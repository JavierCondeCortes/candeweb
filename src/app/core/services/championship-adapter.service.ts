import { Injectable } from '@angular/core';
import {
  ChampionshipLeader,
  ChampionshipRound,
  ChampionshipRoundGroup,
  ChampionshipViewModel,
  ChampionshipWarning,
  DriverStanding,
} from '../models/championship.model';
import { DriverStandingApi, TournamentApiResponse } from '../models/championship-api.model';

@Injectable({ providedIn: 'root' })
export class ChampionshipAdapterService {
  adapt(response: TournamentApiResponse): ChampionshipViewModel {
    const rounds = [...(response.rondas ?? [])]
      .sort((a, b) => a.ronda_no - b.ronda_no)
      .map<ChampionshipRound>((round) => ({
        id: round.id,
        externalSessionId: this.nullableNumber(round.iracing_id),
        number: round.ronda_no,
        name: round.nombre,
        circuit: round.circuito,
        layout: round.variante,
        date: round.fecha,
        dateLabel: this.formatDate(round.fecha),
        laps: this.nullableNumber(round.laps),
        sof: this.nullableNumber(round.sof),
        isHeat: round.is_heat === 1,
        isTeamEvent: round.team_event === 1,
        typeLabel:
          round.team_event === 1
            ? 'Carrera por equipos'
            : round.is_heat === 1
              ? 'Manga'
              : 'Carrera',
        receivedStatus: round.status_label,
      }));

    const standings = response.namedStandings?.length
      ? response.namedStandings.map((standing, index) => ({
          position: this.number(standing.position) || index + 1,
          driverId: this.nullableNumber(standing.driverId),
          driverLabel: standing.driverName || `Piloto ${index + 1}`,
          team: standing.team,
          points: this.number(standing.points),
          rounds: this.number(standing.rounds),
          incidents: this.number(standing.incidents),
          laps: this.number(standing.laps),
          warnings: 0,
          wins: this.number(standing.wins),
          podiums: this.number(standing.podiums),
          topFive: this.number(standing.topFive),
          topTen: 0,
          fastestLaps: 0,
          poles: 0,
        }))
      : (response.pPd ?? []).map((standing, index) => this.adaptStanding(standing, index));

    return {
      id: response.torneo.id,
      name: response.torneo.nombre || `Candeonato ${response.torneo.id}`,
      organizerName: response.organizer?.name ?? null,
      season: response.torneo.season === null ? null : String(response.torneo.season),
      titleSponsor: response.torneo.title_sponsor,
      formatTags: this.getFormatTags(response),
      rounds,
      roundGroups: this.groupRounds(rounds),
      standings,
      stats: {
        roundCount: rounds.length,
        circuitCount: new Set(rounds.map((round) => `${round.circuit}::${round.layout}`)).size,
        driverCount: Math.max(this.number(response.totalInscritos), standings.length),
        totalLaps: this.number(response.totalVueltas),
        totalIncidents: this.number(response.totalIncidentes),
      },
      leaders: this.getLeaders(standings),
      warnings: this.getWarnings(response, standings),
    };
  }

  private adaptStanding(standing: DriverStandingApi, index: number): DriverStanding {
    return {
      position: index + 1,
      driverId: standing.piloto_id,
      driverLabel: `Piloto #${standing.piloto_id}`,
      team: standing.custom_team,
      points: this.number(standing.puntos_totales),
      rounds: this.number(standing.rondas),
      incidents: this.number(standing.total_incidents),
      laps: this.number(standing.total_laps),
      warnings: this.number(standing.total_warnings),
      wins: this.number(standing.victorias),
      podiums: this.number(standing.podios),
      topFive: this.number(standing.top_5),
      topTen: this.number(standing.top_10),
      fastestLaps: this.number(standing.vueltas_rapidas),
      poles: this.number(standing.poles),
    };
  }

  private groupRounds(rounds: ChampionshipRound[]): ChampionshipRoundGroup[] {
    const groups = new Map<string, ChampionshipRoundGroup>();

    for (const round of rounds) {
      const key = `${round.circuit}::${round.layout}`;
      const current = groups.get(key);
      if (current) {
        current.rounds.push(round);
      } else {
        groups.set(key, { key, circuit: round.circuit, layout: round.layout, rounds: [round] });
      }
    }

    return [...groups.values()];
  }

  private getLeaders(standings: DriverStanding[]): ChampionshipLeader[] {
    const metrics: Array<{ label: string; key: keyof DriverStanding; unit: string }> = [
      { label: 'Más victorias', key: 'wins', unit: 'victorias' },
      { label: 'Más podios', key: 'podiums', unit: 'podios' },
      { label: 'Más vueltas rápidas', key: 'fastestLaps', unit: 'vueltas rápidas' },
      { label: 'Más poles', key: 'poles', unit: 'poles' },
    ];

    return metrics.flatMap((metric) => {
      const leader = standings.reduce<DriverStanding | null>((current, standing) => {
        if (!current || Number(standing[metric.key]) > Number(current[metric.key])) return standing;
        return current;
      }, null);
      const value = leader ? Number(leader[metric.key]) : 0;
      return leader && value > 0
        ? [
            {
              label: metric.label,
              driverId: leader.driverId,
              driverLabel: leader.driverLabel,
              value,
              unit: metric.unit,
            },
          ]
        : [];
    });
  }

  private getWarnings(
    response: TournamentApiResponse,
    standings: DriverStanding[],
  ): ChampionshipWarning[] {
    const warnings: ChampionshipWarning[] = [];

    if (
      (response.rondas ?? []).length > 0 &&
      response.rondas.every((round) => round.fecha === null)
    ) {
      warnings.push({
        code: 'missing-dates',
        message: 'La fuente no facilita fechas para estas rondas.',
      });
    }
    if (
      standings.length > 0 &&
      !response.namedStandings?.length &&
      (response.entryList ?? []).length === 0
    ) {
      warnings.push({
        code: 'missing-driver-names',
        message: 'La fuente solo facilita el identificador de cada piloto, no su nombre público.',
      });
    }
    if (
      standings.length > 0 &&
      (response.rondas ?? []).length > 0 &&
      response.rondas.every((round) => round.status_label === 'upcoming')
    ) {
      warnings.push({
        code: 'status-conflict',
        message: 'Las rondas figuran como próximas aunque ya existen puntos acumulados.',
      });
    }
    if (standings.length > 0 && this.number(response.totalInscritos) === 0) {
      warnings.push({
        code: 'total-conflict',
        message: 'El total de inscritos no coincide con los pilotos presentes en la clasificación.',
      });
    }

    return warnings;
  }

  private getFormatTags(response: TournamentApiResponse): string[] {
    const tags: string[] = [];
    if (response.torneo.heat_racing === 1) tags.push('Formato con mangas');
    if (response.torneo.safety === 1) tags.push('Safety activo');
    if (response.torneo.multiclass === 1) tags.push('Multiclase');
    if (response.torneo.driver_change === 1) tags.push('Cambio de piloto');
    return tags;
  }

  private formatDate(value: string | null): string {
    if (!value) return 'Fecha por confirmar';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private number(value: unknown): number {
    return this.nullableNumber(value) ?? 0;
  }
}
