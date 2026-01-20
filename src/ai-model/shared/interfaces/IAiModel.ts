export interface IAiModel {
  call: <T extends object>(
    systemPrompt: string,
    userPrompt: string,
  ) => Promise<T | null>;

  stream: (systemPrompt: string, userPrompt: string) => AsyncGenerator<string>;
}
