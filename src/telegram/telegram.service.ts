import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { AiModelService } from '../ai-model';
import { MessageService } from '../database';
import { IMessage } from '../database/interfaces';
import { Moderator, ModeratorAction } from '../moderators';
import { TextMessageCtx } from '../shared';

@Injectable()
export class TelegramService {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);
  // private moderationTimers = new Map<number, NodeJS.Timeout>();
  private isProcessing = new Map<number, boolean>();

  constructor(
    private readonly configService: ConfigService,
    private readonly ai: AiModelService,
    private readonly messageDb: MessageService,
    private readonly moderator: Moderator,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token, { handlerTimeout: 900_000 });
  }

  private setupHandlers() {
    this.bot.start((ctx) => this.handleStart(ctx));

    this.bot.on('message', async (_ctx) => {
      if (!('text' in _ctx.message)) {
        return;
      }

      const ctx = _ctx as TextMessageCtx;
      const chatId = ctx.chat.id;

      await this.messageDb.saveMessageFromCtx(ctx);

      const isMentioned = await this.processMentionedMessage(ctx);

      if (isMentioned) {
        return;
      }

      // if (this.moderationTimers.has(chatId)) {
      //   clearTimeout(this.moderationTimers.get(chatId));
      // }

      // const timer = setTimeout(async () => {
      if (this.isProcessing.get(chatId)) {
        this.logger.warn(
          `Модерация чата ${chatId} уже в процессе, пропускаю дубль`,
        );
        return;
      }

      try {
        this.isProcessing.set(chatId, true);
        // this.moderationTimers.delete(chatId);

        await this.processModeration(ctx);
      } catch (e) {
        this.logger.error('Ошибка в процессе отложенной модерации', e);
      } finally {
        this.isProcessing.set(chatId, false);
      }
      // }, 1000);

      // this.moderationTimers.set(chatId, timer);
    });
  }

  private async processModeration(ctx: TextMessageCtx) {
    const moderationStream = this.moderator.processMessage(ctx);
    let lastRemovedMessage: IMessage | null = null;

    const internalStream = async function* (this: TelegramService) {
      const { messages } = await this.messageDb.getMessages(ctx);

      const validIds = new Set(messages.map((m) => m.id));

      validIds.add(ctx.message.message_id);

      for await (const result of moderationStream) {
        if (result.action === ModeratorAction.DELETE) {
          const idToDelete = result.messageId || ctx.message.message_id;

          if (validIds.has(idToDelete)) {
            this.logger.log(`Удаляю сообщение: ${idToDelete}`);

            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, idToDelete);

              const removed = await this.messageDb.delete(ctx, idToDelete);

              if (removed) {
                lastRemovedMessage = removed;
              }
            } catch (err) {
              this.logger.error(
                `Ошибка удаления ${idToDelete}: ${(err as Error).message}`,
              );
            }
          }

          continue;
        }

        if (result.action === ModeratorAction.STREAM && result.text) {
          yield result.text;
        }
      }
    }.bind(this);

    const fullStreamText = await this.streamMessage(
      ctx,
      internalStream(),
      '⏳ *Корректирую...*',
    );

    if (lastRemovedMessage && fullStreamText) {
      (lastRemovedMessage as IMessage).text = fullStreamText;

      await this.messageDb.create(ctx, {
        ...(lastRemovedMessage as IMessage),
        isHistoryOnly: true,
      });
    }
  }

  private async processMentionedMessage(ctx: TextMessageCtx): Promise<boolean> {
    if (!('text' in ctx.message)) {
      return false;
    }

    const text = ctx.message.text;
    const botUsername = ctx.botInfo.username;
    const isMentioned = text.includes(`@${botUsername}`);
    const isPrivate = ctx.chat.type === 'private';

    if (!(isPrivate || isMentioned)) {
      return false;
    }

    const prompt = text.replace(`@${botUsername}`, '').trim();

    if (prompt.length <= 0) {
      return true;
    }

    const stream = await this.ai.service.stream(
      'У тебя IQ 160. Ты считаешься очень умным, помоги пользователю с его запросом. Не задавай в ответе уточняющих вопросов пользователю. Напиши только ответ на его вопрос',
      prompt,
    );

    await this.streamMessage(ctx, stream);

    return true;
  }

  private async streamMessage(
    ctx: Context,
    stream: AsyncGenerator<string>,
    placeholderText: string = '⏳ *Секунду...*',
  ) {
    let fullText = '';
    let displayedText = '';
    let isFinished = false;
    let sentMessage: any = null; // Изначально сообщения нет
    let updateTimer: NodeJS.Timeout | null = null;

    try {
      for await (const chunk of stream) {
        fullText += chunk;

        // Создаем сообщение только при получении первого чанка текста
        if (!sentMessage && fullText.trim().length > 0) {
          sentMessage = await ctx.reply(placeholderText, {
            parse_mode: 'Markdown',
            disable_notification: true,
          });

          // Запускаем таймер обновления только после того, как сообщение создано
          // updateTimer = setInterval(async () => {
          if (
            fullText !== displayedText &&
            fullText.trim().length > 0 &&
            sentMessage
          ) {
            const textToSet = isFinished ? fullText : fullText + ' ▎';
            try {
              await ctx.sendChatAction('typing');
              await ctx.telegram.editMessageText(
                sentMessage.chat.id,
                sentMessage.message_id,
                undefined,
                textToSet,
                { parse_mode: 'Markdown' },
              );
              displayedText = fullText;
            } catch (e) {
              await ctx.telegram
                .editMessageText(
                  sentMessage.chat.id,
                  sentMessage.message_id,
                  undefined,
                  textToSet,
                )
                .catch(() => {});
            }
          }

          if (isFinished && fullText === displayedText && updateTimer) {
            clearInterval(updateTimer);
          }
          // }, 2000);
        }
      }

      isFinished = true;

      return fullText;
    } catch (e) {
      this.logger.error('Stream error', e);

      isFinished = true;

      if (updateTimer) clearInterval(updateTimer);

      if (sentMessage) {
        await ctx.reply('⚠️ Произошла ошибка при загрузке данных.');
      }

      return null;
    }
  }

  onModuleInit() {
    this.setupHandlers();
    this.launch();
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Telegram Bot...');

    await this.bot.stop('SIGTERM');

    this.logger.log('Bot stopped successfully');
  }

  private handleStart(ctx: Context) {
    ctx.reply('🤖 Бот модератор запущен и готов к работе!');
  }

  private launch() {
    this.bot.launch();
    this.logger.log('🚀 Telegram Bot успешно запущен');

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}
