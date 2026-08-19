import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';

import { Hero } from './hero';

describe('Hero', () => {
  let component: Hero;
  let fixture: ComponentFixture<Hero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hero],
      providers: [provideRouter([{ path: 'candeonato', component: Hero }])],
    }).compileComponents();

    fixture = TestBed.createComponent(Hero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps a single stable heading and provides optimized video sources', () => {
    fixture.componentRef.setInput('championship', newEraChampionship);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const headings = host.querySelectorAll('h1');
    const video = host.querySelector('video');

    expect(headings.length).toBe(1);
    expect(headings[0].getAttribute('aria-label')).toBe('CANDEONATO');
    expect(video?.hasAttribute('muted')).toBe(true);
    expect(video?.preload).toBe('metadata');
    expect(host.querySelector('source[src$="hero-optimized.mp4"]')).toBeTruthy();

    const brand = host.querySelector<HTMLAnchorElement>('a.brand');
    expect(brand?.getAttribute('aria-label')).toContain(brand?.textContent?.trim());
  });

  it('hides the interface from view and focus while preserving media controls', () => {
    fixture.componentRef.setInput('championship', newEraChampionship);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const viewingButton = host.querySelectorAll<HTMLButtonElement>('.control-button')[2];

    viewingButton.click();
    fixture.detectChanges();

    expect(component.isVideoFocusMode()).toBe(true);
    expect(host.querySelector('.hero')?.classList.contains('video-focus-mode')).toBe(true);
    expect(host.querySelector('.hero-nav')?.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.hero-content')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.control-button').length).toBe(3);
    expect(viewingButton.getAttribute('aria-label')).toBe('Volver a mostrar la interfaz');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isVideoFocusMode()).toBe(false);
    expect(host.querySelector('.hero-nav')?.hasAttribute('inert')).toBe(false);
  });

  it('opens and closes the mobile navigation accessibly', async () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const menuButton = host.querySelector<HTMLButtonElement>('.hero-menu-button');
    const firstLink = host.querySelector<HTMLAnchorElement>('.nav-links a');

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');

    menuButton?.click();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(true);
    expect(host.querySelector('.hero-nav')?.classList.contains('menu-open')).toBe(true);
    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');

    firstLink?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);

    menuButton?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses only the poster when an edition has no background video', () => {
    fixture.componentRef.setInput('championship', {
      ...newEraChampionship,
      backgroundVideoUrl: null,
      backgroundVideoMimeType: null,
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('video')).toBeNull();
    expect(host.querySelector('app-sound-switch')).toBeNull();
    expect(host.querySelector<HTMLImageElement>('.hero-poster img')?.src).toContain(
      'hero-poster.webp',
    );
  });
});

const newEraChampionship: ChampionshipContent = {
  id: 'new-era',
  externalTournamentId: 42,
  slug: 'candeonato-new-era',
  name: 'Candeonato New Era',
  editionNumber: 8,
  subtitle: 'New Era Edition',
  season: '2026',
  summary: 'Una nueva era del Candeonato.',
  description: 'Descripción de la edición.',
  coverUrl: '/media/hero-poster.webp',
  coverMobileUrl: '/media/hero-poster-mobile.webp',
  coverAlt: 'Mazda MX-5 de la edición New Era',
  backgroundVideoUrl: '/media/hero-optimized.mp4',
  backgroundVideoMimeType: 'video/mp4',
  startAt: '2026-09-04T18:00:00+02:00',
  endAt: null,
  registrationUrl: null,
  rulesUrl: null,
  status: 'finished',
  isFeatured: true,
  displayOrder: 0,
  publishedAt: null,
  lastSyncedAt: null,
  syncStatus: 'never',
  syncError: null,
  createdAt: '',
  updatedAt: '',
};
