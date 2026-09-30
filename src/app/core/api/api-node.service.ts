import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { SKIP_TELEMETRY } from '../telemetry/telemetry.interceptor';
import { HealthResponse, NamedMatrix, Statistics } from './api.models';

/** Cliente de api-node: estadísticas de matrices (usa el mismo JWT emitido por api-go). */
@Injectable({ providedIn: 'root' })
export class ApiNodeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiNodeUrl;

  /** POST /api/v1/statistics: máximo, mínimo, promedio, suma y diagonalidad. */
  statistics(matrices: NamedMatrix[]): Observable<Statistics> {
    return this.http.post<Statistics>(`${this.baseUrl}/api/v1/statistics`, { matrices });
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
