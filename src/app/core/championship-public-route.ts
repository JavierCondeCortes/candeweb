import { ChampionshipContent } from './models/content-admin.model';

/**
 * Returns the public destination that matches the way an edition is currently presented.
 * The featured edition uses the promotional landing while registration or racing is active;
 * completed editions use their permanent sports record.
 */
export function championshipPublicRoute(championship: ChampionshipContent): string {
  if (
    championship.isFeatured &&
    (championship.status === 'registration' || championship.status === 'active')
  ) {
    return '/candeonato';
  }

  const publicId = championship.externalTournamentId ?? championship.slug;
  return publicId ? `/candeonatos/${encodeURIComponent(String(publicId))}` : '/candeonatos';
}
