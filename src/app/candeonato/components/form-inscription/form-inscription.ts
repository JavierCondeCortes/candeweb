import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type FieldName = 'iracingName' | 'discordName' | 'email' | 'mood' | 'consent';
type FormStatus = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-form-inscription',
  imports: [ReactiveFormsModule],
  templateUrl: './form-inscription.html',
  styleUrl: './form-inscription.css',
})
export class FormInscription {
  @ViewChild('registrationForm') private registrationForm?: ElementRef<HTMLFormElement>;

  readonly googleFormUrl = 'https://forms.gle/yiH1UGMCCVBtA5mG7';
  readonly status = signal<FormStatus>('idle');
  readonly submitted = signal(false);
  readonly moodOptions = [
    'SI',
    '¡AY AY AYYY!',
    'ME VA MUCHÍSIMO EL TEMARIO',
    'QUIERO AGRADECER',
    'EL CAFÉ ME DA LA VIDA, SIN ÉL TODO ES GRIS.',
    'TITITI TI TIRITI',
    'SOY UNA PERSONA RELAJADA HASTA QUE ENTRO A PISTA.',
  ];

  readonly form = new FormGroup({
    iracingName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    discordName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    mood: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    consent: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  showError(field: FieldName): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.status.set('idle');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      queueMicrotask(() => {
        this.registrationForm?.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"], input:invalid')
          ?.focus();
      });
      return;
    }

    this.status.set('sending');
    const values = this.form.getRawValue();
    const body = new URLSearchParams({
      'entry.907677391': values.iracingName,
      'entry.1512476117': values.discordName,
      'entry.1483403070': values.mood,
      emailAddress: values.email,
    });

    try {
      await fetch(
        'https://docs.google.com/forms/d/e/1FAIpQLSePuX0b17z_QlDoKH3IId8L8KwkwsGkZrl98GRlkCgXLi9hbA/formResponse',
        {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );
      this.status.set('success');
      this.submitted.set(false);
      this.form.reset({ iracingName: '', discordName: '', email: '', mood: '', consent: false });
    } catch {
      this.status.set('error');
    }
  }
}
