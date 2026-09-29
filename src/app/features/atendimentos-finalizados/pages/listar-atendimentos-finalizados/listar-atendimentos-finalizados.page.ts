import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import {
  calendarOutline,
  constructOutline,
  eyeOutline,
  locationOutline,
  personOutline,
  timeOutline,
} from 'ionicons/icons';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import {
  AtendimentoFinalizado,
  AtendimentosFinalizadosPagina,
} from '../../models/atendimento-finalizado';
import { AtendimentosFinalizadosService } from '../../services/atendimentos-finalizados.service';

const EMPTY_PAGE: AtendimentosFinalizadosPagina = {
  data: [],
  total: 0,
  pageNumber: 1,
  pageSize: 10,
  totalPages: 0,
};

@Component({
  selector: 'app-listar-atendimentos-finalizados',
  templateUrl: './listar-atendimentos-finalizados.page.html',
  styleUrl: './listar-atendimentos-finalizados.page.scss',
  imports: [
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListarAtendimentosFinalizadosPage {
  private readonly service = inject(AtendimentosFinalizadosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly pagina = signal<AtendimentosFinalizadosPagina>(EMPTY_PAGE);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly calendarOutline = calendarOutline;
  readonly constructOutline = constructOutline;
  readonly eyeOutline = eyeOutline;
  readonly locationOutline = locationOutline;
  readonly personOutline = personOutline;
  readonly timeOutline = timeOutline;

  ionViewWillEnter(): void {
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

  visualizar(atendimento: AtendimentoFinalizado): void {
    void this.router.navigate(['/atendimentos-finalizados', atendimento.atendimentoId]);
  }

  formatarHora(hora?: string | null): string {
    return hora ? hora.substring(0, 5) : 'Sem horário';
  }

  formatarData(data?: string | null): string {
    if (!data) return 'Sem data';

    const [ano, mes, dia] = data.substring(0, 10).split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  }

  formatarEndereco(atendimento: AtendimentoFinalizado): string {
    const endereco = [atendimento.logradouro, atendimento.numero].filter(Boolean).join(', ');
    const localidade = [atendimento.bairro, atendimento.cidade].filter(Boolean).join(' · ');
    return [endereco, localidade].filter(Boolean).join(' — ');
  }

  formatarMontadores(atendimento: AtendimentoFinalizado): string {
    return (
      [atendimento.atendente, atendimento.atendenteSecundario].filter(Boolean).join(' e ') ||
      'Não informado'
    );
  }

  carregar(finalizar?: () => void): void {
    this.carregando.set(true);
    this.erro.set('');

    this.service
      .listar(this.pagina().pageNumber, 10)
      .pipe(
        finalize(() => {
          this.carregando.set(false);
          finalizar?.();
        }),
      )
      .subscribe({
        next: (pagina) => this.pagina.set(pagina),
        error: () => this.erro.set('Não foi possível carregar os atendimentos finalizados.'),
      });
  }
}
