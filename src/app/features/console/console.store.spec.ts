import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { QRResponse, Statistics } from '../../core/api/api.models';
import { TEST_CONFIG } from '../../../testing/test-helpers';
import { ConsoleStore } from './console.store';

const QR_URL = `${TEST_CONFIG.apiGoUrl}/api/v1/matrix/qr`;
const STATS_URL = `${TEST_CONFIG.apiNodeUrl}/api/v1/statistics`;

/** QR exacta de [[3, 0], [4, 5]]. */
const QR_RESPONSE: QRResponse = {
  q: [[0.6, -0.8], [0.8, 0.6]],
  r: [[5, 4], [0, 3]],
  statistics: { max: 5, min: -0.8, average: 1.65, sum: 13.2, count: 8, anyDiagonal: false, matrices: [] },
};
const stats = (max: number): Statistics => ({ max, min: 0, average: 1, sum: 2, count: 4, anyDiagonal: false, matrices: [] });

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: TEST_CONFIG }, ConsoleStore],
  });
  const store = TestBed.inject(ConsoleStore);
  store.setMatrix([[3, 0], [4, 5]]);
  return { store, httpMock: TestBed.inject(HttpTestingController) };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('ConsoleStore', () => {
  it('pipeline completo: QR en api-go y luego A, Q y R en api-node', () => {
    const { store, httpMock } = setup();
    store.runPipeline();
    expect(store.running()).toBe('pipeline');

    const qrReq = httpMock.expectOne(QR_URL);
    expect(qrReq.request.body).toEqual({ matrix: [[3, 0], [4, 5]] });
    qrReq.flush(QR_RESPONSE);

    const statsReqs = httpMock.match(STATS_URL);
    expect(statsReqs.map((r) => r.request.body.matrices[0].name)).toEqual(['A', 'Q', 'R']);
    statsReqs.forEach((req, i) => req.flush(stats(i + 1)));

    expect(store.running()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.summaries().map((s) => [s.key, s.statistics.max])).toEqual([['A', 1], ['Q', 2], ['R', 3]]);
    expect(store.verification()?.residual).toBeLessThan(1e-12);
    expect(store.verification()?.rank).toBe(2);
    expect(store.timings().goMs).not.toBeNull();
    expect(store.timings().nodeMs).not.toBeNull();
  });

  it('si api-go falla, muestra su error y no llama a api-node', () => {
    const { store, httpMock } = setup();
    store.runPipeline();
    httpMock
      .expectOne(QR_URL)
      .flush(
        { error: { code: 'STATISTICS_UNAVAILABLE', message: 'el servicio de estadísticas no está disponible' } },
        { status: 502, statusText: 'Bad Gateway' },
      );

    httpMock.expectNone(STATS_URL);
    expect(store.error()).toMatchObject({ status: 502, code: 'STATISTICS_UNAVAILABLE' });
    expect(store.running()).toBeNull();
  });

  it('estadísticas directas: una sola llamada a api-node con A', () => {
    const { store, httpMock } = setup();
    store.runNodeOnly();

    const req = httpMock.expectOne(STATS_URL);
    expect(req.request.body).toEqual({ matrices: [{ name: 'A', values: [[3, 0], [4, 5]] }] });
    req.flush(stats(5));

    expect(store.summaries()).toHaveLength(1);
    expect(store.qr()).toBeNull();
  });

  it('marca los resultados como desactualizados al editar la matriz', () => {
    const { store, httpMock } = setup();
    store.runQR();
    httpMock.expectOne(QR_URL).flush(QR_RESPONSE);
    expect(store.isStale()).toBe(false);

    store.setCell(0, 0, 9);
    expect(store.isStale()).toBe(true);
    expect(store.activePresetId()).toBeNull();
  });

  it('ignora una segunda acción mientras otra está en curso', () => {
    const { store, httpMock } = setup();
    store.runQR();
    store.runPipeline();
    httpMock.expectOne(QR_URL).flush(QR_RESPONSE);
    httpMock.expectNone(STATS_URL);
  });

  it('crea una matriz personalizada con las dimensiones y el relleno elegidos', () => {
    const { store } = setup();

    store.createCustomMatrix(4, 6, 'zeros');
    expect(store.dims()).toEqual({ rows: 4, cols: 6 });
    expect(store.matrix().flat().every((v) => v === 0)).toBe(true);

    store.createCustomMatrix(2, 3, 'identity');
    expect(store.matrix()).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(store.activePresetId()).toBeNull();
  });

  it('conserva los valores existentes al redimensionar con "keep"', () => {
    const { store } = setup();
    store.createCustomMatrix(3, 3, 'keep');
    expect(store.matrix()).toEqual([
      [3, 0, 0],
      [4, 5, 0],
      [0, 0, 0],
    ]);
  });

  it('rechaza dimensiones fuera de 1..100 sin modificar la matriz', () => {
    const { store } = setup();
    expect(() => store.createCustomMatrix(0, 3, 'zeros')).toThrow(RangeError);
    expect(() => store.createCustomMatrix(3, 101, 'zeros')).toThrow(RangeError);
    expect(store.dims()).toEqual({ rows: 2, cols: 2 });
  });

  it('carga presets por id', () => {
    const { store } = setup();
    store.loadPreset('diagonal');
    expect(store.dims()).toEqual({ rows: 3, cols: 3 });
    expect(store.activePresetId()).toBe('diagonal');
  });
});
