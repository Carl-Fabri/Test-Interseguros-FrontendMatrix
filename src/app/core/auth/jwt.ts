/** Claims que emite api-go (ver su openapi.yaml). */
export interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

/**
 * Decodifica el payload de un JWT **sin verificar la firma**. La verificación la hacen las APIs;
 * el frontend solo lo usa para mostrar el usuario y el tiempo restante.
 * Devuelve null si el token está mal formado.
 *
 * ! No usar el resultado para decisiones de seguridad: cualquiera puede fabricar un payload.
 * ? base64url → base64 + relleno "=" + TextDecoder para soportar caracteres UTF-8 en los claims.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
    const claims = JSON.parse(json);
    return claims && typeof claims === 'object' ? (claims as JwtClaims) : null;
  } catch {
    return null;
  }
}

/** Segundos que le quedan al token respecto de `nowMs` (0 si expiró o no tiene `exp`). */
export function secondsUntilExpiry(claims: JwtClaims | null, nowMs: number): number {
  if (!claims?.exp) return 0;
  return Math.max(0, Math.floor(claims.exp - nowMs / 1000));
}
