import { Title } from '@angular/platform-browser';
import { effect, inject, Injectable, signal } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

@Injectable()
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly activeTitleKey = signal('');

  constructor() {
    super();
    effect(() => {
      const key = this.activeTitleKey();
      this.i18n.language();
      if (key) this.title.setTitle(this.i18n.translate(key));
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.activeTitleKey.set(this.buildTitle(snapshot) ?? '');
  }
}
