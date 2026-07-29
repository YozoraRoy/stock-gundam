import { TradingEngine } from '@stock/ai-engine'
import { saveAnalysisRecord } from '@stock/database'

const engine = new TradingEngine()

export async function POST(req: Request) {
  const { symbol, date } = await req.json()
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const { state, signal } = await engine.analyze(
          symbol,
          date ?? new Date().toISOString().split('T')[0],
          (step: string, detail: string) => send('progress', { step, detail }),
        )

        const resultPayload = {
          signal,
          decision: state.finalDecision,
          reports: {
            market: state.marketReport,
            sentiment: state.sentimentReport,
            news: state.newsReport,
            fundamentals: state.fundamentalsReport,
          },
        }

        try {
          const decisionObj = typeof state.finalDecision === 'object' ? state.finalDecision : {}
          await saveAnalysisRecord({
            ticker: symbol,
            recommendation: signal || (decisionObj as any)?.rating || (decisionObj as any)?.final_decision || 'Hold',
            summary: (decisionObj as any)?.investmentThesis || (decisionObj as any)?.rationale || (typeof state.finalDecision === 'string' ? state.finalDecision : ''),
            fullReport: resultPayload,
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
}
