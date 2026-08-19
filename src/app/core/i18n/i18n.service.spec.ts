import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import adminEn from './translations/en/admin_en.json';
import candeonatoEn from './translations/en/candeonato_en.json';
import homeEn from './translations/en/home_en.json';
import adminEs from './translations/es/admin_es.json';
import candeonatoEs from './translations/es/candeonato_es.json';
import homeEs from './translations/es/home_es.json';

function translationKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => translationKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.removeItem('candeweb.language');
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.removeItem('candeweb.language'));

  it('starts in Spanish and translates nested keys with parameters', () => {
    const service = TestBed.inject(I18nService);

    expect(service.language()).toBe('es');
    expect(service.translate('home.footer.legal', { year: 2026 })).toContain('2026');
    expect(service.translate('home.nav.community')).toBe('Comunidad');
  });

  it('switches instantly to English, persists the choice and updates the document language', () => {
    const service = TestBed.inject(I18nService);

    service.setLanguage('en');

    expect(service.translate('home.nav.community')).toBe('Community');
    expect(service.localized('Descripción', 'Description')).toBe('Description');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('candeweb.language')).toBe('en');
  });

  it('falls back to Spanish when English editorial content is empty', () => {
    const service = TestBed.inject(I18nService);
    service.setLanguage('en');

    expect(service.localized('Texto original', null)).toBe('Texto original');
  });

  it.each([
    ['home', homeEs, homeEn],
    ['candeonato', candeonatoEs, candeonatoEn],
    ['admin', adminEs, adminEn],
  ])('keeps the Spanish and English %s dictionaries in sync', (_, spanish, english) => {
    expect(translationKeys(english)).toEqual(translationKeys(spanish));
  });
});
