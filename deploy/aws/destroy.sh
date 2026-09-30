#!/usr/bin/env bash
# Elimina matrix-web de AWS (su pila y su repositorio ECR) para dejar de pagar por él.
# Con DESTROY_PLATFORM=si también elimina la plataforma compartida, SOLO si ningún otro servicio la usa.
# Uso: CONFIRM=si ./deploy/aws/destroy.sh            (solo este servicio)
#      CONFIRM=si DESTROY_PLATFORM=si ./deploy/aws/destroy.sh
set -euo pipefail
SERVICE="matrix-web"
PROJECT="${PROJECT_NAME:-retotecnico}"
REGION="${AWS_REGION:-us-east-1}"

if [ "${CONFIRM:-}" != "si" ]; then
  echo "Esto elimina la pila $PROJECT-$SERVICE y el repositorio ECR $PROJECT/$SERVICE en $REGION. Ejecuta con CONFIRM=si." >&2
  exit 1
fi

echo "▶ Eliminando $PROJECT-$SERVICE"
aws cloudformation delete-stack --region "$REGION" --stack-name "$PROJECT-$SERVICE"
aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$PROJECT-$SERVICE"
aws ecr delete-repository --region "$REGION" --repository-name "$PROJECT/$SERVICE" --force >/dev/null 2>&1 || true
echo "✓ $SERVICE eliminado"

if [ "${DESTROY_PLATFORM:-}" = "si" ]; then
  for other in api-go api-node matrix-web; do
    if aws cloudformation describe-stacks --region "$REGION" --stack-name "$PROJECT-$other" >/dev/null 2>&1; then
      echo "✗ La plataforma sigue en uso por $PROJECT-$other: no se elimina. Elimina primero ese servicio." >&2
      exit 1
    fi
  done
  echo "▶ Eliminando la plataforma $PROJECT-platform (ALB, red, cluster y secretos)"
  aws cloudformation delete-stack --region "$REGION" --stack-name "$PROJECT-platform"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$PROJECT-platform"
  echo "✓ Plataforma eliminada: ya no hay costos del sistema en $REGION."
fi
