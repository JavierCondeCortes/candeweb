import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SetupApiService } from '../services/setup-api.service';

export const setupAuthGuard: CanActivateFn = (_route, state) => {
  const api = inject(SetupApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) =>
      session.authenticated
        ? true
        : router.createUrlTree(['/setups/acceso'], { queryParams: { returnUrl: state.url } }),
    ),
    catchError(() => of(router.createUrlTree(['/setups/acceso']))),
  );
};

export const setupManagerGuard: CanActivateFn = () => {
  const api = inject(SetupApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) =>
      session.account && ['owner', 'admin'].includes(session.account.role)
        ? true
        : router.createUrlTree(['/setups']),
    ),
    catchError(() => of(router.createUrlTree(['/setups/acceso']))),
  );
};

export const setupUploaderGuard: CanActivateFn = () => {
  const api = inject(SetupApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) => (session.account?.canUploadSetups ? true : router.createUrlTree(['/setups']))),
    catchError(() => of(router.createUrlTree(['/setups/acceso']))),
  );
};
