import { Routes } from '@angular/router';

export const AGENDAMENTOS_ROUTES: Routes = [
  {
    path: ':id/alterar',
    loadComponent: () =>
      import('./pages/alterar-agendamento/alterar-agendamento.page').then(
        (m) => m.AlterarAgendamentoPage,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/listar-agendamentos/listar-agendamentos.page').then(
        (m) => m.ListarAgendamentosPage,
      ),
  },
];
