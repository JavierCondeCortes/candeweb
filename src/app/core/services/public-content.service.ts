import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ChampionshipContent,
  SiteSettings,
  TeamMemberContent,
} from '../models/content-admin.model';
import { TwitchChannelContent } from '../models/twitch-content.model';

@Injectable({ providedIn: 'root' })
export class PublicContentService {
  private readonly http = inject(HttpClient);

  getMembers(featuredOnly = false) {
    const query = featuredOnly ? '?featured=true' : '';
    return this.http.get<{ members: TeamMemberContent[] }>(`/api/public/members${query}`);
  }

  getChampionships() {
    return this.http.get<{ championships: ChampionshipContent[] }>('/api/public/championships');
  }

  getSiteSettings() {
    return this.http.get<SiteSettings & { featuredChampionship: ChampionshipContent | null }>(
      '/api/public/site-settings',
    );
  }

  getTwitchContent() {
    return this.http.get<TwitchChannelContent>('/api/public/twitch-content');
  }
}
