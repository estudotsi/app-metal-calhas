import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly tokenKey = 'metal-calhas.access-token';
  private memoryToken: string | null = null;

  getToken(): string | null {
    if (this.isNativeAndroid()) return this.memoryToken;
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    if (this.isNativeAndroid()) {
      this.memoryToken = token;
      localStorage.removeItem(this.tokenKey);
      return;
    }
    localStorage.setItem(this.tokenKey, token);
  }

  clear(): void {
    this.memoryToken = null;
    localStorage.removeItem(this.tokenKey);
  }

  private isNativeAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }
}
