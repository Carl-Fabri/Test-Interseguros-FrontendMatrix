import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AppConfig, APP_CONFIG } from '../config/app-config';
import { ServiceName, TelemetryService } from './telemetry.service';

/** Marca una petición para que no se registre (p. ej. el sondeo de /health). */
export const SKIP_TELEMETRY = new HttpContextToken<boolean>(() => false);

const LOGIN_PATH = '/auth/login';

/**
 * Interceptor de telemetría (primero en la cadena, antes de authInterceptor).
 *
 * * Mide cada petición (duración, estado, cuerpos) y la registra en TelemetryService, que alimenta
 * * el inspector de la página Red & JWT.
 * ? Va antes de authInterceptor para medir el recorrido completo y para NO ver el header Authorization.
 * ! Nunca registra secretos: del login enmascara la contraseña y reemplaza el token por '<jwt>'.
 */
export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_TELEMETRY)) {
    return next(req);
  }

  const telemetry = inject(TelemetryService);
  const service = serviceFor(req.url, inject(APP_CONFIG));
  const isLogin = req.url.endsWith(LOGIN_PATH);
  const startedAt = new Date();
  const start = performance.now();
  const base = {
    service,
    method: req.method,
    url: req.url,
    startedAt,
    requestBody: isLogin ? maskLoginRequest(req) : req.body,
    hasAuth: !isLogin, // las rutas distintas del login son protegidas (authInterceptor adjunta el Bearer)
  };

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const responseBody = isLogin ? { ...(event.body as object), accessToken: '<jwt>' } : event.body;
          telemetry.record({ ...base, status: event.status, ok: true, durationMs: performance.now() - start, responseBody });
        }
      },
      error: (err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : -1;
        const responseBody = err instanceof HttpErrorResponse ? err.error : String(err);
        telemetry.record({ ...base, status, ok: false, durationMs: performance.now() - start, responseBody });
      },
    }),
  );
};

/** Identifica el servicio de destino por el prefijo de la URL. */
function serviceFor(url: string, config: AppConfig): ServiceName {
  if (url.startsWith(config.apiGoUrl)) return 'api-go';
  if (url.startsWith(config.apiNodeUrl)) return 'api-node';
  return 'externo';
}

/** ! Conserva el usuario pero oculta la contraseña del cuerpo del login. */
function maskLoginRequest(req: HttpRequest<unknown>): object {
  return { username: (req.body as { username?: string } | null)?.username, password: '••••••' };
}
