import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { APP_CONFIG } from '../config/app-config';
import { TEST_CONFIG } from '../../../testing/test-helpers';
import { telemetryInterceptor } from '../telemetry/telemetry.interceptor';
import { TelemetryService } from '../telemetry/telemetry.service';
import { HealthService } from './health.service';

const GO_HEALTH = `${TEST_CONFIG.apiGoUrl}/health`;
const NODE_HEALTH = `${TEST_CONFIG.apiNodeUrl}/health`;

/** Deja correr el timer(0) inicial del sondeo. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([telemetryInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: TEST_CONFIG }, // healthPollMs = 60 s: solo corre la verificación inicial
    ],
  });
  return {
    health: TestBed.inject(HealthService),
    httpMock: TestBed.inject(HttpTestingController),
    telemetry: TestBed.inject(TelemetryService),
  };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('HealthService (health checker)', () => {
  it('empieza en "checking" y marca "up" con latencia cuando /health responde', async () => {
    const { health, httpMock } = setup();
    expect(health.go().state).toBe('checking');

    health.start();
    await tick();
    httpMock.expectOne(GO_HEALTH).flush({ status: 'ok', service: 'api-go' });
    httpMock.expectOne(NODE_HEALTH).flush({ status: 'ok', service: 'api-node' });

    expect(health.go()).toMatchObject({ state: 'up' });
    expect(health.go().latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.go().checkedAt).toBeInstanceOf(Date);
    expect(health.allUp()).toBe(true);
  });

  it('marca "down" si un servicio falla, sin afectar al otro', async () => {
    const { health, httpMock } = setup();
    health.start();
    await tick();
    httpMock.expectOne(GO_HEALTH).flush({ status: 'ok', service: 'api-go' });
    httpMock.expectOne(NODE_HEALTH).error(new ProgressEvent('error')); // sin red / CORS

    expect(health.go().state).toBe('up');
    expect(health.node()).toMatchObject({ state: 'down', latencyMs: null });
    expect(health.allUp()).toBe(false);
  });

  it('refresh() verifica de inmediato y detecta la recuperación del servicio', async () => {
    const { health, httpMock } = setup();
    health.start();
    await tick();
    httpMock.expectOne(GO_HEALTH).flush({});
    httpMock.expectOne(NODE_HEALTH).flush('caído', { status: 503, statusText: 'Service Unavailable' });
    expect(health.node().state).toBe('down');

    health.refresh();
    httpMock.expectOne(GO_HEALTH).flush({});
    httpMock.expectOne(NODE_HEALTH).flush({ status: 'ok', service: 'api-node' });
    expect(health.node().state).toBe('up');
  });

  it('start() es idempotente y /health no aparece en la telemetría', async () => {
    const { health, httpMock, telemetry } = setup();
    health.start();
    health.start();
    await tick();

    // expectOne falla si hubiera dos sondeos (dos peticiones por servicio).
    httpMock.expectOne(GO_HEALTH).flush({});
    httpMock.expectOne(NODE_HEALTH).flush({});
    expect(telemetry.entries()).toHaveLength(0);
  });
});
