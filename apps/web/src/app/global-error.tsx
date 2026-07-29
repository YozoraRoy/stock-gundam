'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 antialiased">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold">系統遇到嚴重錯誤</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error.message || '應用程式遇到了全域嚴重錯誤，請重試。'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            重置應用程式
          </button>
        </div>
      </body>
    </html>
  )
}
