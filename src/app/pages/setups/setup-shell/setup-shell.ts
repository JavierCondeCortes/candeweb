import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SetupApiService } from '../../../core/services/setup-api.service';

@Component({
  selector: 'app-setup-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LanguageSwitcher, TranslatePipe],
  templateUrl: './setup-shell.html',
})
export class SetupShell {
  private readonly api = inject(SetupApiService);
  private readonly router = inject(Router);

  readonly session = this.api.session;
  readonly menuOpen = signal(false);

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => void this.router.navigate(['/setups/acceso']),
      error: () => void this.router.navigate(['/setups/acceso']),
    });
  }
}
