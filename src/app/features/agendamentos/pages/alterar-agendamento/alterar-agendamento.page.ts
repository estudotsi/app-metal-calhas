import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonBackButton,
  IonButton,
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
  cloudDownloadOutline,
  documentOutline,
  eyeOutline,
  imageOutline,
  saveOutline,
  trashOutline,
  videocamOutline,
} from 'ionicons/icons';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';
import { NativeFile } from '../../../../core/native/native-file.plugin';
import { TokenStorageService } from '../../../../core/services/token-storage.service';
import { environment } from '../../../../../environments/environment';
import {
  AgendamentoDetalhe,
  AlterarAgendamentoRequest,
  ArquivoAgendamento,
} from '../../models/agendamento';
import { EnderecoGoogleSugestaoView } from '../../models/endereco';
import { AgendamentosService } from '../../services/agendamentos.service';
import { EnderecosService } from '../../services/enderecos.service';
import { FotoAgendamentoService } from '../../services/foto-agendamento.service';
import { VideoAgendamentoService } from '../../services/video-agendamento.service';

interface ArquivoPreview {
  arquivo: ArquivoAgendamento;
  url: string;
}

@Component({
  selector: 'app-alterar-agendamento',
  templateUrl: './alterar-agendamento.page.html',
  styleUrl: './alterar-agendamento.page.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
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
export class AlterarAgendamentoPage implements OnInit, OnDestroy {
  @ViewChild('enderecoAutocomplete')
  private enderecoAutocomplete?: ElementRef<HTMLElement>;

  @ViewChild('numeroInput')
  private numeroInput?: ElementRef<HTMLInputElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly agendamentosService = inject(AgendamentosService);
  private readonly enderecosService = inject(EnderecosService);
  private readonly fotoService = inject(FotoAgendamentoService);
  private readonly videoService = inject(VideoAgendamentoService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly destroyRef = inject(DestroyRef);

  agendamentoId = 0;

  readonly agendamento = signal<AgendamentoDetalhe | null>(null);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly mensagem = signal('');
  readonly arquivosSelecionados = signal<File[]>([]);
  readonly enviandoArquivos = signal(false);
  readonly progressoUpload = signal(0);
  readonly arquivoProcessandoId = signal<number | null>(null);
  readonly arquivoParaExcluir = signal<ArquivoAgendamento | null>(null);
  readonly preview = signal<ArquivoPreview | null>(null);
  readonly capturandoMidia = signal<'foto' | 'video' | null>(null);
  readonly progressoMidia = signal(0);
  readonly sugestoesEndereco = signal<EnderecoGoogleSugestaoView[]>([]);
  readonly buscandoEndereco = signal(false);
  readonly autocompleteEnderecoAberto = signal(false);
  private sessionTokenEndereco: string | null = null;

  readonly concluido = computed(() => this.agendamento()?.aberto === false);
  readonly arquivos = computed(() => this.agendamento()?.arquivos ?? []);
  readonly tamanhoTotalSelecionado = computed(() =>
    this.arquivosSelecionados().reduce((total, arquivo) => total + arquivo.size, 0),
  );

  readonly attachOutline = attachOutline;
  readonly cameraOutline = cameraOutline;
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
    nomeVendedor: new FormControl('', { nonNullable: true }),
    orcamentista: new FormControl('', { nonNullable: true }),
    dataAgendamento: new FormControl('', { nonNullable: true }),
    horaAgendamento: new FormControl('', { nonNullable: true }),
    logradouro: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(20)],
    }),
    bairro: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    cidade: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    uf: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2)],
    }),
    observacao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

  ngOnInit(): void {
    this.configurarAutocompleteEndereco();
    this.agendamentoId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(this.agendamentoId) || this.agendamentoId <= 0) {
      this.carregando.set(false);
      this.erro.set('Agendamento não encontrado.');
      return;
    }

    this.carregarAgendamento(true);
  }

  ngOnDestroy(): void {
    this.liberarPreview();
  }

  @HostListener('document:click', ['$event.target'])
  fecharAutocompleteAoClicarFora(target: EventTarget | null): void {
    if (!(target instanceof Node)) return;
    if (this.enderecoAutocomplete && !this.enderecoAutocomplete.nativeElement.contains(target)) {
      this.autocompleteEnderecoAberto.set(false);
    }
  }

  abrirAutocompleteEndereco(): void {
    if (
      !this.concluido() &&
      this.form.controls.logradouro.value.trim().length >= 3 &&
      (this.buscandoEndereco() || this.sugestoesEndereco().length > 0)
    ) {
      this.autocompleteEnderecoAberto.set(true);
    }
  }

  selecionarEndereco(sugestao: EnderecoGoogleSugestaoView): void {
    const sessionToken = this.sessionTokenEndereco;
    if (!sessionToken || this.buscandoEndereco() || this.concluido()) return;

    this.sugestoesEndereco.set([]);
    this.autocompleteEnderecoAberto.set(false);
    this.buscandoEndereco.set(true);
    this.erro.set('');

    this.enderecosService
      .buscarDetalhesGoogle(sugestao.placeId, sessionToken)
      .pipe(
        finalize(() => this.buscandoEndereco.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (endereco) => {
          this.form.patchValue(
            {
              logradouro: endereco.logradouro.trim(),
              bairro: endereco.bairro.trim(),
              cidade: endereco.cidade.trim(),
              uf: endereco.uf.trim(),
            },
            { emitEvent: false },
          );
          this.sessionTokenEndereco = null;
          this.numeroInput?.nativeElement.focus();
        },
        error: (erro) =>
          this.erro.set(
            this.mensagemErro(
              erro,
              'Não foi possível carregar os detalhes do endereço selecionado.',
            ),
          ),
      });
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
    const payload = this.criarPayload();

    this.enderecosService
      .resolverEnderecoGoogle(
        payload.logradouro,
        payload.numero ?? '',
        payload.bairro ?? '',
        payload.cidade ?? '',
        payload.uf ?? '',
      )
      .pipe(
        catchError(() => of({ googlePlaceId: null, enderecoFormatado: null })),
        map((enderecoResolvido) => ({
          ...payload,
          googlePlaceId: enderecoResolvido.googlePlaceId,
        })),
        switchMap((payloadResolvido) =>
          this.agendamentosService.alterar(this.agendamentoId, payloadResolvido),
        ),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe({
        next: () => {
          this.mensagem.set('Agendamento atualizado com sucesso.');
          this.form.markAsPristine();
          this.form.markAsUntouched();
        },
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível salvar o agendamento.')),
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
    this.agendamentosService
      .adicionarArquivos(this.agendamentoId, arquivos)
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
            this.mensagem.set('Arquivos adicionados com sucesso.');
            this.atualizarArquivos();
          }
        },
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível enviar os arquivos.')),
      });
  }

  async tirarFoto(): Promise<void> {
    if (this.capturandoMidia()) return;
    this.capturandoMidia.set('foto');
    this.progressoMidia.set(0);
    this.erro.set('');
    try {
      const resultado = await this.fotoService.capturarEEnviar(
        this.agendamentoId,
        (progresso) => this.progressoMidia.set(progresso),
      );
      if (resultado === 'enviado') {
        this.mensagem.set('Foto adicionada com sucesso.');
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
      const resultado = await this.videoService.capturarEEnviar(
        this.agendamentoId,
        (progresso) => this.progressoMidia.set(progresso),
      );
      if (resultado === 'enviado') {
        this.mensagem.set('Vídeo adicionado com sucesso.');
        this.atualizarArquivos();
      }
    } catch (erro) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível enviar o vídeo.');
    } finally {
      this.capturandoMidia.set(null);
      this.progressoMidia.set(0);
    }
  }

  visualizar(arquivo: ArquivoAgendamento): void {
    if (this.arquivoProcessandoId() !== null) return;
    this.arquivoProcessandoId.set(arquivo.agendamentoArquivoId);
    this.erro.set('');
    this.agendamentosService
      .baixarArquivo(this.agendamentoId, arquivo.agendamentoArquivoId)
      .pipe(finalize(() => this.arquivoProcessandoId.set(null)))
      .subscribe({
        next: (blob) => {
          this.liberarPreview();
          this.preview.set({ arquivo, url: URL.createObjectURL(blob) });
        },
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível visualizar o arquivo.')),
      });
  }

  async baixar(arquivo: ArquivoAgendamento): Promise<void> {
    if (this.arquivoProcessandoId() !== null) return;
    this.arquivoProcessandoId.set(arquivo.agendamentoArquivoId);
    this.erro.set('');

    if (Capacitor.isNativePlatform()) {
      try {
        const token = this.tokenStorage.getToken();
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

        const resultado = await NativeFile.downloadFile({
          url: `${environment.apiUrl}/mobile/agendamentos/${this.agendamentoId}/arquivos/${arquivo.agendamentoArquivoId}/download`,
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

    this.agendamentosService
      .baixarArquivo(this.agendamentoId, arquivo.agendamentoArquivoId)
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
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível baixar o arquivo.')),
      });
  }

  pedirExclusao(arquivo: ArquivoAgendamento): void {
    this.arquivoParaExcluir.set(arquivo);
  }

  cancelarExclusao(): void {
    if (this.arquivoProcessandoId() === null) this.arquivoParaExcluir.set(null);
  }

  excluirArquivo(): void {
    const arquivo = this.arquivoParaExcluir();
    if (!arquivo || this.arquivoProcessandoId() !== null) return;

    this.arquivoProcessandoId.set(arquivo.agendamentoArquivoId);
    this.erro.set('');
    this.agendamentosService
      .excluirArquivo(this.agendamentoId, arquivo.agendamentoArquivoId)
      .pipe(finalize(() => this.arquivoProcessandoId.set(null)))
      .subscribe({
        next: () => {
          this.arquivoParaExcluir.set(null);
          this.mensagem.set('Arquivo excluído com sucesso.');
          this.atualizarArquivos();
        },
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível excluir o arquivo.')),
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

  iconeArquivo(arquivo: ArquivoAgendamento): string {
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

  private carregarAgendamento(preencherForm: boolean): void {
    this.carregando.set(true);
    this.erro.set('');
    this.agendamentosService
      .buscarPorId(this.agendamentoId)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (agendamento) => {
          this.agendamento.set({ ...agendamento, arquivos: agendamento.arquivos ?? [] });
          if (preencherForm) this.preencherForm(agendamento);
        },
        error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível carregar o agendamento.')),
      });
  }

  private atualizarArquivos(): void {
    this.agendamentosService.buscarPorId(this.agendamentoId).subscribe({
      next: (agendamento) =>
        this.agendamento.update((atual) =>
          atual ? { ...atual, arquivos: agendamento.arquivos ?? [] } : agendamento,
        ),
      error: (erro) => this.erro.set(this.mensagemErro(erro, 'Não foi possível atualizar os arquivos.')),
    });
  }

  private preencherForm(agendamento: AgendamentoDetalhe): void {
    this.form.patchValue({
      nomeCliente: agendamento.nomeCliente ?? '',
      telefoneCliente: agendamento.telefoneCliente ?? '',
      nomeVendedor: agendamento.nomeVendedor ?? '',
      orcamentista: agendamento.orcamentista ?? '',
      dataAgendamento: agendamento.dataAgendamento?.substring(0, 10) ?? '',
      horaAgendamento: agendamento.horaAgendamento?.substring(0, 5) ?? '',
      logradouro: agendamento.logradouro ?? '',
      numero: agendamento.numero ?? '',
      bairro: agendamento.bairro ?? '',
      cidade: agendamento.cidade ?? '',
      uf: agendamento.uf ?? '',
      observacao: agendamento.observacao ?? '',
    });

    if (!agendamento.aberto) this.form.disable({ emitEvent: false });
  }

  private criarPayload(): AlterarAgendamentoRequest {
    const valor = this.form.getRawValue();
    return {
      nomeCliente: valor.nomeCliente.trim(),
      telefoneCliente: this.opcional(valor.telefoneCliente),
      nomeVendedor: this.opcional(valor.nomeVendedor),
      orcamentista: this.opcional(valor.orcamentista),
      dataAgendamento: this.opcional(valor.dataAgendamento),
      horaAgendamento: valor.horaAgendamento ? `${valor.horaAgendamento}:00` : null,
      logradouro: valor.logradouro.trim(),
      numero: this.opcional(valor.numero),
      bairro: this.opcional(valor.bairro),
      cidade: this.opcional(valor.cidade),
      uf: this.opcional(valor.uf)?.toUpperCase() ?? null,
      googlePlaceId: null,
      observacao: this.opcional(valor.observacao),
    };
  }

  private configurarAutocompleteEndereco(): void {
    this.form.controls.logradouro.valueChanges
      .pipe(
        map((logradouro) => logradouro.trim()),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((logradouro) => {
          if (logradouro.length < 3 || this.concluido()) {
            this.sugestoesEndereco.set([]);
            this.buscandoEndereco.set(false);
            this.autocompleteEnderecoAberto.set(false);
            this.sessionTokenEndereco = null;
            return of([] as EnderecoGoogleSugestaoView[]);
          }

          this.sessionTokenEndereco ??= crypto.randomUUID();
          this.sugestoesEndereco.set([]);
          this.buscandoEndereco.set(true);
          this.autocompleteEnderecoAberto.set(true);

          return this.enderecosService
            .buscarSugestoesGoogle(logradouro, this.sessionTokenEndereco)
            .pipe(
              catchError(() => of([] as EnderecoGoogleSugestaoView[])),
              finalize(() => this.buscandoEndereco.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((enderecos) => this.sugestoesEndereco.set(enderecos));
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
