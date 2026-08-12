import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicContentService } from '../../../../core/services/public-content.service';

@Component({
  selector: 'app-event-feature',
  imports: [AsyncPipe, RouterLink, TranslatePipe],
  templateUrl: './event-feature.html',
})
export class EventFeature {
  @ViewChild('posterDialog') private posterDialog?: ElementRef<HTMLDialogElement>;

  private readonly content = inject(PublicContentService);
  private readonly i18n = inject(I18nService);
  readonly mediaMode = signal<'poster' | 'video'>('poster');
  readonly event$ = this.content.getSiteSettings().pipe(
    map((settings) => settings.featuredChampionship ?? fallbackChampionship),
    catchError(() => of(fallbackChampionship)),
  );

  statusLabel(status: ChampionshipContent['status']): string {
    return this.i18n.translate(`home.event.status.${status}`);
  }

  localizedDescription(event: ChampionshipContent): string {
    return this.i18n.localized(event.description, event.descriptionEn);
  }

  localizedSummary(event: ChampionshipContent): string {
    return this.i18n.localized(event.summary, event.summaryEn);
  }

  localizedCoverAlt(event: ChampionshipContent): string {
    return this.i18n.localized(event.coverAlt, event.coverAltEn);
  }

  formattedDate(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  selectMedia(mode: 'poster' | 'video'): void {
    this.mediaMode.set(mode);
  }

  openPoster(): void {
    const dialog = this.posterDialog?.nativeElement;
    if (!dialog) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  }

  closePoster(): void {
    const dialog = this.posterDialog?.nativeElement;
    if (!dialog) return;
    try {
      dialog.close();
    } catch {
      dialog.removeAttribute('open');
    }
  }

  closePosterFromBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target === this.posterDialog?.nativeElement ||
      target?.classList.contains('home-event-poster-dialog-content')
    ) {
      this.closePoster();
    }
  }
}

const fallbackChampionship: ChampionshipContent = {
  id: 'fallback',
  externalTournamentId: 42,
  slug: 'candeonato-new-era',
  name: 'Candeonato New Era',
  editionNumber: 8,
  subtitle: 'New Era Edition',
  season: '2026',
  summary: null,
  description: null,
  descriptionEn: null,
  summaryEn: null,
  coverUrl: '/media/hero-poster.webp',
  coverMobileUrl: '/media/hero-poster-mobile.webp',
  coverAlt: null,
  coverAltEn: null,
  backgroundVideoUrl: '/media/hero-optimized.mp4',
  backgroundVideoMimeType: 'video/mp4',
  startAt: null,
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
  updatedByName: null,
};
