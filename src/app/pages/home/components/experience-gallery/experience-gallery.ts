import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, map, of, startWith } from 'rxjs';
import { PublicContentService } from '../../../../core/services/public-content.service';

@Component({
  selector: 'app-experience-gallery',
  imports: [AsyncPipe, DecimalPipe],
  templateUrl: './experience-gallery.html',
})
export class ExperienceGallery {
  private readonly content = inject(PublicContentService);

  readonly state$ = this.content.getTwitchContent().pipe(
    map((content) => ({ kind: 'ready' as const, content })),
    startWith({ kind: 'loading' as const, content: null }),
    catchError(() => of({ kind: 'error' as const, content: null })),
  );
}
