import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChampionshipRoundGroup } from '../../../../core/models/championship.model';
import { RoundResultsResponse } from '../../../../core/models/round-results.model';
import { RoundResultsService } from '../../../../core/services/round-results.service';

type ResultState =
  { kind: 'loading' } | { kind: 'ready'; response: RoundResultsResponse } | { kind: 'error' };

@Component({
  selector: 'app-rounds-list',
  imports: [],
  templateUrl: './rounds-list.html',
  styleUrl: './rounds-list.css',
})
export class RoundsList {
  private readonly resultsService = inject(RoundResultsService);
  private readonly destroyRef = inject(DestroyRef);

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
