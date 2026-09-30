import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Estado vacío de una página de resultados, con un atajo a la página donde se generan. */
@Component({
  selector: 'app-empty-state',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong p-10 text-center">
      <p class="text-sm text-ink-muted">{{ message() }}</p>
      <a class="btn-secondary text-xs" [routerLink]="link()">{{ linkLabel() }}</a>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
  readonly link = input('/matriz');
  readonly linkLabel = input('Ir a Matriz de entrada →');
}
