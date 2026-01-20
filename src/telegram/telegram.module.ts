import { Module } from '@nestjs/common';
import { AiModule } from '../ai-model';
import { DatabaseModule } from '../database/database.module';
import { ModeratorModule } from '../moderators';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ModeratorModule, AiModule, DatabaseModule, ModeratorModule],
  providers: [TelegramService],
})
export class TelegramModule {}
