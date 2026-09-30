import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiGoService } from '../../core/api/api-go.service';
import { ApiNodeService } from '../../core/api/api-node.service';
import { Matrix, QRResponse, Statistics } from '../../core/api/api.models';
import { ApiError, toApiError } from '../../core/api/api-error';
import { MatrixFill, createMatrix, dimensions, rankFromR, verifyQR } from '../../shared/matrix/matrix-math';
import { MATRIX_PRESETS } from '../../shared/matrix/presets';

/** Estadísticas de una matriz individual, calculadas directamente por api-node. */
export interface MatrixSummary {
  key: 'A' | 'Q' | 'R';
  label: string;
  rows: number;
  cols: number;
  statistics: Statistics;
}

/** Tiempos medidos desde el navegador (incluyen la red). */
export interface PipelineTimings {
  goMs: number | null;
  nodeMs: number | null;
}

/** Operación en curso (solo una a la vez). */
export type ConsoleAction = 'pipeline' | 'qr' | 'node';

const LABELS: Record<MatrixSummary['key'], string> = {
  A: 'Matriz original [A]',
  Q: 'Matriz ortogonal [Q]',
  R: 'Matriz triangular [R]',
};

/**
 * Estado y casos de uso de la consola MatrixCore.
 *
 * * Se provee en la ruta de la consola (console.routes.ts), no en root: todas las páginas
 * * (resumen, matriz, QR, estadísticas, red) comparten la MISMA instancia, así la matriz y los
 * * resultados se conservan al navegar, y se descartan al cerrar sesión.
 *
 * Flujos:
 *  - runQR()       → api-go factoriza y consulta a api-node por su cuenta.
 *  - runNodeOnly() → api-node directo con A (el frontend consume ambas APIs).
 *  - runPipeline() → QR en api-go y luego A, Q y R en paralelo en api-node (tabla multi-matriz).
 */
@Injectable()
export class ConsoleStore {
  private readonly apiGo = inject(ApiGoService);
  private readonly apiNode = inject(ApiNodeService);

  // ═════════════════════════════════════════════════════════════════════════
  // Estado
  // ═════════════════════════════════════════════════════════════════════════
  readonly matrix = signal<Matrix>(structuredClone(MATRIX_PRESETS[0].values));
  readonly activePresetId = signal<string | null>(MATRIX_PRESETS[0].id);
  readonly qr = signal<QRResponse | null>(null);
  /** Matriz con la que se obtuvo `qr` (para detectar resultados desactualizados). */
  readonly analyzedMatrix = signal<Matrix | null>(null);
  readonly summaries = signal<MatrixSummary[]>([]);
  readonly timings = signal<PipelineTimings>({ goMs: null, nodeMs: null });
  readonly running = signal<ConsoleAction | null>(null);
  readonly error = signal<ApiError | null>(null);

