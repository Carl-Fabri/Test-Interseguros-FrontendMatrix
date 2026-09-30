import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

/**
 * Rutas raíz. Todo se carga en diferido: el login y la consola se descargan solo cuando se visitan.
 *
 * * /login        → pública; guestGuard redirige a la consola si ya hay sesión.
 * * /resumen, /matriz, /qr, /estadisticas, /red → consola; authGuard exige un JWT vigente.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · MatrixCore',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./features/console/console.routes').then((m) => m.CONSOLE_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
