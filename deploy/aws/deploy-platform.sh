#!/usr/bin/env bash
# Crea o ACTUALIZA explícitamente la plataforma compartida (VPC, cluster ECS, ALB y secretos).
# deploy.sh la crea automáticamente si falta; usa este script solo para cambiar platform.yml.
# ! Las copias de platform.yml en los 3 repositorios deben ser idénticas (ver PlatformVersion).
# Variables opcionales: AWS_REGION (us-east-1), PROJECT_NAME (retotecnico), ALLOWED_INGRESS_CIDR (0.0.0.0/0)
set -euo pipefail
PROJECT="${PROJECT_NAME:-retotecnico}"
REGION="${AWS_REGION:-us-east-1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

aws cloudformation deploy --region "$REGION" \
  --stack-name "$PROJECT-platform" \
  --template-file "$DIR/platform.yml" \
  --no-fail-on-empty-changeset \
  --parameter-overrides ProjectName="$PROJECT" AllowedIngressCidr="${ALLOWED_INGRESS_CIDR:-0.0.0.0/0}"

aws cloudformation describe-stacks --region "$REGION" --stack-name "$PROJECT-platform" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
