#!/usr/bin/env bash
# Crea el certificado https para abrir la app en la red local (correr desde Git Bash en esta PC).
#   bash frontend/scripts/crear-certificado.sh [IP]      (IP por defecto: la de Ethernet)
# Genera en frontend/certs/:
#   gab-local-ca.crt  -> autoridad local; instálala en los teléfonos/PC para que no salga la advertencia
#   gab-local-ca.key  -> llave de la autoridad (no compartir)
#   app.crt / app.key -> certificado que usa Vite
# La autoridad se conserva entre corridas; solo se rehace el certificado de la app (p. ej. si cambia la IP).
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
mkdir -p certs
cd certs

IP="${1:-$(powershell.exe -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Ethernet').IPAddress" | tr -d '\r' | head -1)}"
DASHED="${IP//./-}"
echo "IP de red: $IP"

if [ ! -f gab-local-ca.key ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout gab-local-ca.key -out gab-local-ca.crt \
    -subj "/CN=GAB Aplicaciones aereas - CA local" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
fi

cat > app.ext <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,DNS:aereas.localtest.me,DNS:aereas.${DASHED}.sslip.io,IP:127.0.0.1,IP:${IP}
EOF

openssl req -newkey rsa:2048 -nodes -keyout app.key -out app.csr -subj "/CN=aereas.${DASHED}.sslip.io"
openssl x509 -req -in app.csr -CA gab-local-ca.crt -CAkey gab-local-ca.key -CAcreateserial \
  -days 397 -sha256 -extfile app.ext -out app.crt
rm -f app.csr app.ext gab-local-ca.srl
echo "Listo: certs/app.crt para https://aereas.${DASHED}.sslip.io:5173"
