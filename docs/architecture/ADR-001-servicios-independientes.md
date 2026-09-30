# ADR-001: Servicios independientes, no monolito

- **Estado:** Aceptado
- **Fecha:** 2026-09-29

## Contexto
El reto pide dos APIs en lenguajes distintos (Go/Fiber y Node.js/Express) que se comunican por HTTP,
contenerizadas y desplegables en la nube.

## Decisión
La solución se compone de **servicios independientes** (api-go, api-node y el frontend matrix-web, ver ADR-003),
**cada uno en su propio repositorio git**. No es un monolito ni un monorepo con código compartido.

Cada servicio es dueño de:

| Aspecto            | api-go                         | api-node                        |
|--------------------|--------------------------------|---------------------------------|
| Código y dependencias | `go.mod` propio             | `package.json` propio           |
| Configuración      | `api-go/.env`                  | `api-node/.env`                 |
| Imagen Docker      | `api-go/Dockerfile`            | `api-node/Dockerfile`           |
| Ejecución aislada  | `api-go/docker-compose.yml`    | `api-node/docker-compose.yml`   |
| Pruebas            | `go test ./...`                | `npm test`                      |
| Repositorio git    | propio                         | propio                          |
| Pipeline de CI     | `.github/workflows/ci.yml`     | `.github/workflows/ci.yml`      |
| Despliegue en AWS  | `deploy/aws/`                  | `deploy/aws/`                   |
| Contrato OpenAPI   | `api-go/api/openapi.yaml`      | `api-node/openapi/openapi.yaml` |
| Contexto Claude    | `api-go/.claude/`              | `api-node/.claude/`             |
| Despliegue en la nube | Servicio propio             | Servicio propio                 |

### Reglas
1. **Cero código compartido:** ningún servicio importa, copia ni lee archivos del otro.
2. **Único acoplamiento: el contrato HTTP** que cada proveedor publica en su propio `openapi.yaml` (servido en
   `/openapi.yaml`, ver ADR-002 §3). api-go conoce a api-node solo por
   `NODE_API_URL`.
3. **Configuración por servicio:** no hay `.env` global. Cada valor se inyecta por variables de entorno.
4. **Ciclo de vida independiente:** cada servicio se construye, versiona, prueba, escala y despliega por separado.
   Un cambio interno en uno no obliga a redesplegar el otro mientras respete el contrato.
5. **Tolerancia a fallos:** api-go trata a api-node como una dependencia externa (timeout configurable y
   manejo explícito de errores si no responde).
6. **Pipelines separados:** cada repositorio tiene su propio `.github/workflows/ci.yml` (pruebas, build y build de la
   imagen). No despliega ni usa servicios de AWS: el despliegue es una acción manual con `deploy/aws/deploy.sh`.
7. **Definición de terminado por servicio:** todo cambio actualiza sus pruebas, su documentación y, si hace falta,
   su configuración Docker (ver `CLAUDE.md` y `README.md` de cada servicio).

## Consecuencias
- (+) Cada servicio se escala y despliega en la nube por separado (p. ej. un servicio de contenedores por API).
- (+) Se puede extraer cada carpeta a su propio repositorio sin cambios.
- (+) Cada equipo o stack evoluciona a su ritmo.
- (−) El secreto JWT debe distribuirse a cada servicio por separado.
- (−) Los cambios de contrato requieren versionado y coordinación.
