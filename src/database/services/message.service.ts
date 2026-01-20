import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { TextMessageCtx } from '../../shared';
import { IMessage } from '../interfaces';

@Injectable()
export class MessageService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async saveMessage(ctx: TextMessageCtx) {
    const key = this.getHistoryKey(ctx);

    const { messages } = await this.getMessages(ctx);

    const message: IMessage = {
      id: ctx.message.message_id,
      text: ctx.message.text,
      timestamp: new Date().getTime(),
      userName: ctx.from.first_name || ctx.from.username || 'Guest',
    };

    messages.unshift(message);

    await this.cache.set(
      key,
      messages.slice(0, this.MAX_HISTORY_SIZE),
      this.TTL,
    );

    return message;
  }

  async getMessages(
    ctx: TextMessageCtx,
  ): Promise<{ messages: IMessage[]; isFullHistory: boolean }> {
    const key = this.getHistoryKey(ctx);

    const messages = (await this.cache.get<IMessage[]>(key)) || [];

    const isFullHistory = (messages.length / this.MAX_HISTORY_SIZE) * 100 > 50;

    console.log(
      'isFullHistory',
      isFullHistory,
      ((this.MAX_HISTORY_SIZE - messages.length) / this.MAX_HISTORY_SIZE) * 100,
    );

    return {
      messages,
      isFullHistory,
    };
  }

  async bulkDelete(ctx: TextMessageCtx, messageIds: number[]) {
    const { messages } = await this.getMessages(ctx);

    const newMessages = messages.filter(
      (m) => !messageIds.some((id) => m.id === id),
    );

    const key = this.getHistoryKey(ctx);

    await this.cache.set(key, newMessages, this.TTL);
  }

  async stringifiedMessages(
    ctx: TextMessageCtx,
  ): Promise<{ stringifiedMessage: string; isFullHistory: boolean }> {
    const { messages, isFullHistory } = await this.getMessages(ctx);
    console.log('messsages length', messages.length);
    const strMessages = messages
      .map((m) => `[ID: ${m.id}, User: ${m.userName}]: ${m.text}`)
      .join('\n');

    return { stringifiedMessage: strMessages, isFullHistory };
  }

  private getHistoryKey(ctx: TextMessageCtx) {
    return `${ctx.chat.id}_chat_history`;
  }

  private get MAX_HISTORY_SIZE() {
    return 50;
  }

  private get TTL() {
    return 86400 * 1000; // 1 day
  }
}
