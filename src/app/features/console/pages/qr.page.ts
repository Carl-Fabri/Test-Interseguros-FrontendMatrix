import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ConsoleStore } from '../console.store';
import { EmptyStateComponent } from '../components/empty-state.component';
import { MatrixGridComponent } from '../../../shared/ui/matrix-grid.component';
import { SectionHeaderComponent } from '../../../shared/ui/section-header.component';
import { formatScientific } from '../../../shared/matrix/matrix-math';

type QrTab = 'qr' | 'algorithm';

/** Página Factorización QR (/qr): Q y R devueltas por api-go, su verificación y el algoritmo de Givens. */
@Component({
  selector: 'app-qr-page',
  imports: [DecimalPipe, EmptyStateComponent, MatrixGridComponent, SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel flex flex-col gap-5 p-5">
      <app-section-header
        [step]="2"
        title="Cómputo en Go (Fiber API)"
        subtitle="Factorización QR completa mediante rotaciones de Givens: A = Q·R."
        [badge]="store.timings().goMs !== null ? (store.timings().goMs | number: '1.0-1') + ' ms' : ''"
      >
        <div class="panel-inset flex p-1" role="tablist">
          <button type="button" role="tab" class="chip border-0" [class.chip-active]="tab() === 'qr'" (click)="tab.set('qr')">Factorización (Q y R)</button>
          <button type="button" role="tab" class="chip border-0" [class.chip-active]="tab() === 'algorithm'" (click)="tab.set('algorithm')">
            Algoritmo de Givens
          </button>
        </div>
      </app-section-header>

      @if (store.isStale()) {
        <p class="rounded-lg border border-warn/40 bg-warn/10 px-4 py-2 text-xs text-warn" role="status">
          La matriz cambió desde el último cálculo: los resultados corresponden a la matriz anterior.
        </p>
      }

      @if (tab() === 'algorithm') {
        <div class="panel-inset grid gap-4 p-5 text-sm leading-relaxed text-ink-muted md:grid-cols-2">
          <div>
            <p class="text-ink">¿Por qué rotaciones de Givens?</p>
            <p class="mt-2">
              Por cada columna, de abajo hacia arriba, se anula R[i][j] rotando el par de filas (i−1, i). La misma rotación se acumula en
              Qᵀ, de modo que QᵀA = R. Es numéricamente estable y funciona con matrices altas y anchas.
            </p>
          </div>
          <pre class="rounded-md border border-line bg-canvas p-4 font-mono text-xs text-ink">
G = [  c   s ]     r = hypot(x, y)
    [ −s   c ]     c = x / r,  s = y / r

Q: m×m ortogonal · R: m×n triangular superior
diag(R) ≥ 0 (signos normalizados)</pre
          >
        </div>
      } @else if (store.qr(); as qr) {
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="panel-inset flex flex-col gap-3 p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Matriz Q <span class="font-mono text-xs font-normal text-ink-faint">(ortogonal, QᵀQ = I)</span></h3>
              <span class="tag">{{ qr.q.length }}×{{ qr.q[0].length }}</span>
            </div>
            <p class="text-xs text-ink-muted">Base ortonormal: columnas con norma 1 y producto interno nulo entre sí.</p>
            <app-matrix-grid label="Q" [matrix]="qr.q" [highlightDiagonal]="false" />
            <p class="mt-auto font-mono text-[11px] text-ink-faint">‖QᵀQ − I‖ = {{ sci(store.verification()?.orthogonalityError ?? 0) }}</p>
          </div>
          <div class="panel-inset flex flex-col gap-3 p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Matriz R <span class="font-mono text-xs font-normal text-ink-faint">(triangular superior)</span></h3>
              <span class="tag">R[i][j] = 0 ∀ i &gt; j</span>
            </div>
            <p class="text-xs text-ink-muted">Resultado de aplicar las rotaciones sobre A; la diagonal queda no negativa.</p>
            <app-matrix-grid label="R" [matrix]="qr.r" />
            <p class="mt-auto font-mono text-[11px] text-ink-faint">
              Rango numérico: {{ store.verification()?.rank }} · Residuo ‖QR − A‖ = {{ sci(store.verification()?.residual ?? 0) }}
            </p>
          </div>
        </div>
      } @else {
        <app-empty-state message="Aún no hay resultados. Define la matriz y ejecuta la factorización QR o el pipeline completo." />
      }
    </section>
  `,
})
export class QrPage {
  protected readonly store = inject(ConsoleStore);
  protected readonly tab = signal<QrTab>('qr');
  protected readonly sci = formatScientific;
}
