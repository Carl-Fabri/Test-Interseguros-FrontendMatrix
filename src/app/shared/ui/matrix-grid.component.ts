import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Matrix } from '../../core/api/api.models';
import { ZERO_TOLERANCE, formatNumber } from '../matrix/matrix-math';

/** Visualización de solo lectura de una matriz, con la diagonal resaltada y los ceros atenuados. */
@Component({
  selector: 'app-matrix-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <div
        class="relative inline-grid min-w-full gap-1.5 border-x border-line-strong px-2 py-1"
        [style.grid-template-columns]="'repeat(' + cols() + ', minmax(4.5rem, 1fr))'"
        role="table"
        [attr.aria-label]="label()"
      >
        @for (row of matrix(); track $index; let i = $index) {
          @for (value of row; track $index; let j = $index) {
            <div
              role="cell"
              class="rounded-md border px-2 py-2 text-center font-mono text-xs tabular-nums"
              [class]="cellClass(i, j, value)"
              [title]="label() + '[' + i + '][' + j + '] = ' + value"
            >
              {{ format(value) }}
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class MatrixGridComponent {
  readonly matrix = input.required<Matrix>();
  readonly label = input('Matriz');
  readonly digits = input(4);
  readonly highlightDiagonal = input(true);

  protected readonly cols = computed(() => this.matrix()[0]?.length ?? 1);

  protected format(value: number): string {
    return formatNumber(value, this.digits());
  }

  protected cellClass(i: number, j: number, value: number): string {
    if (this.highlightDiagonal() && i === j) return 'border-ink/70 bg-surface-3 text-ink';
    if (Math.abs(value) < ZERO_TOLERANCE) return 'border-line/60 bg-transparent text-ink-faint';
    return 'border-line bg-surface-2 text-ink';
  }
}
