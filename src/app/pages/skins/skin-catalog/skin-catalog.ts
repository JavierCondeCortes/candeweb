import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SkinContent } from '../../../core/models/skin.model';
import { AccessApiService } from '../../../core/services/access-api.service';
import { PrivateLibraryNavbar } from '../../../shared/components/private-library-navbar/private-library-navbar';

@Component({
  selector: 'app-skin-catalog',
  imports: [TranslatePipe, PrivateLibraryNavbar],
  templateUrl: './skin-catalog.html',
})
export class SkinCatalog implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly router = inject(Router);
  readonly session = this.api.session;
  readonly skins = signal<SkinContent[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.api.getSkins().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ skins }) => this.skins.set(skins),
      error: (error) => this.errorMessage.set((error as { error?: { error?: { message?: string } } })?.error?.error?.message || 'No se pudieron cargar las skins.'),
    });
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => void this.router.navigate(['/acceso']),
      error: () => void this.router.navigate(['/acceso']),
    });
  }
}