  // ═════════════════════════════════════════════════════════════════════════
  // Derivados
  // ═════════════════════════════════════════════════════════════════════════
  readonly dims = computed(() => dimensions(this.matrix()));
  /** Estadísticas agregadas de Q y R que api-go obtuvo de api-node. */
  readonly statistics = computed(() => this.qr()?.statistics ?? null);
  readonly hasResults = computed(() => this.qr() !== null || this.summaries().length > 0);
  readonly isStale = computed(() => {
    const analyzed = this.analyzedMatrix();
    // ? Comparación por JSON: suficiente para ≤ 100×100 y evita mantener un contador de versiones.
    return analyzed !== null && JSON.stringify(analyzed) !== JSON.stringify(this.matrix());
  });
  /** Verificación local de la QR recibida: residuo, ortogonalidad y rango. */
  readonly verification = computed(() => {
    const qr = this.qr();
    const a = this.analyzedMatrix();
    return qr && a ? { ...verifyQR(a, qr.q, qr.r), rank: rankFromR(qr.r) } : null;
  });
  readonly totalMs = computed(() => {
    const { goMs, nodeMs } = this.timings();
    return goMs === null && nodeMs === null ? null : (goMs ?? 0) + (nodeMs ?? 0);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Edición de la matriz
  // ═════════════════════════════════════════════════════════════════════════
  setMatrix(matrix: Matrix, presetId: string | null = null): void {
    this.matrix.set(matrix);
    this.activePresetId.set(presetId);
  }

  loadPreset(id: string): void {
    const preset = MATRIX_PRESETS.find((p) => p.id === id);
    if (preset) this.setMatrix(structuredClone(preset.values), preset.id);
  }

  /**
   * * Matriz personalizada: el usuario elige filas, columnas y cómo rellenarla.
   * ! Propaga el RangeError de createMatrix si las dimensiones están fuera de 1..100
   * ! (el componente lo muestra como error de formulario).
   */
  createCustomMatrix(rows: number, cols: number, fill: MatrixFill): void {
    this.setMatrix(createMatrix(rows, cols, fill, this.matrix()));
  }

  setCell(row: number, col: number, value: number): void {
    // * Inmutable: una matriz nueva hace que los computed (isStale, dims, JSON) se recalculen.
    this.matrix.update((m) => m.map((r, i) => (i === row ? r.map((v, j) => (j === col ? value : v)) : r)));
    this.activePresetId.set(null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Casos de uso
  // ═════════════════════════════════════════════════════════════════════════

  /** Solo la factorización QR en api-go (incluye las estadísticas agregadas que api-go pide a api-node). */
  runQR(): void {
    this.execute('qr', this.factorize().pipe(map(() => undefined)));
  }

  /** Estadísticas de A llamando directamente a api-node. */
  runNodeOnly(): void {
    const a = this.matrix();
    this.execute(
      'node',
      this.nodeSummaries([{ key: 'A', values: a }]).pipe(
        tap((summaries) => this.summaries.set(summaries)),
        map(() => undefined),
      ),
    );
  }

  /**
   * * Pipeline completo: QR en api-go y, cuando responde, A, Q y R en PARALELO en api-node.
   * ? switchMap + forkJoin: las 3 llamadas a api-node dependen de Q y R, pero no entre sí.
   */
  runPipeline(): void {
    this.execute(
      'pipeline',
      this.factorize().pipe(
        switchMap(({ a, qr }) =>
          this.nodeSummaries([
            { key: 'A', values: a },
            { key: 'Q', values: qr.q },
            { key: 'R', values: qr.r },
          ]),
        ),
        tap((summaries) => this.summaries.set(summaries)),
        map(() => undefined),
      ),
    );
  }

  dismissError(): void {
    this.error.set(null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Internos
  // ═════════════════════════════════════════════════════════════════════════

  /** POST api-go /matrix/qr; guarda el resultado, la matriz analizada y el tiempo de api-go. */
  private factorize(): Observable<{ a: Matrix; qr: QRResponse }> {
    const a = this.matrix();
    const start = performance.now();
    return this.apiGo.factorize(a).pipe(
      catchError((err) => throwError(() => toApiError(err, 'api-go'))),
      tap((qr) => {
        this.qr.set(qr);
        this.analyzedMatrix.set(a);
        this.timings.set({ goMs: performance.now() - start, nodeMs: null });
      }),
      map((qr) => ({ a, qr })),
    );
  }

  /** Una llamada a api-node por matriz (en paralelo) para obtener estadísticas individuales. */
  private nodeSummaries(items: { key: MatrixSummary['key']; values: Matrix }[]): Observable<MatrixSummary[]> {
    const start = performance.now();
    return forkJoin(
      items.map(({ key, values }) =>
        this.apiNode
          .statistics([{ name: key, values }])
          .pipe(map((statistics): MatrixSummary => ({ key, label: LABELS[key], ...dimensions(values), statistics }))),
      ),
    ).pipe(
      catchError((err) => throwError(() => toApiError(err, 'api-node'))),
      tap(() => this.timings.update((t) => ({ ...t, nodeMs: performance.now() - start }))),
    );
  }

  /**
   * * Ejecutor común de acciones: marca `running`, limpia el error y lo captura si falla.
   * ! Ignora nuevas acciones mientras otra está en curso (evita respuestas cruzadas y doble clic).
   */
  private execute(action: ConsoleAction, work: Observable<void>): void {
    if (this.running()) return;
    this.running.set(action);
    this.error.set(null);
    work
      .pipe(
        catchError((err: unknown) => {
          this.error.set(isApiError(err) ? err : toApiError(err));
          return of(undefined);
        }),
        finalize(() => this.running.set(null)),
      )
      .subscribe();
  }
}

function isApiError(err: unknown): err is ApiError {
  return typeof (err as ApiError)?.code === 'string' && typeof (err as ApiError)?.status === 'number';
}
