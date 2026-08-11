export interface ChampionshipViewModel {
  id: number;
  name: string;
  organizerName: string | null;
  season: string | null;
  titleSponsor: string | null;
  formatTags: string[];
  rounds: ChampionshipRound[];
  roundGroups: ChampionshipRoundGroup[];
  standings: DriverStanding[];
  stats: ChampionshipStats;
  leaders: ChampionshipLeader[];
  warnings: ChampionshipWarning[];
}

export interface ChampionshipRound {
  id: number;
  externalSessionId: number | null;
  number: number;
  name: string;
  circuit: string;
  layout: string;
  date: string | null;
  dateLabel: string;
  laps: number | null;
  sof: number | null;
  isHeat: boolean;
  isTeamEvent: boolean;
  typeLabel: string;
  receivedStatus: string | null;
}

export interface ChampionshipRoundGroup {
  key: string;
  circuit: string;
  layout: string;
  rounds: ChampionshipRound[];
}

export interface DriverStanding {
  position: number;
  driverId: number | null;
  driverLabel: string;
  team: string | null;
  points: number;
  rounds: number;
  incidents: number;
  laps: number;
  warnings: number;
  wins: number;
  podiums: number;
  topFive: number;
  topTen: number;
  fastestLaps: number;
  poles: number;
}

export interface ChampionshipStats {
  roundCount: number;
  circuitCount: number;
  driverCount: number;
  totalLaps: number;
  totalIncidents: number;
}

export interface ChampionshipLeader {
  label: string;
  driverId: number | null;
  driverLabel: string;
  value: number;
  unit: string;
}

export interface ChampionshipWarning {
  code: 'missing-dates' | 'missing-driver-names' | 'status-conflict' | 'total-conflict';
  message: string;
}

export interface TournamentLoadResult {
  response: import('./championship-api.model').TournamentApiResponse;
  isStale: boolean;
  syncedAt: string;
  source: 'snapshot' | 'live' | 'memory';
  corrections: EditorialCorrection[];
}

export interface EditorialCorrection {
  id: string;
  reason: string;
  note: string;
  createdByName: string;
  createdAt: string;
}
