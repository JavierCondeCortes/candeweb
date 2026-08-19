import { Component, computed, inject, input } from '@angular/core';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-requirements',
  imports: [TranslatePipe],
  templateUrl: './requirements.html',
  styleUrl: './requirements.css',
})
export class Requirements {
  private readonly i18n = inject(I18nService);
  readonly championship = input<ChampionshipContent | null>(null);
  readonly eventDate = computed(
    () => new Date(this.championship()?.startAt ?? '2026-09-04T18:00:00+02:00'),
  );
  readonly year = computed(() => this.eventDate().getFullYear());
  readonly longDate = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      day: 'numeric',
      month: 'long',
    }).format(this.eventDate()),
  );
  readonly shortDate = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language() === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
    })
      .format(this.eventDate())
      .replace('/', ' · '),
  );
}
