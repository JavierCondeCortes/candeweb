import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminApiService } from '../services/admin-api.service';

export const adminOwnerGuard: CanActivateFn = () => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  return api.session()?.admin?.role === 'owner' ? true : router.createUrlTree(['/admin']);
};
