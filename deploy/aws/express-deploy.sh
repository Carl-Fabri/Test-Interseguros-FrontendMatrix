#!/usr/bin/env bash
# Publica y configura matrix-web en ECS Express Mode de forma repetible y sin errores de consola:
#   1) construye la imagen (linux/amd64) y la sube a ECR
#   2) crea los secretos en Secrets Manager si faltan y da permiso de lectura al rol de ejecución
#   3) actualiza el servicio Express con el puerto, el health check, las variables y los secretos correctos
#
# Uso:
#   ./deploy/aws/express-deploy.sh            publica y configura
#   ./deploy/aws/express-deploy.sh diagnose   muestra por qué se detienen las tareas y sus últimos logs
#
# Requisitos: AWS CLI v2 autenticada (aws login / aws configure) y Docker.
# Variables (las marcadas * son obligatorias según el servicio):
#   AWS_REGION (us-east-2) · ECS_CLUSTER (default) · EXPRESS_SERVICE_ARN (si hay varios servicios similares)
#   api-go*: NODE_API_URL, WEB_URL · api-node*: WEB_URL · matrix-web*: API_GO_URL, API_NODE_URL
#   DRY_RUN=1 imprime lo que haría sin tocar AWS ni Docker.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash en Windows convertiría "/health" en una ruta de Windows

SERVICE="matrix-web"
REGION="${AWS_REGION:-us-east-2}"
CLUSTER="${ECS_CLUSTER:-default}"
PREFIX="${SECRET_PREFIX:-retotecnico}"
DRY="${DRY_RUN:-}"
SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run() { if [ -n "$DRY" ]; then printf '+'; printf ' %q' "$@"; echo; else "$@"; fi; }
need() { [ -n "${!1:-}" ] || { echo "✗ Falta la variable $1: $2" >&2; exit 1; }; }
strip() { local v="${!1}"; printf '%s' "${v%/}"; }

# ── Configuración propia de cada servicio ──────────────────────────────────────────────
#  PORT   = puerto en el que escucha la app (las imágenes corren como usuario NO root: ECS no permite puertos < 1024)
#  HEALTH = ruta del health check del balanceador
case "$SERVICE" in
  api-go)
    PORT=8080; HEALTH=/health; USES_SECRETS=1
    need NODE_API_URL "URL pública de api-node, p. ej. https://ap-xxxx.ecs.us-east-2.on.aws"
    need WEB_URL "URL pública de matrix-web (origen permitido por CORS)"
    NODE_API_URL="$(strip NODE_API_URL)"; WEB_URL="$(strip WEB_URL)"
    ENV_JSON="[{\"name\":\"NODE_API_URL\",\"value\":\"$NODE_API_URL\"},{\"name\":\"NODE_API_TIMEOUT_MS\",\"value\":\"5000\"},{\"name\":\"JWT_ISSUER\",\"value\":\"api-go\"},{\"name\":\"JWT_AUDIENCE\",\"value\":\"matrix-services\"},{\"name\":\"AUTH_USERNAME\",\"value\":\"${AUTH_USERNAME:-admin}\"},{\"name\":\"CORS_ALLOWED_ORIGINS\",\"value\":\"$WEB_URL\"}]"
    ;;
  api-node)
    PORT=3000; HEALTH=/health; USES_SECRETS=1
    need WEB_URL "URL pública de matrix-web (origen permitido por CORS)"
    WEB_URL="$(strip WEB_URL)"
    ENV_JSON="[{\"name\":\"JWT_ISSUER\",\"value\":\"api-go\"},{\"name\":\"JWT_AUDIENCE\",\"value\":\"matrix-services\"},{\"name\":\"CORS_ALLOWED_ORIGINS\",\"value\":\"$WEB_URL\"}]"
    ;;
  matrix-web)
    PORT=80; HEALTH=/healthz; USES_SECRETS=0
    need API_GO_URL "URL pública de api-go"
    need API_NODE_URL "URL pública de api-node"
    API_GO_URL="$(strip API_GO_URL)"; API_NODE_URL="$(strip API_NODE_URL)"
    ENV_JSON="[{\"name\":\"API_GO_URL\",\"value\":\"$API_GO_URL\"},{\"name\":\"API_NODE_URL\",\"value\":\"$API_NODE_URL\"}]"
    ;;
  *) echo "Servicio desconocido: $SERVICE" >&2; exit 1 ;;
esac

# ── Localizar el servicio Express ──────────────────────────────────────────────────────
if [ -n "$DRY" ]; then
  ACCOUNT="000000000000"; SERVICE_ARN="arn:aws:ecs:$REGION:$ACCOUNT:service/$CLUSTER/$SERVICE-demo"
else
  ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
  SERVICE_ARN="${EXPRESS_SERVICE_ARN:-$(aws ecs list-services --region "$REGION" --cluster "$CLUSTER" \
    --query "serviceArns[?contains(@, '/$SERVICE')]|[0]" --output text)}"
  if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" = "None" ]; then
    echo "✗ No encontré un servicio '$SERVICE' en el clúster '$CLUSTER' ($REGION). Revisa la región o define EXPRESS_SERVICE_ARN." >&2
    exit 1
  fi
fi
SERVICE_NAME="${SERVICE_ARN##*/}"

