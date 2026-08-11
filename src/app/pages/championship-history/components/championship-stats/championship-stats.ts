import { Component, input } from '@angular/core';
import { ChampionshipStats as ChampionshipStatsModel } from '../../../../core/models/championship.model';

@Component({
  selector: 'app-championship-stats',
  imports: [],
  templateUrl: './championship-stats.html',
  styleUrl: './championship-stats.css',
})
export class ChampionshipStats {
  readonly stats = input.required<ChampionshipStatsModel>();
}
