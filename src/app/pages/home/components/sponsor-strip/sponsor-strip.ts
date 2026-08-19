import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, map, of, startWith } from 'rxjs';
import { PublicContentService } from '../../../../core/services/public-content.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-sponsor-strip',
  imports: [AsyncPipe, TranslatePipe],
  templateUrl: './sponsor-strip.html',
})
export class SponsorStrip {
  private readonly content = inject(PublicContentService);
  readonly state$ = this.content.getSponsors().pipe(
    map(({ sponsors }) => ({ kind: 'ready' as const, sponsors })),
    startWith({ kind: 'loading' as const, sponsors: [] }),
    catchError(() => of({ kind: 'error' as const, sponsors: [] })),
  );
}
