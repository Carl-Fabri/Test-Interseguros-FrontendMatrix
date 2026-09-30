import { Injectable, computed, signal } from '@angular/core';

/** Servicio de destino de una petición. */
export type ServiceName = 'api-go' | 'api-node' | 'externo';

/** Registro de una petición HTTP para el inspector de red. */
export interface TelemetryEntry {
  id: number;
  service: ServiceName;
  method: string;
  url: string;
  /** Código HTTP; 0 = sin respuesta (red/CORS), -1 = error no HTTP. */
  status: number;
  ok: boolean;
  /** Duración medida en el navegador (incluye red y cola). */
  durationMs: number;
  startedAt: Date;
  /** true si la petición es protegida (lleva Bearer); nunca se guarda el token en sí. */
  hasAuth: boolean;
  requestBody: unknown;
  responseBody: unknown;
}

/** Máximo de entradas en memoria (las más antiguas se descartan). */
const MAX_ENTRIES = 25;

/**
 * Historial en memoria de las últimas peticiones a las APIs.
 *
 * * Lo alimenta telemetryInterceptor y lo muestra NetworkInspectorComponent (página Red & JWT).
 * ? Solo vive en memoria: se pierde al recargar y no se envía a ningún servidor.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private nextId = 1;
  private readonly entriesState = signal<TelemetryEntry[]>([]);

  /** Peticiones, la más reciente primero. */
  readonly entries = this.entriesState.asReadonly();
  readonly latest = computed(() => this.entriesState()[0] ?? null);

  /** Agrega una petición al inicio y recorta el historial a MAX_ENTRIES. */
  record(entry: Omit<TelemetryEntry, 'id'>): void {
    this.entriesState.update((entries) => [{ ...entry, id: this.nextId++ }, ...entries].slice(0, MAX_ENTRIES));
  }

  clear(): void {
    this.entriesState.set([]);
  }
}
