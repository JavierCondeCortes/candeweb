import { Component, computed, input } from '@angular/core';
import { ChampionshipContent } from '../../../core/models/content-admin.model';

@Component({
  selector: 'app-requirements',
  imports: [],
  templateUrl: './requirements.html',
  styleUrl: './requirements.css',
})
export class Requirements {
  readonly championship = input<ChampionshipContent | null>(null);
  readonly eventDate = computed(
    () => new Date(this.championship()?.startAt ?? '2026-09-04T18:00:00+02:00'),
  );
  readonly year = computed(() => this.eventDate().getFullYear());
  readonly longDate = computed(() =>
    new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(this.eventDate()),
  );
  readonly shortDate = computed(() =>
    new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' })
      .format(this.eventDate())
      .replace('/', ' · '),
  );
}
