import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * * authGuard: protege la consola (/resumen, /matriz, /qr, /estadisticas, /red).
 * * Deja pasar solo con un token vigente; si no, redirige a /login.
 * ? Devuelve un UrlTree en lugar de navegar manualmente: el router cancela la navegación actual
 * ? y redirige de forma atómica, sin parpadeos ni navegaciones duplicadas.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};

/** * guestGuard: evita mostrar el login a un usuario que ya tiene sesión (lo envía a la consola). */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || inject(Router).createUrlTree(['/']);
};
