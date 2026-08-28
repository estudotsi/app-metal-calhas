import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EnderecoGoogleResolvidoView,
  EnderecoGoogleSugestaoView,
  EnderecoView,
} from '../models/endereco';

@Injectable({ providedIn: 'root' })
export class EnderecosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mobile/enderecos`;

  buscarSugestoesGoogle(
    texto: string,
    sessionToken: string,
  ): Observable<EnderecoGoogleSugestaoView[]> {
    const params = new HttpParams().set('texto', texto.trim()).set('sessionToken', sessionToken);

    return this.http.get<EnderecoGoogleSugestaoView[]>(`${this.baseUrl}/google/autocomplete`, {
      params,
    });
  }

  buscarDetalhesGoogle(placeId: string, sessionToken: string): Observable<EnderecoView> {
    const params = new HttpParams().set('sessionToken', sessionToken);

    return this.http.get<EnderecoView>(`${this.baseUrl}/google/${encodeURIComponent(placeId)}`, {
      params,
    });
  }

  resolverEnderecoGoogle(
    logradouro: string,
    numero: string,
    bairro: string,
    cidade: string,
    uf: string,
  ): Observable<EnderecoGoogleResolvidoView> {
    const params = new HttpParams()
      .set('logradouro', logradouro.trim())
      .set('numero', numero.trim())
      .set('bairro', bairro.trim())
      .set('cidade', cidade.trim())
      .set('uf', uf.trim());

    return this.http.get<EnderecoGoogleResolvidoView>(`${this.baseUrl}/google/resolver`, {
      params,
    });
  }
}
