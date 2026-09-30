import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad';

/** Tarjeta de indicador: etiqueta técnica, valor destacado, detalle y barra opcional (0–1). */
@Component({
  selector: 'app-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="panel flex h-full flex-col gap-3 p-4">
      <header class="flex items-start justify-between gap-2">
        <span class="eyebrow">{{ label() }}</span>
        <span class="font-mono text-sm text-ink-faint" aria-hidden="true">{{ icon() }}</span>
      </header>
      <p class="text-2xl font-semibold tracking-tight tabular-nums" [class]="valueClass()">{{ value() }}</p>
      <p class="font-mono text-[11px] leading-relaxed text-ink-muted">{{ hint() }}</p>
      @if (progress() !== null) {
        <div class="mt-auto h-1 overflow-hidden rounded-full bg-surface-3">
          <div class="h-full rounded-full bg-ink transition-all duration-500" [style.width.%]="progressPercent()"></div>
        </div>
      }
    </article>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input('');
  readonly icon = input('');
  readonly tone = input<Tone>('neutral');
  /** Proporción entre 0 y 1 para la barra inferior; null la oculta. */
  readonly progress = input<number | null>(null);

  protected readonly progressPercent = computed(() => Math.min(100, Math.max(0, (this.progress() ?? 0) * 100)));
  protected readonly valueClass = computed(
    () => ({ neutral: 'text-ink', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' })[this.tone()],
  );
}
