import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { HealthService } from '../../core/health/health.service';
import { toApiError } from '../../core/api/api-error';

/** Pantalla de acceso: obtiene el JWT de api-go (POST /api/v1/auth/login). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-screen place-items-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3">
          <span class="grid size-9 place-items-center rounded-lg bg-ink font-mono text-sm font-bold text-canvas">M</span>
          <div>
            <p class="font-semibold leading-none">MatrixCore</p>
            <p class="mt-1 font-mono text-[11px] text-ink-faint">Consola de procesamiento matricial</p>
          </div>
        </div>

        <form class="panel flex flex-col gap-5 p-6" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div>
            <h1 class="text-lg font-semibold">Iniciar sesión</h1>
            <p class="mt-1 text-xs text-ink-muted">
              api-go emite un JWT HS256 que se usa para consultar api-go y api-node.
            </p>
          </div>

          @if (auth.lastLogoutReason() === 'expired') {
            <p class="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn" role="status">
              Tu sesión expiró. Vuelve a iniciar sesión.
            </p>
          }

          <label class="flex flex-col gap-1.5">
            <span class="eyebrow">Usuario</span>
            <input class="field" formControlName="username" autocomplete="username" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="eyebrow">Contraseña</span>
            <input class="field" type="password" formControlName="password" autocomplete="current-password" />
          </label>

          @if (error()) {
            <p class="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Verificando…' : 'Obtener token y entrar' }}
          </button>

          <p class="font-mono text-[10px] leading-relaxed text-ink-faint">
            Credenciales definidas en el .env de api-go (AUTH_USERNAME / AUTH_PASSWORD).
          </p>
        </form>

        <div class="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
          @for (svc of [{ name: 'api-go', url: config.apiGoUrl, h: health.go() }, { name: 'api-node', url: config.apiNodeUrl, h: health.node() }]; track svc.name) {
            <div class="panel-inset flex items-center gap-2 px-3 py-2" [title]="svc.url">
              <span
                class="size-1.5 rounded-full"
                [class]="svc.h.state === 'up' ? 'bg-ok' : svc.h.state === 'down' ? 'bg-bad' : 'bg-warn'"
              ></span>
              {{ svc.name }}
              <span class="ml-auto text-ink-faint">{{ svc.h.state === 'up' ? 'online' : svc.h.state === 'down' ? 'offline' : '…' }}</span>
            </div>
          }
        </div>
      </div>
    </main>
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  protected readonly config = inject(APP_CONFIG);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    this.health.start();
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/']);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const apiError = toApiError(err, 'api-go');
        this.error.set(apiError.code === 'INVALID_CREDENTIALS' ? 'Usuario o contraseña incorrectos.' : apiError.message);
      },
    });
  }
}
