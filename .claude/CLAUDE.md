# matrix-web — Frontend (Angular 21 + Tailwind CSS v4)

> **Servicio autónomo** con su propio repositorio git, build, Docker, pruebas y CI. Consume api-go y api-node
> **solo por HTTP** desde el navegador. Nunca leer ni importar código de `../api-go` ni `../api-node`:
> sus contratos se consultan en `{apiGoUrl}/openapi.yaml` y `{apiNodeUrl}/openapi.yaml`.

## Responsabilidad
Consola que autentica contra api-go (JWT), envía matrices a factorizar (QR en api-go), consulta estadísticas
directamente en api-node y muestra resultados, verificación (Q·R ≈ A), diagnóstico diagonal y telemetría de red.

## Pantallas y flujos
| Ruta     | Guard        | Contenido                                                                       |
|----------|--------------|---------------------------------------------------------------------------------|
| `/login` | `guestGuard` | Login → `POST {apiGo}/api/v1/auth/login`, estado de /health de ambas APIs       |
| `/resumen` | `authGuard` | Indicadores, health checker, acciones y accesos a los módulos                 |
| `/matriz` | `authGuard` | Matriz personalizada (m × n de 1 a 100 + relleno), presets, grilla y JSON      |
| `/qr` | `authGuard` | Q y R de api-go, verificación y algoritmo de Givens                              |
| `/estadisticas` | `authGuard` | Estadísticas de Q y R y tabla multi-matriz (A, Q, R)                      |
| `/red` | `authGuard` | Inspector de peticiones (telemetría) y claims del JWT                           |

Las páginas de la consola cuelgan del `ShellComponent` en `features/console/console.routes.ts`, con
`providers: [ConsoleStore]` en la ruta padre: **todas comparten la misma instancia** del store.

Acciones de la consola (`ConsoleStore`):
- **QR (Go):** `POST {apiGo}/api/v1/matrix/qr` (api-go consulta a api-node y devuelve Q, R y estadísticas).
- **Estadísticas directas (Node):** `POST {apiNode}/api/v1/statistics` con A.
- **Pipeline completo:** QR en api-go y luego A, Q y R en paralelo en api-node (tabla multi-matriz).

## Arquitectura
```
src/main.ts                 Carga /config.json (loadAppConfig) y arranca Angular
src/app/app.config.ts       Proveedores: router, HttpClient (fetch) + interceptores, APP_CONFIG
src/app/app.routes.ts       Rutas con carga diferida y guards
src/app/core/config/        AppConfig en tiempo de ejecución (URLs de las APIs, sondeo)
src/app/core/api/           DTOs (api.models.ts ↔ OpenAPI), ApiGoService, ApiNodeService, toApiError
src/app/core/auth/          AuthService (signals + sessionStorage), authInterceptor, guards, decodeJwt
src/app/core/telemetry/     telemetryInterceptor + TelemetryService (inspector de red)
src/app/core/health/        HealthService (sondeo de /health)
src/app/shared/matrix/      Validación, presets y verificación de QR del lado del cliente
src/app/shared/ui/          Componentes presentacionales (kpi-card, matrix-grid, section-header)
src/app/layout/             ShellComponent (zona autenticada)
src/app/features/auth/      LoginPage
src/app/features/console/   console.routes.ts · console.store.ts · pages/ (una por apartado) · components/
src/testing/                Helpers de prueba (TEST_CONFIG, fakeJwt, validJwt)
docker/                     nginx.conf y script que genera config.json al arrancar
deploy/aws/                 service.yml (CloudFormation ECS Fargate) + deploy.sh (build → ECR → stack)
```

