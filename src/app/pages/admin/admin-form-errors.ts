import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { ApiProblem } from '../../core/models/content-admin.model';
import { TranslationParams } from '../../core/i18n/i18n.types';

export function apiErrorMessage(
  error: unknown,
  fallback = 'No se pudo completar la operación.',
  translate?: (key: string) => string,
): string {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as Partial<ApiProblem> | undefined;
    const code = problem?.error?.code;
    if (translate && code) {
      const translated = translate(`admin.apiErrors.${code}`);
      if (translated !== `admin.apiErrors.${code}`) return translated;
    }
    return problem?.error?.message ?? fallback;
  }
  return fallback;
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as Partial<ApiProblem> | undefined;
    return problem?.error?.fields ?? {};
  }
  return {};
}

export function apiErrorCode(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as Partial<ApiProblem> | undefined;
    return problem?.error?.code ?? null;
  }
  return null;
}

export function focusErrorSummary(id: string): void {
  queueMicrotask(() => document.getElementById(id)?.focus());
}

export function clientFieldErrors(
  form: FormGroup,
  labels: Record<string, string>,
  translate?: (key: string, params?: TranslationParams) => string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(form.controls)
      .filter(([, control]) => control.invalid)
      .map(([name, control]) => {
        const label = labels[name] ?? translate?.('admin.common.genericField') ?? 'Este campo';
        if (translate) {
          const params = { field: label };
          if (control.hasError('required')) {
            return [name, translate('admin.common.validationRequired', params)];
          }
          if (control.hasError('email')) {
            return [name, translate('admin.common.validationEmail', params)];
          }
          if (control.hasError('min')) {
            return [name, translate('admin.common.validationMin', params)];
          }
          if (control.hasError('minlength')) {
            return [name, translate('admin.common.validationTooShort', params)];
          }
          if (control.hasError('maxlength')) {
            return [name, translate('admin.common.validationTooLong', params)];
          }
          return [name, translate('admin.common.validationReview', params)];
        }
        if (control.hasError('required')) return [name, `${label} es obligatorio.`];
        if (control.hasError('email')) return [name, `${label} no tiene un formato válido.`];
        if (control.hasError('min')) return [name, `${label} debe ser cero o mayor.`];
        if (control.hasError('minlength')) return [name, `${label} es demasiado corto.`];
        if (control.hasError('maxlength')) return [name, `${label} es demasiado largo.`];
        return [name, `Revisa ${label.toLocaleLowerCase('es')}.`];
      }),
  );
}
