import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AggressionModerator } from './agression';

@Module({
  exports: [AggressionModerator],
  providers: [AggressionModerator],
  imports: [HttpModule],
})
export class ModeratorModule {}
