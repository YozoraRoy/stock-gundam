import type { Locale } from './config'

export interface Dict {
  common: {
    home: string
    analyze: string
    oddLot: string
    portfolio: string
    backtest: string
    login: string
    logout: string
    loading: string
    backToHome: string
    myAnalysis: string
    quotaRemaining: string
    brandTagline: string
  }
  footer: {
    privacy: string
    terms: string
    about: string
  }
  nav: {
    home: string
    analyze: string
    oddLot: string
    portfolio: string
    backtest: string
  }
  switcher: {
    label: string
  }
  home: {
    hero: string
    aiAnalyzeTitle: string
    aiAnalyzeDesc: string
    oddLotTitle: string
    oddLotDesc: string
    portfolioTitle: string
    portfolioDesc: string
    backtestTitle: string
    backtestDesc: string
    optionsTitle: string
    optionsDesc: string
    agentTitle: string
    agentDesc: string
    inDevelopment: string
  }
  about: {
    title: string
    hero1: string
    hero2: string
    methodTitle: string
    methodIntro: string
    methodBias: string
    methodBiasLabel: string
    methodBiasLink: string
    methodOddLot: string
    methodOddLotLabel: string
    methodOddLotLink: string
    methodPortfolio: string
    methodPortfolioLabel: string
    methodPortfolioLink: string
    methodAi: string
    methodAiLabel: string
    methodAiLink: string
    featuresTitle: string
    featureAi: string
    featureOddLot: string
    featurePortfolio: string
    featureBacktest: string
    startTitle: string
    step1Title: string
    step1Desc: string
    step1Cta: string
    step2Title: string
    step2Desc: string
    step2Cta: string
    step3Title: string
    step3Desc: string
    step3Cta: string
    closing: string
    techTitle: string
    techFrontend: string
    techBackend: string
    techAi: string
    techData: string
    openSourceTitle: string
    openSourceDesc: string
    disclaimerTitle: string
    disclaimerDesc: string
  }
  login: {
    title: string
    subtitle: string
    google: string
    line: string
    devLogin: string
    note1: string
    note2: string
    checking: string
    devLoginError: string
  }
  privacy: {
    title: string
    s1Title: string
    s1p1: string
    s1p2: string
    s2Title: string
    s2p1: string
    s2li1: string
    s2li2: string
    s3Title: string
    s3p1: string
    s4Title: string
    s4p1: string
    s5Title: string
    s5p1: string
    s6Title: string
    s6p1: string
    s7Title: string
    s7p1: string
    updated: string
  }
  terms: {
    title: string
    s1Title: string
    s1p1: string
    s2Title: string
    s2p1: string
    s2p2: string
    s3Title: string
    s3p1: string
    s3li1: string
    s3li2: string
    s3li3: string
    s4Title: string
    s4p1: string
    s5Title: string
    s5p1: string
    s6Title: string
    s6p1: string
    s7Title: string
    s7p1: string
    updated: string
  }
  oddLot: {
    title: string
    subtitle: string
    latestTradingDay: string
    holidayBanner: string
    giftBadge: string
  }
}

export type LocaleDict = Record<Locale, Dict>
