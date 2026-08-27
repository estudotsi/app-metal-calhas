import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { montadorGuard } from './core/guards/montador.guard';
import { orcamentistaGuard } from './core/guards/orcamentista.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'agendamentos',
    canActivate: [authGuard, orcamentistaGuard],
    loadChildren: () =>
      import('./features/agendamentos/agendamentos.routes').then((m) => m.AGENDAMENTOS_ROUTES),
  },
  {
    path: 'atendimentos',
    canActivate: [authGuard, montadorGuard],
    loadChildren: () =>
      import('./features/atendimentos/atendimentos.routes').then((m) => m.ATENDIMENTOS_ROUTES),
  },
  {
    path: 'inicio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/inicio/pages/inicio/inicio.page').then((m) => m.InicioPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  { path: '**', redirectTo: 'auth/login' },
];
