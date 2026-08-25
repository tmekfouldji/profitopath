const defaultCallbackUrl = '/dashboard';

export type CallbackUrlValue = string | string[] | undefined;

export function safeCallbackUrl(value: CallbackUrlValue): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return defaultCallbackUrl;
  }

  return value;
}

export function authPageHref(
  path: '/login' | '/register',
  callbackUrl: string,
): string {
  return `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
