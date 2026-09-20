import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.encrypt.app',
  appName: 'Encrypt',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
