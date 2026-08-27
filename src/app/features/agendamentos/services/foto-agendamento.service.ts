import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativePhoto } from '../../../core/native/native-photo.plugin';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { environment } from '../../../../environments/environment';

export type ResultadoEnvioFoto = 'cancelado' | 'enviado';

@Injectable({ providedIn: 'root' })
export class FotoAgendamentoService {
  private readonly tokenStorage = inject(TokenStorageService);

  async capturarEEnviar(
    agendamentoId: number,
    informarProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvioFoto> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('A captura de foto está disponível somente no aplicativo Android.');
    }

    const captura = await NativePhoto.capturePhoto();
    if (captura.cancelled) return 'cancelado';
    if (!captura.path) throw new Error('A foto capturada não foi encontrada.');

    const token = this.tokenStorage.getToken();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

    const listener = await NativePhoto.addListener(
      'photoUploadProgress',
      (evento) => informarProgresso(evento.percent),
    );

    try {
      await NativePhoto.uploadPhoto({
        path: captura.path,
        url: `${environment.apiUrl}/mobile/agendamentos/${agendamentoId}/fotos`,
        token,
      });
      return 'enviado';
    } finally {
      await listener.remove();
    }
  }
}
