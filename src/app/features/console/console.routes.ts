import { Routes } from '@angular/router';
import { ShellComponent } from '../../layout/shell.component';
import { ConsoleStore } from './console.store';

/**
 * Rutas de la consola MatrixCore: una página por apartado.
 *
 * * `providers: [ConsoleStore]` en la ruta padre: todas las páginas hijas comparten la misma instancia
 * * del store, así la matriz y los resultados se conservan al navegar entre páginas.
 * ? Se carga en diferido desde app.routes.ts, protegido por authGuard.
 */
export const CONSOLE_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    providers: [ConsoleStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        title: 'Resumen · MatrixCore',
        loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage),
      },
      {
        path: 'matriz',
        title: 'Matriz de entrada · MatrixCore',
        loadComponent: () => import('./pages/matrix.page').then((m) => m.MatrixPage),
      },
      {
        path: 'qr',
        title: 'Factorización QR · MatrixCore',
        loadComponent: () => import('./pages/qr.page').then((m) => m.QrPage),
      },
      {
        path: 'estadisticas',
        title: 'Estadísticas · MatrixCore',
        loadComponent: () => import('./pages/statistics.page').then((m) => m.StatisticsPage),
      },
      {
        path: 'red',
        title: 'Red & JWT · MatrixCore',
        loadComponent: () => import('./pages/network.page').then((m) => m.NetworkPage),
      },
    ],
  },
];
