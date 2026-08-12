export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export const TRANSLATION_DOMAINS = ['home', 'candeonato', 'admin'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type TranslationDomain = (typeof TRANSLATION_DOMAINS)[number];
export type TranslationParams = Record<string, string | number | null | undefined>;
export type TranslationTree = { [key: string]: string | TranslationTree };

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}
