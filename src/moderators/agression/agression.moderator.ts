import { Injectable } from '@nestjs/common';
import { AiModelService } from '../../ai-model';
import { TextMessageCtx } from '../../shared';
import { IAnalyzeResult } from '../analyze-prompt.const';
import { IModerator, ModeratorAction } from '../shared';
import { AGRESSION_CHANGE_MESSAGE_PROMPT } from './constants';

@Injectable()
export class AggressionModerator implements IModerator {
  constructor(private readonly ai: AiModelService) {}

  async *processMessage(ctx: TextMessageCtx, scanResult: IAnalyzeResult) {
    if (scanResult.toxicMessageIds?.length > 0) {
      for (const id of scanResult.toxicMessageIds) {
        yield { action: ModeratorAction.DELETE, messageId: id };
      }
    }

    const aiStream = this.ai.service.stream(
      AGRESSION_CHANGE_MESSAGE_PROMPT(scanResult),
      ctx.message.text,
    );

    for await (const chunk of aiStream) {
      yield {
        action: ModeratorAction.STREAM,
        text: chunk,
      };
    }

    return;
  }
}
