import {
  createMatrix,
  dimensions,
  formatNumber,
  identity,
  zeros,
  formatScientific,
  multiply,
  parseMatrixJson,
  randomMatrix,
  rankFromR,
  resize,
  transpose,
  validateMatrix,
  verifyQR,
} from './matrix-math';

describe('operaciones básicas', () => {
  it('transpone y multiplica', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]]);
    expect(multiply([[1, 2], [3, 4]], [[5], [6]])).toEqual([[17], [39]]);
  });

  it('redimensiona conservando valores y rellenando con ceros', () => {
    expect(resize([[1, 2], [3, 4]], 3, 1)).toEqual([[1], [3], [0]]);
  });

  it('genera matrices aleatorias de enteros dentro del rango', () => {
    const m = randomMatrix(2, 3, 5, () => 1); // random() = 1 → +5
    expect(m).toEqual([[5, 5, 5], [5, 5, 5]]);
  });
});

describe('createMatrix (matriz personalizada)', () => {
  it.each([
    ['zeros', [[0, 0, 0], [0, 0, 0]]],
    ['identity', [[1, 0, 0], [0, 1, 0]]],
    ['keep', [[9, 0, 0], [0, 0, 0]]],
  ] as const)('relleno "%s"', (fill, expected) => {
    expect(createMatrix(2, 3, fill, [[9]])).toEqual(expected);
  });

  it('relleno aleatorio con enteros dentro del rango', () => {
    const m = createMatrix(3, 4, 'random', [], () => 0.5); // random() = 0.5 → 0
    expect(m).toEqual(zeros(3, 4).map((row) => row.map(() => 0)));
  });

  it('acepta el máximo de la API (100×100)', () => {
    expect(dimensions(createMatrix(100, 100, 'zeros'))).toEqual({ rows: 100, cols: 100 });
  });

  it.each([
    [0, 3],
    [3, 0],
    [101, 1],
    [2.5, 2],
    [Number.NaN, 2],
  ])('rechaza dimensiones inválidas (%s × %s)', (rows, cols) => {
    expect(() => createMatrix(rows, cols, 'zeros')).toThrow(RangeError);
  });

  it('identity también funciona con matrices rectangulares', () => {
    expect(identity(3, 2)).toEqual([[1, 0], [0, 1], [0, 0]]);
  });
});

describe('verifyQR y rankFromR', () => {
  // QR exacta de A = [[3, 0], [4, 5]]: Q = [[0.6, -0.8], [0.8, 0.6]], R = [[5, 4], [0, 3]]
  const a = [[3, 0], [4, 5]];
  const q = [[0.6, -0.8], [0.8, 0.6]];
  const r = [[5, 4], [0, 3]];

  it('mide un residuo y un error de ortogonalidad despreciables', () => {
    const { residual, orthogonalityError } = verifyQR(a, q, r);
    expect(residual).toBeLessThan(1e-12);
    expect(orthogonalityError).toBeLessThan(1e-12);
  });

  it('detecta una factorización incorrecta', () => {
    expect(verifyQR(a, q, [[5, 4], [0, 4]]).residual).toBeCloseTo(0.8);
  });

  it('calcula el rango desde la diagonal de R', () => {
    expect(rankFromR(r)).toBe(2);
    expect(rankFromR([[5, 1], [0, 1e-14]])).toBe(1);
    expect(rankFromR([[1, 2, 3]])).toBe(1);
  });
});

describe('validateMatrix y parseMatrixJson', () => {
  it('acepta una matriz válida o el cuerpo { matrix }', () => {
    expect(parseMatrixJson('[[1,2],[3,4]]')).toEqual({ ok: true, matrix: [[1, 2], [3, 4]] });
    expect(parseMatrixJson('{"matrix":[[7]]}')).toEqual({ ok: true, matrix: [[7]] });
  });

  it.each([
    ['JSON inválido', '[[1,', 'JSON inválido'],
    ['vacía', '[]', 'no vacío'],
    ['fila vacía', '[[]]', 'filas'],
    ['no rectangular', '[[1,2],[3]]', 'columnas'],
    ['valores no numéricos', '[[1,"a"]]', 'números finitos'],
    ['objeto sin matrix', '{"otra":1}', 'no vacío'],
  ])('rechaza %s', (_, text, fragment) => {
    const result = parseMatrixJson(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(fragment);
  });

  it('respeta el tamaño máximo', () => {
    const result = validateMatrix([[1, 2, 3]], 2);
    expect(result.ok).toBe(false);
  });
});

describe('formato', () => {
  it('muestra el ruido de coma flotante como 0 y sin signo negativo', () => {
    expect(formatNumber(-1e-17)).toBe('0.0000');
    expect(formatNumber(14.00000000001, 2)).toBe('14.00');
  });

  it('formatea residuos en notación científica', () => {
    expect(formatScientific(0)).toBe('0 (exacto)');
    expect(formatScientific(1.234e-15)).toBe('1.2e-15');
  });
});
