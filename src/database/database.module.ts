import { Module } from '@nestjs/common';
import { MessageService } from './services/message.service';

@Module({
  providers: [MessageService],
  exports: [MessageService],
})
export class DatabaseModule {}
