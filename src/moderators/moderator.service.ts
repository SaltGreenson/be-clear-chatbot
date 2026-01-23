import { Injectable, Logger } from '@nestjs/common';
import { AiModelService } from '../ai-model';
import { MessageService } from '../database';
import { TextMessageCtx } from '../shared';
import { AggressionModerator } from './agression';
import { ANALYZE_PROMPT, IAnalyzeResult } from './analyze-prompt.const';
import { profanityFilter } from './filters';
import {
  IModerator,
  IModeratorResult,
  ModeratorAction,
  ModeratorStatus,
} from './shared';

@Injectable()
export class Moderator implements IModerator {
  private readonly logger = new Logger(Moderator.name);

  constructor(
    private readonly ai: AiModelService,
    private readonly messageDb: MessageService,
    private readonly aggressionModerator: AggressionModerator,
  ) {}

  async *processMessage(ctx: TextMessageCtx): AsyncGenerator<IModeratorResult> {
    const isSpam = await this.messageDb.isSpamLastMessage(ctx);
    await this.messageDb.saveLastUserMessage(ctx);

    if (isSpam) {
      this.logger.warn(
        `Спам сообщение: "${ctx.message.from.first_name || ctx.message.from.username}: ${ctx.message.text}"`,
      );
      yield { action: ModeratorAction.DELETE };
      return;
    }

    const hasProfanity = profanityFilter(ctx.message.text);

    if (hasProfanity) {
      this.logger.warn(`Фильтр сработал на: "${ctx.message.text}"`);

      yield { action: ModeratorAction.DELETE };
      return;
    }

    const { stringifiedMessage, isFullHistory } =
      await this.messageDb.stringifiedMessages(ctx);

    if (!isFullHistory) {
      yield { action: ModeratorAction.KEEP };
      return;
    }

    const prompt = `История сообщений: 
    ${stringifiedMessage}
    `;

    const analyze = await this.ai.service.call<IAnalyzeResult>(
      ANALYZE_PROMPT,
      prompt,
    );

    this.logger.log('Analyze result', analyze);

    if (analyze?.status === ModeratorStatus.AGRESSIVE) {
      return yield* this.aggressionModerator.processMessage(ctx, analyze);
    }

    return { action: ModeratorAction.KEEP };
  }
}
