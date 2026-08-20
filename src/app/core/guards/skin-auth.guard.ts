import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AccessApiService } from '../services/access-api.service';

export const skinAuthGuard: CanActivateFn = (_route, state) => {
  const api = inject(AccessApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) =>
      session.authenticated && session.account?.canAccessSkins
        ? true
        : router.createUrlTree(['/acceso'], { queryParams: { returnUrl: state.url } }),
    ),
    catchError(() => of(router.createUrlTree(['/acceso']))),
  );
};
