import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeGoogleAuthPlugin {
  signIn(): Promise<{ idToken: string; nonce: string }>;
  signOut(): Promise<void>;
}

export const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const hasNativeGoogleAuth = () => Capacitor.isPluginAvailable('NativeGoogleAuth');
