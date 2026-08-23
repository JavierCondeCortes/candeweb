import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  input,
  signal,
  ViewChild,
} from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SoundSwitch } from '../../../../pages/candeonato/components/sound-switch/sound-switch';
import { StreamStatusService } from '../../../../core/services/stream-status.service';
import { LanguageSwitcher } from '../../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';

@Component({
  selector: 'app-home-hero',
  imports: [AsyncPipe, DecimalPipe, RouterLink, SoundSwitch, LanguageSwitcher, TranslatePipe],
  templateUrl: './home-hero.html',
})
export class HomeHero implements AfterViewInit, OnDestroy {
  @ViewChild('homeVideo') private homeVideo?: ElementRef<HTMLVideoElement>;

  private readonly streamService = inject(StreamStatusService);
  private motionQuery?: MediaQueryList;

  readonly streamStatus$ = this.streamService.status$;
  readonly championship = input<ChampionshipContent | null>(null);
  readonly isCandeonatoLive = computed(() => this.championship()?.status === 'active');
  readonly currentEventUrl = computed(() => {
    const championship = this.championship();
    return championship?.status === 'finished' && championship.externalTournamentId
      ? `/candeonatos/${championship.externalTournamentId}`
      : '/candeonato';
  });
  readonly isMuted = signal(true);
  readonly isPaused = signal(false);
  readonly isVideoFocusMode = signal(false);
  readonly isMenuOpen = signal(false);

  ngAfterViewInit(): void {
    if (typeof window.matchMedia !== 'function') return;

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.setReducedMotion(this.motionQuery.matches);
    this.motionQuery.addEventListener('change', this.onMotionPreferenceChange);
  }

  ngOnDestroy(): void {
    this.motionQuery?.removeEventListener('change', this.onMotionPreferenceChange);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  toggleSound(): void {
    const video = this.homeVideo?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.isMuted.set(video.muted);
  }

  async togglePlayback(): Promise<void> {
    const video = this.homeVideo?.nativeElement;
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

  toggleVideoFocus(): void {
    this.isVideoFocusMode.update((active) => !active);
    this.closeMenu();
  }

  onVideoPlay(): void {
    this.isPaused.set(false);
  }

  onVideoPause(): void {
    this.isPaused.set(true);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeMenu();
    this.isVideoFocusMode.set(false);
  }

  private readonly onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.setReducedMotion(event.matches);
  };

  private setReducedMotion(reduceMotion: boolean): void {
    const video = this.homeVideo?.nativeElement;
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
}
