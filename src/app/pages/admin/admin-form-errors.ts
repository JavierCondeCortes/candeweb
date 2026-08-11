import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { ApiProblem } from '../../core/models/content-admin.model';

export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as Partial<ApiProblem> | undefined;
    return problem?.error?.message ?? 'No se pudo completar la operación.';
  }
  return 'No se pudo completar la operación.';
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
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(form.controls)
      .filter(([, control]) => control.invalid)
      .map(([name, control]) => {
        const label = labels[name] ?? 'Este campo';
        if (control.hasError('required')) return [name, `${label} es obligatorio.`];
        if (control.hasError('email')) return [name, `${label} no tiene un formato válido.`];
        if (control.hasError('min')) return [name, `${label} debe ser cero o mayor.`];
        if (control.hasError('minlength')) return [name, `${label} es demasiado corto.`];
        if (control.hasError('maxlength')) return [name, `${label} es demasiado largo.`];
        return [name, `Revisa ${label.toLocaleLowerCase('es')}.`];
      }),
  );
}
