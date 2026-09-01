import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CandeBrand } from '../../../shared/components/cande-brand/cande-brand';

@Component({
  selector: 'app-admin-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LanguageSwitcher,
    TranslatePipe,
    CandeBrand,
  ],
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly session = this.api.session;

  logout(): void {
    this.api.logout().subscribe({
      next: () => void this.router.navigate(['/admin/login']),
      error: () => void this.router.navigate(['/admin/login']),
    });
  }
}
