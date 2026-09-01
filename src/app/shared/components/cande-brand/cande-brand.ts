import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type CandeBrandVariant = 'web' | 'candeonato' | 'setups' | 'skins' | 'access' | 'admin';

const BRAND_NAME = 'CANDEMOR';
// const TEAM = 'RACING TEAM'
const BRAND_ROUTES: Record<CandeBrandVariant, string> = {
  web: '/',
  candeonato: '/candeonato',
  setups: '/setups',
  skins: '/skins',
  access: '/acceso',
  admin: '/admin',
};

@Component({
  selector: 'app-cande-brand',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cande-brand.html',
  styleUrl: './cande-brand.css',
})
export class CandeBrand {
  readonly variant = input<CandeBrandVariant>('web');
  readonly route = input<string | readonly unknown[] | null>(null);
  readonly fragment = input<string | undefined>(undefined);
  readonly ariaLabel = input<string | null>(null);
  readonly ariaCurrent = input<'page' | 'location' | null>(null);

  readonly brandName = BRAND_NAME;
  // readonly team = TEAM;
  readonly resolvedRoute = computed(() => this.route() ?? BRAND_ROUTES[this.variant()]);
  readonly resolvedAriaLabel = computed(() => {
    const customLabel = this.ariaLabel()?.trim();
    if (!customLabel) return BRAND_NAME;
    return customLabel.includes(BRAND_NAME) ? customLabel : `${BRAND_NAME} — ${customLabel}`;
  });
}
