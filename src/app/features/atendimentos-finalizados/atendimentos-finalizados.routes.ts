import { Routes } from '@angular/router';

export const ATENDIMENTOS_FINALIZADOS_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () =>
      import(
        './pages/visualizar-atendimento-finalizado/visualizar-atendimento-finalizado.page'
      ).then((m) => m.VisualizarAtendimentoFinalizadoPage),
  },
  {
    path: '',
    loadComponent: () =>
      import(
        './pages/listar-atendimentos-finalizados/listar-atendimentos-finalizados.page'
      ).then((m) => m.ListarAtendimentosFinalizadosPage),
  },
];
