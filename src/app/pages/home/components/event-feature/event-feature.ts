import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { PublicContentService } from '../../../../core/services/public-content.service';

@Component({
  selector: 'app-event-feature',
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './event-feature.html',
})
export class EventFeature {
  @ViewChild('posterDialog') private posterDialog?: ElementRef<HTMLDialogElement>;

  private readonly content = inject(PublicContentService);
  readonly mediaMode = signal<'poster' | 'video'>('poster');
  readonly event$ = this.content.getSiteSettings().pipe(
    map((settings) => settings.featuredChampionship ?? fallbackChampionship),
    catchError(() => of(fallbackChampionship)),
  );

  statusLabel(status: ChampionshipContent['status']): string {
    return CHAMPIONSHIP_STATUS_LABELS[status];
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

const CHAMPIONSHIP_STATUS_LABELS: Record<ChampionshipContent['status'], string> = {
  draft: 'Borrador',
  registration: 'Inscripciones abiertas',
  active: 'En curso',
  finished: 'Finalizado',
  archived: 'Archivado',
};

const fallbackChampionship: ChampionshipContent = {
  id: 'fallback',
  externalTournamentId: 42,
  slug: 'candeonato-new-era',
  name: 'Candeonato New Era',
  editionNumber: 8,
  subtitle: 'New Era Edition',
  season: '2026',
  summary:
    'Cada cierto tiempo, Candemor organiza el Candeonato: un campeonato con distintas carreras, posiciones y puntos.',
  description: null,
  coverUrl: '/media/hero-poster.webp',
  coverMobileUrl: '/media/hero-poster-mobile.webp',
  coverAlt: 'Mazda MX-5 de competición en la presentación del Candeonato',
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
