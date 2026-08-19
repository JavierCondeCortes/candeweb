import assert from 'node:assert/strict';
import test from 'node:test';
import { createFatcatRoundResultsService, parseRoundResults } from './fatcat-round-results.mjs';

const html = `
  <table id="myTable">
    <thead><tr><th>Pos.</th><th>Nombre</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td><td>José &amp; Ana</td><td>Candemor</td><td>7</td>
        <td>00:15:06.58</td><td>02:09.51</td><td>1</td>
      </tr>
      <tr>
        <td>2</td><td>Lucía</td><td></td><td>6</td>
        <td>00:15:20.00</td><td>02:11.10</td><td>3</td>
      </tr>
    </tbody>
  </table>`;

test('convierte la tabla pública de una ronda en resultados estructurados', () => {
  assert.deepEqual(parseRoundResults(html), [
    {
      position: 1,
      driverName: 'José & Ana',
      team: 'Candemor',
      laps: 7,
      totalTime: '00:15:06.58',
      averageLap: '02:09.51',
      incidents: 1,
    },
    {
      position: 2,
      driverName: 'Lucía',
      team: null,
      laps: 6,
      totalTime: '00:15:20.00',
      averageLap: '02:11.10',
      incidents: 3,
    },
  ]);
});

test('consulta cada sesión una vez durante las 24 horas de caché', async () => {
  let requests = 0;
  const service = createFatcatRoundResultsService({
    now: () => 1_000,
    fetchImpl: async () => {
      requests += 1;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    },
  });

  const first = await service.getResults(82043333);
  const second = await service.getResults(82043333);

  assert.equal(first.results.length, 2);
  assert.deepEqual(second, first);
  assert.equal(requests, 1);
});
