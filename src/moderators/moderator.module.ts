import { Module } from '@nestjs/common';
import { AiModule } from '../ai-model';
import { DatabaseModule } from '../database';
import { AggressionModerator } from './agression';
import { Moderator } from './moderator.service';

@Module({
  exports: [Moderator],
  providers: [AggressionModerator, Moderator],
  imports: [AiModule, DatabaseModule],
})
export class ModeratorModule {}
