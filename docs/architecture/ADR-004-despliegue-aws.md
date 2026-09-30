# ADR-004: Despliegue en AWS con ECS Fargate y CloudFormation

- **Estado:** Aceptado
- **Fecha:** 2026-09-30

## Contexto
El reto pide usar servicios en la nube para desplegar las aplicaciones contenerizadas. Hay tres servicios
independientes (ADR-001), cada uno con su imagen Docker. Buscamos un despliegue reproducible, barato para una
demo, fácil de explicar y que respete la independencia entre servicios.

## Decisión
**Amazon ECS sobre Fargate**, detrás de un **Application Load Balancer**, con imágenes en **ECR**, secretos en
**Secrets Manager**, logs en **CloudWatch** y toda la infraestructura como código en **CloudFormation**.

- **Una pila de plataforma compartida** (`deploy/aws/platform.yml`, copia idéntica en cada repositorio) con VPC,
  subredes, clúster, ALB, security groups y secretos. El primer `deploy.sh` la crea y los demás la reutilizan:
  **un solo balanceador para los tres servicios**. Ningún `deploy.sh` la actualiza (evita que un repo pise a otro).
- **Una pila por servicio**, en su repositorio (`deploy/aws/service.yml`), que importa
  las salidas de la plataforma y crea su *task definition*, rol, logs, target group, listener y servicio ECS.
- **Un script por servicio** (`deploy.sh`): build `linux/amd64` → push a ECR → `cloudformation deploy`.
- **Enrutamiento por puerto** en el ALB (`:80` frontend, `:8080` api-go, `:3000` api-node): cada servicio conserva
  sus rutas (`/health`, `/docs`, `/api/v1`) y no se necesita dominio para la demo.

## Alternativas consideradas
| Opción | Por qué no (para este reto) |
|---|---|
| **EKS (Kubernetes)** | Potente, pero con un costo fijo (~US$ 73/mes solo el plano de control) y una complejidad excesiva para tres contenedores. |
| **EC2 + docker compose** | Barato, pero hay que administrar el servidor (parches, reinicios) y no ofrece rollback ni escalado por servicio. |
| **Elastic Beanstalk (Docker)** | Más abstracción y menos control sobre red y secretos; acopla los servicios en un entorno. |
| **App Runner** | Muy simple, pero con menos control de red y de costos, y una disponibilidad de funciones más limitada según la región. |
| **Lambda** | Exige adaptar Fiber y Express a otro modelo de ejecución; el reto pide contenerizar con Docker. |
| **Terraform / CDK** | Válidos. CloudFormation se eligió por no requerir herramientas adicionales (basta la AWS CLI). |

## Costo
- Un solo ALB, sin NAT Gateway, **Fargate Spot** por defecto (parámetro `CapacityProvider`), 0.25 vCPU / 0.5 GB,
  logs de 7 días y ECR con retención de 5 imágenes: ≈ US$ 45/mes 24/7, centavos para una demo de horas.
- Los pipelines de CI **no despliegan ni usan AWS** (solo pruebas y build), así no generan costos ni despliegues
  involuntarios. `DesiredCount=0` pausa un servicio sin borrarlo.

## Seguridad
- Los secretos (`JWT_SECRET`, `AUTH_PASSWORD`) los **genera** Secrets Manager y ECS los inyecta. No existen en el
  repositorio, en las plantillas ni en las imágenes. Cada rol de ejecución solo puede leer los secretos que usa;
  el frontend no puede leer ninguno.
- Las tareas solo aceptan tráfico del ALB (security group). Imágenes con usuario no root (api-go distroless, api-node `node`).
- Escaneo de vulnerabilidades en ECR al publicar.

## Consecuencias
- (+) Despliegue reproducible con tres comandos, rollback automático y actualización independiente por servicio.
- (+) Costo bajo (≈ US$ 45/mes 24/7 con Spot, centavos para una demo) y eliminación por servicio con `destroy.sh`.
- (−) HTTP sin TLS y tareas con IP pública: aceptable para la demo; el camino a producción (HTTPS con dominio y
  reglas por host, subredes privadas, Service Connect, WAF, autoescalado y CI/CD con OIDC) está documentado en
  [docs/deploy/aws.md §11](../deploy/aws.md#11-endurecimiento-para-producción).
- (−) api-go llega a api-node a través del ALB público (tráfico que sale y vuelve a entrar); Service Connect lo evitaría.
