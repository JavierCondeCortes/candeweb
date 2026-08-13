import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

type FormFieldKind =
  'section' | 'text' | 'textarea' | 'radio' | 'select' | 'checkbox' | 'date' | 'time';

interface GoogleFormField {
  id: string;
  itemId?: string;
  kind: FormFieldKind;
  label: string;
  description: string;
  required?: boolean;
  options?: string[];
}

interface GoogleFormSchema {
  title: string;
  description: string;
  viewUrl: string;
  supported: boolean;
  fields: GoogleFormField[];
}

@Component({
  selector: 'app-form-inscription',
  imports: [TranslatePipe],
  templateUrl: './form-inscription.html',
  styleUrl: './form-inscription.css',
})
export class FormInscription {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;

  readonly registrationUrl = input<string | null>(null);
  readonly schema = signal<GoogleFormSchema | null>(null);
  readonly loadState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly submissionState = signal<'idle' | 'sending' | 'success' | 'error'>('idle');
  readonly answers = signal<Record<string, string | string[]>>({});
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly privacyAccepted = signal(false);

  constructor() {
    effect(() => this.loadForm(this.registrationUrl()));
  }

  setValue(fieldId: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)
      .value;
    this.answers.update((answers) => ({ ...answers, [fieldId]: value }));
    this.clearFieldError(fieldId);
  }

  toggleChoice(fieldId: string, option: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.answers()[fieldId];
    const values = Array.isArray(current) ? current : [];
    this.answers.update((answers) => ({
      ...answers,
      [fieldId]: checked ? [...values, option] : values.filter((value) => value !== option),
    }));
    this.clearFieldError(fieldId);
  }

  isChoiceSelected(fieldId: string, option: string): boolean {
    const value = this.answers()[fieldId];
    return Array.isArray(value) ? value.includes(option) : value === option;
  }

  setPrivacyAccepted(event: Event): void {
    this.privacyAccepted.set((event.target as HTMLInputElement).checked);
    this.clearFieldError('privacy');
  }

  submit(event: Event): void {
    event.preventDefault();
    const schema = this.schema();
    const registrationUrl = this.registrationUrl();
    if (!schema || !registrationUrl || this.submissionState() === 'sending') return;

    const errors: Record<string, string> = {};
    for (const field of schema.fields) {
      if (field.kind === 'section' || !field.required) continue;
      const value = this.answers()[field.id];
      if (!value || (Array.isArray(value) && value.length === 0)) errors[field.id] = 'required';
    }
    if (!this.privacyAccepted()) errors['privacy'] = 'required';
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    this.submissionState.set('sending');
    this.http
      .post<{ ok: boolean }>('/api/public/google-form-submit', {
        url: registrationUrl,
        answers: this.answers(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.submissionState.set('success'),
        error: (error: HttpErrorResponse) => {
          const serverFields = error.error?.error?.fields;
          if (serverFields && typeof serverFields === 'object') {
            this.fieldErrors.set(
              Object.fromEntries(Object.keys(serverFields).map((fieldId) => [fieldId, 'invalid'])),
            );
          }
          this.submissionState.set('error');
        },
      });
  }

  retry(): void {
    this.submissionState.set('idle');
  }

  private loadForm(registrationUrl: string | null): void {
    const version = ++this.requestVersion;
    this.schema.set(null);
    this.answers.set({});
    this.fieldErrors.set({});
    this.privacyAccepted.set(false);
    this.submissionState.set('idle');

    if (!registrationUrl) {
      this.loadState.set('idle');
      return;
    }
    if (!isGoogleFormsUrl(registrationUrl)) {
      this.loadState.set('error');
      return;
    }

    this.loadState.set('loading');
    this.http
      .get<GoogleFormSchema>(`/api/public/google-form?url=${encodeURIComponent(registrationUrl)}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          if (version !== this.requestVersion) return;
          this.schema.set(schema);
          this.loadState.set(schema.supported ? 'ready' : 'error');
        },
        error: () => {
          if (version === this.requestVersion) this.loadState.set('error');
        },
      });
  }

  private clearFieldError(fieldId: string): void {
    this.fieldErrors.update((errors) => {
      if (!errors[fieldId]) return errors;
      const next = { ...errors };
      delete next[fieldId];
      return next;
    });
  }
}

function isGoogleFormsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'forms.gle' ||
        (url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')))
    );
  } catch {
    return false;
  }
}
