import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

const PREFIXO = '[MetalCalhas HTTP]';
const CAMPOS_SENSIVEIS = /^(accessToken|authorization|password|refreshToken|senha|token)$/i;

export const debugHttpInterceptor: HttpInterceptorFn = (request, next) => {
  if (environment.production) return next(request);

  const inicio = performance.now();
  console.info(
    `${PREFIXO} REQUEST  ${request.method} ${request.urlWithParams}${formatarCorpo(request.body)}`,
  );

  return next(request).pipe(
    tap({
      next: (event) => {
        if (!(event instanceof HttpResponse)) return;

        console.info(
          `${PREFIXO} RESPONSE ${event.status} ${request.method} ${request.urlWithParams} (${duracao(inicio)} ms)${formatarCorpo(event.body)}`,
        );
      },
      error: (error: unknown) => {
        const httpError = error instanceof HttpErrorResponse ? error : null;
        console.error(
          `${PREFIXO} ERROR ${httpError?.status || 'SEM STATUS'} ${request.method} ${request.urlWithParams} (${duracao(inicio)} ms)${formatarCorpo(httpError?.error ?? error)}`,
        );
      },
    }),
  );
};

function duracao(inicio: number): number {
  return Math.round(performance.now() - inicio);
}

function formatarCorpo(valor: unknown): string {
  if (valor === undefined || valor === null) return '';

  try {
    const json = JSON.stringify(ocultarDadosSensiveis(valor), null, 2);
    const linhas = json.split('\n').map((linha) => `${PREFIXO}   ${linha}`);
    return `\n${linhas.join('\n')}`;
  } catch {
    return `\n${PREFIXO}   [conteudo nao serializavel]`;
  }
}

function ocultarDadosSensiveis(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ocultarDadosSensiveis);

  if (typeof valor !== 'object' || valor === null) return valor;

  return Object.fromEntries(
    Object.entries(valor).map(([chave, conteudo]) => [
      chave,
      CAMPOS_SENSIVEIS.test(chave) ? '[OCULTO]' : ocultarDadosSensiveis(conteudo),
    ]),
  );
}
