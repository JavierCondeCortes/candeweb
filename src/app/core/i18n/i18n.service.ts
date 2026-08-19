import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import {
  isLanguage,
  Language,
  TRANSLATION_DOMAINS,
  TranslationDomain,
  TranslationParams,
  TranslationTree,
} from './i18n.types';
import homeEs from './translations/es/home_es.json';
import candeonatoEs from './translations/es/candeonato_es.json';
import adminEs from './translations/es/admin_es.json';
import homeEn from './translations/en/home_en.json';
import candeonatoEn from './translations/en/candeonato_en.json';
import adminEn from './translations/en/admin_en.json';

const STORAGE_KEY = 'candeweb.language';
const DICTIONARIES: Record<Language, Record<TranslationDomain, TranslationTree>> = {
  es: { home: homeEs, candeonato: candeonatoEs, admin: adminEs },
  en: { home: homeEn, candeonato: candeonatoEn, admin: adminEn },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly initialLanguage = this.detectInitialLanguage();
  private readonly dictionaries = signal<Record<TranslationDomain, TranslationTree>>(
    DICTIONARIES[this.initialLanguage],
  );
  private readonly languageState = signal<Language>(this.initialLanguage);
  private readonly loadingState = signal(false);

  readonly language = this.languageState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  initialize(): void {
    this.document.documentElement.lang = this.initialLanguage;
  }

  setLanguage(language: Language): void {
    if (language === this.languageState() || this.loadingState()) return;
    this.dictionaries.set(DICTIONARIES[language]);
    this.languageState.set(language);
    this.document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable in privacy modes; the active session still changes language.
    }
  }

  translate(key: string, params: TranslationParams = {}): string {
    const [domain, ...path] = key.split('.');
    if (!TRANSLATION_DOMAINS.includes(domain as TranslationDomain) || path.length === 0) {
      return key;
    }

    let value: string | TranslationTree | undefined =
      this.dictionaries()[domain as TranslationDomain];
    for (const segment of path) {
      if (!value || typeof value === 'string') return key;
      value = value[segment];
    }
    if (typeof value !== 'string') return key;

    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : `{{${name}}}`,
    );
  }

  localized(spanish: string | null | undefined, english: string | null | undefined): string {
    if (this.languageState() === 'en') return english?.trim() || spanish?.trim() || '';
    return spanish?.trim() || english?.trim() || '';
  }

  private detectInitialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) return stored;
    } catch {
      // Fall back to browser preference when storage is unavailable.
    }
    return 'es';
  }
}
