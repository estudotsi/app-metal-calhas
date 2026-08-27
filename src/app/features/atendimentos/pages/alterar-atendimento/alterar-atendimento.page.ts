import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import {
  attachOutline,
  cameraOutline,
  checkmarkDoneOutline,
  cloudDownloadOutline,
  documentOutline,
  eyeOutline,
  imageOutline,
  saveOutline,
  trashOutline,
  videocamOutline,
} from 'ionicons/icons';
import { finalize } from 'rxjs';
import { NativeFile } from '../../../../core/native/native-file.plugin';
import { TokenStorageService } from '../../../../core/services/token-storage.service';
import { environment } from '../../../../../environments/environment';
import {
  AlterarAtendimentoRequest,
  ArquivoAtendimento,
  AtendimentoDetalhe,
} from '../../models/atendimento';
import { AtendimentosService } from '../../services/atendimentos.service';
import { FotoAtendimentoService } from '../../services/foto-atendimento.service';
import { VideoAtendimentoService } from '../../services/video-atendimento.service';

interface ArquivoPreview {
  arquivo: ArquivoAtendimento;
  url: string;
}

@Component({
  selector: 'app-alterar-atendimento',
  templateUrl: './alterar-atendimento.page.html',
  styleUrl: './alterar-atendimento.page.scss',
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToast,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlterarAtendimentoPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly atendimentosService = inject(AtendimentosService);
  private readonly fotoService = inject(FotoAtendimentoService);
  private readonly videoService = inject(VideoAtendimentoService);
  private readonly tokenStorage = inject(TokenStorageService);

  atendimentoId = 0;

  readonly atendimento = signal<AtendimentoDetalhe | null>(null);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly mensagem = signal('');
  readonly arquivosSelecionados = signal<File[]>([]);
  readonly enviandoArquivos = signal(false);
  readonly progressoUpload = signal(0);
  readonly arquivoProcessandoId = signal<number | null>(null);
  readonly arquivoParaExcluir = signal<ArquivoAtendimento | null>(null);
  readonly preview = signal<ArquivoPreview | null>(null);
  readonly capturandoMidia = signal<'foto' | 'video' | null>(null);
  readonly progressoMidia = signal(0);
  readonly confirmandoConclusao = signal(false);
  readonly concluindo = signal(false);
  readonly concluido = computed(() => this.atendimento()?.aberto === false);
  readonly arquivos = computed(() => this.atendimento()?.arquivos ?? []);
  readonly tamanhoTotalSelecionado = computed(() =>
    this.arquivosSelecionados().reduce((total, arquivo) => total + arquivo.size, 0),
  );
  readonly attachOutline = attachOutline;
  readonly cameraOutline = cameraOutline;
  readonly checkmarkDoneOutline = checkmarkDoneOutline;
  readonly cloudDownloadOutline = cloudDownloadOutline;
  readonly documentOutline = documentOutline;
  readonly eyeOutline = eyeOutline;
  readonly imageOutline = imageOutline;
  readonly saveOutline = saveOutline;
  readonly trashOutline = trashOutline;
  readonly videocamOutline = videocamOutline;

  readonly form = new FormGroup({
    nomeCliente: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)],
    }),
    telefoneCliente: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)],
    }),
    atendente: new FormControl('', { nonNullable: true }),
    dataAgendamento: new FormControl('', { nonNullable: true }),
    horaAgendamento: new FormControl('', { nonNullable: true }),
    logradouro: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    bairro: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    cidade: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    uf: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2)],
    }),
    observacao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

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
    this.liberarPreview();
  }

  salvar(): void {
    if (this.salvando() || this.concluido()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erro.set('Revise os campos obrigatórios antes de salvar.');
      return;
    }

    this.erro.set('');
    this.salvando.set(true);
    this.atendimentosService
      .alterar(this.atendimentoId, this.criarPayload())
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: () => {
          this.mensagem.set('Atendimento atualizado com sucesso.');
          this.form.markAsPristine();
          this.form.markAsUntouched();
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível salvar o atendimento.')),
      });
  }

  abrirConfirmacaoConclusao(): void {
    if (this.concluido() || this.concluindo()) return;
    this.confirmandoConclusao.set(true);
  }

  fecharConfirmacaoConclusao(): void {
    if (!this.concluindo()) this.confirmandoConclusao.set(false);
  }

  concluirAtendimento(): void {
    if (this.concluido() || this.concluindo()) return;

    this.erro.set('');
    this.concluindo.set(true);
    this.atendimentosService
      .concluir(this.atendimentoId)
      .pipe(finalize(() => this.concluindo.set(false)))
      .subscribe({
        next: (resultado) => {
          this.confirmandoConclusao.set(false);
          this.atendimento.update((atual) =>
            atual ? { ...atual, aberto: false, dataConclusao: resultado.dataConclusao } : atual,
          );
          this.form.disable({ emitEvent: false });
          this.mensagem.set('Atendimento concluído com sucesso.');
        },
        error: (erro) => {
          this.confirmandoConclusao.set(false);
          this.erro.set(this.mensagemErro(erro, 'Não foi possível concluir o atendimento.'));
        },
      });
  }

  selecionarArquivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.arquivosSelecionados.set(input.files ? Array.from(input.files) : []);
    input.value = '';
  }

  removerSelecionado(index: number): void {
    if (this.enviandoArquivos()) return;
    this.arquivosSelecionados.update((arquivos) => arquivos.filter((_, i) => i !== index));
  }

  enviarArquivos(): void {
    const arquivos = this.arquivosSelecionados();
    if (!arquivos.length || this.enviandoArquivos()) return;

    this.erro.set('');
    this.progressoUpload.set(0);
    this.enviandoArquivos.set(true);
    this.atendimentosService
      .adicionarArquivos(this.atendimentoId, arquivos)
      .pipe(
        finalize(() => {
          this.enviandoArquivos.set(false);
          this.progressoUpload.set(0);
        }),
      )
      .subscribe({
        next: (evento) => {
          if (evento.type === HttpEventType.UploadProgress) {
            this.progressoUpload.set(
              evento.total ? Math.round((evento.loaded / evento.total) * 100) : 0,
            );
          }
          if (evento.type === HttpEventType.Response) {
            this.arquivosSelecionados.set([]);
            this.mensagem.set('Arquivos da obra executada adicionados com sucesso.');
            this.atualizarArquivos();
          }
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível enviar os arquivos.')),
      });
  }

  async tirarFoto(): Promise<void> {
    if (this.capturandoMidia()) return;
    this.capturandoMidia.set('foto');
    this.progressoMidia.set(0);
    this.erro.set('');
    try {
      const resultado = await this.fotoService.capturarEEnviar(this.atendimentoId, (progresso) =>
        this.progressoMidia.set(progresso),
      );
      if (resultado === 'enviado') {
        this.mensagem.set('Foto da obra executada adicionada com sucesso.');
        this.atualizarArquivos();
      }
    } catch (erro) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível enviar a foto.');
    } finally {
      this.capturandoMidia.set(null);
      this.progressoMidia.set(0);
    }
  }

  async gravarVideo(): Promise<void> {
    if (this.capturandoMidia()) return;
    this.capturandoMidia.set('video');
    this.progressoMidia.set(0);
    this.erro.set('');
    try {
      const resultado = await this.videoService.capturarEEnviar(this.atendimentoId, (progresso) =>
        this.progressoMidia.set(progresso),
      );
      if (resultado === 'enviado') {
        this.mensagem.set('Vídeo da obra executada adicionado com sucesso.');
        this.atualizarArquivos();
      }
    } catch (erro) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível enviar o vídeo.');
    } finally {
      this.capturandoMidia.set(null);
      this.progressoMidia.set(0);
    }
  }

  visualizar(arquivo: ArquivoAtendimento): void {
    if (this.arquivoProcessandoId() !== null) return;
    this.arquivoProcessandoId.set(arquivo.atendimentoArquivoId);
    this.erro.set('');
    this.atendimentosService
      .baixarArquivo(this.atendimentoId, arquivo.atendimentoArquivoId)
      .pipe(finalize(() => this.arquivoProcessandoId.set(null)))
      .subscribe({
        next: (blob) => {
          this.liberarPreview();
          this.preview.set({ arquivo, url: URL.createObjectURL(blob) });
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível visualizar o arquivo.')),
      });
  }

  async baixar(arquivo: ArquivoAtendimento): Promise<void> {
    if (this.arquivoProcessandoId() !== null) return;
    this.arquivoProcessandoId.set(arquivo.atendimentoArquivoId);
    this.erro.set('');

    if (Capacitor.isNativePlatform()) {
      try {
        const token = this.tokenStorage.getToken();
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

        const resultado = await NativeFile.downloadFile({
          url: `${environment.apiUrl}/mobile/atendimentos/${this.atendimentoId}/arquivos/${arquivo.atendimentoArquivoId}/download`,
          token,
          fileName: arquivo.nomeOriginal,
          mimeType: arquivo.contentType || 'application/octet-stream',
        });
        this.mensagem.set(`Arquivo salvo em ${resultado.location}.`);
      } catch (erro) {
        this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível baixar o arquivo.');
      } finally {
        this.arquivoProcessandoId.set(null);
      }
      return;
    }

    this.atendimentosService
      .baixarArquivo(this.atendimentoId, arquivo.atendimentoArquivoId)
      .pipe(finalize(() => this.arquivoProcessandoId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = arquivo.nomeOriginal;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível baixar o arquivo.')),
      });
  }

  pedirExclusao(arquivo: ArquivoAtendimento): void {
    this.arquivoParaExcluir.set(arquivo);
  }

  cancelarExclusao(): void {
    if (this.arquivoProcessandoId() === null) this.arquivoParaExcluir.set(null);
  }

  excluirArquivo(): void {
    const arquivo = this.arquivoParaExcluir();
    if (!arquivo || this.arquivoProcessandoId() !== null) return;

    this.arquivoProcessandoId.set(arquivo.atendimentoArquivoId);
    this.erro.set('');
    this.atendimentosService
      .excluirArquivo(this.atendimentoId, arquivo.atendimentoArquivoId)
      .pipe(finalize(() => this.arquivoProcessandoId.set(null)))
      .subscribe({
        next: () => {
          this.arquivoParaExcluir.set(null);
          this.mensagem.set('Arquivo da obra executada excluído com sucesso.');
          this.atualizarArquivos();
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível excluir o arquivo.')),
      });
  }

  fecharPreview(): void {
    this.liberarPreview();
    this.preview.set(null);
  }

  ehImagem(contentType?: string): boolean {
    return contentType?.toLowerCase().startsWith('image/') ?? false;
  }

  ehVideo(contentType?: string): boolean {
    return contentType?.toLowerCase().startsWith('video/') ?? false;
  }

  iconeArquivo(arquivo: ArquivoAtendimento): string {
    if (this.ehImagem(arquivo.contentType)) return this.imageOutline;
    if (this.ehVideo(arquivo.contentType)) return this.videocamOutline;
    return this.documentOutline;
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatarData(data: string): string {
    const valor = new Date(data);
    return Number.isNaN(valor.getTime()) ? data : valor.toLocaleString('pt-BR');
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.atendimentosService
      .buscarPorId(this.atendimentoId)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (atendimento) => {
          this.atendimento.set({ ...atendimento, arquivos: atendimento.arquivos ?? [] });
          this.preencherForm(atendimento);
        },
        error: (erro) =>
          this.erro.set(this.mensagemErro(erro, 'Não foi possível carregar o atendimento.')),
      });
  }

  private atualizarArquivos(): void {
    this.atendimentosService.buscarPorId(this.atendimentoId).subscribe({
      next: (atendimento) =>
        this.atendimento.update((atual) =>
          atual ? { ...atual, arquivos: atendimento.arquivos ?? [] } : atendimento,
        ),
      error: (erro) =>
        this.erro.set(this.mensagemErro(erro, 'Não foi possível atualizar os arquivos.')),
    });
  }

  private preencherForm(atendimento: AtendimentoDetalhe): void {
    this.form.patchValue({
      nomeCliente: atendimento.nomeCliente ?? '',
      telefoneCliente: atendimento.telefoneCliente ?? '',
      atendente: atendimento.atendente ?? '',
      dataAgendamento: atendimento.dataAgendamento?.substring(0, 10) ?? '',
      horaAgendamento: atendimento.horaAgendamento?.substring(0, 5) ?? '',
      logradouro: atendimento.logradouro ?? '',
      numero: atendimento.numero ?? '',
      bairro: atendimento.bairro ?? '',
      cidade: atendimento.cidade ?? '',
      uf: atendimento.uf ?? '',
      observacao: atendimento.observacao ?? '',
    });

    if (atendimento.aberto) {
      this.form.enable({ emitEvent: false });
      this.form.controls.atendente.disable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  private criarPayload(): AlterarAtendimentoRequest {
    const valor = this.form.getRawValue();
    return {
      nomeCliente: valor.nomeCliente.trim(),
      telefoneCliente: valor.telefoneCliente.trim(),
      atendente: valor.atendente.trim(),
      dataAgendamento: this.opcional(valor.dataAgendamento),
      horaAgendamento: valor.horaAgendamento ? `${valor.horaAgendamento}:00` : null,
      logradouro: valor.logradouro.trim(),
      numero: this.opcional(valor.numero),
      bairro: this.opcional(valor.bairro),
      cidade: this.opcional(valor.cidade),
      uf: this.opcional(valor.uf)?.toUpperCase() ?? null,
      observacao: this.opcional(valor.observacao),
    };
  }

  private opcional(valor: string): string | null {
    return valor.trim() || null;
  }

  private liberarPreview(): void {
    const preview = this.preview();
    if (preview) URL.revokeObjectURL(preview.url);
  }

  private mensagemErro(erro: unknown, padrao: string): string {
    if (!(erro instanceof HttpErrorResponse)) return padrao;
    if (typeof erro.error === 'string' && erro.error.trim()) return erro.error;
    if (erro.error?.detail) return String(erro.error.detail);
    if (erro.error?.title) return String(erro.error.title);
    if (erro.error?.errors) {
      const mensagens = Object.values(erro.error.errors).flat();
      if (mensagens.length) return mensagens.join(' ');
    }
    return padrao;
  }
}
