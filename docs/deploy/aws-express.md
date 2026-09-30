# Despliegue con Amazon ECS Express Mode

Alternativa simple a la pila de CloudFormation (`docs/deploy/aws.md`): cada servicio se crea desde la consola de ECS
con **Express Mode**, que provisiona por ti el balanceador con HTTPS, el certificado, el target group y el autoescalado,
y te da una URL pública `https://<id>.ecs.<región>.on.aws`. Este documento es idéntico en los tres repositorios.

## Por qué un servicio se queda "en curso" o no pasa el health check

Express Mode, por defecto, envía el tráfico al **puerto 80** del contenedor y hace el health check en **`/`**.

| Causa | Síntoma | Solución |
|---|---|---|
| El puerto del contenedor no es el que escucha la app | Target group *unhealthy*; la tarea se reinicia | `containerPort` = **8080** (api-go), **3000** (api-node) u **80** (matrix-web) |
| Una app no root intenta escuchar en el puerto 80 | La tarea se detiene al arrancar (`permission denied`) | No cambies `PORT` a 80 en las APIs: sus imágenes corren como usuario no root |
| Faltan variables obligatorias | La tarea se detiene al instante; en los logs: `configuración inválida: JWT_SECRET es obligatorio...` | Define `JWT_SECRET` (≥ 32 caracteres) y, en api-go, `AUTH_USERNAME` y `AUTH_PASSWORD` |
| La ruta del health check responde 404 | Target group *unhealthy* | Usa `--health-check-path /health` (las APIs también responden 200 en `/`) |
| El balanceador y el certificado aún se aprovisionan | La URL no resuelve (*Non-existent domain*); recursos en "Aprovisionamiento" | Esperar entre 5 y 15 minutos. Luego el health check necesita ~2.5 min (5 éxitos × 30 s) |

## Configuración por servicio

Reemplaza las URLs por las de tus servicios (se ven en la consola, en *Ruta de entrada pública*).

| | api-go | api-node | matrix-web |
|---|---|---|---|
| **Imagen** | `…/api-go:<tag>` | `…/api-node:<tag>` | `…/matrix-web:<tag>` |
| **Puerto del contenedor** | `8080` | `3000` | `80` |
| **Ruta de health check** | `/health` | `/health` | `/healthz` |
| **CPU / memoria sugeridas** | 256 / 512 | 256 / 512 | 256 / 512 |

**Variables de entorno:**

| Variable | api-go | api-node | matrix-web |
|---|---|---|---|
| `JWT_SECRET` | **secreto** (el mismo en ambas APIs) | **secreto** (el mismo) | — |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `api-go` / `matrix-services` | `api-go` / `matrix-services` | — |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | `admin` / **secreto** | — | — |
| `NODE_API_URL` | `https://<url-de-api-node>` | — | — |
| `CORS_ALLOWED_ORIGINS` | `https://<url-de-matrix-web>` | `https://<url-de-matrix-web>` | — |
| `API_GO_URL` / `API_NODE_URL` | — | — | `https://<url-de-api-go>` / `https://<url-de-api-node>` |

> Las URLs van **sin barra final**. `CORS_ALLOWED_ORIGINS` debe ser exactamente el origen del frontend
> (`https://ma-…on.aws`); si no coincide, el navegador bloquea las peticiones.

## Paso a paso

### 1. Secretos (recomendado)
```bash
REGION=us-east-2
aws secretsmanager create-secret --region $REGION --name retotecnico/jwt-secret \
  --secret-string "$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-64)"
aws secretsmanager create-secret --region $REGION --name retotecnico/auth-password \
  --secret-string "$(openssl rand -base64 18 | tr -d '\n/+=')"
```
El **rol de ejecución** de las tareas (normalmente `ecsTaskExecutionRole`) necesita permiso para leerlos. Agrega esta
política en línea en IAM:
```json
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:us-east-2:<cuenta>:secret:retotecnico/*" } ] }
```
*Para una demo rápida puedes poner los valores como variables de entorno normales, pero quedan visibles en la
task definition.*

### 2. Actualizar cada servicio

**Consola:** ECS → *Express Mode* → el servicio → **Update** → *Additional configurations*: puerto del contenedor,
ruta del health check, variables de entorno y secretos (tabla anterior).

