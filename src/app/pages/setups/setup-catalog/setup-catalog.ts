import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RacingSetup, SetupCapabilities } from '../../../core/models/setup.model';
import { SetupApiService } from '../../../core/services/setup-api.service';

@Component({
  selector: 'app-setup-catalog',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './setup-catalog.html',
})
export class SetupCatalog implements OnInit {
  private readonly api = inject(SetupApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly setups = signal<RacingSetup[]>([]);
  readonly capabilities = signal<SetupCapabilities>({
    canAccess: true,
    canUpload: false,
    canManage: false,
  });
  readonly filters = this.formBuilder.nonNullable.group({ q: [''], simulator: [''] });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api
      .getSetups(this.filters.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ setups, capabilities }) => {
          this.setups.set(setups);
          this.capabilities.set(capabilities);
        },
        error: (error) => this.errorMessage.set(setupError(error)),
      });
  }

  clear(): void {
    this.filters.reset({ q: '', simulator: '' });
    this.load();
  }
}

function setupError(error: unknown): string {
  const message = (error as { error?: { error?: { message?: string } } })?.error?.error?.message;
  return message || 'No se pudo cargar la biblioteca.';
}
