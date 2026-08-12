import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, shareReplay } from 'rxjs';
import { PublicContentService } from '../core/services/public-content.service';
import { About } from './components/about/about';
import { FormInscription } from './components/form-inscription/form-inscription';
import { Hero } from './components/hero/hero';
import { Requirements } from './components/requirements/requirements';
import { Rules } from './components/rules/rules';
import { TranslatePipe } from '../core/i18n/translate.pipe';

@Component({
  selector: 'app-candeonato-page',
  imports: [
    AsyncPipe,
    RouterLink,
    Hero,
    About,
    Requirements,
    Rules,
    FormInscription,
    TranslatePipe,
  ],
  templateUrl: './candeonato-page.html',
  styleUrl: '../app.css',
})
export class CandeonatoPage {
  private readonly content = inject(PublicContentService);
  readonly featured$ = this.content.getSiteSettings().pipe(
    map((settings) => settings.featuredChampionship),
    catchError(() => of(null)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
