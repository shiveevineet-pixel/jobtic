import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jobtic.interviewer',
  appName: 'Jobtic Interviewer',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true  // Route ALL fetch() through native HTTP — bypasses CORS on Android
    }
  }
};

export default config;
