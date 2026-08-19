import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChampionshipContent } from '../../core/models/content-admin.model';
import { CandeonatoNavbar } from '../../shared/components/candeonato-navbar/candeonato-navbar';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  selector: 'app-championship-history-page',
  standalone: true,
  imports: [Footer, AsyncPipe, RouterLink, CandeonatoNavbar, TranslatePipe],
  templateUrl: './championship-history-page.html',
})
export class ChampionshipHistoryPage {
  private readonly content = inject(PublicContentService);
  private readonly i18n = inject(I18nService);
  readonly state$ = this.content.getChampionships().pipe(
    map(({ championships }) => ({ kind: 'ready' as const, championships })),
    startWith({ kind: 'loading' as const, championships: [] }),
    catchError(() => of({ kind: 'error' as const, championships: [] })),
  );

  localizedSummary(championship: ChampionshipContent): string {
    return this.i18n.localized(championship.summary, championship.summaryEn);
  }

  localizedCoverAlt(championship: ChampionshipContent): string {
    return this.i18n.localized(championship.coverAlt, championship.coverAltEn);
  }
}
