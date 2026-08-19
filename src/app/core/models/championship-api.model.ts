export interface TournamentApiResponse {
  torneo: TournamentApi;
  rondas: RoundApi[];
  entryList: unknown[];
  teams: unknown[];
  organizer: OrganizerApi | null;
  schedule: unknown[];
  pPe: unknown[];
  pPd: DriverStandingApi[];
  transfers: unknown[];
  sanciones: unknown[];
  totalInscritos: number;
  totalVueltas: string;
  totalIncidentes: string;
  totalPuntosdeLicencia: string;
  namedStandings?: NamedDriverStandingApi[];
}

export interface NamedDriverStandingApi {
  position: number;
  driverId?: number | null;
  driverIdMatch?: 'exact-statistics' | null;
  driverName: string;
  team: string | null;
  rounds: number;
  laps: number;
  wins: number;
  podiums: number;
  topFive: number;
  incidents: number;
  points: number;
}

export interface TournamentApi {
  id: number;
  nombre: string;
  season: string | number | null;
  series: string | null;
  status: number | null;
  title_sponsor: string | null;
  comments: string | null;
  sistemapts: number | null;
  c_or_p: number | null;
  heat_racing: 0 | 1;
  heat_sistemapts: number | null;
  heat_subsession: number | null;
  multiclass: 0 | 1;
  driver_change: 0 | 1;
  safety: 0 | 1;
  team_transfers: 0 | 1;
  hidden: 0 | 1;
  timetrial: 0 | 1;
  individual_tt: 0 | 1;
  forty_percent: 0 | 1;
  group: string | null;
  ai_set: string | null;
  manages_funds: 0 | 1;
  promediar_rondas: 0 | 1;
}

export interface RoundApi {
  id: number;
  torneo_id: number;
  iracing_id: number | null;
  nombre: string;
  ronda_no: number;
  circuito: string;
  variante: string;
  fecha: string | null;
  sof: number | null;
  team_event: 0 | 1;
  laps: number | null;
  is_heat: 0 | 1;
  created_at?: string | null;
  status_label: string | null;
}

export interface DriverStandingApi {
  piloto_id: number;
  torneo_id: number;
  puntos_totales: string;
  rondas: number;
  suma_posiciones: string;
  total_incidents: string;
  mazm_total?: string;
  total_laps: string;
  total_warnings: string;
  victorias: number;
  podios: number;
  top_5: number;
  top_10: number;
  vueltas_rapidas: number;
  poles: number;
  custom_team: string | null;
}

export interface OrganizerApi {
  id: number;
  name: string;
  overlay_prefix?: string | null;
  user?: unknown;
  enabled_overlays?: unknown;
}
