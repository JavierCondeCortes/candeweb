import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChampionshipViewModel, EditorialCorrection } from '../../core/models/championship.model';
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

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-championship-detail-page',
  imports: [RouterLink, ChampionshipStats, StandingsTable, RoundsList],
  templateUrl: './championship-detail-page.html',
})
export class ChampionshipDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ChampionshipApiService);
  private readonly adapter = inject(ChampionshipAdapterService);
  private readonly content = inject(PublicContentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private loadSubscription?: Subscription;

  readonly state = signal<PageState>('loading');
  readonly championship = signal<ChampionshipViewModel | null>(null);
  readonly tournamentId = signal(42);
  readonly isRefreshing = signal(false);
  readonly isStale = signal(false);
  readonly errorMessage = signal('');
  readonly lastUpdated = signal('');
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
          this.errorMessage.set('La edición solicitada no tiene un identificador válido.');
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
          this.lastUpdated.set(
            new Intl.DateTimeFormat('es-ES', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(syncedAt)),
          );
          this.state.set('ready');
          this.isRefreshing.set(false);
          this.title.setTitle(`${championship.name} · Clasificación`);
        },
        error: () => {
          this.errorMessage.set(
            'No se han podido recuperar los datos de esta edición. Comprueba la conexión y vuelve a intentarlo.',
          );
          this.state.set(this.championship() ? 'ready' : 'error');
          this.isRefreshing.set(false);
        },
      });
  }
}
