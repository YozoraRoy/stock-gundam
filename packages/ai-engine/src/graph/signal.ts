export class SignalProcessor {
  process(fullSignal: string): string {
    const match = fullSignal.match(/\*\*Rating\*\*:\s*(\w+)/)
    return match?.[1] ?? 'Hold'
  }
}
