import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { catchError, map, of, shareReplay } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PublicContentService } from '../../../core/services/public-content.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [TranslatePipe,RouterLink,AsyncPipe],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly content = inject(PublicContentService);
  readonly currentYear = new Date().getFullYear();
  readonly featured$ = this.content.getSiteSettings().pipe(
    map((settings) => settings.featuredChampionship),
    catchError(() => of(null)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
    readonly settings$ = this.content.getSiteSettings().pipe(
    catchError(() =>
      of({
        twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
        discordUrl: 'https://discord.gg/j22XuDEfMk',
        contactEmail: null,
        featuredChampionship: null,
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
