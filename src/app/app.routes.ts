import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Candemor Racing Team · Simracing y comunidad',
    loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
  },
  {
    path: 'candeonato',
    title: 'Candeonato #8 · New Era Edition',
    loadComponent: () =>
      import('./candeonato/candeonato-page').then((module) => module.CandeonatoPage),
  },
  {
    path: 'candeonatos',
    title: 'Historial de Candeonatos',
    loadComponent: () =>
      import('./pages/championship-history/championship-history-page').then(
        (module) => module.ChampionshipHistoryPage,
      ),
  },
  {
    path: 'candeonatos/:torneoId',
    title: 'Clasificación · Candeonato',
    loadComponent: () =>
      import('./pages/championship-history/championship-detail-page').then(
        (module) => module.ChampionshipDetailPage,
      ),
  },
  {
    path: 'admin/login',
    title: 'Acceso · Administración Candemor',
    loadComponent: () =>
      import('./pages/admin/admin-login/admin-login').then((module) => module.AdminLogin),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./pages/admin/admin-shell/admin-shell').then((module) => module.AdminShell),
    children: [
      {
        path: '',
        title: 'Resumen · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-dashboard/admin-dashboard').then(
            (module) => module.AdminDashboard,
          ),
      },
      {
        path: 'miembros',
        title: 'Miembros · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-members/admin-members').then((module) => module.AdminMembers),
      },
      {
        path: 'miembros/nuevo',
        title: 'Nuevo miembro · Administración Candemor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-member-form/admin-member-form').then(
            (module) => module.AdminMemberForm,
          ),
      },
      {
        path: 'miembros/:id',
        title: 'Editar miembro · Administración Candemor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-member-form/admin-member-form').then(
            (module) => module.AdminMemberForm,
          ),
      },
      {
        path: 'candeonatos',
        title: 'Candeonatos · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-championships/admin-championships').then(
            (module) => module.AdminChampionships,
          ),
      },
      {
        path: 'candeonatos/nuevo',
        title: 'Nuevo Candeonato · Administración Candemor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-championship-form/admin-championship-form').then(
            (module) => module.AdminChampionshipForm,
          ),
      },
      {
        path: 'candeonatos/:id',
        title: 'Editar Candeonato · Administración Candemor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-championship-form/admin-championship-form').then(
            (module) => module.AdminChampionshipForm,
          ),
      },
      {
        path: 'ajustes',
        title: 'Ajustes · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-settings/admin-settings').then(
            (module) => module.AdminSettings,
          ),
      },
      {
        path: 'seguridad',
        title: 'Seguridad · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-security/admin-security').then(
            (module) => module.AdminSecurity,
          ),
      },
      {
        path: 'auditoria',
        title: 'Auditoría · Administración Candemor',
        loadComponent: () =>
          import('./pages/admin/admin-audit/admin-audit').then((module) => module.AdminAudit),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
