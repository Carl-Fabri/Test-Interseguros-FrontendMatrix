import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { SKIP_TELEMETRY } from '../telemetry/telemetry.interceptor';
import { HealthResponse, LoginRequest, LoginResponse, Matrix, QRResponse } from './api.models';

/** Cliente de api-go: autenticación y factorización QR. */
@Injectable({ providedIn: 'root' })
export class ApiGoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiGoUrl;

  /** Endpoint público de login (el interceptor JWT no le agrega token). */
  readonly loginUrl = `${this.baseUrl}/api/v1/auth/login`;

  /** POST /api/v1/auth/login: obtiene un JWT. */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, credentials);
  }

  /** POST /api/v1/matrix/qr: QR de la matriz y estadísticas de Q y R (api-go consulta a api-node). */
  factorize(matrix: Matrix): Observable<QRResponse> {
    return this.http.post<QRResponse>(`${this.baseUrl}/api/v1/matrix/qr`, { matrix });
  }

  /** GET /health (excluido de la telemetría para no saturar el inspector). */
  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`, {
      context: new HttpContext().set(SKIP_TELEMETRY, true),
    });
  }

  /** URL de la referencia interactiva (Scalar). */
  get docsUrl(): string {
    return `${this.baseUrl}/docs`;
  }
}
