import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.metalcalhas.app',
  appName: 'Metal Calhas',
  webDir: 'dist/app-metal-calhas/browser',
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
