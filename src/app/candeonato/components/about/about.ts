import { Component, input } from '@angular/core';
import { ChampionshipContent } from '../../../core/models/content-admin.model';

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  readonly championship = input<ChampionshipContent | null>(null);
}
