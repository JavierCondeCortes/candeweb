import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ChampionshipContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-championships',
  imports: [RouterLink],
  templateUrl: './admin-championships.html',
})
export class AdminChampionships implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly championships = signal<ChampionshipContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly query = signal('');
  readonly statusFilter = signal<'all' | ChampionshipContent['status']>('all');
  readonly filteredChampionships = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    const status = this.statusFilter();
    return this.championships().filter(
      (championship) =>
        (status === 'all' || championship.status === status) &&
        (!query ||
          [championship.name, championship.season, championship.subtitle]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase('es').includes(query))),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  runAction(
    championship: ChampionshipContent,
    action: 'publish' | 'archive' | 'feature' | 'sync',
  ): void {
    if (
      action === 'archive' &&
      !window.confirm(
        `¿Archivar ${championship.name}? Dejará de estar destacada y permanecerá disponible en el historial público.`,
      )
    )
      return;
    this.busyId.set(championship.id);
    this.message.set(action === 'sync' ? 'Sincronizando con Fat Cat Race…' : 'Guardando cambio…');
    this.errorMessage.set('');
    this.api
      .championshipAction(championship.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.message.set(
            action === 'sync'
              ? 'Datos deportivos sincronizados.'
              : action === 'feature'
                ? 'Edición destacada actualizada.'
                : 'Estado actualizado.',
          );
          this.load();
        },
        error: (error) => {
          this.message.set('');
          this.errorMessage.set(apiErrorMessage(error));
          this.load();
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getChampionships()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ championships }) => this.championships.set(championships),
        error: (error) => this.errorMessage.set(apiErrorMessage(error)),
      });
  }
}
