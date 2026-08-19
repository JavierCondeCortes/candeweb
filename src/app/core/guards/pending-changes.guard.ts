import { CanDeactivateFn } from '@angular/router';

export interface HasPendingChanges {
  hasPendingChanges(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<HasPendingChanges> = (component) =>
  !component.hasPendingChanges() ||
  window.confirm('Hay cambios sin guardar. ¿Quieres salir igualmente?');
