import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from './auth.service';

/** Ruta pública de login (nunca lleva token). */
const LOGIN_PATH = '/api/v1/auth/login';

/**
 * Interceptor JWT (segundo en la cadena, después de telemetryInterceptor).
 *
 * * 1. Agrega `Authorization: Bearer <token>` a las peticiones hacia api-go y api-node.
 * * 2. Si una API responde 401 a una petición con token → la sesión venció: cierra sesión como 'expired'.
 *
 * ! Solo adjunta el token a las URLs configuradas (apiGoUrl / apiNodeUrl): NUNCA a terceros,
 * ! para no filtrar credenciales a otros dominios.
 * ! El login se excluye: no hay token todavía y un 401 ahí significa "credenciales incorrectas", no "sesión vencida".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(APP_CONFIG);
  const auth = inject(AuthService);

  const isOwnApi = req.url.startsWith(config.apiGoUrl) || req.url.startsWith(config.apiNodeUrl);
  const isLogin = req.url.endsWith(LOGIN_PATH);
  const token = auth.token();

  if (!isOwnApi || isLogin || !token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        auth.logout('expired');
      }
      // * El error se re-lanza para que el llamador (store o página) también pueda mostrarlo.
      return throwError(() => err);
    }),
  );
};
