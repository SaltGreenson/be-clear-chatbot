import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AggressionAnalyzer {
  private readonly logger = new Logger(AggressionAnalyzer.name);
  private readonly deepSeekUrl = 'https://api.deepseek.com/v1/chat/completions';
  private readonly apiKey: string;

  // Белый список слов, которые похожи на мат, но ими не являются
  private readonly WHITE_LIST = ['есть', 'быть', 'команда', 'хотя', 'тоже'];

  // Используем корни слов для более широкого охвата
  private readonly BANNED_VOCABULARY = [
    'хуй',
    'хуя',
    'хуе',
    'хуи',
    'хул',
    'пизд',
    'пздц',
    'ебат',
    'ебал',
    'ебу',
    'еблан',
    'ебт',
    'сука',
    'суч',
    'бля',
    'блж',
    'хуйни',
    'хуйня',
    'заеб',
    'отъеб',
    'наху',
  ];

  private readonly HOMOGLYPHS: Record<string, string> = {
    a: 'а',
    b: 'в',
    e: 'е',
    k: 'к',
    m: 'м',
    h: 'н',
    o: 'о',
    p: 'р',
    c: 'с',
    t: 'т',
    y: 'у',
    x: 'х',
    '0': 'о',
    '3': 'з',
    '4': 'ч',
    '6': 'б',
    u: 'у',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.getOrThrow<string>('DEEPSEEK_API_KEY');
  }

  async processMessage(
    content: string,
  ): Promise<{ isAggressive: boolean; content: string }> {
    // 1. Быстрая локальная проверка (мат, обходы, растягивание букв)
    const hasProfanity = this.checkWithProfanityFilter(content);

    if (hasProfanity) {
      this.logger.warn(`Фильтр сработал на: "${content}"`);
      const rephrased = await this.rephraseMessage(content);
      return { content: rephrased, isAggressive: true };
    }

    // 2. AI проверка на токсичность и скрытую агрессию
    // Если AI говорит "YES", он сразу возвращает и исправленный текст (оптимизация)
    const aiResult = await this.analyzeWithAI(content);

    if (aiResult.isAggressive) {
      return { isAggressive: true, content: aiResult.correctedText };
    }

    return { content, isAggressive: false };
  }

  /**
   * Улучшенная нормализация: замена символов + удаление лишних повторов
   */
  private normalizeAndCollapse(text: string): string {
    let normalized = text.toLowerCase();

    for (const [latin, cyrillic] of Object.entries(this.HOMOGLYPHS)) {
      normalized = normalized.replace(new RegExp(latin, 'g'), cyrillic);
    }

    // Оставляем только буквы
    const clean = normalized.replace(/[^а-яё]/g, '');

    // Схлопываем повторы: "ахуееееено" -> "ахуено"
    return clean.replace(/(.)\1+/g, '$1');
  }

  private checkWithProfanityFilter(text: string): boolean {
    // Проверка 1: Весь текст без пробелов (против "н а х у й")
    const collapsedTotal = this.normalizeAndCollapse(text);

    for (const banned of this.BANNED_VOCABULARY) {
      if (collapsedTotal.includes(banned)) {
        // Проверяем, не является ли это слово частью белого списка
        const isWhiteListed = this.WHITE_LIST.some(
          (white) =>
            collapsedTotal.includes(white) &&
            white.length >= collapsedTotal.length - 1,
        );
        if (!isWhiteListed) return true;
      }
    }

    // Проверка 2: По словам (Левенштейн для опечаток)
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleanWord = this.normalizeAndCollapse(word);
      if (cleanWord.length < 3 || this.WHITE_LIST.includes(cleanWord)) continue;

      for (const banned of this.BANNED_VOCABULARY) {
        const distance = this.getLevenshteinDistance(cleanWord, banned);

        // Более строгие пороги: только 1 опечатка для коротких матов
        const threshold = banned.length > 5 ? 2 : 1;
        if (distance <= threshold) return true;
      }
    }

    return false;
  }

  private getLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Оптимизированный запрос к AI: проверка + исправление за один раз
   */
  private async analyzeWithAI(
    content: string,
  ): Promise<{ isAggressive: boolean; correctedText: string }> {
    const prompt = `Анализируй сообщение на токсичность и агрессию. 
    Если сообщение доброе и нормальное, ответь "CLEAN". 
    Если есть агрессия, мат или токсичность, ответь в формате: FIXED: <исправленный вежливый текст>.
    Сообщение: "${content}"`;

    const response = await this.callDeepSeek(prompt);

    if (response.startsWith('FIXED:')) {
      return {
        isAggressive: true,
        correctedText: response.replace('FIXED:', '').trim(),
      };
    }

    return { isAggressive: false, correctedText: content };
  }

  private async rephraseMessage(content: string): Promise<string> {
    const prompt = `Перепиши сообщение максимально вежливо, сохранив суть, но убрав мат и агрессию. Дай только текст ответа.
    Оригинал: "${content}"`;
    return await this.callDeepSeek(prompt);
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    try {
      const response: any = await lastValueFrom(
        this.httpService.post(
          this.deepSeekUrl,
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2, // Уменьшил для стабильности ответов
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      this.logger.error('DeepSeek Error', (error as Error).message);
      this.logger.error(error);
      return 'Давайте общаться вежливее.';
    }
  }
}
