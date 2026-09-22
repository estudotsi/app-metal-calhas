import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AgendamentoDetalhe,
  AgendamentosPagina,
  AlterarAgendamentoRequest,
  NovoAgendamentoProcessoResponse,
  SituacaoAgendamento,
} from '../models/agendamento';

export interface AgendamentosFiltro {
  situacao: SituacaoAgendamento;
  dataAgendamento: string;
  sortDirection: 'asc' | 'desc';
  pageNumber: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AgendamentosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mobile/agendamentos`;

  listar(filtro: AgendamentosFiltro): Observable<AgendamentosPagina> {
    const url = filtro.situacao === 'concluidos' ? `${this.baseUrl}/concluidos` : this.baseUrl;
    let params = new HttpParams()
      .set('pageNumber', filtro.pageNumber)
      .set('pageSize', filtro.pageSize)
      .set('sortBy', 'horaagendamento')
      .set('sortDirection', filtro.sortDirection);

    if (filtro.dataAgendamento) {
      params = params.set('dataAgendamento', filtro.dataAgendamento);
    }

    return this.http.get<AgendamentosPagina>(url, { params });
  }

  buscarPorId(agendamentoId: number): Observable<AgendamentoDetalhe> {
    return this.http.get<AgendamentoDetalhe>(`${this.baseUrl}/${agendamentoId}`);
  }

  alterar(agendamentoId: number, request: AlterarAgendamentoRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${agendamentoId}`, request);
  }

  concluirSemOrcamento(agendamentoId: number): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/${agendamentoId}/concluir-sem-orcamento`,
      null,
    );
  }

  criarNovoNoProcesso(
    agendamentoId: number,
  ): Observable<NovoAgendamentoProcessoResponse> {
    return this.http.post<NovoAgendamentoProcessoResponse>(
      `${this.baseUrl}/${agendamentoId}/novo-agendamento`,
      null,
    );
  }

  excluir(agendamentoId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${agendamentoId}`);
  }

  adicionarArquivos(
    agendamentoId: number,
    arquivos: File[],
  ): Observable<HttpEvent<void>> {
    const formData = new FormData();
    arquivos.forEach((arquivo) => formData.append('Arquivos', arquivo));

    return this.http.post<void>(`${this.baseUrl}/${agendamentoId}/arquivos`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }

  baixarArquivo(agendamentoId: number, arquivoId: number): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${agendamentoId}/arquivos/${arquivoId}/download`,
      { responseType: 'blob' },
    );
  }

  excluirArquivo(agendamentoId: number, arquivoId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${agendamentoId}/arquivos/${arquivoId}`,
    );
  }
}
