import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonSpinner, IonText } from '@ionic/angular';
import { fingerPrintOutline } from 'ionicons/icons';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  imports: [ReactiveFormsModule, IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonSpinner, IonText],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly loadingBiometria = signal(false);
  readonly biometriaSalva = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);
  readonly fingerPrintOutline = fingerPrintOutline;
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required]],
  });

  ngOnInit(): void {
    void this.atualizarStatusBiometria();
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (user) => void this.finalizarLoginComSenha(user),
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  entrarComBiometria(): void {
    if (this.loading() || this.loadingBiometria()) return;

    this.errorMessage.set('');
    this.loadingBiometria.set(true);
    this.auth.loginWithBiometrics().pipe(
      finalize(() => this.loadingBiometria.set(false)),
    ).subscribe({
      next: (user) =>
        void this.router.navigateByUrl(this.auth.homeUrl(user), { replaceUrl: true }),
      error: (error: unknown) => {
        const message = error instanceof Error ? error.message : '';
        if (!message.toLowerCase().includes('cancel')) {
          this.errorMessage.set(message || 'Não foi possível entrar com a biometria.');
        }
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  private async finalizarLoginComSenha(user: Parameters<AuthService['homeUrl']>[0]): Promise<void> {
    try {
      await this.auth.protectCurrentSession();
    } catch {
      // Cancelar a ativação da biometria não cancela o login feito com a senha.
    }

    await this.router.navigateByUrl(this.auth.homeUrl(user), { replaceUrl: true });
  }

  private async atualizarStatusBiometria(): Promise<void> {
    try {
      this.biometriaSalva.set(await this.auth.hasBiometricCredential());
    } catch {
      this.biometriaSalva.set(false);
    }
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 0) {
      this.errorMessage.set('Não foi possível conectar ao servidor. Tente novamente.');
    } else if (error.status === 400 || error.status === 401) {
      this.errorMessage.set('E-mail ou senha inválidos.');
    } else {
      this.errorMessage.set('Ocorreu um erro ao entrar. Tente novamente em instantes.');
    }
  }
}