# ── Subcomando: diagnose ───────────────────────────────────────────────────────────────
if [ "${1:-}" = "diagnose" ]; then
  echo "▶ Servicio: $SERVICE_NAME ($REGION)"
  echo "── Despliegues:"
  aws ecs describe-services --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE_ARN" \
    --query "services[0].deployments[].[status,rolloutState,rolloutStateReason,desiredCount,runningCount,failedTasks]" --output table
  echo "── Últimas tareas detenidas (motivo de la caída):"
  TASKS="$(aws ecs list-tasks --region "$REGION" --cluster "$CLUSTER" --service-name "$SERVICE_NAME" \
    --desired-status STOPPED --max-items 5 --query "taskArns" --output text)"
  if [ -n "$TASKS" ] && [ "$TASKS" != "None" ]; then
    # shellcheck disable=SC2086
    aws ecs describe-tasks --region "$REGION" --cluster "$CLUSTER" --tasks $TASKS \
      --query "tasks[].[stoppedAt,stoppedReason,containers[0].exitCode,containers[0].reason]" --output table
  else
    echo "   (ninguna: las tareas aún no se han detenido)"
  fi
  echo "── Logs recientes:"
  GROUP="$(aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "/aws/ecs/$CLUSTER/$SERVICE" \
    --query "logGroups[0].logGroupName" --output text)"
  if [ -n "$GROUP" ] && [ "$GROUP" != "None" ]; then aws logs tail "$GROUP" --region "$REGION" --since 30m | tail -40
  else echo "   (sin grupo de logs para $SERVICE)"; fi
  exit 0
fi

# ── 1. Imagen en ECR ───────────────────────────────────────────────────────────────────
REPO="$PREFIX/$SERVICE"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
IMAGE="$REGISTRY/$REPO:$TAG"
echo "▶ 1/3 Imagen $IMAGE"
if [ -z "$DRY" ]; then
  aws ecr describe-repositories --region "$REGION" --repository-names "$REPO" >/dev/null 2>&1 ||
    aws ecr create-repository --region "$REGION" --repository-name "$REPO" --image-scanning-configuration scanOnPush=true >/dev/null
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
fi
run docker build --platform linux/amd64 -t "$IMAGE" "$SERVICE_DIR"
run docker push "$IMAGE"

# ── 2. Secretos y permisos ─────────────────────────────────────────────────────────────
SECRETS_JSON=""
if [ "$USES_SECRETS" = "1" ]; then
  echo "▶ 2/3 Secretos en Secrets Manager ($PREFIX/*)"
  random() { head -c 256 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-"$1"; }
  ensure_secret() {   # $1 nombre · $2 valor inicial (solo si no existe); imprime el ARN
    if [ -n "$DRY" ]; then echo "arn:aws:secretsmanager:$REGION:$ACCOUNT:secret:$1-AbCdEf"; return; fi
    aws secretsmanager describe-secret --region "$REGION" --secret-id "$1" >/dev/null 2>&1 ||
      aws secretsmanager create-secret --region "$REGION" --name "$1" --secret-string "$2" >/dev/null
    aws secretsmanager describe-secret --region "$REGION" --secret-id "$1" --query ARN --output text
  }
  JWT_ARN="$(ensure_secret "$PREFIX/jwt-secret" "$(random 64)")"
  SECRETS_JSON="[{\"name\":\"JWT_SECRET\",\"valueFrom\":\"$JWT_ARN\"}"
  if [ "$SERVICE" = "api-go" ]; then
    PASS_ARN="$(ensure_secret "$PREFIX/auth-password" "${AUTH_PASSWORD:-$(random 20)}")"
    SECRETS_JSON="$SECRETS_JSON,{\"name\":\"AUTH_PASSWORD\",\"valueFrom\":\"$PASS_ARN\"}"
  fi
  SECRETS_JSON="$SECRETS_JSON]"

  # El rol de ejecución de la tarea debe poder leer los secretos (sin esto: ResourceInitializationError).
  if [ -z "$DRY" ]; then
    TD_ARN="$(aws ecs describe-services --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE_ARN" \
      --query "services[0].taskDefinition" --output text)"
    ROLE_ARN="$(aws ecs describe-task-definition --region "$REGION" --task-definition "$TD_ARN" \
      --query "taskDefinition.executionRoleArn" --output text)"
    POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"arn:aws:secretsmanager:$REGION:$ACCOUNT:secret:$PREFIX/*\"}]}"
    aws iam put-role-policy --role-name "${ROLE_ARN##*/}" --policy-name "$PREFIX-read-secrets" --policy-document "$POLICY" ||
      echo "⚠ No pude dar permiso de lectura a ${ROLE_ARN##*/}; agrégalo a mano (ver docs/deploy/aws-express.md)." >&2
  fi
else
  echo "▶ 2/3 Sin secretos (el frontend no los usa)"
fi

# ── 3. Actualizar el servicio Express ──────────────────────────────────────────────────
CONTAINER_JSON="{\"image\":\"$IMAGE\",\"containerPort\":$PORT,\"environment\":$ENV_JSON"
[ -n "$SECRETS_JSON" ] && CONTAINER_JSON="$CONTAINER_JSON,\"secrets\":$SECRETS_JSON"
CONTAINER_JSON="$CONTAINER_JSON}"

echo "▶ 3/3 Actualizando $SERVICE_NAME: puerto $PORT, health check $HEALTH, 256 CPU / 512 MB"
run aws ecs update-express-gateway-service --region "$REGION" --service-arn "$SERVICE_ARN" \
  --health-check-path "$HEALTH" --cpu 256 --memory 512 --primary-container "$CONTAINER_JSON"

cat <<EOF

✓ Enviado. ECS tarda unos minutos en desplegar; el health check necesita ~2.5 min de respuestas correctas.
  Estado y causa de fallos:   ./deploy/aws/express-deploy.sh diagnose
EOF
