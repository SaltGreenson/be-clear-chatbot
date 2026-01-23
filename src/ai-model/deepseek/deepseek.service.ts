import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { IAiModel } from '../shared';

@Injectable()
export class DeepseekService implements IAiModel {
  private logger = new Logger(DeepseekService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async *stream(
    systemPrompt: string,
    userPrompt: string,
  ): AsyncGenerator<string> {
    this.logger.log({ type: 'stream', systemPrompt, userPrompt });

    try {
      const response = await this.httpService.axiosRef.post(
        this.API_URL,
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
        },
        {
          headers: this.BASE_HEADERS,
          responseType: 'stream',
          timeout: 0,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      const stream = response.data;

      for await (const chunk of stream) {
        const utfChunk = chunk.toString('utf8');

        const lines = utfChunk
          .split('\n')
          .filter((line: string) => line.trim() !== '');

        for (const line of lines) {
          const message = line.replace(/^data: /, '');

          if (message === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(message);

            const content = parsed.choices[0]?.delta?.content || '';

            if (content) {
              yield content;
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      this.logger.error('DeepSeek Stream Error', error);
    }
  }

  async call<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
    const response = await this.request(systemPrompt, userPrompt);

    return response as T | null;
  }

  async request(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<object | null> {
    try {
      this.logger.log({ type: 'request', systemPrompt, userPrompt });

      const response: any = await lastValueFrom(
        this.httpService.post(
          this.API_URL,
          {
            model: 'deepseek-chat',
            messages: [
              { role: 'user', content: userPrompt },
              { role: 'system', content: systemPrompt },
            ],
            temperature: 0.2,
            response_format: {
              type: 'json_object',
            },
          },
          {
            headers: this.BASE_HEADERS,
          },
        ),
      );

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      this.logger.error('DeepSeek Error');

      return null;
    }
  }

  private get API_URL() {
    return 'https://api.deepseek.com/v1/chat/completions';
  }

  private get BASE_HEADERS() {
    const apiKey = this.configService.getOrThrow<string>('DEEPSEEK_API_KEY');

    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
