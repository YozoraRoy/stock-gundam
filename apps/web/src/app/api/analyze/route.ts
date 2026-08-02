import { TradingEngine } from '@stock/ai-engine'
import { saveAnalysisRecord } from '@stock/database'

let _engine: TradingEngine | null = null
let _engineError: string | null = null

function getEngine(): TradingEngine {
  if (_engineError) throw new Error(_engineError)
  if (_engine) return _engine
  try {
    _engine = new TradingEngine()
    return _engine
  } catch (e: any) {
    _engineError = `TradingEngine init failed: ${e.message}`
    throw new Error(_engineError)
  }
}

export async function POST(req: Request) {
  try {
    const { symbol, date } = await req.json()
    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 })
    }

    const encoder = new TextEncoder()
    let engine: TradingEngine

    try {
      engine = getEngine()
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          const { state, signal, tokenUsage } = await engine.analyze(
            symbol,
            date ?? new Date().toISOString().split('T')[0],
            (step: string, detail: string) => send('progress', { step, detail }),
          )

          const modelPlan = engine.getModelPlan()
          const resultPayload = {
            signal,
            decision: state.finalDecision,
            tokenUsage,
            modelPlan,
            reports: {
              market: state.marketReport,
              sentiment: state.sentimentReport,
              news: state.newsReport,
              fundamentals: state.fundamentalsReport,
            },
          }

          const fallbackCount = tokenUsage.agents.reduce((n, a) => n + (a.fallbackCalls ?? 0), 0)

          try {
            const decisionObj = typeof state.finalDecision === 'object' ? state.finalDecision : {}
            await saveAnalysisRecord({
              ticker: symbol,
              recommendation: signal || (decisionObj as any)?.rating || (decisionObj as any)?.final_decision || 'Hold',
              summary: (decisionObj as any)?.investmentThesis || (decisionObj as any)?.rationale || (typeof state.finalDecision === 'string' ? state.finalDecision : ''),
              fullReport: resultPayload,
              modelUsage: JSON.stringify(tokenUsage.agents),
              primaryModels: JSON.stringify(modelPlan),
              fallbackUsed: fallbackCount > 0,
              fallbackCount,
            })
          } catch (dbErr) {
            console.error('[API/Analyze] Failed to save analysis record to DB:', dbErr)
          }

          send('result', resultPayload)
        } catch (e: any) {
          send('error', { message: e.message })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
