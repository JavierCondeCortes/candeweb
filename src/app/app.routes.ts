import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { adminOwnerGuard } from './core/guards/admin-owner.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';
import {
  setupAuthGuard,
  setupManagerGuard,
  setupUploaderGuard,
} from './core/guards/setup-auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'home.meta.title',
    loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
  },
  {
    path: 'candeonato',
    title: 'candeonato.meta.title',
    loadComponent: () =>
      import('./pages/candeonato/candeonato-page').then((module) => module.CandeonatoPage),
  },
  {
    path: 'candeonatos',
    title: 'candeonato.meta.historyTitle',
    loadComponent: () =>
      import('./pages/championship-history/championship-history-page').then(
        (module) => module.ChampionshipHistoryPage,
      ),
  },
  {
    path: 'candeonatos/:torneoId',
    title: 'candeonato.meta.detailTitle',
    loadComponent: () =>
      import('./pages/championship-history/championship-detail-page').then(
        (module) => module.ChampionshipDetailPage,
      ),
  },
  {
    path: 'setups/acceso',
    title: 'home.setups.meta.login',
    data: { mode: 'login' },
    loadComponent: () =>
      import('./pages/setups/setup-auth/setup-auth').then((module) => module.SetupAuth),
  },
  {
    path: 'setups/solicitar-acceso',
    title: 'home.setups.meta.request',
    data: { mode: 'request' },
    loadComponent: () =>
      import('./pages/setups/setup-auth/setup-auth').then((module) => module.SetupAuth),
  },
  {
    path: 'setups/aceptar-invitacion',
    title: 'home.setups.meta.invitation',
    data: { mode: 'invitation' },
    loadComponent: () =>
      import('./pages/setups/setup-auth/setup-auth').then((module) => module.SetupAuth),
  },
  {
    path: 'setups',
    canActivate: [setupAuthGuard],
    loadComponent: () =>
      import('./pages/setups/setup-shell/setup-shell').then((module) => module.SetupShell),
    children: [
      {
        path: '',
        title: 'home.setups.meta.catalog',
        loadComponent: () =>
          import('./pages/setups/setup-catalog/setup-catalog').then(
            (module) => module.SetupCatalog,
          ),
      },
      {
        path: 'nuevo',
        title: 'home.setups.meta.new',
        canActivate: [setupUploaderGuard],
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/setups/setup-form/setup-form').then((module) => module.SetupForm),
      },
      {
        path: 'usuarios',
        title: 'home.setups.meta.users',
        canActivate: [setupManagerGuard],
        loadComponent: () =>
          import('./pages/setups/setup-users/setup-users').then((module) => module.SetupUsers),
      },
      {
        path: ':id/editar',
        title: 'home.setups.meta.edit',
        canActivate: [setupUploaderGuard],
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/setups/setup-form/setup-form').then((module) => module.SetupForm),
      },
      {
        path: ':id',
        title: 'home.setups.meta.detail',
        loadComponent: () =>
          import('./pages/setups/setup-detail/setup-detail').then((module) => module.SetupDetail),
      },
    ],
  },
  {
    path: 'admin/login',
    title: 'admin.meta.login',
    loadComponent: () =>
      import('./pages/admin/admin-login/admin-login').then((module) => module.AdminLogin),
  },
  {
    path: 'admin/solicitar-acceso',
    title: 'admin.meta.requestAccess',
    loadComponent: () =>
      import('./pages/admin/admin-access-request/admin-access-request').then(
        (module) => module.AdminAccessRequestPage,
      ),
  },
  {
    path: 'admin/aceptar-invitacion',
    title: 'admin.meta.acceptInvitation',
    loadComponent: () =>
      import('./pages/admin/admin-accept-invitation/admin-accept-invitation').then(
        (module) => module.AdminAcceptInvitation,
      ),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./pages/admin/admin-shell/admin-shell').then((module) => module.AdminShell),
    children: [
      {
        path: '',
        title: 'admin.meta.dashboard',
        loadComponent: () =>
          import('./pages/admin/admin-dashboard/admin-dashboard').then(
            (module) => module.AdminDashboard,
          ),
      },
      {
        path: 'miembros',
        title: 'admin.meta.members',
        loadComponent: () =>
          import('./pages/admin/admin-members/admin-members').then((module) => module.AdminMembers),
      },
      {
        path: 'miembros/nuevo',
        title: 'admin.meta.newMember',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-member-form/admin-member-form').then(
            (module) => module.AdminMemberForm,
          ),
      },
      {
        path: 'miembros/:id',
        title: 'admin.meta.editMember',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-member-form/admin-member-form').then(
            (module) => module.AdminMemberForm,
          ),
      },
      {
        path: 'candeonatos',
        title: 'admin.meta.championships',
        loadComponent: () =>
          import('./pages/admin/admin-championships/admin-championships').then(
            (module) => module.AdminChampionships,
          ),
      },
      {
        path: 'sponsors',
        title: 'admin.meta.sponsors',
        loadComponent: () =>
          import('./pages/admin/admin-sponsors/admin-sponsors').then(
            (module) => module.AdminSponsors,
          ),
      },
      {
        path: 'sponsors/nuevo',
        title: 'admin.meta.newSponsor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-sponsor-form/admin-sponsor-form').then(
            (module) => module.AdminSponsorForm,
          ),
      },
      {
        path: 'sponsors/:id',
        title: 'admin.meta.editSponsor',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-sponsor-form/admin-sponsor-form').then(
            (module) => module.AdminSponsorForm,
          ),
      },
      {
        path: 'candeonatos/nuevo',
        title: 'admin.meta.newChampionship',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-championship-form/admin-championship-form').then(
            (module) => module.AdminChampionshipForm,
          ),
      },
      {
        path: 'candeonatos/:id',
        title: 'admin.meta.editChampionship',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./pages/admin/admin-championship-form/admin-championship-form').then(
            (module) => module.AdminChampionshipForm,
          ),
      },
      {
        path: 'ajustes',
        title: 'admin.meta.settings',
        loadComponent: () =>
          import('./pages/admin/admin-settings/admin-settings').then(
            (module) => module.AdminSettings,
          ),
      },
      {
        path: 'seguridad',
        title: 'admin.meta.security',
        loadComponent: () =>
          import('./pages/admin/admin-security/admin-security').then(
            (module) => module.AdminSecurity,
          ),
      },
      {
        path: 'administradores',
        title: 'admin.meta.users',
        canActivate: [adminOwnerGuard],
        loadComponent: () =>
          import('./pages/admin/admin-users/admin-users').then((module) => module.AdminUsers),
      },
      {
        path: 'auditoria',
        title: 'admin.meta.audit',
        loadComponent: () =>
          import('./pages/admin/admin-audit/admin-audit').then((module) => module.AdminAudit),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
