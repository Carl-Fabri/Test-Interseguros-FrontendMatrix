import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { HealthService, ServiceHealth } from '../core/health/health.service';
import { APP_CONFIG } from '../core/config/app-config';
import { ApiGoService } from '../core/api/api-go.service';
import { ApiNodeService } from '../core/api/api-node.service';
import { ConsoleStore } from '../features/console/console.store';

/**
 * Estructura de la zona autenticada: barra lateral (una entrada por página), barra superior con el
 * estado de los servicios y la sesión, banner de error global y el contenido de la página activa.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  protected readonly store = inject(ConsoleStore);
  protected readonly config = inject(APP_CONFIG);
  protected readonly goDocsUrl = inject(ApiGoService).docsUrl;
  protected readonly nodeDocsUrl = inject(ApiNodeService).docsUrl;
  protected readonly menuOpen = signal(false);

  /** Páginas de la consola (cada apartado es una ruta independiente, ver console.routes.ts). */
  protected readonly pages = [
    { link: '/resumen', label: 'Resumen', icon: '▤' },
    { link: '/matriz', label: 'Matriz de entrada', icon: '▦' },
    { link: '/qr', label: 'Factorización QR', icon: '⊞' },
    { link: '/estadisticas', label: 'Estadísticas', icon: 'Σ' },
    { link: '/red', label: 'Red & JWT', icon: '⇄' },
  ];

  /** Servicios mostrados en la barra superior con su estado de /health. */
  protected readonly services = computed(() => [
    { name: 'Go (Fiber)', url: this.config.apiGoUrl, h: this.health.go() },
    { name: 'Node.js (Express)', url: this.config.apiNodeUrl, h: this.health.node() },
  ]);

  constructor() {
    // * El health checker empieza al entrar a la consola (idempotente si ya corría desde el login).
    this.health.start();
  }

  protected port(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.port ? `:${parsed.port}` : parsed.host;
    } catch {
      return url;
    }
  }

  protected healthLabel(h: ServiceHealth): string {
    return { checking: 'verificando…', up: '200 OK', down: 'sin conexión' }[h.state];
  }

  protected healthDot(h: ServiceHealth): string {
    return { checking: 'bg-warn', up: 'bg-ok', down: 'bg-bad' }[h.state];
  }
}
