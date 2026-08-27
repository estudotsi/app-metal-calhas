import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeVideo } from '../../../core/native/native-video.plugin';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { environment } from '../../../../environments/environment';

export type ResultadoEnvioVideo = 'cancelado' | 'enviado';

@Injectable({ providedIn: 'root' })
export class VideoAgendamentoService {
  private readonly tokenStorage = inject(TokenStorageService);

  async capturarEEnviar(
    agendamentoId: number,
    informarProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvioVideo> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('A gravação de vídeo está disponível somente no aplicativo Android.');
    }

    const captura = await NativeVideo.captureVideo();
    if (captura.cancelled) return 'cancelado';
    if (!captura.path) throw new Error('O arquivo gravado não foi encontrado.');

    const token = this.tokenStorage.getToken();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

    const listener = await NativeVideo.addListener(
      'videoUploadProgress',
      (evento) => informarProgresso(evento.percent),
    );

    try {
      await NativeVideo.uploadVideo({
        path: captura.path,
        url: `${environment.apiUrl}/mobile/agendamentos/${agendamentoId}/videos`,
        token,
      });
      return 'enviado';
    } finally {
      await listener.remove();
    }
  }
}
