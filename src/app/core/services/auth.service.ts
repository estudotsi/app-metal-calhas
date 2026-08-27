import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../features/auth/models/login-request';
import { LoginResponse } from '../../features/auth/models/login-response';
import { AuthenticatedUser } from '../models/authenticated-user';
import { BiometricService } from './biometric.service';
import { TokenStorageService } from './token-storage.service';

type JwtPayload = Record<string, unknown> & { exp?: number };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly biometric = inject(BiometricService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly loginUrl = `${environment.apiUrl}/mobile/auth/login`;
  private readonly meUrl = `${environment.apiUrl}/mobile/auth/me`;
  private readonly currentUserState = signal<AuthenticatedUser | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);

  login(request: LoginRequest): Observable<AuthenticatedUser> {
    return this.http.post<LoginResponse>(this.loginUrl, request).pipe(
      tap(({ accessToken }) => this.tokenStorage.setToken(accessToken)),
      switchMap(() => this.loadCurrentUser()),
      catchError((error: unknown) => {
        this.clearLocalSession();
        return throwError(() => error);
      }),
    );
  }

  restoreSession(): Observable<AuthenticatedUser | null> {
    if (this.biometric.isNativeAndroid()) {
      this.tokenStorage.clear();
      return from(this.biometric.unlockToken()).pipe(
        switchMap((token) => {
          if (!token) return of(null);
          this.tokenStorage.setToken(token);

          if (!this.hasValidSession()) return of(null);
          return this.loadCurrentUser();
        }),
        catchError(() => {
          this.tokenStorage.clear();
          this.currentUserState.set(null);
          return of(null);
        }),
      );
    }

    if (!this.hasValidSession()) {
      return of(null);
    }

    return this.loadCurrentUser().pipe(
      catchError(() => {
        this.logout();
        return of(null);
      }),
    );
  }

  logout(): void {
    this.clearLocalSession();
    void this.biometric.removeCredential();
  }

  async protectCurrentSession(): Promise<boolean> {
    const token = this.tokenStorage.getToken();
    if (!token) return false;
    return this.biometric.protectToken(token);
  }

  hasBiometricCredential(): Promise<boolean> {
    return this.biometric.getStatus().then((status) => status.available && status.hasCredential);
  }

  loginWithBiometrics(): Observable<AuthenticatedUser> {
    return from(this.biometric.unlockToken()).pipe(
      switchMap((token) => {
        if (!token) return throwError(() => new Error('Acesso biométrico não disponível.'));
        this.tokenStorage.setToken(token);

        if (!this.hasValidSession()) {
          return throwError(() => new Error('Sua sessão expirou. Entre novamente com sua senha.'));
        }

        return this.loadCurrentUser();
      }),
      catchError((error: unknown) => {
        this.tokenStorage.clear();
        this.currentUserState.set(null);
        return throwError(() => error);
      }),
    );
  }

  homeUrl(user = this.currentUserState()): string {
    if (user?.roles.includes('Orcamentista')) return '/agendamentos';
    if (user?.roles.includes('Montador')) return '/atendimentos';
    return '/inicio';
  }

  hasValidSession(): boolean {
    const token = this.tokenStorage.getToken();
    if (!token) return false;

    try {
      const payload = this.decodePayload(token);
      const valid = typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
      if (!valid) this.logout();
      return valid;
    } catch {
      this.logout();
      return false;
    }
  }

  private loadCurrentUser(): Observable<AuthenticatedUser> {
    return this.http
      .get<AuthenticatedUser>(this.meUrl)
      .pipe(tap((user) => this.currentUserState.set(user)));
  }

  private decodePayload(token: string): JwtPayload {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) throw new Error('Token JWT inválido.');

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(decoded) as JwtPayload;
  }

  private clearLocalSession(): void {
    this.tokenStorage.clear();
    this.currentUserState.set(null);
  }
}
