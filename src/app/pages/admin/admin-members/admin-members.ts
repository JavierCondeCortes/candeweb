import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TeamMemberContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../admin-form-errors';

@Component({
  selector: 'app-admin-members',
  imports: [RouterLink],
  templateUrl: './admin-members.html',
})
export class AdminMembers implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly members = signal<TeamMemberContent[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly query = signal('');
  readonly statusFilter = signal<'all' | TeamMemberContent['status']>('all');
  readonly isFiltered = computed(
    () => Boolean(this.query().trim()) || this.statusFilter() !== 'all',
  );
  readonly filteredMembers = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    const status = this.statusFilter();
    return this.members().filter(
      (member) =>
        (status === 'all' || member.status === status) &&
        (!query ||
          [member.name, member.alias, member.roleLabel]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase('es').includes(query))),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  move(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    const current = [...this.members()];
    if (nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    this.members.set(current);
    this.message.set('Guardando orden…');
    this.api.reorderMembers(current.map((member) => member.id)).subscribe({
      next: () => this.message.set('Orden guardado.'),
      error: (error) => {
        this.errorMessage.set(apiErrorMessage(error));
        this.load();
      },
    });
  }

  runAction(member: TeamMemberContent, action: 'publish' | 'archive'): void {
    if (
      action === 'archive' &&
      !window.confirm(
        `¿Archivar a ${member.name}? El perfil dejará de aparecer en la web pública, pero conservará sus datos.`,
      )
    )
      return;
    this.busyId.set(member.id);
    this.errorMessage.set('');
    this.api
      .memberAction(member.id, action)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: ({ member: updated }) => {
          this.members.update((members) =>
            members.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.message.set(action === 'publish' ? 'Miembro publicado.' : 'Miembro archivado.');
        },
        error: (error) => this.errorMessage.set(apiErrorMessage(error)),
      });
  }

  deleteMember(member: TeamMemberContent): void {
    if (
      !window.confirm(
        `¿Eliminar a ${member.name}? Dejará de aparecer en el panel y esta acción no se puede deshacer desde la web.`,
      )
    )
      return;
    this.busyId.set(member.id);
    this.errorMessage.set('');
    this.api
      .deleteMember(member.id)
      .pipe(finalize(() => this.busyId.set('')))
      .subscribe({
        next: () => {
          this.members.update((members) => members.filter((item) => item.id !== member.id));
          this.message.set('Miembro eliminado.');
        },
        error: (error) => this.errorMessage.set(apiErrorMessage(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getMembers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ members }) => this.members.set(members),
        error: (error) => this.errorMessage.set(apiErrorMessage(error)),
      });
  }
}
