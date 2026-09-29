import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { documentOutline, eyeOutline, imageOutline, videocamOutline } from 'ionicons/icons';
import { Observable, Subscription, finalize } from 'rxjs';
import {
  ArquivoAgendamentoOrigem,
  ArquivoAtendimento,
  AtendimentoDetalhe,
} from '../../../atendimentos/models/atendimento';
import { AtendimentosFinalizadosService } from '../../services/atendimentos-finalizados.service';

interface ArquivoExibicao {
  chave: string;
  nomeOriginal: string;
  contentType?: string | null;
  tamanhoBytes: number;
  dataUpload: string;
  carregar: () => Observable<Blob>;
}

interface ArquivoPreview {
  arquivo: ArquivoExibicao;
  url: string;
}

@Component({
  selector: 'app-visualizar-atendimento-finalizado',
  templateUrl: './visualizar-atendimento-finalizado.page.html',
  styleUrl: './visualizar-atendimento-finalizado.page.scss',
  imports: [
    NgTemplateOutlet,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualizarAtendimentoFinalizadoPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AtendimentosFinalizadosService);
  private arquivoSubscription?: Subscription;

  atendimentoId = 0;

  readonly atendimento = signal<AtendimentoDetalhe | null>(null);
  readonly arquivosOrigem = signal<ArquivoAgendamentoOrigem[]>([]);
  readonly carregando = signal(true);
  readonly carregandoOrigem = signal(false);
  readonly erro = signal('');
  readonly erroOrigem = signal('');
  readonly arquivoProcessando = signal<string | null>(null);
  readonly preview = signal<ArquivoPreview | null>(null);
  readonly arquivosVisita = computed(() =>
    this.arquivosOrigem().map((arquivo) => this.arquivoOrigemParaExibicao(arquivo)),
  );
  readonly arquivosObra = computed(() =>
    (this.atendimento()?.arquivos ?? []).map((arquivo) => this.arquivoObraParaExibicao(arquivo)),
  );
  readonly documentOutline = documentOutline;
  readonly eyeOutline = eyeOutline;

  ngOnInit(): void {
    this.atendimentoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(this.atendimentoId) || this.atendimentoId <= 0) {
      this.carregando.set(false);
      this.erro.set('Atendimento não encontrado.');
      return;
    }

    this.carregar();
  }

  ngOnDestroy(): void {
    this.arquivoSubscription?.unsubscribe();
    this.liberarPreview();
  }

  visualizar(arquivo: ArquivoExibicao): void {
    if (this.arquivoProcessando() !== null) return;

    this.arquivoProcessando.set(arquivo.chave);
    this.erro.set('');
    this.arquivoSubscription = arquivo
      .carregar()
      .pipe(finalize(() => this.arquivoProcessando.set(null)))
      .subscribe({
        next: (blob) => {
          this.liberarPreview();
          this.preview.set({ arquivo, url: URL.createObjectURL(blob) });
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível visualizar o arquivo.')),
      });
  }

  fecharPreview(): void {
    this.liberarPreview();
    this.preview.set(null);
  }

  ehImagem(arquivo: ArquivoExibicao): boolean {
    const nome = arquivo.nomeOriginal.toLowerCase();
    return (
      arquivo.contentType?.toLowerCase().startsWith('image/') === true ||
      ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((extensao) => nome.endsWith(extensao))
    );
  }

  ehVideo(arquivo: ArquivoExibicao): boolean {
    return (
      arquivo.contentType?.toLowerCase().startsWith('video/') === true ||
      arquivo.nomeOriginal.toLowerCase().endsWith('.mp4')
    );
  }

  iconeArquivo(arquivo: ArquivoExibicao): string {
    if (this.ehImagem(arquivo)) return imageOutline;
    if (this.ehVideo(arquivo)) return videocamOutline;
    return documentOutline;
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatarDataHora(data?: string | null): string {
    if (!data) return '';
    const valor = new Date(data);
    return Number.isNaN(valor.getTime()) ? data : valor.toLocaleString('pt-BR');
  }

  formatarData(data?: string | null): string {
    if (!data) return 'Sem data';

    const [ano, mes, dia] = data.substring(0, 10).split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  }

  formatarHora(hora?: string | null): string {
    return hora ? hora.substring(0, 5) : 'Sem horário';
  }

  formatarEndereco(atendimento: AtendimentoDetalhe): string {
    const endereco = [atendimento.logradouro, atendimento.numero].filter(Boolean).join(', ');
    const cidadeUf = [atendimento.cidade, atendimento.uf].filter(Boolean).join(' - ');
    return [endereco, atendimento.bairro, cidadeUf].filter(Boolean).join(' · ');
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.service
      .buscarPorId(this.atendimentoId)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (atendimento) => {
          this.atendimento.set({ ...atendimento, arquivos: atendimento.arquivos ?? [] });
          this.carregarArquivosOrigem();
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível carregar o atendimento.')),
      });
  }

  private carregarArquivosOrigem(): void {
    this.carregandoOrigem.set(true);
    this.erroOrigem.set('');
    this.service
      .listarArquivosAgendamentoOrigem(this.atendimentoId)
      .pipe(finalize(() => this.carregandoOrigem.set(false)))
      .subscribe({
        next: (arquivos) => this.arquivosOrigem.set(arquivos ?? []),
        error: (erro) =>
          this.erroOrigem.set(
            this.mensagemErro(erro, 'Não foi possível buscar os arquivos do agendamento.'),
          ),
      });
  }

  private arquivoOrigemParaExibicao(arquivo: ArquivoAgendamentoOrigem): ArquivoExibicao {
    return {
      chave: `origem-${arquivo.arquivoId}`,
      nomeOriginal: arquivo.nomeOriginal,
      contentType: arquivo.contentType,
      tamanhoBytes: arquivo.tamanhoBytes,
      dataUpload: arquivo.dataUpload,
      carregar: () =>
        this.service.visualizarArquivoAgendamentoOrigem(this.atendimentoId, arquivo.arquivoId),
    };
  }

  private arquivoObraParaExibicao(arquivo: ArquivoAtendimento): ArquivoExibicao {
    return {
      chave: `obra-${arquivo.atendimentoArquivoId}`,
      nomeOriginal: arquivo.nomeOriginal,
      contentType: arquivo.contentType,
      tamanhoBytes: arquivo.tamanhoBytes,
      dataUpload: arquivo.dataUpload,
      carregar: () => this.service.baixarArquivo(this.atendimentoId, arquivo.atendimentoArquivoId),
    };
  }

  private liberarPreview(): void {
    const preview = this.preview();
    if (preview) URL.revokeObjectURL(preview.url);
  }

  private mensagemErro(erro: unknown, padrao: string): string {
    if (!(erro instanceof HttpErrorResponse)) return padrao;
    if (erro.status === 404) return 'Atendimento finalizado não encontrado.';
    if (typeof erro.error === 'string' && erro.error.trim()) return erro.error;
    if (erro.error?.detail) return String(erro.error.detail);
    if (erro.error?.title) return String(erro.error.title);
    return padrao;
  }
}
