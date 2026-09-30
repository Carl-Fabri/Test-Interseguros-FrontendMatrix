# ADR-003: Frontend matrix-web

- **Estado:** Aceptado
- **Fecha:** 2026-09-30

## Contexto
El reto pide un frontend que consuma ambas APIs, muestre la factorización (la "rotación") y las estadísticas, y
respete la seguridad con JWT. El proyecto se generó con Angular 21 con SSR activado y Tailwind v4.

## Decisiones

### 1. SPA estática en lugar de SSR
Se eliminó el SSR (`@angular/ssr`, servidor Express). Es una consola autenticada sin necesidad de SEO, el token vive en
el navegador y todos los datos dependen del usuario. El SSR solo añadía un servidor Node extra, guards y acceso a
`sessionStorage` condicionados a la plataforma, y una imagen más pesada. La SPA se sirve con **nginx**.

### 2. Configuración en tiempo de ejecución (`/config.json`)
Las URLs de las APIs no se compilan en el bundle: `main.ts` descarga `config.json` antes de arrancar Angular.
En Docker, un script del entrypoint de nginx genera ese archivo desde variables de entorno. Así **una sola imagen**
sirve para local, staging y producción. Si el archivo no existe, se usan los valores por defecto (localhost), por lo
que el desarrollo local funciona sin configurar nada. No contiene secretos: todo lo del frontend es público.

### 3. JWT
- Login contra api-go; el token se guarda en **sessionStorage**: se borra al cerrar la pestaña y no se comparte entre
  pestañas. Una cookie HttpOnly sería más resistente a XSS, pero requeriría que api-go emita cookies (mejora futura).
- `authInterceptor` adjunta el Bearer **solo** a `apiGoUrl` y `apiNodeUrl`, nunca a terceros. Ante un **401** cierra la
  sesión como expirada. El frontend decodifica el payload **sin verificarlo**: solo para mostrar el usuario y el tiempo
  restante. La verificación es responsabilidad de las APIs.
- Un reloj interno cierra la sesión cuando vence `exp`, aunque no haya peticiones.

### 4. El frontend consume ambas APIs
- **Flujo principal:** `POST api-go /matrix/qr`. api-go factoriza y consulta a api-node por su cuenta.
- **Consumo directo de api-node:** estadísticas de A, y en el pipeline completo estadísticas individuales de A, Q y R
  en paralelo, para la tabla multi-matriz. Demuestra que api-node es un servicio independiente con su propio contrato.

### 5. Verificación del lado del cliente
El navegador recalcula ‖QR − A‖ y ‖QᵀQ − I‖ y el rango a partir de R. No sustituye a las APIs: sirve para *mostrar*
que el resultado es correcto (Q × R = A) y hacerlo auditable en la demo.

### 6. Diseño y arquitectura
- **Tailwind v4 CSS-first**: tokens en `@theme` y utilidades propias con `@utility`. Estética de consola técnica
  oscura basada en la referencia entregada, adaptada a lo que realmente hacen las APIs: sin selector de ángulo de
  rotación, porque la "rotación" es el algoritmo de Givens (ADR-002).
- Angular **zoneless + signals**, componentes standalone OnPush, rutas con carga diferida (bundle inicial ≈ 79 KB
  transferidos), store por página y componentes presentacionales en `shared/ui`.
- **Inspector de red** propio (interceptor de telemetría) para evidenciar la comunicación entre servicios, sin guardar
  nunca la contraseña ni el token.

## Consecuencias
- (+) Imagen pequeña (nginx + estáticos), configurable por entorno y desplegable en cualquier hosting estático.
- (+) Seguridad razonable para un reto: token de vida corta, alcance limitado a las APIs propias y cierre ante 401.
- (−) sessionStorage es accesible desde JavaScript: se mitiga con Angular (sanitización por defecto, sin `innerHTML`).
- (−) El origen del frontend debe agregarse a `CORS_ALLOWED_ORIGINS` de ambas APIs en cada entorno.
