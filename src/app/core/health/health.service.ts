import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, map, merge, of, switchMap, timer } from 'rxjs';
import { ApiGoService } from '../api/api-go.service';
import { ApiNodeService } from '../api/api-node.service';
import { APP_CONFIG } from '../config/app-config';

/** Estado de salud de un servicio. */
export interface ServiceHealth {
  /** checking: aún sin respuesta · up: GET /health respondió 2xx · down: error, timeout o sin red. */
  state: 'checking' | 'up' | 'down';
  /** Latencia de la última verificación medida desde el navegador (ms); null si falló. */
  latencyMs: number | null;
  /** Momento de la última verificación completada. */
  checkedAt: Date | null;
}

const INITIAL: ServiceHealth = { state: 'checking', latencyMs: null, checkedAt: null };

/**
 * Health checker del frontend: sondea `GET /health` de api-go y api-node y expone su estado como signals.
 *
 * * Cómo funciona
 * *   - Al llamar start() hace una verificación inmediata y luego una cada `healthPollMs` (config.json, 15 s).
 * *   - refresh() fuerza una verificación inmediata de ambos servicios (botón "Verificar ahora").
 * *   - Cada verificación mide la latencia con performance.now() y actualiza el signal del servicio.
 * *   - Un error (HTTP ≠ 2xx, CORS, red caída) marca el servicio como `down`; el sondeo continúa y
 * *     vuelve a `up` solo cuando el servicio se recupera.
 *
 * ! Las peticiones de /health se marcan con SKIP_TELEMETRY (en ApiGoService/ApiNodeService) para no
 * ! saturar el inspector de red, y son públicas: no llevan JWT.
 *
 * ? Es `providedIn: 'root'` y start() es idempotente: el login y la consola comparten el mismo sondeo.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly apiGo = inject(ApiGoService);
  private readonly apiNode = inject(ApiNodeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pollMs = inject(APP_CONFIG).healthPollMs;
  private readonly refresh$ = new Subject<void>();
  private started = false;

  readonly go = signal<ServiceHealth>(INITIAL);
  readonly node = signal<ServiceHealth>(INITIAL);
  /** true solo si ambos servicios respondieron correctamente en su última verificación. */
  readonly allUp = computed(() => this.go().state === 'up' && this.node().state === 'up');
  /** Intervalo de sondeo configurado (para mostrarlo en la interfaz). */
  readonly intervalMs = this.pollMs;

  /** Inicia el sondeo periódico. Llamarlo varias veces no crea sondeos duplicados. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.poll(() => this.apiGo.health(), (h) => this.go.set(h));
    this.poll(() => this.apiNode.health(), (h) => this.node.set(h));
  }

  /** Verifica ambos servicios ahora mismo, sin esperar al siguiente intervalo. */
  refresh(): void {
    this.refresh$.next();
  }

  /**
   * * Un sondeo por servicio: timer(0, pollMs) + refresh$ → switchMap cancela una verificación lenta
   * * si llega la siguiente, así nunca hay dos verificaciones del mismo servicio en vuelo.
   */
  private poll(check: () => Observable<unknown>, update: (h: ServiceHealth) => void): void {
    merge(timer(0, this.pollMs), this.refresh$)
      .pipe(
        switchMap(() => {
          const start = performance.now();
          return check().pipe(
            map((): ServiceHealth => ({ state: 'up', latencyMs: performance.now() - start, checkedAt: new Date() })),
            // ! Nunca propagar el error: un fallo de /health no debe romper el sondeo.
            catchError(() => of<ServiceHealth>({ state: 'down', latencyMs: null, checkedAt: new Date() })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(update);
  }
}
