import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
  private swipeStartX: number | null = null;

  readonly activeMemberIndex = signal(0);

  readonly state$ = this.content.getMembers(true).pipe(
    map(({ members }) => ({
      kind: 'ready' as const,
      members,
      hasDemo: members.some((member) => member.isDemo),
    })),
    startWith({ kind: 'loading' as const, members: [], hasDemo: false }),
    catchError(() => of({ kind: 'error' as const, members: [], hasDemo: false })),
  );

  showPreviousMember(totalMembers: number): void {
    if (totalMembers < 2) return;

    this.activeMemberIndex.update((index) => (index - 1 + totalMembers) % totalMembers);
  }

  showNextMember(totalMembers: number): void {
    if (totalMembers < 2) return;

    this.activeMemberIndex.update((index) => (index + 1) % totalMembers);
  }

  startSwipe(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;

    this.swipeStartX = event.clientX;
  }

  finishSwipe(event: PointerEvent, totalMembers: number): void {
    if (this.swipeStartX === null || !event.isPrimary) return;

    const distance = event.clientX - this.swipeStartX;
    this.swipeStartX = null;

    if (Math.abs(distance) < 48) return;

    if (distance < 0) {
      this.showNextMember(totalMembers);
    } else {
      this.showPreviousMember(totalMembers);
    }
  }

  cancelSwipe(): void {
    this.swipeStartX = null;
  }
}
