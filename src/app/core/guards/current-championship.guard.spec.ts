import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { ChampionshipContent } from '../models/content-admin.model';
import { PublicContentService } from '../services/public-content.service';
import { currentChampionshipGuard } from './current-championship.guard';

describe('currentChampionshipGuard', () => {
  async function runGuard(championship: Partial<ChampionshipContent> | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PublicContentService,
          useValue: {
            getSiteSettings: () => of({ featuredChampionship: championship }),
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      currentChampionshipGuard({} as never, {} as never),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('redirects a finished current edition to its historical record', async () => {
    const result = await runGuard({ status: 'finished', externalTournamentId: 42 });

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/candeonatos/42');
  });

  it('keeps the promotional landing available while the edition is active', async () => {
    await expect(runGuard({ status: 'active', externalTournamentId: 42 })).resolves.toBe(true);
  });
});
