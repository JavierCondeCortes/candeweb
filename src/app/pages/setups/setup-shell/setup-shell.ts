import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SetupApiService } from '../../../core/services/setup-api.service';
import { PrivateLibraryNavbar } from '../../../shared/components/private-library-navbar/private-library-navbar';

@Component({
  selector: 'app-setup-shell',
  imports: [RouterOutlet, TranslatePipe, PrivateLibraryNavbar],
  templateUrl: './setup-shell.html',
})
export class SetupShell {
  private readonly api = inject(SetupApiService);
  private readonly router = inject(Router);

  readonly session = this.api.session;

  logout(): void {
    this.api.logout().subscribe({
      next: () => void this.router.navigate(['/acceso']),
      error: () => void this.router.navigate(['/acceso']),
    });
  }
}
