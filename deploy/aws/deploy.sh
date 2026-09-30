#!/usr/bin/env bash
# Despliega matrix-web en AWS (ECS Fargate) desde ESTE repositorio, sin depender de los otros:
#   0) crea la plataforma compartida si aún no existe (red, cluster, ALB, secretos)
#   1) crea el repositorio ECR si no existe   2) construye y publica la imagen (linux/amd64)
#   3) crea/actualiza la pila CloudFormation del servicio con la nueva imagen.
# Requisitos: AWS CLI v2 autenticada y Docker.
#
# Uso:  ./deploy/aws/deploy.sh
# Variables opcionales:
#   AWS_REGION (us-east-1) · PROJECT_NAME (retotecnico) · IMAGE_TAG (git sha o fecha)
#   PARAM_OVERRIDES  parámetros extra de service.yml, p. ej. "DesiredCount=0" o "CapacityProvider=FARGATE"
set -euo pipefail

SERVICE="matrix-web"
PROJECT="${PROJECT_NAME:-retotecnico}"
REGION="${AWS_REGION:-us-east-1}"
SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Tag inmutable por versión: SHA de git (+ fecha si hay cambios sin commit) o solo la fecha si no hay git.
if SHA="$(git -C "$SERVICE_DIR" rev-parse --short HEAD 2>/dev/null)"; then
  [ -n "$(git -C "$SERVICE_DIR" status --porcelain 2>/dev/null)" ] && SHA="$SHA-dirty-$(date +%Y%m%d%H%M%S)"
else
  SHA="$(date +%Y%m%d%H%M%S)"
fi
TAG="${IMAGE_TAG:-$SHA}"
STACK="$PROJECT-$SERVICE"

echo "▶ Desplegando $SERVICE (stack $STACK, región $REGION, tag $TAG)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
REPO="$PROJECT/$SERVICE"
IMAGE="$REGISTRY/$REPO:$TAG"

# 0) Plataforma compartida: se CREA solo si no existe (nunca se actualiza desde aquí,
#    para que un repositorio no pise la configuración usada por los otros servicios).
if ! aws cloudformation describe-stacks --region "$REGION" --stack-name "$PROJECT-platform" >/dev/null 2>&1; then
  echo "▶ La plataforma $PROJECT-platform no existe: creándola (≈ 3-4 min, una sola vez para los 3 servicios)"
  "$SERVICE_DIR/deploy/aws/deploy-platform.sh"
fi

# 1) Repositorio ECR con escaneo al publicar y retención de las 5 imágenes más recientes (ahorra almacenamiento).
if ! aws ecr describe-repositories --region "$REGION" --repository-names "$REPO" >/dev/null 2>&1; then
  aws ecr create-repository --region "$REGION" --repository-name "$REPO" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  aws ecr put-lifecycle-policy --region "$REGION" --repository-name "$REPO" --lifecycle-policy-text \
    '{"rules":[{"rulePriority":1,"description":"Conservar 5 imagenes","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}' >/dev/null
fi

# 2) Build y push (Fargate usa X86_64; --platform evita imágenes ARM si construyes en Apple Silicon).
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker build --platform linux/amd64 -t "$IMAGE" "$SERVICE_DIR"
docker push "$IMAGE"

# 3) Pila del servicio (rollback automático si las tareas nuevas no pasan el health check).
# shellcheck disable=SC2086
aws cloudformation deploy --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$SERVICE_DIR/deploy/aws/service.yml" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides ProjectName="$PROJECT" ImageUri="$IMAGE" ${PARAM_OVERRIDES:-}

echo "✓ $SERVICE desplegado. Salidas:"
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
