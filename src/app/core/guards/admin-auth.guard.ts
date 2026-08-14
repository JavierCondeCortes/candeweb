import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminApiService } from '../services/admin-api.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  return api.refreshSession().pipe(
    map((session) => {
      if (!session.authenticated) {
        return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
      }
      if (!session.admin?.mfaEnabled && state.url !== '/admin/seguridad') {
        return router.createUrlTree(['/admin/seguridad']);
      }
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/admin/login']))),
  );
};
