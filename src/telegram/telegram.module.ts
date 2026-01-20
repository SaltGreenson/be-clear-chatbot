import { Module } from '@nestjs/common';
import { ModeratorModule } from '../moderators';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ModeratorModule],
  providers: [TelegramService],
})
export class TelegramModule {}
