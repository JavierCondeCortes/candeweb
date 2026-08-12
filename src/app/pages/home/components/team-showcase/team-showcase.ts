import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, map, of, startWith } from 'rxjs';
import { PublicContentService } from '../../../../core/services/public-content.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-team-showcase',
  imports: [AsyncPipe, TranslatePipe],
  templateUrl: './team-showcase.html',
})
export class TeamShowcase {
  private readonly content = inject(PublicContentService);

  readonly state$ = this.content.getMembers(true).pipe(
    map(({ members }) => ({
      kind: 'ready' as const,
      members,
      hasDemo: members.some((member) => member.isDemo),
    })),
    startWith({ kind: 'loading' as const, members: [], hasDemo: false }),
    catchError(() => of({ kind: 'error' as const, members: [], hasDemo: false })),
  );
}
