import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, // undefined = SDK desligado
  // @sentry/nextjs v11 trocou `sendDefaultPii` por `dataCollection` (os defaults
  // coletam tudo); aqui desligamos tudo que pode carregar token, e-mail ou apelido.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
