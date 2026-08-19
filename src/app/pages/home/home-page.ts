import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, of, shareReplay } from 'rxjs';
import { PublicContentService } from '../../core/services/public-content.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CommunityIntro } from './components/community-intro/community-intro';
import { EventFeature } from './components/event-feature/event-feature';
import { ExperienceGallery } from './components/experience-gallery/experience-gallery';
import { HomeHero } from './components/home-hero/home-hero';
import { TeamShowcase } from './components/team-showcase/team-showcase';
import { SponsorStrip } from './components/sponsor-strip/sponsor-strip';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  selector: 'app-home-page',
  imports: [
    AsyncPipe,
    Footer,
    HomeHero,
    CommunityIntro,
    EventFeature,
    TeamShowcase,
    ExperienceGallery,
    SponsorStrip,
    TranslatePipe,
  ],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly content = inject(PublicContentService);
  readonly currentYear = new Date().getFullYear();
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
