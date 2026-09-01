import {
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { LanguageSwitcher } from '../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PublicContentService } from '../../core/services/public-content.service';
import { Footer } from '../../shared/components/footer/footer';
import { CandeBrand } from '../../shared/components/cande-brand/cande-brand';

const DEFAULT_PATREON_URL = 'https://www.patreon.com/candemor/posts/chiquitito-151646382';

interface SpotterDemo {
  readonly id: string;
  readonly src: string;
  readonly titleKey: string;
  readonly contextKey: string;
  readonly transcriptKey: string;
}

@Component({
  selector: 'app-chiquito-spotter-page',
  imports: [Footer, LanguageSwitcher, RouterLink, TranslatePipe, CandeBrand],
  templateUrl: './chiquito-spotter-page.html',
  styleUrl: './chiquito-spotter-page.css',
})
export class ChiquitoSpotterPage {
  private readonly content = inject(PublicContentService);

  @ViewChildren('demoAudio') private readonly audioPlayers?: QueryList<
    ElementRef<HTMLAudioElement>
  >;

  readonly menuOpen = signal(false);
  readonly patreonUrl = toSignal(
    this.content.getSiteSettings().pipe(
      map((settings) => settings.chiquitoSpotterUrl?.trim() || DEFAULT_PATREON_URL),
      catchError(() => of(DEFAULT_PATREON_URL)),
    ),
    { initialValue: DEFAULT_PATREON_URL },
  );
  readonly waveBars = Array.from({ length: 24 });
  readonly demos: readonly SpotterDemo[] = [
    {
      id: 'position',
      src: '/media/chiquito-spotter/POSFT.wav',
      titleKey: 'home.spotter.demo.items.position.title',
      contextKey: 'home.spotter.demo.items.position.context',
      transcriptKey: 'home.spotter.demo.items.position.transcript',
    },
    {
      id: 'won',
      src: '/media/chiquito-spotter/UWON7!.wav',
      titleKey: 'home.spotter.demo.items.won.title',
      contextKey: 'home.spotter.demo.items.won.context',
      transcriptKey: 'home.spotter.demo.items.won.transcript',
    },
    {
      id: 'top10',
      src: '/media/chiquito-spotter/TOP10!.wav',
      titleKey: 'home.spotter.demo.items.top10.title',
      contextKey: 'home.spotter.demo.items.top10.context',
      transcriptKey: 'home.spotter.demo.items.top10.transcript',
    },
    {
      id: 'smoking',
      src: '/media/chiquito-spotter/SMOKING_2!.wav',
      titleKey: 'home.spotter.demo.items.smoking.title',
      contextKey: 'home.spotter.demo.items.smoking.context',
      transcriptKey: 'home.spotter.demo.items.smoking.transcript',
    },
    {
      id: 'repair',
      src: '/media/chiquito-spotter/REPAIR_3!.wav',
      titleKey: 'home.spotter.demo.items.repair.title',
      contextKey: 'home.spotter.demo.items.repair.context',
      transcriptKey: 'home.spotter.demo.items.repair.transcript',
    },
    {
      id: 'most-repair',
      src: '/media/chiquito-spotter/DAMRPMOST!.wav',
      titleKey: 'home.spotter.demo.items.mostRepair.title',
      contextKey: 'home.spotter.demo.items.mostRepair.context',
      transcriptKey: 'home.spotter.demo.items.mostRepair.transcript',
    },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  pauseOtherAudios(event: Event): void {
    const activeAudio = event.currentTarget as HTMLAudioElement | null;
    if (!activeAudio) return;

    this.audioPlayers?.forEach(({ nativeElement }) => {
      if (nativeElement !== activeAudio && !nativeElement.paused) nativeElement.pause();
    });
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closeMenu();
  }
}
