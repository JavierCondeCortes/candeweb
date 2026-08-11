import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminApiService } from '../services/admin-api.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) =>
      session.authenticated
        ? true
        : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } }),
    ),
    catchError(() => of(router.createUrlTree(['/admin/login']))),
  );
};
