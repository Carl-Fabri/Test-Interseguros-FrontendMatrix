import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, JsonPipe, UpperCasePipe } from '@angular/common';
import { TelemetryEntry, TelemetryService } from '../../../core/telemetry/telemetry.service';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Inspector de red: historial de peticiones a ambas APIs (registradas por telemetryInterceptor),
 * cuerpo de petición/respuesta de la seleccionada y claims del JWT activo.
 * Nunca muestra el token ni la contraseña.
 */
@Component({
  selector: 'app-network-inspector',
  imports: [DatePipe, DecimalPipe, JsonPipe, UpperCasePipe],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (telemetry.entries().length === 0) {
      <p class="rounded-lg border border-dashed border-line-strong p-6 text-center text-xs text-ink-muted">
        Aún no hay peticiones. Ejecuta una operación para ver el tráfico entre el cliente, api-go y api-node.
      </p>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <!-- Lista de peticiones -->
        <ol class="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1" aria-label="Peticiones recientes">
          @for (entry of telemetry.entries(); track entry.id; let idx = $index) {
            <li>
              <button
                type="button"
                class="panel-inset w-full p-3 text-left transition hover:border-line-strong"
                [class.border-ink]="selected()?.id === entry.id"
                (click)="selectedId.set(entry.id)"
              >
                <div class="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span class="font-semibold">{{ telemetry.entries().length - idx }}. CLIENTE → {{ entry.service | uppercase }}</span>
                  <span [class]="entry.ok ? 'text-ok' : 'text-bad'">
                    {{ entry.status || 'ERR' }} · {{ entry.durationMs | number: '1.0-1' }} ms
                  </span>
                </div>
                <p class="mt-1 truncate font-mono text-[11px] text-ink-muted">{{ entry.method }} {{ path(entry.url) }}</p>
                <p class="mt-0.5 font-mono text-[10px] text-ink-faint">
                  {{ entry.startedAt | date: 'HH:mm:ss.SSS' }} · {{ entry.hasAuth ? 'Bearer JWT' : 'público' }}
                </p>
              </button>
            </li>
          }
        </ol>

        <!-- Detalle -->
        @if (selected(); as entry) {
          <div class="panel-inset flex min-w-0 flex-col">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 font-mono text-[11px]">
              <span class="text-ink-muted">HTTP {{ entry.status || '—' }} · {{ entry.method }} {{ path(entry.url) }}</span>
              <button type="button" class="btn-ghost text-[11px]" (click)="copy(entry)">
                {{ copied() ? '✓ Copiado' : '⧉ Copiar JSON' }}
              </button>
            </div>
            <pre class="max-h-[24rem] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ink">{{ snapshot(entry) | json }}</pre>
          </div>
        }
      </div>
    }

    @if (auth.claims(); as claims) {
      <div class="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
        <span class="tag">sub: {{ claims.sub }}</span>
        <span class="tag">iss: {{ claims.iss }}</span>
        <span class="tag">aud: {{ claims.aud }}</span>
        @if (claims.exp) {
          <span class="tag">exp: {{ claims.exp * 1000 | date: 'HH:mm:ss' }}</span>
        }
      </div>
    }
  `,
})
export class NetworkInspectorComponent {
  protected readonly telemetry = inject(TelemetryService);
  protected readonly auth = inject(AuthService);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly copied = signal(false);

  /** La petición elegida o, por defecto, la más reciente. */
  protected readonly selected = computed((): TelemetryEntry | null => {
    const entries = this.telemetry.entries();
    return entries.find((e) => e.id === this.selectedId()) ?? entries[0] ?? null;
  });

  protected path(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  protected snapshot(entry: TelemetryEntry): object {
    return {
      service: entry.service,
      request: { method: entry.method, url: entry.url, body: entry.requestBody ?? null },
      response: { status: entry.status, durationMs: Number(entry.durationMs.toFixed(2)), body: entry.responseBody ?? null },
    };
  }

  protected async copy(entry: TelemetryEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.snapshot(entry), null, 2));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      this.copied.set(false);
    }
  }
}
