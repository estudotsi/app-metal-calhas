import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import {
  alertCircleOutline,
  arrowBackOutline,
  calendarOutline,
  cameraOutline,
  chatboxEllipsesOutline,
  checkmarkCircleOutline,
  closeOutline,
  createOutline,
  documentOutline,
  imageOutline,
  imagesOutline,
  locationOutline,
  logoWhatsapp,
  personOutline,
  playCircleOutline,
  timeOutline,
  videocamOutline,
} from 'ionicons/icons';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ArquivoAgendamentoOrigem,
  Atendimento,
  AtendimentosPagina,
  SituacaoAtendimento,
} from '../../models/atendimento';
import { AtendimentosService } from '../../services/atendimentos.service';
import { FotoAtendimentoService } from '../../services/foto-atendimento.service';
import { VideoAtendimentoService } from '../../services/video-atendimento.service';

const EMPTY_PAGE: AtendimentosPagina = {
  data: [],
  total: 0,
  pageNumber: 1,
  pageSize: 10,
  totalPages: 0,
};

@Component({
  selector: 'app-listar-atendimentos',
  templateUrl: './listar-atendimentos.page.html',
  styleUrl: './listar-atendimentos.page.scss',
  imports: [
    IonButton,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonHeader,
    IonIcon,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonToast,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListarAtendimentosPage implements OnDestroy {
  private readonly atendimentosService = inject(AtendimentosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fotoService = inject(FotoAtendimentoService);
  private readonly videoService = inject(VideoAtendimentoService);

  readonly user = this.auth.currentUser;
  readonly situacao = signal<SituacaoAtendimento>('nao-concluidos');
  readonly dataAgendamento = signal(this.formatarDataFiltro(new Date()));
  readonly direcaoHora = signal<'asc' | 'desc'>('asc');
  readonly pagina = signal<AtendimentosPagina>(EMPTY_PAGE);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly observacaoSelecionada = signal<Atendimento | null>(null);
  readonly atendimentoMidias = signal<Atendimento | null>(null);
  readonly carregandoMidias = signal(false);
  readonly arquivosOrigem = signal<ArquivoAgendamentoOrigem[]>([]);
  readonly erroMidias = signal('');
  readonly arquivoSelecionado = signal<ArquivoAgendamentoOrigem | null>(null);
  readonly carregandoArquivoId = signal<number | null>(null);
  readonly urlVisualizacao = signal('');
  readonly erroVisualizacao = signal('');
  readonly velocidadeVideo = signal(1);
  readonly bytesRecebidos = signal(0);
  readonly totalBytes = signal(0);
  readonly progressoDownload = signal(0);
  readonly enviandoFotoId = signal<number | null>(null);
  readonly progressoFoto = signal(0);
  readonly mensagemFoto = signal('');
  readonly erroFoto = signal(false);
  readonly enviandoVideoId = signal<number | null>(null);
  readonly progressoVideo = signal(0);
  readonly mensagemVideo = signal('');
  readonly erroVideo = signal(false);
  readonly atendimentoParaConcluir = signal<Atendimento | null>(null);
  readonly concluindoId = signal<number | null>(null);
  readonly mensagemAcao = signal('');
  readonly erroAcao = signal(false);
  readonly alertCircleOutline = alertCircleOutline;
  readonly arrowBackOutline = arrowBackOutline;
  readonly calendarOutline = calendarOutline;
  readonly cameraOutline = cameraOutline;
  readonly chatboxEllipsesOutline = chatboxEllipsesOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly closeOutline = closeOutline;
  readonly createOutline = createOutline;
  readonly documentOutline = documentOutline;
  readonly imageOutline = imageOutline;
  readonly imagesOutline = imagesOutline;
  readonly locationOutline = locationOutline;
  readonly logoWhatsapp = logoWhatsapp;
  readonly personOutline = personOutline;
  readonly playCircleOutline = playCircleOutline;
  readonly timeOutline = timeOutline;
  readonly videocamOutline = videocamOutline;

  private listaMidiasSubscription?: Subscription;
  private arquivoSubscription?: Subscription;

  ngOnDestroy(): void {
    this.listaMidiasSubscription?.unsubscribe();
    this.arquivoSubscription?.unsubscribe();
    this.liberarUrlVisualizacao();
  }

  ionViewWillEnter(): void {
    this.carregar();
  }

  alterarSituacao(situacao: SituacaoAtendimento): void {
    if (situacao === this.situacao()) return;

    this.situacao.set(situacao);
    this.pagina.update((pagina) => ({ ...pagina, pageNumber: 1 }));
    this.carregar();
  }

  alterarData(event: CustomEvent<{ value?: string | string[] | null }>): void {
    const valor = event.detail.value;
    const data = Array.isArray(valor) ? valor[0] : valor;

    if (!data) {
      this.limparData();
      return;
    }

    if (data === this.dataAgendamento()) return;

    this.dataAgendamento.set(data.substring(0, 10));
    this.pagina.update((pagina) => ({ ...pagina, pageNumber: 1 }));
    this.carregar();
  }

  limparData(): void {
    if (!this.dataAgendamento()) return;

    this.dataAgendamento.set('');
    this.pagina.update((pagina) => ({ ...pagina, pageNumber: 1 }));
    this.carregar();
  }

  alternarDirecaoHora(): void {
    this.direcaoHora.update((direcao) => (direcao === 'asc' ? 'desc' : 'asc'));
    this.pagina.update((pagina) => ({ ...pagina, pageNumber: 1 }));
    this.carregar();
  }

  paginaAnterior(): void {
    if (this.pagina().pageNumber <= 1) return;
    this.pagina.update((pagina) => ({ ...pagina, pageNumber: pagina.pageNumber - 1 }));
    this.carregar();
  }

  proximaPagina(): void {
    const pagina = this.pagina();
    if (pagina.pageNumber >= pagina.totalPages) return;
    this.pagina.update((atual) => ({ ...atual, pageNumber: atual.pageNumber + 1 }));
    this.carregar();
  }

  atualizar(event: CustomEvent): void {
    this.carregar(() => void (event.target as HTMLIonRefresherElement).complete());
  }

  sair(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  formatarHora(hora?: string | null): string {
    return hora ? hora.substring(0, 5) : 'Sem horário';
  }

  formatarData(data?: string | null): string {
    if (!data) return 'Sem data';

    const [ano, mes, dia] = data.substring(0, 10).split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  }

  formatarEndereco(atendimento: Atendimento): string {
    const endereco = [atendimento.logradouro, atendimento.numero].filter(Boolean).join(', ');
    const localidade = [atendimento.bairro, atendimento.cidade].filter(Boolean).join(' · ');
    return [endereco, localidade].filter(Boolean).join(' — ');
  }

  urlGoogleMaps(atendimento: Atendimento): string {
    const cidadeUf = [atendimento.cidade, atendimento.uf].filter(Boolean).join(' - ');
    const destino = [
      atendimento.logradouro,
      atendimento.numero,
      atendimento.bairro,
      cidadeUf,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
  }

  urlWhatsApp(telefone?: string | null): string {
    const digitos = telefone?.replace(/\D/g, '') ?? '';
    if (!digitos) return '';

    const numero = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
    return `https://wa.me/${numero}`;
  }

  abrirObservacao(atendimento: Atendimento): void {
    this.observacaoSelecionada.set(atendimento);
  }

  fecharObservacao(): void {
    this.observacaoSelecionada.set(null);
  }

  abrirAtendimento(atendimento: Atendimento): void {
    void this.router.navigate(['/atendimentos', atendimento.atendimentoId, 'alterar']);
  }

  abrirConfirmacaoConclusao(atendimento: Atendimento): void {
    if (this.situacao() !== 'nao-concluidos' || this.concluindoId() !== null) return;
    this.atendimentoParaConcluir.set(atendimento);
  }

  fecharConfirmacaoConclusao(): void {
    if (this.concluindoId() === null) this.atendimentoParaConcluir.set(null);
  }

  concluirAtendimento(): void {
    const atendimento = this.atendimentoParaConcluir();
    if (!atendimento || this.concluindoId() !== null) return;

    this.concluindoId.set(atendimento.atendimentoId);
    this.atendimentosService
      .concluir(atendimento.atendimentoId)
      .pipe(finalize(() => this.concluindoId.set(null)))
      .subscribe({
        next: () => {
          this.atendimentoParaConcluir.set(null);
          this.mensagemAcao.set('Atendimento concluído com sucesso.');
          this.erroAcao.set(false);
          this.carregar();
        },
        error: (erro) => {
          this.atendimentoParaConcluir.set(null);
          this.mensagemAcao.set(
            this.mensagemErro(erro, 'Não foi possível concluir o atendimento.'),
          );
          this.erroAcao.set(true);
        },
      });
  }


  async tirarFoto(atendimento: Atendimento): Promise<void> {
    if (
      this.situacao() === 'concluidos' ||
      this.enviandoFotoId() !== null ||
      this.enviandoVideoId() !== null
    ) {
      return;
    }

    this.enviandoFotoId.set(atendimento.atendimentoId);
    this.progressoFoto.set(0);
    this.mensagemFoto.set('');
    this.erroFoto.set(false);

    try {
      const resultado = await this.fotoService.capturarEEnviar(
        atendimento.atendimentoId,
        (percentual) => this.progressoFoto.set(percentual),
      );

      if (resultado === 'enviado') {
        this.mensagemFoto.set('Foto do atendimento enviada com sucesso.');
      }
    } catch (erro) {
      this.erroFoto.set(true);
      this.mensagemFoto.set(
        erro instanceof Error ? erro.message : 'Não foi possível enviar a foto.',
      );
    } finally {
      this.enviandoFotoId.set(null);
      this.progressoFoto.set(0);
    }
  }

  async gravarVideo(atendimento: Atendimento): Promise<void> {
    if (
      this.situacao() === 'concluidos' ||
      this.enviandoFotoId() !== null ||
      this.enviandoVideoId() !== null
    ) {
      return;
    }

    this.enviandoVideoId.set(atendimento.atendimentoId);
    this.progressoVideo.set(0);
    this.mensagemVideo.set('');
    this.erroVideo.set(false);

    try {
      const resultado = await this.videoService.capturarEEnviar(
        atendimento.atendimentoId,
        (percentual) => this.progressoVideo.set(percentual),
      );

      if (resultado === 'enviado') {
        this.mensagemVideo.set('Vídeo do atendimento enviado com sucesso.');
      }
    } catch (erro) {
      this.erroVideo.set(true);
      this.mensagemVideo.set(
        erro instanceof Error ? erro.message : 'Não foi possível enviar o vídeo.',
      );
    } finally {
      this.enviandoVideoId.set(null);
      this.progressoVideo.set(0);
    }
  }

  abrirMidias(atendimento: Atendimento): void {
    if (this.carregandoMidias()) return;

    this.atendimentoMidias.set(atendimento);
    this.carregandoMidias.set(true);
    this.arquivosOrigem.set([]);
    this.erroMidias.set('');
    this.fecharVisualizacao();

    this.listaMidiasSubscription?.unsubscribe();
    this.listaMidiasSubscription = this.atendimentosService
      .listarArquivosAgendamentoOrigem(atendimento.atendimentoId)
      .pipe(finalize(() => this.carregandoMidias.set(false)))
      .subscribe({
        next: (arquivos) => this.arquivosOrigem.set(arquivos ?? []),
        error: (erro) =>
          this.erroMidias.set(
            this.mensagemErro(erro, 'Não foi possível buscar as fotos e os vídeos.'),
          ),
      });
  }

  fecharMidias(): void {
    this.listaMidiasSubscription?.unsubscribe();
    this.arquivoSubscription?.unsubscribe();
    this.atendimentoMidias.set(null);
    this.carregandoMidias.set(false);
    this.arquivosOrigem.set([]);
    this.erroMidias.set('');
    this.fecharVisualizacao();
  }

  visualizarArquivo(arquivo: ArquivoAgendamentoOrigem): void {
    const atendimento = this.atendimentoMidias();
    if (!atendimento || this.carregandoArquivoId() !== null) return;

    this.arquivoSubscription?.unsubscribe();
    this.liberarUrlVisualizacao();
    this.arquivoSelecionado.set(arquivo);
    this.erroVisualizacao.set('');
    this.velocidadeVideo.set(1);
    this.iniciarProgresso(arquivo.tamanhoBytes);
    this.carregandoArquivoId.set(arquivo.arquivoId);

    this.arquivoSubscription = this.atendimentosService
      .visualizarArquivoAgendamentoOrigem(atendimento.atendimentoId, arquivo.arquivoId)
      .pipe(finalize(() => this.carregandoArquivoId.set(null)))
      .subscribe({
        next: (evento) => {
          if (evento.type === HttpEventType.DownloadProgress) {
            this.atualizarProgresso(evento.loaded, arquivo.tamanhoBytes, evento.total);
            return;
          }

          if (evento.type === HttpEventType.Response && evento.body) {
            this.atualizarProgresso(evento.body.size, arquivo.tamanhoBytes, evento.body.size);
            this.urlVisualizacao.set(URL.createObjectURL(evento.body));
          }
        },
        error: (erro) =>
          this.erroVisualizacao.set(this.mensagemErro(erro, 'Não foi possível abrir o arquivo.')),
      });
  }

  fecharVisualizacao(): void {
    this.arquivoSubscription?.unsubscribe();
    this.liberarUrlVisualizacao();
    this.arquivoSelecionado.set(null);
    this.carregandoArquivoId.set(null);
    this.erroVisualizacao.set('');
    this.velocidadeVideo.set(1);
    this.bytesRecebidos.set(0);
    this.totalBytes.set(0);
    this.progressoDownload.set(0);
  }

  ajustarVelocidadeVideo(event: Event): void {
    const velocidade = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(velocidade)) this.velocidadeVideo.set(velocidade);
  }

  ehVideo(arquivo: ArquivoAgendamentoOrigem): boolean {
    return (
      arquivo.contentType?.toLowerCase().startsWith('video/') === true ||
      arquivo.nomeOriginal.toLowerCase().endsWith('.mp4')
    );
  }

  ehImagem(arquivo: ArquivoAgendamentoOrigem): boolean {
    const nome = arquivo.nomeOriginal.toLowerCase();
    return (
      arquivo.contentType?.toLowerCase().startsWith('image/') === true ||
      ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((extensao) => nome.endsWith(extensao))
    );
  }

  descricaoArquivo(arquivo: ArquivoAgendamentoOrigem, indice: number): string {
    const tipo = this.ehVideo(arquivo) ? 'Vídeo' : this.ehImagem(arquivo) ? 'Foto' : 'Arquivo';
    return `${tipo} ${indice + 1}`;
  }

  descricaoProgresso(): string {
    const recebidos = this.formatarTamanho(this.bytesRecebidos());
    const total = this.totalBytes();

    return total > 0
      ? `${this.progressoDownload()}% · ${recebidos} de ${this.formatarTamanho(total)}`
      : `${recebidos} recebidos`;
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  carregar(finalizar?: () => void): void {
    this.carregando.set(true);
    this.erro.set('');

    this.atendimentosService
      .listar({
        situacao: this.situacao(),
        dataAgendamento: this.dataAgendamento(),
        sortDirection: this.direcaoHora(),
        pageNumber: this.pagina().pageNumber,
        pageSize: 10,
      })
      .pipe(
        finalize(() => {
          this.carregando.set(false);
          finalizar?.();
        }),
      )
      .subscribe({
        next: (pagina) => this.pagina.set(pagina),
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível carregar seus atendimentos.')),
      });
  }

  private formatarDataFiltro(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private liberarUrlVisualizacao(): void {
    const url = this.urlVisualizacao();
    if (url) URL.revokeObjectURL(url);
    this.urlVisualizacao.set('');
  }

  private iniciarProgresso(tamanhoBytes: number): void {
    this.bytesRecebidos.set(0);
    this.totalBytes.set(tamanhoBytes > 0 ? tamanhoBytes : 0);
    this.progressoDownload.set(0);
  }

  private atualizarProgresso(
    bytesRecebidos: number,
    tamanhoBytes: number,
    totalEvento?: number,
  ): void {
    const total = tamanhoBytes > 0 ? tamanhoBytes : (totalEvento ?? 0);
    this.bytesRecebidos.set(bytesRecebidos);
    this.totalBytes.set(total);
    this.progressoDownload.set(
      total > 0 ? Math.min(100, Math.round((bytesRecebidos / total) * 100)) : 0,
    );
  }

  private mensagemErro(erro: unknown, padrao: string): string {
    if (!(erro instanceof HttpErrorResponse)) return padrao;

    const resposta = erro.error as
      { detail?: string; title?: string; mensagem?: string } | string | null;
    if (typeof resposta === 'string' && resposta.trim()) return resposta;
    if (!resposta || typeof resposta === 'string') return padrao;

    return resposta.detail || resposta.mensagem || resposta.title || padrao;
  }
}
