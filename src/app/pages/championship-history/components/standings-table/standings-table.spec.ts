import { TestBed } from '@angular/core/testing';
import { DriverStanding } from '../../../../core/models/championship.model';
import { StandingsTable } from './standings-table';

const standings: DriverStanding[] = Array.from({ length: 12 }, (_, index) => ({
  position: index + 1,
  driverId: 800000 + index,
  driverLabel: `Piloto #${800000 + index}`,
  team: null,
  points: 120 - index,
  rounds: 6,
  incidents: index,
  laps: 54,
  warnings: 0,
  wins: index === 0 ? 2 : 0,
  podiums: index < 3 ? 3 - index : 0,
  topFive: 4,
  topTen: 6,
  fastestLaps: 0,
  poles: 0,
}));

describe('StandingsTable', () => {
  it('shows a compact top ten and can reveal the complete classification', async () => {
    await TestBed.configureTestingModule({ imports: [StandingsTable] }).compileComponents();
    const fixture = TestBed.createComponent(StandingsTable);
    fixture.componentRef.setInput('standings', standings);
    fixture.componentRef.setInput('championshipName', 'Candeonato de prueba');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(host.querySelector('caption')?.textContent).toContain('Candeonato de prueba');

    host.querySelector<HTMLButtonElement>('.show-all-button')?.click();
    fixture.detectChanges();

    expect(host.querySelectorAll('tbody tr')).toHaveLength(12);
  });

  it('filters by the public driver identifier', async () => {
    await TestBed.configureTestingModule({ imports: [StandingsTable] }).compileComponents();
    const fixture = TestBed.createComponent(StandingsTable);
    fixture.componentRef.setInput('standings', standings);
    fixture.componentRef.setInput('championshipName', 'Candeonato de prueba');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input');
    if (!input) throw new Error('Search input was not rendered');
    input.value = '800011';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Piloto #800011');
  });

  it('switches to a name search when the public classification provides names', async () => {
    await TestBed.configureTestingModule({ imports: [StandingsTable] }).compileComponents();
    const fixture = TestBed.createComponent(StandingsTable);
    fixture.componentRef.setInput('standings', [
      { ...standings[0], driverId: null, driverLabel: 'Pablo Cabrera', team: 'Candemor' },
    ]);
    fixture.componentRef.setInput('championshipName', 'Candeonato de prueba');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('label')?.textContent).toContain('Buscar piloto');
    expect(host.querySelector<HTMLInputElement>('input')?.placeholder).toBe('Ej. Pablo Cabrera');
    expect(host.querySelector('.source-note')?.textContent).toContain(
      'clasificación pública de Fat Cat Race',
    );
  });

  it('keeps name search and explains an ID matched by unique statistics', async () => {
    await TestBed.configureTestingModule({ imports: [StandingsTable] }).compileComponents();
    const fixture = TestBed.createComponent(StandingsTable);
    fixture.componentRef.setInput('standings', [
      { ...standings[0], driverLabel: 'Pablo Cabrera', team: 'Candemor' },
    ]);
    fixture.componentRef.setInput('championshipName', 'Candeonato de prueba');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('label')?.textContent).toContain('Buscar piloto');
    expect(host.querySelector<HTMLInputElement>('input')?.placeholder).toBe('Ej. Pablo Cabrera');
    expect(host.querySelector('.source-note')?.textContent).toContain(
      'estadísticas publicadas coinciden de forma única',
    );
  });
});
