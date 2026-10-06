const IN_APP_PATTERNS = [/Instagram/i, /FBAN|FBAV|FB_IAB/i, /\bLine\//i, /musical_ly|BytedanceWebview|TikTok/i, /Snapchat/i, /LinkedInApp/i];

/** Navegadores embutidos onde o Google bloqueia OAuth (disallowed_useragent). */
export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
}
