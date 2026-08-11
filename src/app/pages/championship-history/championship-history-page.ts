import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';

@Component({
  selector: 'app-championship-history-page',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './championship-history-page.html',
})
export class ChampionshipHistoryPage {
  private readonly content = inject(PublicContentService);
  readonly state$ = this.content.getChampionships().pipe(
    map(({ championships }) => ({ kind: 'ready' as const, championships })),
    startWith({ kind: 'loading' as const, championships: [] }),
    catchError(() => of({ kind: 'error' as const, championships: [] })),
  );
}
