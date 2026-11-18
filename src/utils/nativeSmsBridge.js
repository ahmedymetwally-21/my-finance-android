import { Capacitor, registerPlugin } from '@capacitor/core';

export const SmsBridge = registerPlugin('SmsBridge');

export function getSmsBridgeEnvironment() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const hasPlugin = isNative && Capacitor.isPluginAvailable('SmsBridge');
  const hasWindowScan =
    typeof window !== 'undefined' && typeof window.scanDeviceBankSms === 'function';

  return {
    isNative,
    isNativeAndroid: isNative && platform === 'android',
    platform,
    hasPlugin,
    hasWindowScan
  };
}

export async function getNativeSmsPermissionStatus() {
  const env = getSmsBridgeEnvironment();
  if (!env.hasPlugin) {
    return {
      supported: false,
      granted: false,
      readSms: false,
      receiveSms: false,
      state: env.isNative ? 'plugin_missing' : 'browser'
    };
  }
  try {
    const res = await SmsBridge.getSmsPermissionStatus();
    return {
      supported: true,
      granted: Boolean(res?.granted),
      readSms: Boolean(res?.readSms),
      receiveSms: Boolean(res?.receiveSms),
      state: res?.state || (res?.granted ? 'granted' : 'prompt')
    };
  } catch {
    return {
      supported: false,
      granted: false,
      readSms: false,
      receiveSms: false,
      state: 'error'
    };
  }
}

export async function requestNativeSmsPermission() {
  const env = getSmsBridgeEnvironment();
  if (!env.hasPlugin) {
    return {
      supported: false,
      granted: false,
      readSms: false,
      receiveSms: false,
      state: env.isNative ? 'plugin_missing' : 'browser'
    };
  }
  const res = await SmsBridge.requestSmsPermissions();
  return {
    supported: true,
    granted: Boolean(res?.granted),
    readSms: Boolean(res?.readSms),
    receiveSms: Boolean(res?.receiveSms),
    state: res?.state || (res?.granted ? 'granted' : 'denied')
  };
}

export async function openAndroidAppSettings() {
  const env = getSmsBridgeEnvironment();
  if (!env.hasPlugin) return false;
  try {
    await SmsBridge.openAppSettings();
    return true;
  } catch {
    return false;
  }
}

export async function scanNativeBankSms({ days = 30, limit = 150 } = {}) {
  const res = await SmsBridge.scanRecentBankSms({ days, limit });
  return {
    granted: Boolean(res?.granted),
    permissionDenied: Boolean(res?.permissionDenied),
    messages: Array.isArray(res?.messages) ? res.messages : []
  };
}
