import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

type CommunityValue = {
  index: string;
  key: string;
};

@Component({
  selector: 'app-community-intro',
  imports: [TranslatePipe],
  templateUrl: './community-intro.html',
})
export class CommunityIntro {
  readonly discordUrl = input<string | null>(null);
  readonly values: readonly CommunityValue[] = [
    {
      index: '01',
      key: 'compete',
    },
    {
      index: '02',
      key: 'share',
    },
    {
      index: '03',
      key: 'create',
    },
  ];
}
