import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'land.scan.app',
  appName: 'scaNLand',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
