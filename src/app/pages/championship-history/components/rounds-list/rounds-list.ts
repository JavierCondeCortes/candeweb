import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChampionshipRound,
  ChampionshipRoundGroup,
} from '../../../../core/models/championship.model';
import { RoundResultsResponse } from '../../../../core/models/round-results.model';
import { RoundResultsService } from '../../../../core/services/round-results.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

type ResultState =
  { kind: 'loading' } | { kind: 'ready'; response: RoundResultsResponse } | { kind: 'error' };

@Component({
  selector: 'app-rounds-list',
  imports: [TranslatePipe],
  templateUrl: './rounds-list.html',
  styleUrl: './rounds-list.css',
})
export class RoundsList {
  private readonly resultsService = inject(RoundResultsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);

  readonly groups = input.required<ChampionshipRoundGroup[]>();
  readonly openSessionId = signal<number | null>(null);
  readonly resultStates = signal(new Map<number, ResultState>());
  readonly selectedRound = computed(() => {
    const sessionId = this.openSessionId();
    if (!sessionId) return null;
    return (
      this.groups()
        .flatMap((group) => group.rounds)
        .find((round) => round.externalSessionId === sessionId) ?? null
    );
  });

  toggleResults(sessionId: number | null): void {
    if (!sessionId) return;
    if (this.openSessionId() === sessionId) {
      this.openSessionId.set(null);
      return;
    }
    this.openSessionId.set(sessionId);
    if (!this.resultStates().has(sessionId)) this.loadResults(sessionId);
  }

  retryResults(sessionId: number): void {
    this.loadResults(sessionId);
  }

  resultState(sessionId: number): ResultState | undefined {
    return this.resultStates().get(sessionId);
  }

  roundType(round: ChampionshipRound): string {
    const key =
      round.type === 'team'
        ? 'candeonato.sports.teamRace'
        : round.type === 'heat'
          ? 'candeonato.sports.heat'
          : 'candeonato.sports.race';
    return this.i18n.translate(key);
  }

  roundDate(value: string | null): string {
    if (!value) return this.i18n.translate('candeonato.sports.datePending');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return this.i18n.translate('candeonato.sports.datePending');
    }
    return new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private loadResults(sessionId: number): void {
    this.setResultState(sessionId, { kind: 'loading' });
    this.resultsService
      .getResults(sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.setResultState(sessionId, { kind: 'ready', response }),
        error: () => this.setResultState(sessionId, { kind: 'error' }),
      });
  }

  private setResultState(sessionId: number, state: ResultState): void {
    this.resultStates.update((states) => new Map(states).set(sessionId, state));
  }
}
