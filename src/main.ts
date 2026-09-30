import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';

// La configuración de ejecución (URLs de las APIs) se carga antes de arrancar Angular.
loadAppConfig()
  .then((runtimeConfig) => bootstrapApplication(App, createAppConfig(runtimeConfig)))
  .catch((err) => console.error(err));
