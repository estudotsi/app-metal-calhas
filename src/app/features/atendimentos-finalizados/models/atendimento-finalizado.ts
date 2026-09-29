import { Atendimento } from '../../atendimentos/models/atendimento';

export interface AtendimentoFinalizado extends Atendimento {
  atendente?: string | null;
  atendenteSecundario?: string | null;
}

export interface AtendimentosFinalizadosPagina {
  data: AtendimentoFinalizado[];
  total: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}
