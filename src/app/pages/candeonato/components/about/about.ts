import { Component, inject, input } from '@angular/core';
import { ChampionshipContent } from '../../../../core/models/content-admin.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-about',
  imports: [TranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly i18n = inject(I18nService);
  readonly championship = input<ChampionshipContent | null>(null);

  localizedDescription(): string {
    const championship = this.championship();
    return this.i18n.localized(championship?.description, championship?.descriptionEn);
  }
}
