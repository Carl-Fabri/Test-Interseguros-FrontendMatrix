import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsoleStore } from '../console.store';
import { PipelineActionsComponent } from '../components/pipeline-actions.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { HealthService, ServiceHealth } from '../../../core/health/health.service';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { formatScientific } from '../../../shared/matrix/matrix-math';

/** Página de Resumen (/resumen): visión general del pipeline, salud de los servicios y accesos a cada módulo. */
@Component({
  selector: 'app-overview-page',
  imports: [DatePipe, DecimalPipe, RouterLink, PipelineActionsComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- ─── Cabecera ─── -->
      <section class="panel flex flex-wrap items-start justify-between gap-6 p-6">
        <div class="max-w-3xl">
          <p class="eyebrow flex items-center gap-2"><span class="size-1.5 rounded-full bg-ok"></span> Reto técnico · Servicios independientes</p>
          <h1 class="mt-3 text-xl font-semibold tracking-tight md:text-2xl">Consola de procesamiento matricial &amp; análisis distribuido</h1>
          <p class="mt-2 font-mono text-xs leading-relaxed text-ink-muted">
            <span class="text-ink">Pipeline:</span> Matriz A → Go (Fiber) [QR por rotaciones de Givens] → HTTP + JWT → Node.js (Express)
            [estadísticas &amp; diagnóstico diagonal]
          </p>
        </div>
        <div class="flex flex-col gap-2 font-mono text-[11px]">
          <div class="panel-inset px-3 py-2">
            <p class="eyebrow">Go Fiber · api-go</p>
            <p class="mt-0.5">{{ ms(store.timings().goMs) }} · <span class="text-ink-muted">factorización QR</span></p>
          </div>
          <div class="panel-inset px-3 py-2">
            <p class="eyebrow">Node Express · api-node</p>
            <p class="mt-0.5">{{ ms(store.timings().nodeMs) }} · <span class="text-ink-muted">estadísticas</span></p>
          </div>
          <div class="panel-inset px-3 py-2">
            <p class="eyebrow">JWT HS256</p>
            <p class="mt-0.5" [class.text-ok]="auth.isAuthenticated()">
              {{ auth.isAuthenticated() ? 'Válido (' + (auth.secondsLeft() / 60 | number: '1.0-0') + ' min)' : 'Sin sesión' }}
            </p>
          </div>
        </div>
      </section>

      <!-- ─── Indicadores ─── -->
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        <app-kpi-card label="Dimensión matriz" icon="▦" [value]="store.dims().rows + ' × ' + store.dims().cols" [hint]="dimensionHint()" />
        <app-kpi-card
          label="Tiempo total pipeline"
          icon="◷"
          [value]="ms(store.totalMs())"
          [hint]="'Go ' + ms(store.timings().goMs) + ' + Node ' + ms(store.timings().nodeMs)"
        />
        <app-kpi-card
          label="Factorización QR"
          icon="✓"
          [value]="store.verification() ? 'Q × R = A' : 'Pendiente'"
          [tone]="store.verification() ? 'ok' : 'neutral'"
          [hint]="store.verification() ? 'Residuo ' + sci(store.verification()!.residual) : 'Ejecuta la factorización en api-go'"
        />
        <app-kpi-card
          label="Diagnóstico diagonal"
          icon="⊘"
          [value]="store.statistics() ? (store.statistics()!.anyDiagonal ? 'Sí (Verdadero)' : 'No (Falso)') : 'Pendiente'"
          [tone]="store.statistics() ? (store.statistics()!.anyDiagonal ? 'ok' : 'warn') : 'neutral'"
          hint="¿Q o R es diagonal? (según api-node)"
        />
      </section>

      <!-- ─── Acciones ─── -->
      <section class="panel flex flex-col gap-4 p-5" aria-label="Acciones del pipeline">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">Ejecutar sobre la matriz actual ({{ store.dims().rows }}×{{ store.dims().cols }})</h2>
            <p class="mt-0.5 text-xs text-ink-muted">Para cambiar tamaño o valores, ve a <a class="underline hover:text-ink" routerLink="/matriz">Matriz de entrada</a>.</p>
          </div>
        </div>
        <app-pipeline-actions />
      </section>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <!-- ─── Health checker ─── -->
        <section class="panel flex flex-col gap-4 p-5" aria-label="Estado de los servicios">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold">Health checker</h2>
              <p class="mt-0.5 text-xs text-ink-muted">GET /health de cada API cada {{ health.intervalMs / 1000 }} s, desde este navegador.</p>
            </div>
            <button type="button" class="btn-ghost text-xs" (click)="health.refresh()">⟳ Verificar ahora</button>
          </div>
          @for (svc of services(); track svc.name) {
            <div class="panel-inset flex items-center gap-3 px-4 py-3">
              <span class="size-2 rounded-full" [class]="dot(svc.h)"></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{{ svc.name }}</p>
                <p class="truncate font-mono text-[11px] text-ink-faint">{{ svc.url }}/health</p>
              </div>
              <div class="text-right font-mono text-[11px]">
                <p [class]="svc.h.state === 'up' ? 'text-ok' : svc.h.state === 'down' ? 'text-bad' : 'text-warn'">{{ label(svc.h) }}</p>
                <p class="text-ink-faint">
                  {{ svc.h.latencyMs !== null ? (svc.h.latencyMs | number: '1.0-0') + ' ms · ' : '' }}{{ svc.h.checkedAt ? (svc.h.checkedAt | date: 'HH:mm:ss') : '—' }}
                </p>
              </div>
            </div>
          }
        </section>

        <!-- ─── Módulos ─── -->
        <section class="grid gap-3 sm:grid-cols-2" aria-label="Módulos">
          @for (module of modules; track module.link) {
            <a class="panel group flex flex-col gap-2 p-4 transition hover:border-line-strong" [routerLink]="module.link">
              <span class="flex items-center justify-between">
                <span class="font-mono text-sm text-ink-faint">{{ module.icon }}</span>
                <span class="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
              </span>
              <span class="text-sm font-semibold">{{ module.title }}</span>
              <span class="text-xs text-ink-muted">{{ module.description }}</span>
            </a>
          }
        </section>
      </div>
    </div>
  `,
})
export class OverviewPage {
  protected readonly store = inject(ConsoleStore);
  protected readonly health = inject(HealthService);
  protected readonly auth = inject(AuthService);
  private readonly config = inject(APP_CONFIG);
  protected readonly sci = formatScientific;

  protected readonly modules = [
    { link: '/matriz', icon: '▦', title: 'Matriz de entrada', description: 'Dimensiones personalizadas, presets, grilla y JSON.' },
    { link: '/qr', icon: '⊞', title: 'Factorización QR', description: 'Q y R de api-go, verificación y algoritmo de Givens.' },
    { link: '/estadisticas', icon: 'Σ', title: 'Estadísticas', description: 'Máximo, mínimo, promedio, suma y matriz diagonal.' },
    { link: '/red', icon: '⇄', title: 'Red & JWT', description: 'Peticiones, tiempos, cuerpos JSON y claims del token.' },
  ];

  protected readonly services = computed(() => [
    { name: 'api-go · Go (Fiber)', url: this.config.apiGoUrl, h: this.health.go() },
    { name: 'api-node · Node.js (Express)', url: this.config.apiNodeUrl, h: this.health.node() },
  ]);

  protected readonly dimensionHint = computed(() => {
    const { rows, cols } = this.store.dims();
    const rank = this.store.verification()?.rank;
    const shape = rows === cols ? 'Cuadrada' : rows > cols ? 'Rectangular alta' : 'Rectangular ancha';
    return rank === undefined ? shape : `${shape} · rango ${rank}${rank === Math.min(rows, cols) ? ' (completo)' : ' (incompleto)'}`;
  });

  protected ms(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)} ms`;
  }

  protected label(h: ServiceHealth): string {
    return { checking: 'VERIFICANDO', up: '200 OK', down: 'SIN CONEXIÓN' }[h.state];
  }

  protected dot(h: ServiceHealth): string {
    return { checking: 'bg-warn', up: 'bg-ok', down: 'bg-bad' }[h.state];
  }
}
