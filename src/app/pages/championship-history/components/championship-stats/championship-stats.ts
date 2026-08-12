import { Component, input } from '@angular/core';
import { ChampionshipStats as ChampionshipStatsModel } from '../../../../core/models/championship.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-championship-stats',
  imports: [TranslatePipe],
  templateUrl: './championship-stats.html',
  styleUrl: './championship-stats.css',
})
export class ChampionshipStats {
  readonly stats = input.required<ChampionshipStatsModel>();
}
