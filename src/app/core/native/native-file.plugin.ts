import { registerPlugin } from '@capacitor/core';

interface NativeFilePlugin {
  downloadFile(options: {
    url: string;
    token: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ fileName: string; location: string }>;
}

export const NativeFile = registerPlugin<NativeFilePlugin>('NativeFile');
