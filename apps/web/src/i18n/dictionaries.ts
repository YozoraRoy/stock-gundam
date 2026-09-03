import type { Locale } from './config'
import type { Dict } from './dictionary-types'
import { zhTW } from './locales/zh-TW'
import { en } from './locales/en'
import { ja } from './locales/ja'

export type { Dict, LocaleDict } from './dictionary-types'
export type { Locale }

export const dictionaries: Record<Locale, Dict> = {
  'zh-TW': zhTW,
  en,
  ja,
}
