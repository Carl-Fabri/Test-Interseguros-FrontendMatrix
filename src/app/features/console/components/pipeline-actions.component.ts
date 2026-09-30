import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsoleStore, ConsoleAction } from '../console.store';

/**
 * Barra de acciones del pipeline, reutilizada en Resumen y Matriz.
 *
 * * Al terminar una acción ofrece atajos a las páginas de resultados (QR, estadísticas, red),
 * * porque cada apartado de la consola vive en su propia página.
 */
@Component({
  selector: 'app-pipeline-actions',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-secondary" [disabled]="store.running() !== null" (click)="store.runNodeOnly()">
          {{ isRunning('node') ? 'Calculando…' : '∑ Estadísticas directas (Node)' }}
        </button>
        <button type="button" class="btn-secondary" [disabled]="store.running() !== null" (click)="store.runQR()">
          {{ isRunning('qr') ? 'Factorizando…' : '⊞ Calcular factorización QR (Go)' }}
        </button>
        <button type="button" class="btn-primary" [disabled]="store.running() !== null" (click)="store.runPipeline()">
          {{ isRunning('pipeline') ? 'Ejecutando pipeline…' : '▶ Ejecutar pipeline completo (Go → Node)' }}
        </button>
      </div>

      @if (store.hasResults() && !store.running() && !store.error()) {
        <p class="flex flex-wrap items-center justify-end gap-2 font-mono text-[11px] text-ink-muted" role="status">
          <span class="text-ok">✓ Resultados listos:</span>
          @if (store.qr()) {
            <a class="chip" routerLink="/qr">Ver Q y R →</a>
          }
          <a class="chip" routerLink="/estadisticas">Ver estadísticas →</a>
          <a class="chip" routerLink="/red">Ver tráfico →</a>
        </p>
      }
    </div>
  `,
})
export class PipelineActionsComponent {
  protected readonly store = inject(ConsoleStore);

  protected isRunning(action: ConsoleAction): boolean {
    return this.store.running() === action;
  }
}
