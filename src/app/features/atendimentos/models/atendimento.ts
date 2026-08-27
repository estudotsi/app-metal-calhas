export interface Atendimento {
  atendimentoId: number;
  nomeCliente: string;
  nomeVendedor?: string | null;
  telefoneCliente?: string | null;
  logradouro: string;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  observacao?: string | null;
  retorno: boolean;
  dataAgendamento?: string | null;
  horaAgendamento?: string | null;
  dataCriacao: string;
}

export interface AtendimentoDetalhe extends Atendimento {
  agendamentoOrigemId?: number | null;
  atendente: string;
  dataConclusao?: string | null;
  aberto: boolean;
  arquivos: ArquivoAtendimento[];
}

export interface ArquivoAtendimento {
  atendimentoArquivoId: number;
  nomeOriginal: string;
  contentType: string;
  tamanhoBytes: number;
  dataUpload: string;
}

export interface AlterarAtendimentoRequest {
  nomeCliente: string;
  telefoneCliente: string;
  atendente: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacao: string | null;
  dataAgendamento: string | null;
  horaAgendamento: string | null;
}

export interface ConcluirAtendimentoResponse {
  atendimentoId: number;
  processoOrcamentoId?: number | null;
  orcamentoOrigemId?: number | null;
  dataConclusao: string;
}

export interface AtendimentosPagina {
  data: Atendimento[];
  total: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface ArquivoAgendamentoOrigem {
  arquivoId: number;
  nomeOriginal: string;
  contentType?: string | null;
  tamanhoBytes: number;
  dataUpload: string;
}

export type SituacaoAtendimento = 'nao-concluidos' | 'concluidos';
