import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { ConsoleStore } from '../console.store';
import { MATRIX_PRESETS } from '../../../shared/matrix/presets';
import {
  API_MAX_DIMENSION,
  GRID_MAX_DIMENSION,
  MATRIX_FILL_OPTIONS,
  MatrixFill,
  parseMatrixJson,
} from '../../../shared/matrix/matrix-math';

/**
 * Editor de la matriz de entrada.
 *
 * * Tres formas de definir la matriz, sincronizadas con el ConsoleStore:
 * *   1. Dimensiones personalizadas (filas × columnas, 1..100) + relleno (conservar, aleatoria, ceros, identidad).
 * *   2. Grilla editable celda a celda (hasta 12×12).
 * *   3. Panel JSON con el cuerpo exacto de POST /api/v1/matrix/qr (hasta 100×100).
 */
@Component({
  selector: 'app-matrix-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <!-- ─── 1. Dimensiones personalizadas ─── -->
      <form class="panel-inset flex flex-wrap items-end gap-3 p-4" (submit)="$event.preventDefault(); applyDimensions()" aria-label="Dimensiones de la matriz">
        <label class="flex flex-col gap-1.5">
          <span class="eyebrow">Filas (m)</span>
          <input
            class="field w-24 font-mono"
            type="number"
            min="1"
            [max]="apiMax"
            [value]="rowsInput()"
            (input)="rowsInput.set(toInt($event))"
            aria-label="Número de filas"
          />
        </label>
        <span class="pb-2 font-mono text-ink-faint">×</span>
        <label class="flex flex-col gap-1.5">
          <span class="eyebrow">Columnas (n)</span>
          <input
            class="field w-24 font-mono"
            type="number"
            min="1"
            [max]="apiMax"
            [value]="colsInput()"
            (input)="colsInput.set(toInt($event))"
            aria-label="Número de columnas"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="eyebrow">Relleno</span>
          <select class="field w-44" [value]="fill()" (change)="fill.set(toFill($event))" aria-label="Relleno de la matriz">
            @for (option of fillOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        <button type="submit" class="btn-secondary" [disabled]="dimensionError() !== null">Crear matriz {{ rowsInput() }}×{{ colsInput() }}</button>
        @if (dimensionError(); as message) {
          <p class="basis-full font-mono text-[11px] text-bad" role="alert">{{ message }}</p>
        } @else {
          <p class="basis-full font-mono text-[11px] text-ink-faint">
            Entre 1 y {{ apiMax }} filas y columnas (límite de la API). La grilla edita hasta {{ gridMax }}×{{ gridMax }}; más grandes, en el JSON.
          </p>
        }
      </form>

      <!-- ─── Presets ─── -->
      <div class="panel-inset flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span class="eyebrow mr-1">Presets</span>
        @for (preset of presets; track preset.id) {
          <button
            type="button"
            class="chip"
            [class.chip-active]="store.activePresetId() === preset.id"
            [title]="preset.description"
            (click)="store.loadPreset(preset.id)"
          >
            {{ preset.label }}
          </button>
        }
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <!-- ─── 2. Grilla editable ─── -->
        <section class="panel-inset flex flex-col gap-4 p-4" aria-label="Edición por celdas">
          <h3 class="flex items-center gap-2 text-xs font-semibold">
            <span class="text-ink-faint">▦</span> Edición directa por celdas [A]
            <span class="tag ml-auto py-0.5">{{ rows() }} × {{ cols() }}</span>
          </h3>

          @if (fitsGrid()) {
            <div class="overflow-x-auto">
              <div
                class="inline-grid min-w-full gap-1.5 border-x border-line-strong px-2 py-1"
                [style.grid-template-columns]="'repeat(' + cols() + ', minmax(4rem, 1fr))'"
              >
                @for (row of store.matrix(); track $index; let i = $index) {
                  @for (value of row; track $index; let j = $index) {
                    <input
                      type="number"
                      step="any"
                      class="cell focus:border-ink focus:outline-none"
                      [class.border-ink/60]="i === j"
                      [value]="value"
                      [attr.aria-label]="'A[' + i + '][' + j + ']'"
                      (change)="onCell(i, j, $event)"
                    />
                  }
                }
              </div>
            </div>
          } @else {
            <p class="rounded-md border border-dashed border-line-strong p-6 text-center text-xs text-ink-muted">
              La matriz ({{ rows() }}×{{ cols() }}) excede la grilla de {{ gridMax }}×{{ gridMax }}. Edítala desde el panel JSON.
            </p>
          }

          <p class="mt-auto font-mono text-[11px] text-ink-faint">
            {{ rows() === cols() ? 'Cuadrada' : 'Rectangular' }} · {{ rows() * cols() }} valores · Q será {{ rows() }}×{{ rows() }}
            y R {{ rows() }}×{{ cols() }}
          </p>
        </section>

        <!-- ─── 3. Panel JSON ─── -->
        <section class="panel-inset flex flex-col gap-3 p-4" aria-label="Cuerpo JSON de la petición">
          <div class="flex items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 font-mono text-xs font-semibold">
              <span class="text-ink-faint">&lt;/&gt;</span> POST /api/v1/matrix/qr
            </h3>
            <button type="button" class="btn-ghost text-xs" [disabled]="!jsonDirty()" (click)="applyJson()">Aplicar JSON</button>
          </div>
          <textarea
            class="min-h-56 flex-1 resize-y rounded-md border border-line bg-canvas p-3 font-mono text-xs leading-relaxed text-ink focus:border-ink focus:outline-none"
            spellcheck="false"
            aria-label="JSON de la matriz"
            [value]="jsonText()"
            (input)="onJsonInput($event)"
          ></textarea>
          @if (jsonError()) {
            <p class="font-mono text-[11px] text-bad" role="alert">{{ jsonError() }}</p>
          } @else {
            <p class="flex justify-between font-mono text-[11px] text-ink-faint">
              <span>Tamaño: {{ jsonBytes() }} bytes</span><span>application/json</span>
            </p>
          }
        </section>
      </div>
    </div>
  `,
})
export class MatrixEditorComponent {
  protected readonly store = inject(ConsoleStore);
  protected readonly presets = MATRIX_PRESETS;
  protected readonly fillOptions = MATRIX_FILL_OPTIONS;
  protected readonly gridMax = GRID_MAX_DIMENSION;
  protected readonly apiMax = API_MAX_DIMENSION;

  protected readonly rows = computed(() => this.store.dims().rows);
  protected readonly cols = computed(() => this.store.dims().cols);
  protected readonly fitsGrid = computed(() => this.rows() <= this.gridMax && this.cols() <= this.gridMax);

  // ─── Formulario de dimensiones ─────────────────────────────────────────────
  // * linkedSignal: el campo sigue a la matriz del store (preset, JSON, otra página), pero el usuario puede
  // * editarlo libremente; solo se resetea cuando la matriz cambia de verdad.
  // ? Reemplaza a un effect(): el effect corría de forma diferida y podía pisar lo que el usuario acababa de escribir.
  protected readonly rowsInput = linkedSignal(() => this.store.dims().rows);
  protected readonly colsInput = linkedSignal(() => this.store.dims().cols);
  protected readonly fill = signal<MatrixFill>('keep');
  /** Mensaje de validación del formulario (null = válido). */
  protected readonly dimensionError = computed(() => {
    const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= this.apiMax;
    return valid(this.rowsInput()) && valid(this.colsInput())
      ? null
      : `Filas y columnas deben ser enteros entre 1 y ${this.apiMax}.`;
  });

  // ─── Panel JSON ────────────────────────────────────────────────────────────
  // * Mismo patrón: el texto, la marca de edición y el error se regeneran cuando cambia la matriz del store,
  // * y mientras tanto reflejan lo que el usuario escribe en el panel.
  protected readonly jsonText = linkedSignal(() => toRequestJson(this.store.matrix()));
  protected readonly jsonDirty = linkedSignal(() => (this.store.matrix(), false));
  protected readonly jsonError = linkedSignal<string | null>(() => (this.store.matrix(), null));
  protected readonly jsonBytes = computed(() => new TextEncoder().encode(this.jsonText()).length);

  /** Crea la matriz personalizada con las dimensiones y el relleno elegidos. */
  protected applyDimensions(): void {
    if (this.dimensionError()) return;
    this.store.createCustomMatrix(this.rowsInput(), this.colsInput(), this.fill());
  }

  protected onCell(row: number, col: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    // ! Entradas vacías o no numéricas se revierten: la matriz del store siempre es válida.
    if (input.value.trim() === '' || !Number.isFinite(value)) {
      input.value = String(this.store.matrix()[row][col]);
      return;
    }
    this.store.setCell(row, col, value);
  }

  protected onJsonInput(event: Event): void {
    this.jsonText.set((event.target as HTMLTextAreaElement).value);
    this.jsonDirty.set(true);
    const check = parseMatrixJson(this.jsonText());
    this.jsonError.set(check.ok ? null : check.error);
  }

  protected applyJson(): void {
    const check = parseMatrixJson(this.jsonText());
    if (check.ok) {
      this.store.setMatrix(check.matrix);
    } else {
      this.jsonError.set(check.error);
    }
  }

  protected toInt(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected toFill(event: Event): MatrixFill {
    return (event.target as HTMLSelectElement).value as MatrixFill;
  }
}

/** JSON legible con una fila por línea, igual al cuerpo que recibe api-go. */
function toRequestJson(matrix: number[][]): string {
  const rows = matrix.map((row) => `    [${row.join(', ')}]`).join(',\n');
  return `{\n  "matrix": [\n${rows}\n  ]\n}`;
}
