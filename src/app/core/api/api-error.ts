import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from './api.models';

/** Error normalizado para mostrar en la interfaz. */
export interface ApiError {
  status: number;
  code: string;
  message: string;
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  const error = (body as ApiErrorBody | null)?.error;
  return typeof error?.code === 'string' && typeof error?.message === 'string';
}

/**
 * Convierte cualquier error (HTTP, de red o inesperado) al formato de la interfaz.
 * Aprovecha el formato `{ error: { code, message } }` que devuelven ambas APIs.
 *
 * * status 0  → la petición no llegó (API caída o CORS): mensaje accionable con el nombre del servicio.
 * * status ≥1 → se usa el código estable de la API (INVALID_MATRIX, UNAUTHORIZED, ...).
 */
export function toApiError(err: unknown, serviceName = 'la API'): ApiError {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return {
        status: 0,
        code: 'NETWORK_ERROR',
        message: `No se pudo conectar con ${serviceName}. Verifica que esté levantada y que CORS permita este origen.`,
      };
    }
    if (isApiErrorBody(err.error)) {
      return { status: err.status, code: err.error.error.code, message: err.error.error.message };
    }
    return { status: err.status, code: `HTTP_${err.status}`, message: err.message };
  }
  return { status: -1, code: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : 'Error inesperado' };
}
