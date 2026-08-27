import { registerPlugin } from '@capacitor/core';

export interface CapturedVideo {
  cancelled: boolean;
  path?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface VideoUploadProgress {
  sent: number;
  total: number;
  percent: number;
}

interface NativeVideoPlugin {
  captureVideo(): Promise<CapturedVideo>;
  uploadVideo(options: {
    path: string;
    url: string;
    token: string;
  }): Promise<{ status: number; body: string }>;
  addListener(
    eventName: 'videoUploadProgress',
    listener: (event: VideoUploadProgress) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const NativeVideo = registerPlugin<NativeVideoPlugin>('NativeVideo');
