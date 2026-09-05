import { ChampionshipAdapterService } from './championship-adapter.service';
import { TournamentApiResponse } from '../models/championship-api.model';

const apiResponse: TournamentApiResponse = {
  torneo: {
    id: 42,
    nombre: 'Candeonato Bandido',
    season: null,
    series: null,
    status: 2,
    title_sponsor: null,
    comments: null,
    sistemapts: 1,
    c_or_p: 0,
    heat_racing: 1,
    heat_sistemapts: 1,
    heat_subsession: -2,
    multiclass: 0,
    driver_change: 0,
    safety: 1,
    team_transfers: 1,
    hidden: 0,
    timetrial: 0,
    individual_tt: 0,
    forty_percent: 0,
    group: null,
    ai_set: null,
    manages_funds: 0,
    promediar_rondas: 0,
  },
  rondas: [
    {
      id: 2,
      torneo_id: 42,
      iracing_id: 202,
      nombre: 'VIRGINIA HEAT',
      ronda_no: 2,
      circuito: 'Virginia International Raceway',
      variante: 'Full Course',
      fecha: null,
      sof: 2346,
      team_event: 0,
      laps: 7,
      is_heat: 1,
      status_label: 'upcoming',
    },
    {
      id: 1,
      torneo_id: 42,
      iracing_id: 201,
      nombre: 'VIRGINIA',
      ronda_no: 1,
      circuito: 'Virginia International Raceway',
      variante: 'Full Course',
      fecha: null,
      sof: 2346,
      team_event: 0,
      laps: 7,
      is_heat: 0,
      status_label: 'upcoming',
    },
  ],
  entryList: [],
  teams: [],
  organizer: { id: 0, name: 'Candemor Racing Team' },
  schedule: [],
  pPe: [],
  pPd: [
    {
      piloto_id: 801380,
      torneo_id: 42,
      puntos_totales: '165.0000',
      rondas: 6,
      suma_posiciones: '15',
      total_incidents: '33',
      total_laps: '54',
      total_warnings: '0',
      victorias: 1,
      podios: 4,
      top_5: 5,
      top_10: 6,
      vueltas_rapidas: 1,
      poles: 0,
      custom_team: null,
    },
  ],
  transfers: [],
  sanciones: [],
  totalInscritos: 0,
  totalVueltas: '1357',
  totalIncidentes: '1292',
  totalPuntosdeLicencia: '0',
};

describe('ChampionshipAdapterService', () => {
  const adapter = new ChampionshipAdapterService();
  const result = adapter.adapt(apiResponse);

  it('normalizes numeric values, booleans and round order', () => {
    expect(result.stats.totalLaps).toBe(1357);
    expect(result.stats.driverCount).toBe(1);
    expect(result.rounds.map((round) => round.number)).toEqual([1, 2]);
    expect(result.rounds.map((round) => round.externalSessionId)).toEqual([201, 202]);
    expect(result.rounds[1].isHeat).toBe(true);
    expect(result.standings[0].points).toBe(165);
  });

  it('groups sessions without losing their real round number', () => {
    expect(result.roundGroups).toHaveLength(1);
    expect(result.roundGroups[0].rounds.map((round) => round.number)).toEqual([1, 2]);
  });

  it('surfaces contradictions and missing source data', () => {
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'missing-dates',
      'missing-driver-names',
      'status-conflict',
      'total-conflict',
    ]);
  });

  it('uses the independent public classification when it includes driver names', () => {
    const named = adapter.adapt({
      ...apiResponse,
      pPd: apiResponse.pPd.map((standing) => ({ ...standing, poles: 2 })),
      namedStandings: [
        {
          position: 1,
          driverId: 801380,
          driverIdMatch: 'exact-statistics',
          driverName: 'Pablo Cabrera',
          team: 'fatcat racing',
          rounds: 6,
          laps: 54,
          wins: 1,
          podiums: 4,
          topFive: 5,
          incidents: 33,
          points: 165,
        },
      ],
    });

    expect(named.standings[0].driverLabel).toBe('Pablo Cabrera');
    expect(named.standings[0].driverId).toBe(801380);
    expect(named.standings[0].team).toBe('fatcat racing');
    expect(named.standings[0].fastestLaps).toBe(1);
    expect(named.standings[0].poles).toBe(2);
    expect(named.leaders.map(({ metric, value }) => ({ metric, value }))).toEqual([
      { metric: 'wins', value: 1 },
      { metric: 'podiums', value: 4 },
      { metric: 'fastestLaps', value: 1 },
      { metric: 'poles', value: 2 },
    ]);
    expect(named.warnings.map((warning) => warning.code)).not.toContain('missing-driver-names');
  });

  it('keeps the official accumulated totals when the named classification is stale', () => {
    const resultWithStaleNames = adapter.adapt({
      ...apiResponse,
      pPd: apiResponse.pPd.map((standing) => ({
        ...standing,
        puntos_totales: '221.0000',
        rondas: 5,
        total_laps: '56',
        victorias: 1,
        podios: 3,
      })),
      namedStandings: [
        {
          position: 1,
          driverId: 801380,
          driverIdMatch: 'exact-statistics',
          driverName: 'Oier Zamalloa',
          team: 'Candemor',
          rounds: 1,
          laps: 12,
          wins: 1,
          podiums: 1,
          topFive: 1,
          incidents: 9,
          points: 60,
        },
      ],
    });

    expect(resultWithStaleNames.standings[0]).toMatchObject({
      driverLabel: 'Oier Zamalloa',
      points: 221,
      rounds: 5,
      laps: 56,
      wins: 1,
      podiums: 3,
    });
  });
});
