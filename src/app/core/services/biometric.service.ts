import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  NativeBiometric,
  NativeBiometricStatus,
} from '../native/native-biometric.plugin';

const UNAVAILABLE: NativeBiometricStatus = {
  available: false,
  hasCredential: false,
  status: -1,
};

@Injectable({ providedIn: 'root' })
export class BiometricService {
  isNativeAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async getStatus(): Promise<NativeBiometricStatus> {
    if (!this.isNativeAndroid()) return UNAVAILABLE;
    return NativeBiometric.getStatus();
  }

  async protectToken(token: string): Promise<boolean> {
    const status = await this.getStatus();
    if (!status.available) return false;

    const result = await NativeBiometric.storeToken({ token });
    return result.stored;
  }

  async unlockToken(): Promise<string | null> {
    const status = await this.getStatus();
    if (!status.available || !status.hasCredential) return null;

    const result = await NativeBiometric.retrieveToken();
    return result.token;
  }

  async removeCredential(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    await NativeBiometric.removeCredential();
  }
}
