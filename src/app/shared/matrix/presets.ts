import { Matrix } from '../../core/api/api.models';

/** Matriz de ejemplo lista para cargar en el editor. */
export interface MatrixPreset {
  id: string;
  label: string;
  description: string;
  values: Matrix;
}

export const MATRIX_PRESETS: readonly MatrixPreset[] = [
  {
    id: 'standard',
    label: 'Estándar 3×3',
    description: 'Ejemplo clásico: R = [[14, 21, −14], [0, 175, −70], [0, 0, 35]]',
    values: [
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ],
  },
  {
    id: 'square4',
    label: 'Cuadrada 4×4',
    description: 'Matriz densa de rango completo',
    values: [
      [12, -51, 4, 30],
      [6, 167, -68, -10],
      [-4, 24, -41, 15],
      [1, 0, 12, 8],
    ],
  },
  {
    id: 'tall',
    label: 'Rectangular 4×3',
    description: 'Más filas que columnas (m > n): Q es 4×4 y R es 4×3',
    values: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
      [2, 1, 0],
    ],
  },
  {
    id: 'wide',
    label: 'Ancha 2×4',
    description: 'Más columnas que filas (m < n)',
    values: [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ],
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    description: 'Q = I y R = A: ambas matrices son diagonales',
    values: [
      [3, 0, 0],
      [0, 5, 0],
      [0, 0, 2],
    ],
  },
  {
    id: 'singular',
    label: 'Singular',
    description: 'Filas linealmente dependientes: rango incompleto',
    values: [
      [1, 2, 3],
      [2, 4, 6],
      [1, 0, 1],
    ],
  },
];