**CLI** (con `aws configure` o `aws login` hecho). Ejemplo con las URLs actuales:

```bash
REGION=us-east-2
GO=https://ap-8e3d5e0e78f6457f95a8800ed6701ad1.ecs.us-east-2.on.aws
NODE=https://ap-cc4ef613dc894f5e8fa7b82b3b899301.ecs.us-east-2.on.aws
WEB=https://ma-5e9d558c80e64056a2b7350bc5740fe8.ecs.us-east-2.on.aws
JWT_ARN=$(aws secretsmanager describe-secret --region $REGION --secret-id retotecnico/jwt-secret --query ARN --output text)
PASS_ARN=$(aws secretsmanager describe-secret --region $REGION --secret-id retotecnico/auth-password --query ARN --output text)
svc() { aws ecs list-services --region $REGION --cluster default --query "serviceArns[?contains(@, '$1')]|[0]" --output text; }

# api-node (primero: api-go depende de él)
aws ecs update-express-gateway-service --region $REGION --service-arn "$(svc api-node)" \
  --health-check-path /health \
  --primary-container "image=<imagen-api-node>,containerPort=3000,environment=[{name=JWT_ISSUER,value=api-go},{name=JWT_AUDIENCE,value=matrix-services},{name=CORS_ALLOWED_ORIGINS,value=$WEB}],secrets=[{name=JWT_SECRET,valueFrom=$JWT_ARN}]"

# api-go
aws ecs update-express-gateway-service --region $REGION --service-arn "$(svc api-go)" \
  --health-check-path /health \
  --primary-container "image=<imagen-api-go>,containerPort=8080,environment=[{name=NODE_API_URL,value=$NODE},{name=JWT_ISSUER,value=api-go},{name=JWT_AUDIENCE,value=matrix-services},{name=AUTH_USERNAME,value=admin},{name=CORS_ALLOWED_ORIGINS,value=$WEB}],secrets=[{name=JWT_SECRET,valueFrom=$JWT_ARN},{name=AUTH_PASSWORD,valueFrom=$PASS_ARN}]"

# matrix-web
aws ecs update-express-gateway-service --region $REGION --service-arn "$(svc matrix-web)" \
  --health-check-path /healthz \
  --primary-container "image=<imagen-matrix-web>,containerPort=80,environment=[{name=API_GO_URL,value=$GO},{name=API_NODE_URL,value=$NODE}]"
```
Ajusta los filtros de `svc` si tus servicios tienen otros nombres (p. ej. `api-go-60e6`).

### 3. Verificar
```bash
curl $GO/health          # {"service":"api-go","status":"ok"}
curl $NODE/health        # {"status":"ok","service":"api-node"}
curl $WEB/config.json    # debe mostrar las URLs de las APIs
```
Luego abre la URL del frontend e inicia sesión con `admin` y la contraseña del secreto:
`aws secretsmanager get-secret-value --region us-east-2 --secret-id retotecnico/auth-password --query SecretString --output text`.

### 4. Si algo falla: logs
```bash
aws logs describe-log-groups --region us-east-2 --log-group-name-prefix /aws/ecs/default --query "logGroups[].logGroupName"
aws logs tail /aws/ecs/default/<nombre-del-servicio> --region us-east-2 --follow
```
| Mensaje en los logs | Causa |
|---|---|
| `configuración inválida: ...` / `Configuración inválida: ...` | Falta una variable obligatoria o el secreto es corto |
| `listen tcp :80: bind: permission denied` | Se forzó `PORT=80` en una imagen no root |
| `ResourceInitializationError ... secretsmanager` | El rol de ejecución no puede leer el secreto |
| El frontend carga pero muestra las APIs "sin conexión" | `API_GO_URL`/`API_NODE_URL` incorrectas o CORS sin el origen del frontend |

## Costo
Express Mode comparte un balanceador entre hasta 25 servicios de la misma VPC. Sus valores por defecto son 1 vCPU y
2 GB por tarea; bájalos a **256 CPU / 512 MB** (`--cpu 256 --memory 512`) para ahorrar: estas apps no necesitan más.
Con mínimo de 1 tarea por servicio el costo es parecido al de la pila de CloudFormation. Para no pagar, elimina los
servicios desde la consola de ECS cuando termines.
