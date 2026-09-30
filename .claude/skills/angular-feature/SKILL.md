---
name: angular-feature
description: Convenciones de matrix-web para agregar o modificar pantallas, componentes, servicios de API, interceptores o estado (Angular 21 zoneless, signals, Tailwind v4, Vitest). Usar al crear cualquier pieza del frontend o conectar un endpoint nuevo de api-go o api-node.
---

# Funcionalidades en matrix-web

## Dónde va cada cosa
| Pieza                          | Carpeta                         | Regla                                                        |
|--------------------------------|---------------------------------|--------------------------------------------------------------|
| DTO de una API                 | `core/api/api.models.ts`        | Copia fiel del contrato OpenAPI del servicio                 |
| Llamada HTTP                   | `core/api/api-*.service.ts`     | Un método por endpoint; URL desde `APP_CONFIG`               |
| Estado compartido de la consola | `features/console/console.store.ts` | `@Injectable()` proveído en la ruta padre; signals + `computed` |
| Página enrutable               | `features/console/pages/<x>.page.ts` | Carga diferida en `console.routes.ts` (protegida por authGuard) |
| Componente de la consola       | `features/console/components/`  | Puede inyectar `ConsoleStore`                                |
| Componente reutilizable        | `shared/ui/`                    | Solo `input()`/`output()`, sin servicios                     |
| Lógica pura                    | `shared/<tema>/`                | Funciones puras con pruebas                                  |

## Conectar un endpoint nuevo
1. Leer el contrato (`{apiUrl}/openapi.yaml`) y agregar los DTOs en `api.models.ts`.
2. Agregar el método en `ApiGoService` o `ApiNodeService` (`authInterceptor` adjunta el JWT automáticamente;
   si es público y no debe aparecer en el inspector, usar `SKIP_TELEMETRY`).
3. Orquestar en el store: `running`, `error` (vía `toApiError(err, 'api-go' | 'api-node')`) y el resultado en signals.
4. Mostrar estados: vacío, cargando (botón deshabilitado con texto), error (`role="alert"`) y éxito.
5. Pruebas: servicio/store con `provideHttpClientTesting` + `HttpTestingController` (`expectOne`, `match`, `verify`).

## Componentes
```ts
@Component({
  selector: 'app-ejemplo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="panel p-4"><span class="eyebrow">{{ label() }}</span></article>`,
})
export class EjemploComponent {
  readonly label = input.required<string>();
}
```
- Plantillas inline si son cortas; `templateUrl` para páginas grandes. Sin archivos CSS por componente.
- Utilidades de diseño: `panel`, `panel-inset`, `eyebrow`, `tag`, `btn-primary|secondary|ghost`, `chip`/`chip-active`,
  `field`, `cell`. Colores: `bg-canvas|surface|surface-2|surface-3`, `border-line|line-strong`,
  `text-ink|ink-muted|ink-faint`, `text-ok|warn|bad`. Datos numéricos en `font-mono tabular-nums`.

## Pruebas (Vitest + TestBed)
- Helpers en `src/testing/test-helpers.ts`: `TEST_CONFIG` (proveer como `APP_CONFIG`), `validJwt()`, `fakeJwt()`.
- Sustituir `HealthService` por un doble con signals en pruebas de componentes (evita sondeos reales).
- Espiar `Router.navigate` con `vi.spyOn(...).mockResolvedValue(true)`.
- `await fixture.whenStable()` tras interacciones (la app es zoneless).

## Checklist antes de terminar
- [ ] Pruebas nuevas o actualizadas; `npm run test:ci` en verde
- [ ] `npm run build` sin advertencias nuevas
- [ ] `.claude/CLAUDE.md` y `README.md` al día; DTOs alineados con los contratos
- [ ] Docker/config revisados si cambió la configuración de ejecución
