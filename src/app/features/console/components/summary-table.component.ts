import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatrixSummary } from '../console.store';

/** Tabla multi-matriz: estadísticas individuales de A, Q y R calculadas directamente por api-node. */
@Component({
  selector: 'app-summary-table',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-2">
      <span class="eyebrow">Resumen estadístico multi-matriz</span>
      <span class="font-mono text-[10px] text-ink-faint">Fuente: POST api-node /api/v1/statistics</span>
    </div>
    <div class="mt-2 overflow-x-auto rounded-lg border border-line">
      <table class="w-full min-w-[40rem] text-left text-xs">
        <thead class="bg-surface-2 font-mono text-[10px] tracking-wider text-ink-faint uppercase">
          <tr>
            <th class="px-4 py-2.5 font-medium">Matriz evaluada</th>
            <th class="px-4 py-2.5 font-medium">Dimensión</th>
            <th class="px-4 py-2.5 text-right font-medium">Máximo</th>
            <th class="px-4 py-2.5 text-right font-medium">Mínimo</th>
            <th class="px-4 py-2.5 text-right font-medium">Promedio</th>
            <th class="px-4 py-2.5 text-right font-medium">Suma total</th>
            <th class="px-4 py-2.5 text-right font-medium">¿Diagonal?</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line font-mono tabular-nums">
          @for (row of rows(); track row.key) {
            <tr class="hover:bg-surface-2/60">
              <td class="px-4 py-2.5 font-sans font-medium">
                <span class="mr-2 inline-block size-1.5 rounded-full bg-ink-muted align-middle"></span>{{ row.label }}
              </td>
              <td class="px-4 py-2.5 text-ink-muted">{{ row.rows }} × {{ row.cols }}</td>
              <td class="px-4 py-2.5 text-right">{{ row.statistics.max | number: '1.4-4' }}</td>
              <td class="px-4 py-2.5 text-right">{{ row.statistics.min | number: '1.4-4' }}</td>
              <td class="px-4 py-2.5 text-right">{{ row.statistics.average | number: '1.4-4' }}</td>
              <td class="px-4 py-2.5 text-right">{{ row.statistics.sum | number: '1.4-4' }}</td>
              <td class="px-4 py-2.5 text-right">
                <span class="tag py-0.5" [class.text-ok]="row.statistics.anyDiagonal">
                  {{ row.statistics.anyDiagonal ? 'SÍ' : 'NO' }}
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="px-4 py-6 text-center font-sans text-ink-muted">
                Ejecuta el pipeline completo o las estadísticas directas para poblar esta tabla.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class SummaryTableComponent {
  readonly rows = input.required<MatrixSummary[]>();
}
