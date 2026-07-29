import type { LLMClient } from '../llm/client.js'

const REFLECTION_PROMPT = `You are a trading analyst reviewing your own past decision now that the outcome is known.
Write exactly 2-4 sentences covering:
1. Was the directional call correct? (cite the alpha figure)
2. Which part of the investment thesis held or failed?
3. One concrete lesson to apply to the next similar analysis.`

export class Reflector {
  constructor(private llm: LLMClient) {}

  async reflect(
    finalDecision: string,
    rawReturn: number,
    alphaReturn: number,
    benchmarkName = 'SPY',
  ): Promise<string> {
    return this.llm.generate(REFLECTION_PROMPT,
      `Raw return: ${(rawReturn * 100).toFixed(1)}%\nAlpha vs ${benchmarkName}: ${(alphaReturn * 100).toFixed(1)}%\n\nFinal Decision:\n${finalDecision}`
    )
  }
}
