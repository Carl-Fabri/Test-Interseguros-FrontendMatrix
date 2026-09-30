import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { authInterceptor } from './core/auth/auth.interceptor';
import { telemetryInterceptor } from './core/telemetry/telemetry.interceptor';

/**
 * Proveedores de la aplicación. `runtimeConfig` viene de /config.json (ver core/config/app-config.ts).
 * La app es zoneless (Angular 21) y usa signals para todo el estado.
 */
export function createAppConfig(runtimeConfig: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      // telemetry primero: mide la petición completa, incluido el paso por authInterceptor.
      provideHttpClient(withFetch(), withInterceptors([telemetryInterceptor, authInterceptor])),
      { provide: APP_CONFIG, useValue: runtimeConfig },
    ],
  };
}
