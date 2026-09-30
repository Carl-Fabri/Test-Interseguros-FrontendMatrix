/**
 * DTOs de las APIs. Reflejan los contratos OpenAPI de cada servicio:
 *  - api-go:   GET {apiGoUrl}/openapi.yaml
 *  - api-node: GET {apiNodeUrl}/openapi.yaml
 */

/** Matriz en orden de filas. */
export type Matrix = number[][];

// ── api-go ──────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface QRRequest {
  matrix: Matrix;
}

export interface QRResponse {
  q: Matrix;
  r: Matrix;
  statistics: Statistics;
}

// ── api-node ────────────────────────────────────────────────────────────
export interface NamedMatrix {
  name?: string;
  values: Matrix;
}

export interface StatisticsRequest {
  matrices: NamedMatrix[];
}

export interface MatrixDiagonal {
  name: string;
  isDiagonal: boolean;
}

export interface Statistics {
  max: number;
  min: number;
  average: number;
  sum: number;
  count: number;
  anyDiagonal: boolean;
  matrices: MatrixDiagonal[];
}

// ── comunes ─────────────────────────────────────────────────────────────
export interface HealthResponse {
  status: 'ok';
  service: string;
}

/** Formato único de error de ambas APIs. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
