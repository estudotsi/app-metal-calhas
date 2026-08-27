import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../environments/environment';
import { NativeVideo } from '../../../core/native/native-video.plugin';
import { TokenStorageService } from '../../../core/services/token-storage.service';

export type ResultadoEnvioVideoAtendimento = 'cancelado' | 'enviado';

@Injectable({ providedIn: 'root' })
export class VideoAtendimentoService {
  private readonly tokenStorage = inject(TokenStorageService);

  async capturarEEnviar(
    atendimentoId: number,
    informarProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvioVideoAtendimento> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('A gravação de vídeo está disponível somente no aplicativo Android.');
    }

    const captura = await NativeVideo.captureVideo();
    if (captura.cancelled) return 'cancelado';
    if (!captura.path) throw new Error('O arquivo gravado não foi encontrado.');

    const token = this.tokenStorage.getToken();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

    const listener = await NativeVideo.addListener('videoUploadProgress', (evento) =>
      informarProgresso(evento.percent),
    );

    try {
      await NativeVideo.uploadVideo({
        path: captura.path,
        url: `${environment.apiUrl}/mobile/atendimentos/${atendimentoId}/videos`,
        token,
      });
      return 'enviado';
    } finally {
      await listener.remove();
    }
  }
}
