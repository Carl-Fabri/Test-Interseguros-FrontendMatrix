---
paths:
  - "src/**/*.spec.ts"
  - "src/testing/**"
---

# Pruebas en matrix-web
- Vitest + TestBed (zoneless): `await fixture.whenStable()` después de cada interacción.
- HTTP siempre simulado con `provideHttpClientTesting`; terminar con `httpMock.verify()`. Nunca llamar a las APIs reales.
- Proveer `APP_CONFIG` con `TEST_CONFIG`; tokens con `validJwt()`/`fakeJwt()` (nunca tokens reales).
- Limpiar `sessionStorage` en cada `setup()`.
- Nombres de `it` en español describiendo el comportamiento. Flotantes con `toBeCloseTo`.
