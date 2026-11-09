import { Title } from '@angular/platform-browser';
import { effect, inject, Injectable, signal } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SeoService } from '../seo/seo.service';
import { I18nService } from './i18n.service';

@Injectable()
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly activeTitleKey = signal('');
  private readonly activeRoute = signal({ url: '/', descriptionKey: '' });

  constructor() {
    super();
    effect(() => {
      const key = this.activeTitleKey();
      const { url, descriptionKey } = this.activeRoute();
      this.i18n.language();
      if (!key) return;
      const title = this.i18n.translate(key);
      this.title.setTitle(title);
      const description = descriptionKey ? this.i18n.translate(descriptionKey) : '';
      this.seo.update(url, title, description === descriptionKey ? '' : description);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    let descriptionKey = '';
    while (route) {
      const key = route.data?.['description'];
      if (typeof key === 'string') descriptionKey = key;
      route = route.firstChild as typeof route;
    }
    this.activeRoute.set({ url: snapshot.url, descriptionKey });
    this.activeTitleKey.set(this.buildTitle(snapshot) ?? '');
  }
}
