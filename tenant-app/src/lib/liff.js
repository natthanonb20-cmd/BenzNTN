import liff from '@line/liff';

const LIFF_ID = '2009775309-LwHzSChX';

let _initialized = false;

export async function initLiff() {
  if (_initialized) return;
  await liff.init({ liffId: LIFF_ID });
  _initialized = true;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
  }
}

export function getAccessToken() {
  return liff.getAccessToken();
}

export function getProfile() {
  return liff.getProfile();
}

export function isInClient() {
  return liff.isInClient();
}
