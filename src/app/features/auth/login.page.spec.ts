import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_CONFIG } from '../../core/config/app-config';
import { HealthService } from '../../core/health/health.service';
import { TEST_CONFIG, validJwt } from '../../../testing/test-helpers';
import { LoginPage } from './login.page';

const LOGIN_URL = `${TEST_CONFIG.apiGoUrl}/api/v1/auth/login`;

async function setup() {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: APP_CONFIG, useValue: TEST_CONFIG },
      // Sin sondeo real de /health en las pruebas.
      {
        provide: HealthService,
        useValue: { start: () => undefined, go: signal({ state: 'up', latencyMs: 1, checkedAt: null }), node: signal({ state: 'down', latencyMs: null, checkedAt: null }) },
      },
    ],
  });
  const fixture = TestBed.createComponent(LoginPage);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  await fixture.whenStable();

  const el = fixture.nativeElement as HTMLElement;
  const type = (name: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`input[formcontrolname="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, router, type, submit, httpMock: TestBed.inject(HttpTestingController) };
}

describe('LoginPage', () => {
  it('deshabilita el envío hasta completar ambos campos', async () => {
    const { el, type, fixture } = await setup();
    const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);

    type('username', 'admin');
    type('password', 'admin123');
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
  });

  it('inicia sesión y navega a la consola', async () => {
    const { type, submit, httpMock, router } = await setup();
    type('username', 'admin');
    type('password', 'admin123');
    await submit();

    const req = httpMock.expectOne(LOGIN_URL);
    expect(req.request.body).toEqual({ username: 'admin', password: 'admin123' });
    req.flush({ accessToken: validJwt(), tokenType: 'Bearer', expiresIn: 3600 });

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('muestra un mensaje claro ante credenciales inválidas', async () => {
    const { type, submit, httpMock, fixture, el } = await setup();
    type('username', 'admin');
    type('password', 'mal');
    await submit();

    httpMock
      .expectOne(LOGIN_URL)
      .flush({ error: { code: 'INVALID_CREDENTIALS', message: 'usuario o contraseña incorrectos' } }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Usuario o contraseña incorrectos');
  });

  it('muestra el estado de ambas APIs', async () => {
    const { el } = await setup();
    const text = el.textContent ?? '';
    expect(text).toContain('api-go');
    expect(text).toContain('online');
    expect(text).toContain('offline');
  });
});
