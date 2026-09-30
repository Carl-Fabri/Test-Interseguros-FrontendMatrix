#!/bin/sh
# Genera /config.json a partir de variables de entorno al arrancar el contenedor, para que
# la misma imagen sirva en cualquier entorno sin recompilar. Lo ejecuta el entrypoint de nginx.
set -eu

: "${API_GO_URL:=http://localhost:8080}"
: "${API_NODE_URL:=http://localhost:3000}"
: "${HEALTH_POLL_MS:=15000}"

cat > /usr/share/nginx/html/config.json <<JSON
{
  "apiGoUrl": "${API_GO_URL}",
  "apiNodeUrl": "${API_NODE_URL}",
  "healthPollMs": ${HEALTH_POLL_MS}
}
JSON

echo "matrix-web: config.json generado (apiGoUrl=${API_GO_URL}, apiNodeUrl=${API_NODE_URL})"
