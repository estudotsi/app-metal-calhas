import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AlterarAtendimentoRequest,
  ArquivoAgendamentoOrigem,
  AtendimentoDetalhe,
  AtendimentosPagina,
  ConcluirAtendimentoResponse,
  SituacaoAtendimento,
} from '../models/atendimento';

export interface AtendimentosFiltro {
  situacao: SituacaoAtendimento;
  dataAgendamento: string;
  sortDirection: 'asc' | 'desc';
  pageNumber: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AtendimentosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mobile/atendimentos`;

  listar(filtro: AtendimentosFiltro): Observable<AtendimentosPagina> {
    const url = filtro.situacao === 'concluidos' ? `${this.baseUrl}/concluidos` : this.baseUrl;
    let params = new HttpParams()
      .set('pageNumber', filtro.pageNumber)
      .set('pageSize', filtro.pageSize)
      .set('sortBy', 'horaagendamento')
      .set('sortDirection', filtro.sortDirection);

    if (filtro.dataAgendamento) {
      params = params.set('dataAgendamento', filtro.dataAgendamento);
    }

    return this.http.get<AtendimentosPagina>(url, { params });
  }

  buscarPorId(atendimentoId: number): Observable<AtendimentoDetalhe> {
    return this.http.get<AtendimentoDetalhe>(`${this.baseUrl}/${atendimentoId}`);
  }

  alterar(atendimentoId: number, request: AlterarAtendimentoRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${atendimentoId}`, request);
  }

  concluir(atendimentoId: number): Observable<ConcluirAtendimentoResponse> {
    return this.http.post<ConcluirAtendimentoResponse>(
      `${this.baseUrl}/${atendimentoId}/concluir`,
      null,
    );
  }

  adicionarArquivos(atendimentoId: number, arquivos: File[]): Observable<HttpEvent<void>> {
    const formData = new FormData();
    arquivos.forEach((arquivo) => formData.append('Arquivos', arquivo));

    return this.http.post<void>(`${this.baseUrl}/${atendimentoId}/arquivos`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }

  baixarArquivo(atendimentoId: number, arquivoId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${atendimentoId}/arquivos/${arquivoId}/download`, {
      responseType: 'blob',
    });
  }

  excluirArquivo(atendimentoId: number, arquivoId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${atendimentoId}/arquivos/${arquivoId}`);
  }

  listarArquivosAgendamentoOrigem(atendimentoId: number): Observable<ArquivoAgendamentoOrigem[]> {
    return this.http.get<ArquivoAgendamentoOrigem[]>(
      `${this.baseUrl}/${atendimentoId}/arquivos-agendamento-origem`,
    );
  }

  visualizarArquivoAgendamentoOrigem(
    atendimentoId: number,
    arquivoId: number,
  ): Observable<HttpEvent<Blob>> {
    return this.http.get(
      `${this.baseUrl}/${atendimentoId}/arquivos-agendamento-origem/${arquivoId}`,
      {
        observe: 'events',
        reportProgress: true,
        responseType: 'blob',
      },
    );
  }
}
