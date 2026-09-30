import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('usa el formato { error: { code, message } } de las APIs', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { error: { code: 'INVALID_MATRIX', message: 'la matriz debe ser rectangular' } },
    });
    expect(toApiError(err)).toEqual({ status: 400, code: 'INVALID_MATRIX', message: 'la matriz debe ser rectangular' });
  });

  it('explica un error de red (status 0) nombrando el servicio', () => {
    const result = toApiError(new HttpErrorResponse({ status: 0 }), 'api-node');
    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.message).toContain('api-node');
  });

  it('cubre respuestas HTTP sin el formato estándar y errores no HTTP', () => {
    expect(toApiError(new HttpErrorResponse({ status: 503, error: '<html>' })).code).toBe('HTTP_503');
    expect(toApiError(new Error('boom'))).toEqual({ status: -1, code: 'UNKNOWN_ERROR', message: 'boom' });
    expect(toApiError('x').message).toBe('Error inesperado');
  });
});
