import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, map, of, shareReplay } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { About } from './components/about/about';
import { FormInscription } from './components/form-inscription/form-inscription';
import { Hero } from './components/hero/hero';
import { Requirements } from './components/requirements/requirements';
import { Rules } from './components/rules/rules';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  selector: 'app-candeonato-page',
  imports: [AsyncPipe, Footer, Hero, About, Requirements, Rules, FormInscription, TranslatePipe],
  templateUrl: './candeonato-page.html',
  styleUrl: '../../app.css',
})
export class CandeonatoPage {
  private readonly content = inject(PublicContentService);
  readonly settings$ = this.content.getSiteSettings().pipe(
    catchError(() =>
      of({
        twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
        featuredChampionship: null,
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly featured$ = this.settings$.pipe(
    map((settings) => settings.featuredChampionship),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
