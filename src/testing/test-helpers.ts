import { AppConfig } from '../app/core/config/app-config';

/** Configuración de prueba (nunca se usa un config.json real). */
export const TEST_CONFIG: AppConfig = {
  apiGoUrl: 'http://go.test',
  apiNodeUrl: 'http://node.test',
  healthPollMs: 60_000,
};

/** Crea un JWT **sin firma válida** con los claims dados (el frontend solo decodifica el payload). */
export function fakeJwt(claims: Record<string, unknown>): string {
  // base64url de los bytes UTF-8 del JSON, como un JWT real.
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

/** JWT vigente por `minutes` minutos a partir de ahora. */
export function validJwt(minutes = 60, sub = 'admin'): string {
  const now = Math.floor(Date.now() / 1000);
  return fakeJwt({ sub, iss: 'api-go', aud: ['matrix-services'], iat: now, exp: now + minutes * 60 });
}
