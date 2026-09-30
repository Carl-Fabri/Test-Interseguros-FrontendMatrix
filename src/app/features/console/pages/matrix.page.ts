import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatrixEditorComponent } from '../components/matrix-editor.component';
import { PipelineActionsComponent } from '../components/pipeline-actions.component';
import { SectionHeaderComponent } from '../../../shared/ui/section-header.component';

/** Página Matriz de entrada (/matriz): definición de la matriz A y ejecución del pipeline. */
@Component({
  selector: 'app-matrix-page',
  imports: [MatrixEditorComponent, PipelineActionsComponent, SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel flex flex-col gap-5 p-5">
      <app-section-header
        [step]="1"
        title="Matriz de entrada"
        subtitle="Elige las dimensiones (filas × columnas), edita los valores y envíala al microservicio Go."
      >
        <span class="tag">INPUT: float64 IEEE-754</span>
      </app-section-header>
      <app-matrix-editor />
      <app-pipeline-actions />
    </section>
  `,
})
export class MatrixPage {}
