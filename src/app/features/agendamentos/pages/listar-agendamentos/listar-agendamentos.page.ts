import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  calendarOutline,
  cameraOutline,
  chatboxEllipsesOutline,
  checkmarkCircleOutline,
  createOutline,
  eyeOutline,
  locationOutline,
  logoWhatsapp,
  personOutline,
  timeOutline,
  trashOutline,
  videocamOutline,
} from 'ionicons/icons';
import { Observable, finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { Agendamento, AgendamentosPagina, SituacaoAgendamento } from '../../models/agendamento';
import { AgendamentosService } from '../../services/agendamentos.service';
import { FotoAgendamentoService } from '../../services/foto-agendamento.service';
import { VideoAgendamentoService } from '../../services/video-agendamento.service';

const EMPTY_PAGE: AgendamentosPagina = {
  data: [],
  total: 0,
  pageNumber: 1,
  pageSize: 10,
  totalPages: 0,
};

@Component({
  selector: 'app-listar-agendamentos',
  templateUrl: './listar-agendamentos.page.html',
  styleUrl: './listar-agendamentos.page.scss',
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
export class ListarAgendamentosPage {
  private readonly agendamentosService = inject(AgendamentosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fotoService = inject(FotoAgendamentoService);
  private readonly videoService = inject(VideoAgendamentoService);

  readonly user = this.auth.currentUser;
  readonly situacao = signal<SituacaoAgendamento>('abertos');
  readonly dataAgendamento = signal(this.formatarDataFiltro(new Date()));
  readonly direcaoHora = signal<'asc' | 'desc'>('asc');
  readonly pagina = signal<AgendamentosPagina>(EMPTY_PAGE);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly observacaoSelecionada = signal<Agendamento | null>(null);
  readonly enviandoFotoId = signal<number | null>(null);
  readonly progressoFoto = signal(0);
  readonly mensagemFoto = signal('');
  readonly erroFoto = signal(false);
  readonly enviandoVideoId = signal<number | null>(null);
  readonly progressoVideo = signal(0);
  readonly mensagemVideo = signal('');
  readonly erroVideo = signal(false);
  readonly agendamentoParaConcluir = signal<Agendamento | null>(null);
  readonly agendamentoParaExcluir = signal<Agendamento | null>(null);
  readonly agendamentoParaNovo = signal<Agendamento | null>(null);
  readonly concluindoId = signal<number | null>(null);
  readonly excluindoId = signal<number | null>(null);
  readonly criandoNovoId = signal<number | null>(null);
  readonly mensagemAcao = signal('');
  readonly erroAcao = signal(false);
  readonly calendarOutline = calendarOutline;
  readonly cameraOutline = cameraOutline;
  readonly chatboxEllipsesOutline = chatboxEllipsesOutline;
  readonly checkmarkCircleOutline = checkmarkCircleOutline;
  readonly createOutline = createOutline;
  readonly eyeOutline = eyeOutline;
  readonly locationOutline = locationOutline;
  readonly logoWhatsapp = logoWhatsapp;
  readonly personOutline = personOutline;
  readonly timeOutline = timeOutline;
  readonly trashOutline = trashOutline;
  readonly videocamOutline = videocamOutline;

  ionViewWillEnter(): void {
    this.carregar();
  }

  alterarSituacao(situacao: SituacaoAgendamento): void {
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

  formatarEndereco(agendamento: Agendamento): string {
    const endereco = [agendamento.logradouro, agendamento.numero].filter(Boolean).join(', ');
    const localidade = [agendamento.bairro, agendamento.cidade].filter(Boolean).join(' · ');
    return [endereco, localidade].filter(Boolean).join(' — ');
  }

  urlGoogleMaps(agendamento: Agendamento): string {
    const cidadeUf = [agendamento.cidade, agendamento.uf].filter(Boolean).join(' - ');
    const destino = [
      agendamento.logradouro,
      agendamento.numero,
      agendamento.bairro,
      cidadeUf,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
    const googlePlaceId = agendamento.googlePlaceId?.trim();

    return googlePlaceId
      ? `${url}&destination_place_id=${encodeURIComponent(googlePlaceId)}`
      : url;
  }

  urlWhatsApp(telefone?: string | null): string {
    const digitos = telefone?.replace(/\D/g, '') ?? '';
    if (!digitos) return '';

    const numero = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
    return `https://wa.me/${numero}`;
  }

  abrirObservacao(agendamento: Agendamento): void {
    this.observacaoSelecionada.set(agendamento);
  }

  fecharObservacao(): void {
    this.observacaoSelecionada.set(null);
  }

  alterarAgendamento(agendamento: Agendamento): void {
    void this.router.navigate(['/agendamentos', agendamento.agendamentoId, 'alterar']);
  }

  podeCriarNovoAgendamento(agendamento: Agendamento): boolean {
    const processoOrcamentoId = agendamento.processoOrcamentoId;
    return (
      !agendamento.aberto &&
      typeof processoOrcamentoId === 'number' &&
      Number.isInteger(processoOrcamentoId) &&
      processoOrcamentoId > 0
    );
  }

  abrirConfirmacaoNovoAgendamento(agendamento: Agendamento): void {
    if (
      this.situacao() !== 'concluidos' ||
      !this.podeCriarNovoAgendamento(agendamento) ||
      this.criandoNovoId() !== null
    ) {
      return;
    }

    this.agendamentoParaNovo.set(agendamento);
  }

  fecharConfirmacaoNovoAgendamento(): void {
    if (this.criandoNovoId() === null) this.agendamentoParaNovo.set(null);
  }

  criarNovoAgendamento(): void {
    const agendamento = this.agendamentoParaNovo();
    if (!agendamento || !this.podeCriarNovoAgendamento(agendamento)) return;
    if (this.criandoNovoId() !== null) return;

    this.criandoNovoId.set(agendamento.agendamentoId);
    this.agendamentosService
      .criarNovoNoProcesso(agendamento.agendamentoId)
      .pipe(finalize(() => this.criandoNovoId.set(null)))
      .subscribe({
        next: (response) => {
          this.agendamentoParaNovo.set(null);
          void this.router.navigate([
            '/agendamentos',
            response.agendamentoId,
            'alterar',
          ]);
        },
        error: (erro) => {
          this.agendamentoParaNovo.set(null);
          this.mensagemAcao.set(
            this.mensagemErro(erro, 'Não foi possível criar o novo agendamento.'),
          );
          this.erroAcao.set(true);
        },
      });
  }

  abrirConfirmacaoConclusao(agendamento: Agendamento): void {
    if (!agendamento.aberto || this.concluindoId() !== null || this.excluindoId() !== null) return;
    this.agendamentoParaConcluir.set(agendamento);
  }

  fecharConfirmacaoConclusao(): void {
    if (this.concluindoId() !== null) return;
    this.agendamentoParaConcluir.set(null);
  }

  concluirAgendamento(criarOrcamento: boolean): void {
    const agendamento = this.agendamentoParaConcluir();
    if (!agendamento?.aberto || this.concluindoId() !== null) return;

    const agendamentoId = agendamento.agendamentoId;
    this.concluindoId.set(agendamentoId);
    this.erro.set('');

    const operacao: Observable<unknown> = criarOrcamento
      ? this.agendamentosService.concluir(agendamentoId)
      : this.agendamentosService.concluirSemOrcamento(agendamentoId);

    operacao.pipe(finalize(() => this.concluindoId.set(null))).subscribe({
      next: () => {
        this.agendamentoParaConcluir.set(null);
        this.mensagemAcao.set(
          criarOrcamento
            ? 'Agendamento concluído e orçamento criado com sucesso.'
            : 'Agendamento fechado sem gerar orçamento.',
        );
        this.erroAcao.set(false);
        this.carregar();
      },
      error: (erro) => {
        this.agendamentoParaConcluir.set(null);
        this.mensagemAcao.set(
          this.mensagemErro(erro, 'Não foi possível concluir o agendamento.'),
        );
        this.erroAcao.set(true);
      },
    });
  }

  abrirConfirmacaoExclusao(agendamento: Agendamento): void {
    if (!agendamento.aberto || this.excluindoId() !== null || this.concluindoId() !== null) return;
    this.agendamentoParaExcluir.set(agendamento);
  }

  fecharConfirmacaoExclusao(): void {
    if (this.excluindoId() !== null) return;
    this.agendamentoParaExcluir.set(null);
  }

  excluirAgendamento(): void {
    const agendamento = this.agendamentoParaExcluir();
    if (!agendamento?.aberto || this.excluindoId() !== null) return;

    const agendamentoId = agendamento.agendamentoId;
    this.excluindoId.set(agendamentoId);
    this.erro.set('');

    this.agendamentosService
      .excluir(agendamentoId)
      .pipe(finalize(() => this.excluindoId.set(null)))
      .subscribe({
        next: () => {
          this.agendamentoParaExcluir.set(null);
          this.mensagemAcao.set('Agendamento excluído com sucesso.');
          this.erroAcao.set(false);

          if (this.pagina().data.length === 1 && this.pagina().pageNumber > 1) {
            this.pagina.update((pagina) => ({ ...pagina, pageNumber: pagina.pageNumber - 1 }));
          }

          this.carregar();
        },
        error: (erro) => {
          this.agendamentoParaExcluir.set(null);
          this.mensagemAcao.set(
            this.mensagemErro(erro, 'Não foi possível excluir o agendamento.'),
          );
          this.erroAcao.set(true);
        },
      });
  }

  async tirarFoto(agendamento: Agendamento): Promise<void> {
    if (this.enviandoFotoId() !== null || this.enviandoVideoId() !== null || !agendamento.aberto) return;

    this.enviandoFotoId.set(agendamento.agendamentoId);
    this.progressoFoto.set(0);
    this.mensagemFoto.set('');
    this.erroFoto.set(false);

    try {
      const resultado = await this.fotoService.capturarEEnviar(
        agendamento.agendamentoId,
        (percentual) => this.progressoFoto.set(percentual),
      );

      if (resultado === 'enviado') {
        this.mensagemFoto.set('Foto enviada com sucesso.');
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

  async gravarVideo(agendamento: Agendamento): Promise<void> {
    if (this.enviandoFotoId() !== null || this.enviandoVideoId() !== null || !agendamento.aberto) return;

    this.enviandoVideoId.set(agendamento.agendamentoId);
    this.progressoVideo.set(0);
    this.mensagemVideo.set('');
    this.erroVideo.set(false);

    try {
      const resultado = await this.videoService.capturarEEnviar(
        agendamento.agendamentoId,
        (percentual) => this.progressoVideo.set(percentual),
      );

      if (resultado === 'enviado') {
        this.mensagemVideo.set('Vídeo enviado com sucesso.');
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

  carregar(finalizar?: () => void): void {
    this.carregando.set(true);
    this.erro.set('');

    this.agendamentosService
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
        error: () => this.erro.set('Não foi possível carregar seus agendamentos.'),
      });
  }

  private formatarDataFiltro(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private mensagemErro(erro: unknown, padrao: string): string {
    if (!(erro instanceof HttpErrorResponse)) return padrao;

    const resposta = erro.error as { detail?: string; title?: string; mensagem?: string } | string | null;
    if (typeof resposta === 'string' && resposta.trim()) return resposta;
    if (!resposta || typeof resposta === 'string') return padrao;

    return resposta.detail || resposta.mensagem || resposta.title || padrao;
  }
}
