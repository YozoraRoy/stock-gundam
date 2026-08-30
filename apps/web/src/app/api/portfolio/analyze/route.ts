import { runPortfolioAnalysis, INVESTMENT_FRAMEWORKS, getFramework } from '@stock/ai-engine'
import { savePortfolioRecord, consumeAnalysisQuota } from '@stock/database'
import { DAILY_ANALYSIS_LIMIT, getCurrentUserFromCookies, getTaiwanDateStr } from '../../../../lib/auth'
import { buildMarketContext, computePnL, validatePortfolioInput } from '../../../../lib/portfolio'

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromCookies()
    if (!user) {
      return new Response(JSON.stringify({ error: 'login required' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    const parsed = validatePortfolioInput(body)
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const strategyId = typeof body?.strategyId === 'string' ? body.strategyId : ''
    if (!INVESTMENT_FRAMEWORKS.some(f => f.id === strategyId)) {
      return new Response(JSON.stringify({ error: '請選擇有效的投資法則' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const quota = await consumeAnalysisQuota(user.id, getTaiwanDateStr(), DAILY_ANALYSIS_LIMIT)
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: `今日 AI 分析額度已用完（${quota.used}/${quota.max}），請明天再試`,
          quota,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { market, symbol, shares, cost, currentPrice, dividend, symbolName } = parsed.data
    const pnl = computePnL(parsed.data)
    const framework = getFramework(strategyId)

    const encoder = new TextEncoder()
    const marketContext = await buildMarketContext(symbol, market)

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          const { advice, modelPlan, usedFallback } = await runPortfolioAnalysis({
            market,
            symbol,
            symbolName,
            shares,
            cost,
            currentPrice,
            dividend,
            costBasis: pnl.costBasis,
            marketValue: pnl.marketValue,
            unrealizedPnl: pnl.unrealizedPnl,
            unrealizedPnlPct: pnl.unrealizedPnlPct,
            totalReturn: pnl.totalReturn,
            totalReturnPct: pnl.totalReturnPct,
            yieldOnCost: pnl.yieldOnCost,
            strategyId,
            marketContext,
            onProgress: (step, detail) => send('progress', { step, detail }),
          })

          const resultPayload = {
            advice,
            modelPlan,
            usedFallback,
            strategy: { id: framework.id, nameZh: framework.nameZh, nameEn: framework.nameEn },
            position: { market, symbol, symbolName, shares, cost, currentPrice, dividend, ...pnl },
          }

          try {
            await savePortfolioRecord({
              user_id: user.id,
              market,
              symbol,
              symbolName,
              shares,
              cost,
              currentPrice,
              dividend,
              costBasis: pnl.costBasis,
              marketValue: pnl.marketValue,
              unrealizedPnl: pnl.unrealizedPnl,
              unrealizedPnlPct: pnl.unrealizedPnlPct,
              totalReturn: pnl.totalReturn,
              totalReturnPct: pnl.totalReturnPct,
              yieldOnCost: pnl.yieldOnCost,
              strategy: framework.id,
              recommendation: advice.rating,
              summary: advice.summary,
              reportJson: JSON.stringify(resultPayload),
            })
          } catch (dbErr) {
            console.error('[API/Portfolio/Analyze] Failed to save record to DB:', dbErr)
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