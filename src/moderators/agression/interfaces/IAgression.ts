export interface IAgressionPromptResult {
  is_toxic_to_partner: boolean;
  confidence_score: number;
  suggested_text?: string;
  reasoning: string;
}
