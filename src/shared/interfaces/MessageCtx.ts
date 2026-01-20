import { Context, NarrowedContext } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';

export type MessageCtx = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message>
> &
  Message.TextMessage;

export type TextMessageCtx = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Record<'text', string> & Message.TextMessage>
>;
