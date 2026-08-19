import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFatcatStandingsService,
  parseChampionshipStandings,
  reconcileStandingsWithDriverIds,
} from './fatcat-standings.mjs';

const html = `
  <table class="table-ranking text-white">
    <tbody>
      <tr>
        <td>1</td><td><img alt="Flag"></td><td>Pablo &amp; Ana</td><td>Candemor</td>
        <td>6</td><td>54</td><td>1</td><td>4</td><td>5</td><td>33</td><td>165.0000</td>
      </tr>
    </tbody>
  </table>`;

test('convierte la clasificación pública con nombres y puntos', () => {
  assert.deepEqual(parseChampionshipStandings(html), [
    {
      position: 1,
      driverName: 'Pablo & Ana',
      team: 'Candemor',
      rounds: 6,
      laps: 54,
      wins: 1,
      podiums: 4,
      topFive: 5,
      incidents: 33,
      points: 165,
    },
  ]);
});

test('envía las cabeceras AJAX requeridas y conserva la clasificación', async () => {
  let receivedHeaders;
  let requests = 0;
  const service = createFatcatStandingsService({
    now: () => 2_000,
    fetchImpl: async (_url, init) => {
      requests += 1;
      receivedHeaders = init.headers;
      return new Response(html, { status: 200 });
    },
  });

  await service.getStandings(42);
  await service.getStandings(42);

  assert.equal(receivedHeaders['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(requests, 1);
});

test('relaciona nombre e ID solo cuando las estadísticas publicadas forman una pareja única', () => {
  const named = [
    {
      position: 1,
      driverName: 'Pablo Cabrera',
      team: 'Candemor',
      rounds: 6,
      laps: 54,
      wins: 0,
      podiums: 4,
      topFive: 5,
      incidents: 33,
      points: 165,
    },
    {
      position: 2,
      driverName: 'Lucía Torres',
      team: 'Candemor',
      rounds: 6,
      laps: 52,
      wins: 1,
      podiums: 3,
      topFive: 5,
      incidents: 29,
      points: 164,
    },
  ];
  const drivers = [
    {
      piloto_id: 1027444,
      puntos_totales: '164.0000',
      rondas: 6,
      total_laps: '52',
      victorias: 1,
      podios: 3,
      top_5: 5,
      total_incidents: '29',
    },
    {
      piloto_id: 801380,
      puntos_totales: '165.0000',
      rondas: 6,
      total_laps: '54',
      victorias: 0,
      podios: 4,
      top_5: 5,
      total_incidents: '33',
    },
  ];

  assert.deepEqual(
    reconcileStandingsWithDriverIds(drivers, named).map((standing) => standing.driverId),
    [801380, 1027444],
  );
});

test('no asigna un ID cuando dos registros comparten la misma firma estadística', () => {
  const named = [
    {
      position: 1,
      driverName: 'Piloto A',
      team: null,
      rounds: 1,
      laps: 7,
      wins: 0,
      podiums: 0,
      topFive: 0,
      incidents: 2,
      points: 10,
    },
  ];
  const driver = {
    puntos_totales: '10',
    rondas: 1,
    total_laps: '7',
    victorias: 0,
    podios: 0,
    top_5: 0,
    total_incidents: '2',
  };

  const [result] = reconcileStandingsWithDriverIds(
    [
      { ...driver, piloto_id: 1 },
      { ...driver, piloto_id: 2 },
    ],
    named,
  );

  assert.equal(result.driverId, null);
  assert.equal(result.driverIdMatch, null);
});

test('no reconcilia registros con estadísticas incompletas', () => {
  const [result] = reconcileStandingsWithDriverIds(
    [
      {
        piloto_id: 801380,
        puntos_totales: '10',
        rondas: 1,
        total_laps: null,
        victorias: 0,
        podios: 0,
        top_5: 1,
        total_incidents: '2',
      },
    ],
    [
      {
        position: 1,
        driverName: 'Piloto A',
        team: null,
        points: 10,
        rounds: 1,
        laps: 0,
        wins: 0,
        podiums: 0,
        topFive: 1,
        incidents: 2,
      },
    ],
  );

  assert.equal(result.driverId, null);
});
