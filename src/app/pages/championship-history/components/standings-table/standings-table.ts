import { Component, computed, input, signal } from '@angular/core';
import { DriverStanding } from '../../../../core/models/championship.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-standings-table',
  imports: [TranslatePipe],
  templateUrl: './standings-table.html',
  styleUrl: './standings-table.css',
})
export class StandingsTable {
  readonly standings = input.required<DriverStanding[]>();
  readonly championshipName = input.required<string>();
  readonly query = signal('');
  readonly showAll = signal(false);
  readonly hasPublicNames = computed(() =>
    this.standings().some((standing) => !/^Piloto #\d+$/.test(standing.driverLabel)),
  );
  readonly hasMatchedIds = computed(() =>
    this.standings().some(
      (standing) => standing.driverId !== null && !/^Piloto #\d+$/.test(standing.driverLabel),
    ),
  );

  readonly filteredStandings = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const matching = normalizedQuery
      ? this.standings().filter(
          (standing) =>
            standing.driverLabel.toLowerCase().includes(normalizedQuery) ||
            (standing.driverId !== null && String(standing.driverId).includes(normalizedQuery)),
        )
      : this.standings();
    return this.showAll() || normalizedQuery ? matching : matching.slice(0, 10);
  });

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  toggleAll(): void {
    this.showAll.update((value) => !value);
  }
}
