import { Component, HostListener, input, model } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher/language-switcher';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export type CandeonatoNavbarVariant = 'landing' | 'detail' | 'archive';

@Component({
  selector: 'app-candeonato-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LanguageSwitcher, TranslatePipe],
  templateUrl: './candeonato-navbar.html',
  styleUrl: './candeonato-navbar.css',
})
export class CandeonatoNavbar {
  readonly exactLinkMatchOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'exact',
  };
  readonly variant = input<CandeonatoNavbarVariant>('landing');
  readonly historyUrl = input('/candeonatos');
  readonly brandAriaLabel = input('CANDEWEB — Candemor Racing Team');
  readonly inactive = input(false);
  readonly menuOpen = model(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closeMenu();
  }
}
