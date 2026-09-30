import { fakeJwt } from '../../../testing/test-helpers';
import { decodeJwt, secondsUntilExpiry } from './jwt';

describe('decodeJwt', () => {
  it('decodifica el payload, incluidos caracteres no ASCII', () => {
    const token = fakeJwt({ sub: 'administración', exp: 100 });
    expect(decodeJwt(token)).toEqual({ sub: 'administración', exp: 100 });
  });

  it.each(['', 'a.b', 'a.b.c.d', 'a.!!!.c', `a.${btoa('no-json')}.c`, `a.${btoa('123')}.c`])(
    'devuelve null para un token mal formado: "%s"',
    (token) => {
      expect(decodeJwt(token)).toBeNull();
    },
  );
});

describe('secondsUntilExpiry', () => {
  it('calcula los segundos restantes', () => {
    expect(secondsUntilExpiry({ exp: 1_000 }, 400_000)).toBe(600);
  });

  it('devuelve 0 si el token expiró o no tiene exp', () => {
    expect(secondsUntilExpiry({ exp: 1_000 }, 2_000_000)).toBe(0);
    expect(secondsUntilExpiry({}, 0)).toBe(0);
    expect(secondsUntilExpiry(null, 0)).toBe(0);
  });
});
