import { Component, computed, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Footer } from '../../shared/components/footer/footer';
import {
  ChampionshipFormatTag,
  ChampionshipLeader,
  ChampionshipViewModel,
  ChampionshipWarning,
  EditorialCorrection,
} from '../../core/models/championship.model';
import { ChampionshipContent } from '../../core/models/content-admin.model';
import { ChampionshipAdapterService } from '../../core/services/championship-adapter.service';
import {
  CHAMPIONSHIP_API_BASE_URL,
  ChampionshipApiService,
} from '../../core/services/championship-api.service';
import { PublicContentService } from '../../core/services/public-content.service';
import { ChampionshipStats } from './components/championship-stats/championship-stats';
import { RoundsList } from './components/rounds-list/rounds-list';
import { StandingsTable } from './components/standings-table/standings-table';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CandeonatoNavbar } from '../../shared/components/candeonato-navbar/candeonato-navbar';

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-championship-detail-page',
  standalone: true,
  imports: [
    Footer,
    RouterLink,
    ChampionshipStats,
    StandingsTable,
    RoundsList,
    CandeonatoNavbar,
    TranslatePipe,
  ],
  templateUrl: './championship-detail-page.html',
})
export class ChampionshipDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ChampionshipApiService);
  private readonly adapter = inject(ChampionshipAdapterService);
  private readonly content = inject(PublicContentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private loadSubscription?: Subscription;

  readonly state = signal<PageState>('loading');
  readonly isMenuOpen = signal(false);
  readonly championship = signal<ChampionshipViewModel | null>(null);
  readonly tournamentId = signal(42);
  readonly isRefreshing = signal(false);
  readonly isStale = signal(false);
  readonly errorMessage = signal('');
  private readonly lastSyncedAt = signal('');
  readonly lastUpdated = computed(() => {
    const syncedAt = this.lastSyncedAt();
    if (!syncedAt) return '';
    return new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(syncedAt));
  });
  readonly dataSource = signal<'snapshot' | 'live' | 'memory'>('snapshot');
  readonly corrections = signal<EditorialCorrection[]>([]);
  readonly editions = signal<ChampionshipContent[]>([]);
  readonly sourceBaseUrl = CHAMPIONSHIP_API_BASE_URL;

  ngOnInit(): void {
    this.content
      .getChampionships()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ championships }) =>
          this.editions.set(
            championships.filter((championship) => championship.externalTournamentId !== null),
          ),
        error: () => this.editions.set([]),
      });

    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('torneoId'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (!Number.isInteger(id) || id <= 0) {
          this.championship.set(null);
          this.errorMessage.set(this.i18n.translate('candeonato.detail.invalidEdition'));
          this.state.set('error');
          return;
        }

        this.tournamentId.set(id);
        this.championship.set(null);
        this.loadTournament(false);
      });

    this.destroyRef.onDestroy(() => this.loadSubscription?.unsubscribe());
  }

  refresh(): void {
    this.loadTournament(true);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  selectEdition(event: Event): void {
    const tournamentId = Number((event.target as HTMLSelectElement).value);

    if (
      Number.isInteger(tournamentId) &&
      tournamentId > 0 &&
      tournamentId !== this.tournamentId()
    ) {
      void this.router.navigate(['/candeonatos', tournamentId]);
    }
  }

  private loadTournament(refresh: boolean): void {
    this.loadSubscription?.unsubscribe();
    this.errorMessage.set('');

    if (this.championship()) {
      this.isRefreshing.set(true);
    } else {
      this.state.set('loading');
    }

    this.loadSubscription = this.api
      .getTournament(this.tournamentId(), refresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ response, isStale, syncedAt, source, corrections }) => {
          const championship = this.adapter.adapt(response);
          this.championship.set(championship);
          this.isStale.set(isStale);
          this.dataSource.set(source);
          this.corrections.set(corrections ?? []);
          this.lastSyncedAt.set(syncedAt);
          this.state.set('ready');
          this.isRefreshing.set(false);
        },
        error: () => {
          this.errorMessage.set(this.i18n.translate('candeonato.detail.loadErrorMessage'));
          this.state.set(this.championship() ? 'ready' : 'error');
          this.isRefreshing.set(false);
        },
      });
  }

  formatTagLabel(tag: ChampionshipFormatTag): string {
    const keys: Record<ChampionshipFormatTag, string> = {
      heat: 'candeonato.sports.formatHeat',
      safety: 'candeonato.sports.formatSafety',
      multiclass: 'candeonato.sports.formatMulticlass',
      'driver-change': 'candeonato.sports.formatDriverChange',
    };
    return this.i18n.translate(keys[tag]);
  }

  warningLabel(code: ChampionshipWarning['code']): string {
    const keys: Record<ChampionshipWarning['code'], string> = {
      'missing-dates': 'candeonato.sports.warningMissingDates',
      'missing-driver-names': 'candeonato.sports.warningMissingDriverNames',
      'status-conflict': 'candeonato.sports.warningStatusConflict',
      'total-conflict': 'candeonato.sports.warningTotalConflict',
    };
    return this.i18n.translate(keys[code]);
  }

  leaderLabel(metric: ChampionshipLeader['metric']): string {
    return this.i18n.translate(this.leaderKey(metric, false));
  }

  leaderUnit(metric: ChampionshipLeader['metric']): string {
    return this.i18n.translate(this.leaderKey(metric, true));
  }

  private leaderKey(metric: ChampionshipLeader['metric'], unit: boolean): string {
    const suffix = unit ? 'Unit' : '';
    const names: Record<ChampionshipLeader['metric'], string> = {
      wins: 'Wins',
      podiums: 'Podiums',
      fastestLaps: 'FastestLaps',
      poles: 'Poles',
    };
    return `candeonato.sports.leader${names[metric]}${suffix}`;
  }
}
