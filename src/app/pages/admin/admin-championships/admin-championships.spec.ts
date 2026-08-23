import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChampionshipContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminChampionships } from './admin-championships';

describe('AdminChampionships', () => {
  it('elimina definitivamente una edición confirmada y la retira del listado', async () => {
    const championship: ChampionshipContent = {
      id: 'championship-1',
      externalTournamentId: 42,
      slug: 'candeonato-prueba',
      name: 'Candeonato de prueba',
      editionNumber: 9,
      subtitle: null,
      season: '2026',
      summary: 'Edición temporal.',
      description: null,
      coverUrl: null,
      coverAlt: null,
      backgroundVideoUrl: null,
      backgroundVideoMimeType: null,
      startAt: null,
      endAt: null,
      registrationUrl: null,
      rulesUrl: null,
      status: 'draft',
      isFeatured: false,
      displayOrder: 0,
      publishedAt: null,
      lastSyncedAt: null,
      syncStatus: 'never',
      syncError: null,
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
    };
    const api = {
      getChampionships: vi.fn(() => of({ championships: [championship] })),
      deleteChampionship: vi.fn(() => of(void 0)),
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [AdminChampionships],
      providers: [provideRouter([]), { provide: AdminApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminChampionships);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deleteButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Eliminar',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('¿Eliminar definitivamente Candeonato de prueba?'),
    );
    expect(api.deleteChampionship).toHaveBeenCalledWith('championship-1');
    expect(fixture.nativeElement.textContent).toContain('Edición eliminada definitivamente.');
    expect(fixture.nativeElement.textContent).not.toContain('Candeonato de prueba');
  });
});
