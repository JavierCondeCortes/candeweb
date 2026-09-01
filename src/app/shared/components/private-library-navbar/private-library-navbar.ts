import { Component, computed, HostListener, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SetupSession } from '../../../core/models/setup.model';
import { CandeBrand } from '../cande-brand/cande-brand';

export type PrivateLibrary = 'setups' | 'skins';

@Component({
  selector: 'app-private-library-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LanguageSwitcher, TranslatePipe, CandeBrand],
  templateUrl: './private-library-navbar.html',
})
export class PrivateLibraryNavbar {
  readonly library = input.required<PrivateLibrary>();
  readonly session = input<SetupSession | null>(null);
  readonly logoutRequested = output<void>();
  readonly menuOpen = signal(false);

  readonly navigationId = computed(() => `${this.library()}-navigation`);
  readonly brandRoute = computed(() => (this.library() === 'skins' ? '/skins' : '/setups'));
  readonly brandLabel = computed(() =>
    this.library() === 'skins' ? 'home.skins.homeLabel' : 'home.setups.shell.homeLabel',
  );
  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  logout(): void {
    this.closeMenu();
    this.logoutRequested.emit();
  }
}
