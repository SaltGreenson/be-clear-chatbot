import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Context, NarrowedContext, Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { AggressionModerator } from '../moderators/agression';

@Injectable()
export class TelegramService {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aggressionModerator: AggressionModerator,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token);
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

  private async saveHistory(
    ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
  ) {
    if (!('text' in ctx.message)) {
      return false;
    }

    const messageId = ctx.message.message_id;
    const message = ctx.message.text;
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || ctx.from.username;
    const chatId = ctx.chat.id;

    const lastKey = `${chatId}-${userId}-last`;

    await this.cacheManager.set(lastKey, message, 180);

    return false;
  }

  private setupHandlers() {
    // Команда /start
    this.bot.start((ctx) => this.handleStart(ctx));

    // Обработка сообщений
    this.bot.on('message', async (ctx) => {
      if (!('text' in ctx.message)) return;

      const isRemove = await this.saveHistory(ctx);

      const messageId = ctx.message.message_id;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username;
      const colorizedPrefix = userName?.startsWith('V') ? '🔵🔵🔵' : '🟣🟣🟣'; // TODO: change
      const text = ctx.message.text;
      const botUsername = ctx.botInfo.username;
      const isMentioned = text.includes(`@${botUsername}`);
      const isPrivate = ctx.chat.type === 'private';

      if (text.startsWith('/')) return;

      if (isPrivate || isMentioned) {
        // Убираем имя бота из текста, если это упоминание
        const prompt = text.replace(`@${botUsername}`, '').trim();

        if (prompt.length > 0) {
          // Показываем статус "печатает..."
          await ctx.sendChatAction('typing');

          const aiResponse =
            await this.aggressionModerator.callDeepSeek(prompt);

          await ctx.reply(aiResponse, {
            parse_mode: 'Markdown',
            reply_parameters: {
              message_id: ctx.message.message_id,
            },
          });
          return;
        }
      }

      try {
        // 1. Анализ
        const analysis = await this.aggressionModerator.processMessage(text);

        if (analysis.isAggressive) {
          try {
            await ctx.deleteMessage(messageId);
          } catch (e) {
            this.logger.error(
              'Не удалось удалить сообщение. Проверьте права администратора.',
            );
            return;
          }

          if (analysis.content) {
            await ctx.reply(
              `${colorizedPrefix} **${userName}**: \n"${analysis.content}"`,
              {
                parse_mode: 'Markdown',
                disable_notification: true,
              },
            );
          }
        }
      } catch (e) {
        this.logger.error(
          `Ошибка при обработке сообщения: ${(e as Error).message}`,
        );
        this.logger.error(e);
      }
    });

    // Callback кнопки
    this.bot.on('callback_query', async (ctx) => {
      // Ваша логика обработки кнопок (replace_ и т.д.)
    });
  }

  private async handleAggressiveMessage(
    ctx: any,
    original: string,
    corrected: string,
    analysis: any,
    hasSwear: boolean,
  ) {
    // Ваша логика с кнопками и ответом пользователю
    // ...
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
