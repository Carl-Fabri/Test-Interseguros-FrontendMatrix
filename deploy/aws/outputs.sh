#!/usr/bin/env bash
# Muestra las URLs públicas y el usuario/contraseña de demo del sistema desplegado.
set -euo pipefail
PROJECT="${PROJECT_NAME:-retotecnico}"
REGION="${AWS_REGION:-us-east-1}"

out() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$PROJECT-platform" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

echo "Frontend : $(out FrontendUrl)"
echo "api-go   : $(out ApiGoUrl)   (docs: $(out ApiGoUrl)/docs)"
echo "api-node : $(out ApiNodeUrl)   (docs: $(out ApiNodeUrl)/docs)"
echo "Usuario  : admin (parámetro AuthUsername de la pila api-go)"
echo "Password : $(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$(out AuthPasswordSecretArn)" --query SecretString --output text)"
