import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TeamMemberContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { AdminMembers } from './admin-members';

describe('AdminMembers', () => {
  it('elimina un miembro confirmado del listado y comunica el resultado', async () => {
    const member: TeamMemberContent = {
      id: 'member-1',
      slug: 'andrea',
      name: 'Andrea',
      alias: null,
      roleLabel: 'Piloto',
      bio: null,
      photoUrl: null,
      photoAlt: null,
      twitchUrl: null,
      instagramUrl: null,
      youtubeUrl: null,
      xUrl: null,
      discordUrl: null,
      websiteUrl: null,
      displayOrder: 0,
      isFeatured: true,
      isDemo: false,
      status: 'published',
      publishedAt: '2026-08-11T00:00:00.000Z',
      createdAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z',
    };
    const api = {
      getMembers: vi.fn(() => of({ members: [member] })),
      deleteMember: vi.fn(() => of(void 0)),
    };
    const confirmation = { confirm: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [AdminMembers],
      providers: [
        provideRouter([]),
        { provide: AdminApiService, useValue: api },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminMembers);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deleteButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Eliminar',
    ) as HTMLButtonElement;
    deleteButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmation.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('¿Eliminar a Andrea?') }),
    );
    expect(api.deleteMember).toHaveBeenCalledWith('member-1');
    expect(fixture.nativeElement.textContent).toContain('Miembro eliminado.');
    expect(fixture.nativeElement.textContent).not.toContain('Andrea');
  });
});
