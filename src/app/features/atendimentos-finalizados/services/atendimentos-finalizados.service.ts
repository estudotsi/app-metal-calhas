import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ArquivoAgendamentoOrigem,
  AtendimentoDetalhe,
} from '../../atendimentos/models/atendimento';
import { AtendimentosFinalizadosPagina } from '../models/atendimento-finalizado';

@Injectable({ providedIn: 'root' })
export class AtendimentosFinalizadosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mobile/orcamentista/atendimentos`;

  listar(
    pageNumber: number,
    pageSize: number,
    nomeCliente?: string,
  ): Observable<AtendimentosFinalizadosPagina> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('sortBy', 'atendimentoid')
      .set('sortDirection', 'desc');

    if (nomeCliente) params = params.set('nomeCliente', nomeCliente);

    return this.http.get<AtendimentosFinalizadosPagina>(`${this.baseUrl}/concluidos`, { params });
  }

  buscarPorId(atendimentoId: number): Observable<AtendimentoDetalhe> {
    return this.http.get<AtendimentoDetalhe>(`${this.baseUrl}/${atendimentoId}`);
  }

  baixarArquivo(atendimentoId: number, arquivoId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${atendimentoId}/arquivos/${arquivoId}/download`, {
      responseType: 'blob',
    });
  }

  listarArquivosAgendamentoOrigem(atendimentoId: number): Observable<ArquivoAgendamentoOrigem[]> {
    return this.http.get<ArquivoAgendamentoOrigem[]>(
      `${this.baseUrl}/${atendimentoId}/arquivos-agendamento-origem`,
    );
  }

  visualizarArquivoAgendamentoOrigem(atendimentoId: number, arquivoId: number): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${atendimentoId}/arquivos-agendamento-origem/${arquivoId}`,
      { responseType: 'blob' },
    );
  }
}
