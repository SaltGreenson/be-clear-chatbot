import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { AggressionAnalyzer } from './moderators/agression.analyzer';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramBotService.name);

  // Временное хранилище (в идеале заменить на TypeORM/Prisma + Redis)
  private userStats: Map<number, { warnings: number; corrected: number }> =
    new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly aggressionAnalyzer: AggressionAnalyzer,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token);
  }

  onModuleInit() {
    this.setupHandlers();
    this.launch();
  }

  private setupHandlers() {
    // Команда /start
    this.bot.start((ctx) => this.handleStart(ctx));

    // Обработка сообщений
    this.bot.on('message', async (ctx) => {
      if (!('text' in ctx.message)) return;

      const messageId = ctx.message.message_id;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username;
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      try {
        // 1. Анализ
        const analysis = await this.aggressionAnalyzer.processMessage(text);

        if (analysis.isAggressive) {
          try {
            await ctx.deleteMessage(messageId);
          } catch (e) {
            this.logger.error(
              'Не удалось удалить сообщение. Проверьте права администратора.',
            );
            return;
          }

          await ctx.reply(
            `✨ **${userName}** (вежливо): \n"${analysis.content}"`,
            { parse_mode: 'Markdown' },
          );
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
