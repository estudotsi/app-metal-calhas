import { registerPlugin } from '@capacitor/core';

export interface NativeBiometricStatus {
  available: boolean;
  hasCredential: boolean;
  status: number;
}

export interface NativeBiometricPlugin {
  getStatus(): Promise<NativeBiometricStatus>;
  storeToken(options: { token: string }): Promise<{ stored: boolean }>;
  retrieveToken(): Promise<{ token: string }>;
  removeCredential(): Promise<void>;
}

export const NativeBiometric = registerPlugin<NativeBiometricPlugin>('NativeBiometric');
