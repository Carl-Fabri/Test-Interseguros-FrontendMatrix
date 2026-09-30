import { InjectionToken } from '@angular/core';

/**
 * Configuración de ejecución del frontend. Se lee de `/config.json` al arrancar, así la misma
 * build sirve para cualquier entorno (local, Docker, nube) sin recompilar.
 *
 * Las URLs son las que ve el **navegador** del usuario, no la red interna de Docker.
 */
export interface AppConfig {
  /** URL base de api-go (login y factorización QR). */
  apiGoUrl: string;
  /** URL base de api-node (estadísticas). */
  apiNodeUrl: string;
  /** Intervalo de sondeo de /health de ambas APIs, en milisegundos. */
  healthPollMs: number;
}

/** Valores por defecto: ambas APIs levantadas en la máquina local. */
export const DEFAULT_APP_CONFIG: AppConfig = {
  apiGoUrl: 'http://localhost:8080',
  apiNodeUrl: 'http://localhost:3000',
  healthPollMs: 15000,
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/**
 * Combina un objeto desconocido (el JSON leído) con los valores por defecto,
 * ignorando campos inválidos y normalizando las URLs (sin "/" final).
 */
export function resolveAppConfig(raw: unknown): AppConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const url = (value: unknown, fallback: string) =>
    typeof value === 'string' && /^https?:\/\//.test(value.trim()) ? value.trim().replace(/\/+$/, '') : fallback;
  const poll = Number(source['healthPollMs']);

  return {
    apiGoUrl: url(source['apiGoUrl'], DEFAULT_APP_CONFIG.apiGoUrl),
    apiNodeUrl: url(source['apiNodeUrl'], DEFAULT_APP_CONFIG.apiNodeUrl),
    healthPollMs: Number.isFinite(poll) && poll >= 1000 ? poll : DEFAULT_APP_CONFIG.healthPollMs,
  };
}

/**
 * Descarga `/config.json`. Si no existe o es inválido se usan los valores por defecto:
 * el archivo es opcional en desarrollo local.
 *
 * * Se ejecuta en main.ts ANTES de arrancar Angular: todos los servicios reciben ya las URLs finales.
 * ? `cache: 'no-store'`: el archivo cambia por entorno y nunca debe servirse desde caché.
 * ! Nunca lanza: una configuración rota no debe dejar la aplicación en blanco.
 */
export async function loadAppConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  try {
    const response = await fetchFn('config.json', { cache: 'no-store' });
    return response.ok ? resolveAppConfig(await response.json()) : { ...DEFAULT_APP_CONFIG };
  } catch {
    return { ...DEFAULT_APP_CONFIG };
  }
}
