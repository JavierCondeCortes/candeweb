import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  inject,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { SoundSwitch } from '../sound-switch/sound-switch';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { RouterLink } from '@angular/router';
import { CandeonatoNavbar } from '../../../../shared/components/candeonato-navbar/candeonato-navbar';

type Countdown = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [SoundSwitch, CandeonatoNavbar, TranslatePipe, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero implements AfterViewInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  private heroVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('heroVideo')
  set videoElement(element: ElementRef<HTMLVideoElement> | undefined) {
    this.heroVideo = element;
    if (element && this.motionQuery) this.setReducedMotion(this.motionQuery.matches);
  }

  readonly championship = input<ChampionshipContent | null>(null);

  readonly isMuted = signal(true);
  readonly isPaused = signal(false);
  readonly isVideoFocusMode = signal(false);
  readonly isMenuOpen = signal(false);
  readonly countdown = signal<Countdown>({ days: '00', hours: '00', minutes: '00', seconds: '00' });
  readonly editionNumber = computed(() => this.championship()?.editionNumber ?? 8);
  readonly editionCode = computed(() => String(this.editionNumber()).padStart(2, '0'));
  readonly editionSubtitle = computed(
    () => this.championship()?.subtitle ?? this.championship()?.name ?? 'New Era Edition',
  );
  readonly heroSubtitle = computed(() => {
    const championship = this.championship();
    return (
      this.i18n.localized(championship?.summary, championship?.summaryEn) ||
      this.i18n.translate('candeonato.hero.fallbackSubtitle')
    );
  });
  readonly coverUrl = computed(() => this.championship()?.coverUrl ?? '/media/hero-poster.webp');
  readonly coverMobileUrl = computed(() => {
    const championship = this.championship();
    return championship
      ? (championship.coverMobileUrl ?? championship.coverUrl ?? '/media/hero-poster-mobile.webp')
      : '/media/hero-poster-mobile.webp';
  });
  readonly backgroundVideoUrl = computed(() => this.championship()?.backgroundVideoUrl ?? null);
  readonly backgroundVideoMimeType = computed(
    () => this.championship()?.backgroundVideoMimeType ?? 'video/mp4',
  );
  readonly historyUrl = computed(() => {
    const championship = this.championship();
    return championship?.status === 'finished' && championship.externalTournamentId
      ? `/candeonatos/${championship.externalTournamentId}`
      : '/candeonatos';
  });
  readonly startAt = computed(() => this.championship()?.startAt ?? '2026-09-04T18:00:00+02:00');
  readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Madrid',
    })
      .format(new Date(this.startAt()))
      .replaceAll('/', ' · '),
  );
  private countdownTimer?: ReturnType<typeof setInterval>;
  private motionQuery?: MediaQueryList;

  ngAfterViewInit(): void {
    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);

    if (typeof window.matchMedia !== 'function') {
      return;
    }

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.setReducedMotion(this.motionQuery.matches);
    this.motionQuery.addEventListener('change', this.onMotionPreferenceChange);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.motionQuery?.removeEventListener('change', this.onMotionPreferenceChange);
  }

  toggleSound(): void {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;

    video.muted = !video.muted;
    this.isMuted.set(video.muted);
  }

  toggleVideoFocus(): void {
    this.isMenuOpen.set(false);
    this.isVideoFocusMode.update((active) => !active);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOverlays(): void {
    this.isMenuOpen.set(false);
    this.isVideoFocusMode.set(false);
  }

  async togglePlayback(): Promise<void> {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        this.isPaused.set(true);
      }
    } else {
      video.pause();
    }
  }

  onVideoPlay(): void {
    this.isPaused.set(false);
  }

  onVideoPause(): void {
    this.isPaused.set(true);
  }

  private readonly onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.setReducedMotion(event.matches);
  };

  private setReducedMotion(reduceMotion: boolean): void {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      this.isPaused.set(true);
      return;
    }

    video.muted = true;
    this.isMuted.set(true);
    video.play().catch(() => this.isPaused.set(true));
  }

  private updateCountdown(): void {
    const distance = Math.max(0, new Date(this.startAt()).getTime() - Date.now());
    const day = 86_400_000;
    const hour = 3_600_000;
    const minute = 60_000;

    this.countdown.set({
      days: this.pad(Math.floor(distance / day)),
      hours: this.pad(Math.floor((distance % day) / hour)),
      minutes: this.pad(Math.floor((distance % hour) / minute)),
      seconds: this.pad(Math.floor((distance % minute) / 1000)),
    });
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
