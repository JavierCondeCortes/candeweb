import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, defer, map, of, shareReplay } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PublicContentService } from '../../../core/services/public-content.service';
import { CandeBrand } from '../cande-brand/cande-brand';

const FALLBACK_SITE_SETTINGS = {
  twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
  discordUrl: 'https://discord.gg/j22XuDEfMk',
  contactEmail: null,
  featuredChampionship: null,
};

@Component({
  selector: 'app-footer',
  imports: [TranslatePipe, RouterLink, AsyncPipe, CandeBrand],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly content = inject(PublicContentService);

  private readonly siteSettings$ = defer(() => {
    const getSiteSettings = this.content.getSiteSettings;

    if (typeof getSiteSettings !== 'function') {
      return of(FALLBACK_SITE_SETTINGS);
    }

    return getSiteSettings.call(this.content);
  }).pipe(
    catchError(() => of(FALLBACK_SITE_SETTINGS)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly currentYear = new Date().getFullYear();

  readonly featured$ = this.siteSettings$.pipe(
    map((settings) => settings.featuredChampionship),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly registrationOpen$ = this.featured$.pipe(
    map((championship) => championship?.status === 'registration'),
  );

  readonly settings$ = this.siteSettings$;
}
