import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { PublicContentService } from '../services/public-content.service';

export const currentChampionshipGuard: CanActivateFn = () => {
  const content = inject(PublicContentService);
  const router = inject(Router);

  return content.getSiteSettings().pipe(
    map(({ featuredChampionship }) => {
      if (featuredChampionship?.status !== 'finished') return true;
      return featuredChampionship.externalTournamentId
        ? router.createUrlTree(['/candeonatos', featuredChampionship.externalTournamentId])
        : router.createUrlTree(['/candeonatos']);
    }),
    catchError(() => of(true)),
  );
};
