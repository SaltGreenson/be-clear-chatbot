import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AiModelService } from './ai-model.service';
import { DeepseekService } from './deepseek';

@Module({
  imports: [HttpModule],
  providers: [DeepseekService, AiModelService],
  exports: [AiModelService],
})
export class AiModule {}
