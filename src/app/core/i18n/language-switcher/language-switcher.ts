import { Component, inject } from '@angular/core';
import { I18nService } from '../i18n.service';
import { Language } from '../i18n.types';
import { TranslatePipe } from '../translate.pipe';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  private readonly i18n = inject(I18nService);

  readonly language = this.i18n.language;
  readonly loading = this.i18n.loading;

  changeLanguage(language: Language): void {
    this.i18n.setLanguage(language);
  }
}
