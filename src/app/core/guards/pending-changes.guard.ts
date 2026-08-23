import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { ConfirmationService } from '../services/confirmation.service';

export interface HasPendingChanges {
  hasPendingChanges(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<HasPendingChanges> = (component) => {
  if (!component.hasPendingChanges()) return true;
  const confirmation = inject(ConfirmationService);
  const i18n = inject(I18nService);
  return confirmation.confirm({
    message: i18n.translate('admin.common.pendingChanges'),
    confirmLabel: i18n.translate('admin.common.leave'),
    tone: 'warning',
  });
};
