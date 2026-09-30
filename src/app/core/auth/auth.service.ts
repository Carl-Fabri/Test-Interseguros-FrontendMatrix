import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { ApiGoService } from '../api/api-go.service';
import { LoginRequest } from '../api/api.models';
import { decodeJwt, secondsUntilExpiry } from './jwt';

/** Clave de sessionStorage donde se guarda el token. */
export const TOKEN_STORAGE_KEY = 'matrix-web.token';

/** Motivo del último cierre de sesión, para informarlo en la pantalla de login. */
export type LogoutReason = 'manual' | 'expired' | null;

/** Cada cuánto se recalcula la expiración del token aunque no haya peticiones. */
const EXPIRY_CHECK_MS = 15_000;

/**
 * Estado de autenticación de la aplicación (basado en signals).
 *
 * * Única fuente de verdad del JWT: los guards, el interceptor y la interfaz leen de aquí.
 * ? El token se guarda en sessionStorage: se borra al cerrar la pestaña y no se comparte entre pestañas.
 * !   Una cookie HttpOnly resistiría mejor un XSS, pero exigiría que api-go emita cookies (ver ADR-003).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiGo = inject(ApiGoService);
  private readonly router = inject(Router);

  // ═════════════════════════════════════════════════════════════════════════
  // Estado
  // ═════════════════════════════════════════════════════════════════════════
  private readonly tokenState = signal<string | null>(readStoredToken());
  /** Reloj interno: se actualiza periódicamente para que `secondsLeft` avance solo. */
  private readonly now = signal(Date.now());

  readonly token = this.tokenState.asReadonly();
  readonly claims = computed(() => {
    const token = this.tokenState();
    return token ? decodeJwt(token) : null;
  });
  readonly secondsLeft = computed(() => secondsUntilExpiry(this.claims(), this.now()));
  /** * Autenticado = hay token y su `exp` está en el futuro (la firma la verifican las APIs). */
  readonly isAuthenticated = computed(() => this.secondsLeft() > 0);
  readonly username = computed(() => this.claims()?.sub ?? '');
  readonly lastLogoutReason = signal<LogoutReason>(null);

  constructor() {
    // * Vigilante de expiración: cierra la sesión cuando vence `exp`, aunque el usuario no haga peticiones.
    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.tokenState() && !this.isAuthenticated()) this.logout('expired');
    }, EXPIRY_CHECK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Acciones
  // ═════════════════════════════════════════════════════════════════════════

  /** * Autentica contra api-go (POST /api/v1/auth/login) y guarda el token recibido. */
  login(credentials: LoginRequest): Observable<void> {
    return this.apiGo.login(credentials).pipe(
      tap(({ accessToken }) => {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        this.now.set(Date.now());
        this.tokenState.set(accessToken);
        this.lastLogoutReason.set(null);
      }),
      map(() => undefined),
    );
  }

  /**
   * Borra el token y vuelve a la pantalla de login.
   * @param reason 'manual' (botón) o 'expired' (vencimiento o 401 de una API, ver authInterceptor).
   */
  logout(reason: Exclude<LogoutReason, null> = 'manual'): void {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    this.tokenState.set(null);
    this.lastLogoutReason.set(reason);
    void this.router.navigate(['/login']);
  }
}

/** ! sessionStorage puede lanzar (modo privado, cookies bloqueadas): en ese caso no hay sesión previa. */
function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
