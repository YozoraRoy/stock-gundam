import type { AnalysisState } from '@stock/core'
import type { WorkflowDefinition, AgentNode, GraphEdge } from '../types.js'

export class WorkflowGraph {
  private nodes: Map<string, AgentNode> = new Map()
  private edges: GraphEdge[] = []
  private entryPoint: string = ''

  constructor(def?: WorkflowDefinition) {
    if (def) {
      for (const [name, node] of Object.entries(def.nodes)) {
        this.nodes.set(name, node)
      }
      this.edges = def.edges
      this.entryPoint = def.entryPoint
    }
  }

  addNode(name: string, node: AgentNode) {
    this.nodes.set(name, node)
  }

  addEdge(edge: GraphEdge) {
    this.edges.push(edge)
  }

  setEntryPoint(name: string) {
    this.entryPoint = name
  }

  async execute(initialState: AnalysisState): Promise<AnalysisState> {
    let state = { ...initialState }
    let current = this.entryPoint

    const visited = new Set<string>()

    while (current !== '__end__') {
      if (visited.has(current)) {
        if (current === 'Bull Researcher' || current === 'Bear Researcher') {
          const target = state.investDebate.round % 2 === 0 ? 'Bull Researcher' : 'Bear Researcher'
          if (current === target) {
            const fromEdge = this.edges.find(e => e.from === current)
            if (fromEdge) {
              const next = fromEdge.condition ? fromEdge.condition(state) : fromEdge.to
              current = next
              continue
            }
          }
        }
        if (current === 'Aggressive Analyst' || current === 'Conservative Analyst' || current === 'Neutral Analyst') {
          const fromEdge = this.edges.find(e => e.from === current)
          if (fromEdge) {
            const next = fromEdge.condition ? fromEdge.condition(state) : fromEdge.to
            current = next
            continue
          }
        }
      }

      const node = this.nodes.get(current)
      if (!node) throw new Error(`Node "${current}" not found`)

      visited.add(current)
      const updates = await node(state)
      state = { ...state, ...updates }

      const outgoingEdges = this.edges.filter(e => e.from === current)
      if (outgoingEdges.length === 0) {
        current = '__end__'
      } else if (outgoingEdges.length === 1) {
        current = outgoingEdges[0].to
      } else {
        const chosen = outgoingEdges.find(e => e.condition?.(state) === e.to)
        current = chosen?.to ?? outgoingEdges[0].to
      }
    }

    return state
  }
}
