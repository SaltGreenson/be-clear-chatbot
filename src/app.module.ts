import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CacheModule } from '@nestjs/cache-manager';
import { HealthController } from './app.controller';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegramModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
