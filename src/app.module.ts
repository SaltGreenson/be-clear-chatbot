import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CacheModule } from '@nestjs/cache-manager';
import { HealthController } from './app.controller';
import { AggressionAnalyzer } from './bot/moderators/agression.analyzer';
import { TelegramBotService } from './bot/telegram-bot.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({}),
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [AggressionAnalyzer, TelegramBotService],
})
export class AppModule {}
