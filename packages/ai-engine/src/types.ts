import type { AnalysisState } from '@stock/core'

export type AgentNode = (state: AnalysisState) => Promise<Partial<AnalysisState>>

export interface AgentFactory {
  createAgent(type: string, llm: any, tools?: any[]): AgentNode
}

export interface GraphEdge {
  from: string
  to: string
  condition?: (state: AnalysisState) => string
}

export interface WorkflowDefinition {
  nodes: Record<string, AgentNode>
  edges: GraphEdge[]
  entryPoint: string
}
