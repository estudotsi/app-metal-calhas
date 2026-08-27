import { registerPlugin } from '@capacitor/core';

export interface CapturedPhoto {
  cancelled: boolean;
  path?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface PhotoUploadProgress {
  sent: number;
  total: number;
  percent: number;
}

interface NativePhotoPlugin {
  capturePhoto(): Promise<CapturedPhoto>;
  uploadPhoto(options: {
    path: string;
    url: string;
    token: string;
  }): Promise<{ status: number; body: string }>;
  addListener(
    eventName: 'photoUploadProgress',
    listener: (event: PhotoUploadProgress) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const NativePhoto = registerPlugin<NativePhotoPlugin>('NativePhoto');
