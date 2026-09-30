import { Matrix } from '../../core/api/api.models';

/**
 * Utilidades de matrices del lado del cliente.
 *
 * * No reemplazan a las APIs: solo validan la entrada antes de enviarla y verifican/describen el
 * * resultado (Q·R ≈ A, ortogonalidad, rango) para mostrarlo en la consola.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Límites y constantes
// ═══════════════════════════════════════════════════════════════════════════

/** Máximo de filas y columnas que aceptan las APIs (MATRIX_MAX_DIMENSION por defecto). */
export const API_MAX_DIMENSION = 100;
/** Máximo de la grilla editable celda a celda; matrices mayores se editan desde el panel JSON. */
export const GRID_MAX_DIMENSION = 12;
/** Tolerancia para considerar un valor como cero al describir resultados. */
export const ZERO_TOLERANCE = 1e-10;

/** Cómo rellenar una matriz nueva al elegir sus dimensiones. */
export type MatrixFill = 'keep' | 'zeros' | 'random' | 'identity';

export const MATRIX_FILL_OPTIONS: readonly { value: MatrixFill; label: string }[] = [
  { value: 'keep', label: 'Conservar valores' },
  { value: 'random', label: 'Aleatoria' },
  { value: 'zeros', label: 'Ceros' },
  { value: 'identity', label: 'Identidad' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Construcción
// ═══════════════════════════════════════════════════════════════════════════

export function dimensions(m: Matrix): { rows: number; cols: number } {
  return { rows: m.length, cols: m[0]?.length ?? 0 };
}

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(0));
}

/** Identidad rectangular rows×cols (unos en la diagonal principal). */
export function identity(rows: number, cols: number = rows): Matrix {
  return Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === j ? 1 : 0)));
}

/** Matriz aleatoria de enteros en [-range, range]. `random` es inyectable para pruebas. */
export function randomMatrix(rows: number, cols: number, range = 20, random: () => number = Math.random): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.round((random() * 2 - 1) * range)));
}

/** Cambia el tamaño conservando los valores existentes y rellenando con ceros. */
export function resize(m: Matrix, rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => m[i]?.[j] ?? 0));
}

/**
 * * Crea una matriz personalizada de `rows`×`cols` con el relleno elegido por el usuario.
 * ! Lanza RangeError si las dimensiones no son enteros entre 1 y API_MAX_DIMENSION:
 * ! así el editor nunca produce una matriz que la API rechazaría por tamaño.
 */
export function createMatrix(rows: number, cols: number, fill: MatrixFill, current: Matrix = [], random?: () => number): Matrix {
  assertDimension(rows, 'filas');
  assertDimension(cols, 'columnas');

  switch (fill) {
    case 'keep':
      return resize(current, rows, cols);
    case 'random':
      return randomMatrix(rows, cols, 20, random);
    case 'identity':
      return identity(rows, cols);
    case 'zeros':
      return zeros(rows, cols);
  }
}

function assertDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > API_MAX_DIMENSION) {
    throw new RangeError(`El número de ${label} debe ser un entero entre 1 y ${API_MAX_DIMENSION}.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Álgebra (solo para verificar resultados)
// ═══════════════════════════════════════════════════════════════════════════

export function transpose(m: Matrix): Matrix {
  const { rows, cols } = dimensions(m);
  return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => m[i][j]));
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const { rows, cols: inner } = dimensions(a);
  const { cols } = dimensions(b);
  const out = zeros(rows, cols);
  // ? Orden i-k-j: recorre b por filas (acceso contiguo en memoria), más rápido que i-j-k.
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = a[i][k];
      for (let j = 0; j < cols; j++) out[i][j] += aik * b[k][j];
    }
  }
  return out;
}

/** Mayor diferencia absoluta entre dos matrices de igual tamaño (norma infinito elemento a elemento). */
export function maxAbsDiff(a: Matrix, b: Matrix): number {
  let max = 0;
  a.forEach((row, i) => row.forEach((v, j) => (max = Math.max(max, Math.abs(v - b[i][j])))));
  return max;
}

/**
 * * Verificación de la factorización recibida de api-go:
 * *   residual           = ‖Q·R − A‖   (≈ 0 si la QR reconstruye la matriz original)
 * *   orthogonalityError = ‖QᵀQ − I‖  (≈ 0 si Q es ortogonal)
 */
export function verifyQR(a: Matrix, q: Matrix, r: Matrix): { residual: number; orthogonalityError: number } {
  return {
    residual: maxAbsDiff(multiply(q, r), a),
    orthogonalityError: maxAbsDiff(multiply(transpose(q), q), identity(q.length)),
  };
}

/**
 * Rango numérico a partir de la diagonal de R.
 * ? Tolerancia relativa a la escala de R: un valor de 1e-14 frente a otros de 1e3 es ruido, no rango.
 */
export function rankFromR(r: Matrix): number {
  const diag = Array.from({ length: Math.min(r.length, r[0]?.length ?? 0) }, (_, k) => Math.abs(r[k][k]));
  const scale = Math.max(1, ...diag);
  return diag.filter((d) => d > ZERO_TOLERANCE * scale).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validación de entrada
// ═══════════════════════════════════════════════════════════════════════════

/** Resultado de validar una matriz de entrada. */
export type MatrixCheck = { ok: true; matrix: Matrix } | { ok: false; error: string };

/**
 * * Valida con las mismas reglas que api-go (no vacía, rectangular, finita, ≤ máximo)
 * * para avisar al usuario ANTES de enviar la petición.
 * ! La validación real la hace el backend: esto es solo una ayuda de interfaz.
 */
export function validateMatrix(value: unknown, maxDimension = API_MAX_DIMENSION): MatrixCheck {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: 'La matriz debe ser un array de filas no vacío.' };
  if (!Array.isArray(value[0]) || value[0].length === 0) return { ok: false, error: 'Las filas no pueden estar vacías.' };
  const cols = value[0].length;
  if (value.length > maxDimension || cols > maxDimension) {
    return { ok: false, error: `El tamaño máximo es ${maxDimension}×${maxDimension}.` };
  }
  for (let i = 0; i < value.length; i++) {
    const row: unknown = value[i];
    if (!Array.isArray(row) || row.length !== cols) return { ok: false, error: `La fila ${i + 1} no tiene ${cols} columnas.` };
    if (row.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      return { ok: false, error: `La fila ${i + 1} contiene valores que no son números finitos.` };
    }
  }
  return { ok: true, matrix: value as Matrix };
}

/** Acepta `[[...]]` o `{ "matrix": [[...]] }` (el mismo cuerpo que recibe api-go). */
export function parseMatrixJson(text: string): MatrixCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON inválido.' };
  }
  const candidate = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as { matrix?: unknown }).matrix : parsed;
  return validateMatrix(candidate);
}

// ═══════════════════════════════════════════════════════════════════════════
// Formato para la interfaz
// ═══════════════════════════════════════════════════════════════════════════

/** Formatea un número para mostrarlo: ruido de coma flotante como 0 y sin "-0". */
export function formatNumber(v: number, digits = 4): string {
  if (Math.abs(v) < ZERO_TOLERANCE) return (0).toFixed(digits);
  return v.toFixed(digits);
}

/** Formato compacto para residuos (p. ej. 1.2e-15). */
export function formatScientific(v: number): string {
  return v === 0 ? '0 (exacto)' : v.toExponential(1);
}
