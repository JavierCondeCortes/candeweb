import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta } from '@angular/platform-browser';

const PRIVATE_PATH = /^\/(?:admin|setups|skins|acceso|solicitar-acceso|aceptar-invitacion)(?:\/|$)/;

/**
 * Mantiene sincronizados description, canonical, robots y Open Graph al navegar o cambiar de
 * idioma. El servidor ya entrega estos valores en el HTML inicial (server/seo.mjs); este servicio
 * evita que queden obsoletos en la navegación interna de la SPA.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);

  update(url: string, title: string, description: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    const indexable = !PRIVATE_PATH.test(path);
    const canonical = new URL(path, this.document.location.origin).toString();

    this.meta.updateTag({
      name: 'robots',
      content: indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    });
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
    if (title) {
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });
    }
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.setCanonical(canonical);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = href;
  }
}
