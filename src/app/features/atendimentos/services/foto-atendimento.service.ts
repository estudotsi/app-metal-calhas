import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../environments/environment';
import { NativePhoto } from '../../../core/native/native-photo.plugin';
import { TokenStorageService } from '../../../core/services/token-storage.service';

export type ResultadoEnvioFotoAtendimento = 'cancelado' | 'enviado';

@Injectable({ providedIn: 'root' })
export class FotoAtendimentoService {
  private readonly tokenStorage = inject(TokenStorageService);

  async capturarEEnviar(
    atendimentoId: number,
    informarProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvioFotoAtendimento> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('A captura de foto está disponível somente no aplicativo Android.');
    }

    const captura = await NativePhoto.capturePhoto();
    if (captura.cancelled) return 'cancelado';
    if (!captura.path) throw new Error('A foto capturada não foi encontrada.');

    const token = this.tokenStorage.getToken();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

    const listener = await NativePhoto.addListener('photoUploadProgress', (evento) =>
      informarProgresso(evento.percent),
    );

    try {
      await NativePhoto.uploadPhoto({
        path: captura.path,
        url: `${environment.apiUrl}/mobile/atendimentos/${atendimentoId}/fotos`,
        token,
      });
      return 'enviado';
    } finally {
      await listener.remove();
    }
  }
}