## Convenciones
- **Zoneless + signals**: estado con `signal`/`computed`; sin `BehaviorSubject` para estado de UI.
- Componentes standalone, `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, control flow `@if/@for`.
- Los componentes no llaman HTTP directamente: usan servicios de `core/api` o el store de la página.
- Todo error de API pasa por `toApiError` (formato `{ error: { code, message } }` de ambos servicios).
- **Tailwind v4 CSS-first**: tokens en `@theme` de `src/styles.css` (`canvas`, `surface*`, `line*`, `ink*`, `ok/warn/bad`)
  y utilidades propias con `@utility` (`panel`, `eyebrow`, `tag`, `btn-*`, `chip`, `field`, `cell`). Sin CSS por componente.
- Seguridad: el token solo se adjunta a `apiGoUrl`/`apiNodeUrl`; la telemetría nunca guarda contraseña ni token.
- Textos de la interfaz y documentación en español; identificadores en inglés.
- **Comentarios Better Comments** en los métodos clave: `// *` punto clave · `// !` advertencia o seguridad ·
  `// ?` decisión de diseño · `// TODO:` pendiente. JSDoc para la API pública de cada clase o función.

## Definición de terminado (OBLIGATORIA en cada cambio)
1. **Pruebas**: agregar o actualizar pruebas (`*.spec.ts`) de toda lógica nueva o modificada: utilidades, servicios,
   interceptores, store y componentes con interacción. `npm run test:ci` en verde.
2. **Documentación**: este `CLAUDE.md`, `README.md` y los DTOs de `core/api/api.models.ts` si cambia un contrato.
3. **Docker**: revisar `Dockerfile`, `docker/`, `docker-compose.yml`, `.env.example` y `public/config.example.json`
   cuando cambien la configuración de ejecución, el build o el servidor. Validar con `docker compose build`.
   Si cambia una variable de entorno, un puerto o el health check, actualizar también `deploy/aws/service.yml`
   (y validar con `cfn-lint`). Guía: `docs/deploy/aws.md`.

El CI (`.github/workflows/ci.yml`) bloquea el cambio si fallan las pruebas, el build o la imagen Docker.

## Comandos
- Desarrollo: `npm start` → http://localhost:4200 (APIs en localhost:8080 y :3000 por defecto)
- Pruebas: `npm run test:ci` · Build: `npm run build`
- **Windows con Smart App Control** (bloquea el binario nativo de Rollup que usa Vitest): correr las pruebas en contenedor:
  `docker run --rm -v "${PWD}:/app" -v matrixweb_node_modules:/app/node_modules -w /app node:22-alpine sh -c "npm ci && npm run test:ci"`
- Docker aislado: `docker compose up --build` → http://localhost:4200
- Despliegue en AWS: `./deploy/aws/deploy.sh` (crea la plataforma compartida si falta)

## Configuración de ejecución (sin secretos: todo lo del frontend es público)
| Clave (`config.json`) | Variable Docker    | Default               | Descripción                         |
|-----------------------|--------------------|-----------------------|-------------------------------------|
| `apiGoUrl`            | `API_GO_URL`       | http://localhost:8080 | URL de api-go vista por el navegador |
| `apiNodeUrl`          | `API_NODE_URL`     | http://localhost:3000 | URL de api-node vista por el navegador |
| `healthPollMs`        | `HEALTH_POLL_MS`   | 15000                 | Intervalo de sondeo de /health      |
| —                     | `WEB_PORT`         | 4200                  | Puerto publicado (debe estar en CORS de ambas APIs) |

## Agentes, skills y memoria
- **Subagentes** (`.claude/agents/`, memoria en `.claude/agent-memory/<nombre>/`):
  - `web-developer`: implementa pantallas, componentes, servicios y sus pruebas.
  - `web-reviewer`: revisa sin editar (seguridad JWT, accesibilidad, contratos con las APIs, pruebas, diseño).
- **Skills**: `angular-feature` (propia, convenciones de este proyecto), `angular-developer` (oficial de Angular)
  y `tailwind-design-system`. Versiones de terceros fijadas en `skills-lock.json`.
- **Reglas por ruta**: `.claude/rules/testing.md` (specs) y `.claude/rules/templates.md` (plantillas y estilos).
- Al cerrar una sesión: `/retro`.
