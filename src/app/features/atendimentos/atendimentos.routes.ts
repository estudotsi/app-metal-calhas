import { Routes } from '@angular/router';

export const ATENDIMENTOS_ROUTES: Routes = [
  {
    path: ':id/alterar',
    loadComponent: () =>
      import('./pages/alterar-atendimento/alterar-atendimento.page').then(
        (m) => m.AlterarAtendimentoPage,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/listar-atendimentos/listar-atendimentos.page').then(
        (m) => m.ListarAtendimentosPage,
      ),
  },
];
