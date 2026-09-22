export interface Agendamento {
  agendamentoId: number;
  processoOrcamentoId?: number | null;
  nomeCliente: string;
  telefoneCliente?: string | null;
  nomeVendedor?: string | null;
  orcamentista?: string | null;
  logradouro: string;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  googlePlaceId?: string | null;
  observacao?: string | null;
  dataAgendamento?: string | null;
  horaAgendamento?: string | null;
  dataCriacao: string;
  aberto: boolean;
}

export interface AgendamentosPagina {
  data: Agendamento[];
  total: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface ArquivoAgendamento {
  agendamentoArquivoId: number;
  nomeOriginal: string;
  contentType: string;
  tamanhoBytes: number;
  dataUpload: string;
}

export interface AgendamentoDetalhe extends Agendamento {
  dataConclusao?: string | null;
  arquivos: ArquivoAgendamento[];
}

export interface AlterarAgendamentoRequest {
  nomeCliente: string;
  telefoneCliente: string | null;
  nomeVendedor: string | null;
  orcamentista: string | null;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  googlePlaceId: string | null;
  observacao: string | null;
  dataAgendamento: string | null;
  horaAgendamento: string | null;
}

export interface NovoAgendamentoProcessoResponse {
  processoOrcamentoId: number;
  agendamentoId: number;
}

export type SituacaoAgendamento = 'abertos' | 'concluidos';
