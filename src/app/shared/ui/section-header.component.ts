import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado numerado de cada página de la consola. El contenido proyectado va a la derecha. */
@Component({
  selector: 'app-section-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="grid size-7 shrink-0 place-items-center rounded-md border border-line-strong font-mono text-xs">
          {{ step() }}
        </span>
        <div>
          <h2 class="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {{ title() }}
            @if (badge()) {
              <span class="tag py-0.5">{{ badge() }}</span>
            }
          </h2>
          <p class="mt-0.5 text-xs text-ink-muted">{{ subtitle() }}</p>
        </div>
      </div>
      <ng-content />
    </header>
  `,
})
export class SectionHeaderComponent {
  readonly step = input.required<number>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
}
