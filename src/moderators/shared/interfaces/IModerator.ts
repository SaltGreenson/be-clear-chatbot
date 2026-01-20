import { TextMessageCtx } from '../../../shared';
import { IAnalyzeResult } from '../../analyze-prompt.const';

export enum ModeratorStatus {
  AGRESSIVE = 'AGRESSIVE',
  NEUTRAL = 'NEUTRAL',
  THANKFUL = 'THANKFUL',
  SEXUAL = 'SEXUAL',
}

export type ModeratorStatusType = Partial<Record<ModeratorStatus, boolean>>;

export enum ModeratorAction {
  DELETE = 'DELETE',
  KEEP = 'KEEP',
  STREAM = 'STREAM',
}

export interface IModeratorResult {
  action: ModeratorAction;
  text?: string;
  messageId?: number;
}

export interface IModerator {
  processMessage: (
    ctx: TextMessageCtx,
    scanResult: IAnalyzeResult,
  ) => AsyncGenerator<IModeratorResult>;
}
