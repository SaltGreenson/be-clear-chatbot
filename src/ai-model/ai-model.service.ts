import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepseekService } from './deepseek';
import { IAiModel } from './shared';

@Injectable()
export class AiModelService implements OnModuleInit {
  public service!: IAiModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly deepseekService: DeepseekService,
  ) {}

  onModuleInit() {
    const model = this.configService.get('MODEL');

    if (model === 'DEEPSEEK') {
      this.service = this.deepseekService;
    }

    this.service = this.deepseekService;
  }
}
