import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_CONFIG } from '../config/app-config';
import { TEST_CONFIG, fakeJwt, validJwt } from '../../../testing/test-helpers';
import { AuthService, TOKEN_STORAGE_KEY } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { telemetryInterceptor } from '../telemetry/telemetry.interceptor';
import { TelemetryService } from '../telemetry/telemetry.service';

function setup(storedToken: string | null = null) {
  sessionStorage.clear();
  if (storedToken) sessionStorage.setItem(TOKEN_STORAGE_KEY, storedToken);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([telemetryInterceptor, authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: APP_CONFIG, useValue: TEST_CONFIG },
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
    telemetry: TestBed.inject(TelemetryService),
    router,
  };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('AuthService', () => {
  it('inicia sesión contra api-go y guarda el token en sessionStorage', () => {
    const { auth, httpMock } = setup();
    const token = validJwt(60, 'admin');

    auth.login({ username: 'admin', password: 'admin123' }).subscribe();
    const req = httpMock.expectOne(`${TEST_CONFIG.apiGoUrl}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: token, tokenType: 'Bearer', expiresIn: 3600 });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.username()).toBe('admin');
    expect(auth.secondsLeft()).toBeGreaterThan(3500);
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
  });

  it('restaura una sesión vigente desde sessionStorage', () => {
    const { auth } = setup(validJwt(10));
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('no considera autenticado un token expirado o ilegible', () => {
    expect(setup(fakeJwt({ sub: 'admin', exp: 1 })).auth.isAuthenticated()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup('basura').auth.isAuthenticated()).toBe(false);
  });

  it('cierra sesión, borra el token y vuelve al login', () => {
    const { auth, router } = setup(validJwt());
    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(auth.lastLogoutReason()).toBe('manual');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('authInterceptor', () => {
  it('agrega el Bearer token a api-go y a api-node', () => {
    const token = validJwt();
    const { http, httpMock } = setup(token);

    http.post(`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`, {}).subscribe();
    http.post(`${TEST_CONFIG.apiNodeUrl}/api/v1/statistics`, {}).subscribe();

    for (const url of [`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`, `${TEST_CONFIG.apiNodeUrl}/api/v1/statistics`]) {
      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush({});
    }
  });

  it('nunca envía el token a dominios de terceros', () => {
    const { http, httpMock } = setup(validJwt());
    http.get('https://terceros.example.com/data').subscribe();

    const req = httpMock.expectOne('https://terceros.example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('cierra la sesión como expirada si una API responde 401', () => {
    const { auth, http, httpMock } = setup(validJwt());
    http.post(`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`, {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne(`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`)
      .flush({ error: { code: 'UNAUTHORIZED', message: 'token inválido' } }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.lastLogoutReason()).toBe('expired');
  });
});

describe('telemetryInterceptor', () => {
  it('registra servicio, estado y duración de cada petición', () => {
    const { http, httpMock, telemetry } = setup(validJwt());
    http.post(`${TEST_CONFIG.apiNodeUrl}/api/v1/statistics`, { matrices: [] }).subscribe();
    httpMock.expectOne(`${TEST_CONFIG.apiNodeUrl}/api/v1/statistics`).flush({ max: 1 });

    const entry = telemetry.latest();
    expect(entry).toMatchObject({ service: 'api-node', method: 'POST', status: 200, ok: true });
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('oculta la contraseña y el token del login', () => {
    const { auth, httpMock, telemetry } = setup();
    auth.login({ username: 'admin', password: 'secreta' }).subscribe();
    httpMock.expectOne(`${TEST_CONFIG.apiGoUrl}/api/v1/auth/login`).flush({ accessToken: validJwt(), tokenType: 'Bearer', expiresIn: 1 });

    const serialized = JSON.stringify(telemetry.latest());
    expect(serialized).not.toContain('secreta');
    expect(serialized).toContain('<jwt>');
  });

  it('registra también las respuestas de error', () => {
    const { http, httpMock, telemetry } = setup(validJwt());
    http.post(`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`)
      .flush({ error: { code: 'INVALID_MATRIX', message: 'x' } }, { status: 400, statusText: 'Bad Request' });

    expect(telemetry.latest()).toMatchObject({ status: 400, ok: false });
  });
});
