import type { LLMCallInfo, LLMClient, LLMUsage } from './client.js'

export interface AgentUsage {
  agent: string
  /** Model that served the agent's calls (primary or fallback). */
  model: string | null
  /** Whether any call for this agent fell back to the secondary model. */
  usedFallback: boolean
  /** Number of calls that engaged the fallback model. */
  fallbackCalls: number
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

interface AgentState {
  promptTokens: number
  completionTokens: number
  model: string | null
  fallbackCalls: number
}

export class LLMUsageTracker {
  private byAgent = new Map<string, AgentState>()
  private currentAgent = 'Unknown'

  reset() {
    this.byAgent.clear()
    this.currentAgent = 'Unknown'
  }

  setCurrentAgent(agent: string) {
    this.currentAgent = agent
  }

  private getOrInit(agent: string): AgentState {
    const current = this.byAgent.get(agent)
    if (current) return current
    const fresh: AgentState = { promptTokens: 0, completionTokens: 0, model: null, fallbackCalls: 0 }
    this.byAgent.set(agent, fresh)
    return fresh
  }

  private handleUsage = (usage: LLMUsage) => {
    const current = this.getOrInit(this.currentAgent)
    current.promptTokens += usage.promptTokens ?? 0
    current.completionTokens += usage.completionTokens ?? 0
  }

  private handleCall = (info: LLMCallInfo) => {
    const current = this.getOrInit(this.currentAgent)
    current.model = info.model
    if (info.usedFallback) current.fallbackCalls++
  }

  attach(client: LLMClient): LLMClient {
    client.onUsage = this.handleUsage
    client.onCall = this.handleCall
    return client
  }

  /** 回傳單一 agent 的用量快照；不存在時回傳 null。 */
  getAgent(agent: string): AgentUsage | null {
    const usage = this.byAgent.get(agent)
    if (!usage) return null
    const totalTokens = usage.promptTokens + usage.completionTokens
    return {
      agent,
      model: usage.model,
      usedFallback: usage.fallbackCalls > 0,
      fallbackCalls: usage.fallbackCalls,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens,
    }
  }

  getSummary(): TokenUsageSummary {
    const agents: AgentUsage[] = []
    let totalPrompt = 0
    let totalCompletion = 0

    for (const [agent, usage] of this.byAgent) {
      const totalTokens = usage.promptTokens + usage.completionTokens
      agents.push({
        agent,
        model: usage.model,
        usedFallback: usage.fallbackCalls > 0,
        fallbackCalls: usage.fallbackCalls,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens,
      })
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
