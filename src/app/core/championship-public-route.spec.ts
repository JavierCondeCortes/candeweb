import { ChampionshipContent } from './models/content-admin.model';
import { championshipPublicRoute } from './championship-public-route';

describe('championshipPublicRoute', () => {
  it('opens the promotional landing for the featured registration and active edition', () => {
    expect(championshipPublicRoute(championship({ status: 'registration' }))).toBe('/candeonato');
    expect(championshipPublicRoute(championship({ status: 'active' }))).toBe('/candeonato');
  });

  it('opens the permanent record when the current edition has finished', () => {
    expect(championshipPublicRoute(championship({ status: 'finished' }))).toBe('/candeonatos/52');
  });

  it('uses the slug when an edition does not have an external tournament id', () => {
    expect(
      championshipPublicRoute(
        championship({
          externalTournamentId: null,
          slug: 'edicion-especial',
          status: 'finished',
        }),
      ),
    ).toBe('/candeonatos/edicion-especial');
  });
});

function championship(overrides: Partial<ChampionshipContent> = {}): ChampionshipContent {
  return {
    id: 'championship-52',
    externalTournamentId: 52,
    slug: 'candeonato-52',
    name: 'Candeonato 52',
    editionNumber: 9,
    subtitle: null,
    season: '2026',
    summary: null,
    description: null,
    coverUrl: null,
    coverAlt: null,
    backgroundVideoUrl: null,
    backgroundVideoMimeType: null,
    startAt: null,
    endAt: null,
    registrationUrl: null,
    rulesUrl: null,
    status: 'active',
    isFeatured: true,
    displayOrder: 0,
    publishedAt: null,
    lastSyncedAt: null,
    syncStatus: 'never',
    syncError: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
