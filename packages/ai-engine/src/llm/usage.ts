import type { LLMClient, LLMUsage } from './client.js'

export interface AgentUsage {
  agent: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface TokenUsageSummary {
  agents: AgentUsage[]
  total: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class LLMUsageTracker {
  private byAgent = new Map<string, { promptTokens: number; completionTokens: number }>()
  private currentAgent = 'Unknown'

  reset() {
    this.byAgent.clear()
    this.currentAgent = 'Unknown'
  }

  setCurrentAgent(agent: string) {
    this.currentAgent = agent
  }

  private handleUsage = (usage: LLMUsage) => {
    const prompt = usage.promptTokens ?? 0
    const completion = usage.completionTokens ?? 0
    const current = this.byAgent.get(this.currentAgent) ?? { promptTokens: 0, completionTokens: 0 }
    this.byAgent.set(this.currentAgent, {
      promptTokens: current.promptTokens + prompt,
      completionTokens: current.completionTokens + completion,
    })
  }

  attach(client: LLMClient): LLMClient {
    client.onUsage = this.handleUsage
    return client
  }

  getSummary(): TokenUsageSummary {
    const agents: AgentUsage[] = []
    let totalPrompt = 0
    let totalCompletion = 0

    for (const [agent, usage] of this.byAgent) {
      const totalTokens = usage.promptTokens + usage.completionTokens
      agents.push({ agent, ...usage, totalTokens })
      totalPrompt += usage.promptTokens
      totalCompletion += usage.completionTokens
    }

    agents.sort((a, b) => b.totalTokens - a.totalTokens)

    return {
      agents,
      total: {
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        totalTokens: totalPrompt + totalCompletion,
      },
    }
  }
}
