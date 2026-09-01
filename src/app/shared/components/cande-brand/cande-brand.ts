import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type CandeBrandVariant = 'web' | 'candeonato' | 'setups' | 'skins' | 'access' | 'admin';

const BRAND_CONFIG: Record<CandeBrandVariant, { suffix: string; route: string }> = {
  web: { suffix: 'WEB', route: '/' },
  candeonato: { suffix: 'ONATO', route: '/candeonato' },
  setups: { suffix: 'SETUPS', route: '/setups' },
  skins: { suffix: 'SKINS', route: '/skins' },
  access: { suffix: 'ACCESS', route: '/acceso' },
  admin: { suffix: 'ADMIN', route: '/admin' },
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

  readonly suffix = computed(() => BRAND_CONFIG[this.variant()].suffix);
  readonly brandName = computed(() => `CANDE${this.suffix()}`);
  readonly resolvedRoute = computed(() => this.route() ?? BRAND_CONFIG[this.variant()].route);
  readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.brandName());
}
