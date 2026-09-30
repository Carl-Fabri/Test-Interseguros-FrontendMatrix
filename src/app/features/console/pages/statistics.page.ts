import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ConsoleStore } from '../console.store';
import { EmptyStateComponent } from '../components/empty-state.component';
import { SummaryTableComponent } from '../components/summary-table.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { SectionHeaderComponent } from '../../../shared/ui/section-header.component';
import { formatNumber } from '../../../shared/matrix/matrix-math';

/** Página Estadísticas (/estadisticas): resultado de api-node sobre Q y R y tabla multi-matriz (A, Q, R). */
@Component({
  selector: 'app-statistics-page',
  imports: [DecimalPipe, EmptyStateComponent, SummaryTableComponent, KpiCardComponent, SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel flex flex-col gap-5 p-5">
      <app-section-header
        [step]="3"
        title="Cálculo & diagnóstico en Node.js (Express API)"
        subtitle="Estadísticas agregadas de Q y R, verificación de diagonalidad y resumen por matriz."
        [badge]="store.timings().nodeMs !== null ? (store.timings().nodeMs | number: '1.0-1') + ' ms' : ''"
      >
        <span class="tag">TARGET: matrices Q y R</span>
      </app-section-header>

      @if (store.statistics(); as s) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <app-kpi-card label="Valor máximo (max)" icon="↑" [value]="fmt(s.max)" hint="Mayor valor de Q y R" [progress]="1" />
          <app-kpi-card label="Valor mínimo (min)" icon="↓" [value]="fmt(s.min)" hint="Menor valor de Q y R" [progress]="0" />
          <app-kpi-card label="Promedio (mean)" icon="μ" [value]="fmt(s.average)" [hint]="'μ = Σ / ' + s.count + ' valores'" [progress]="ratio(s.average)" />
          <app-kpi-card label="Suma total (sum)" icon="Σ" [value]="fmt(s.sum)" [hint]="s.count + ' elementos evaluados'" />
        </div>

        <div class="panel-inset flex flex-wrap items-center justify-between gap-4 p-4">
          <div class="flex items-start gap-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full border font-mono text-sm"
              [class]="s.anyDiagonal ? 'border-ok text-ok' : 'border-line-strong text-ink-muted'"
              >{{ s.anyDiagonal ? '✓' : '⊖' }}</span
            >
            <div>
              <p class="flex flex-wrap items-center gap-2 text-sm font-semibold">
                Diagnóstico: matriz diagonal
                <span class="tag py-0.5" [class.text-ok]="s.anyDiagonal">{{ s.anyDiagonal ? 'VERDADERO' : 'FALSO' }}</span>
              </p>
              <p class="mt-1 text-xs text-ink-muted">
                @for (m of s.matrices; track m.name; let last = $last) {
                  {{ m.name }}: {{ m.isDiagonal ? 'diagonal' : 'no diagonal' }}{{ last ? '.' : ' · ' }}
                }
              </p>
            </div>
          </div>
          <span class="tag">Criterio: ∀ i≠j |a<sub>ij</sub>| ≤ 1e-10</span>
        </div>
      } @else if (store.summaries().length === 0) {
        <app-empty-state message="Las estadísticas aparecen al factorizar la matriz (api-go las pide a api-node) o con «Estadísticas directas (Node)»." />
      }

      <app-summary-table [rows]="store.summaries()" />
    </section>
  `,
})
export class StatisticsPage {
  protected readonly store = inject(ConsoleStore);
  protected readonly fmt = formatNumber;

  /** Posición relativa de un valor entre el mínimo y el máximo (para la barra de la tarjeta). */
  protected ratio(value: number): number {
    const s = this.store.statistics();
    if (!s || s.max === s.min) return 1;
    return (value - s.min) / (s.max - s.min);
  }
}
