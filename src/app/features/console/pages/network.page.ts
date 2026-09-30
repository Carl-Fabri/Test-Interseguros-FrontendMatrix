import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NetworkInspectorComponent } from '../components/network-inspector.component';
import { SectionHeaderComponent } from '../../../shared/ui/section-header.component';

/** Página Red & JWT (/red): inspector de peticiones (telemetría) y claims del token activo. */
@Component({
  selector: 'app-network-page',
  imports: [NetworkInspectorComponent, SectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel flex flex-col gap-5 p-5">
      <app-section-header
        [step]="4"
        title="Inspector de red, telemetría inter-servicios & JWT"
        subtitle="Trazabilidad de las peticiones del navegador a api-go y api-node, con sus cuerpos JSON."
      />
      <app-network-inspector />
    </section>
  `,
})
export class NetworkPage {}
