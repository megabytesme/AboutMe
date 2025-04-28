#!/bin/sh
set -e

echo "### Entrypoint script started ###"

: "${DOMAIN_NAME?Need to set DOMAIN_NAME}"
: "${CERT_EMAIL?Need to set CERT_EMAIL}"

LIVE_DIR="/etc/letsencrypt/live/${DOMAIN_NAME}"
FULLCHAIN_PATH="${LIVE_DIR}/fullchain.pem"
WEBROOT_PATH="/var/www/certbot"

mkdir -p /etc/nginx/conf.d

if [ ! -f "${FULLCHAIN_PATH}" ]; then
  echo "No SSL certificate found. Creating temporary Nginx config for challenges..."
  cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME};

    location /.well-known/acme-challenge/ {
        root ${WEBROOT_PATH};
    }

    location / {
        return 404; # Or a temporary page
    }
}
EOF
else
  echo "Existing certificate found at ${FULLCHAIN_PATH}. Generating full Nginx config."
  envsubst '${DOMAIN_NAME}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
fi

echo "Testing Nginx configuration..."
nginx -t

echo "Starting Nginx in background..."
nginx -g 'daemon on;'
sleep 2

echo "Attempting to obtain/renew STAGING certificate for ${DOMAIN_NAME}..."

CERTBOT_ARGS="certonly --non-interactive --agree-tos --email ${CERT_EMAIL} --webroot -w ${WEBROOT_PATH} -d ${DOMAIN_NAME} --cert-name ${DOMAIN_NAME} --keep-until-expiring --rsa-key-size 4096 --staging"

if [ ! -f "${FULLCHAIN_PATH}" ]; then
  echo "No certificate found, attempting to obtain a new one..."
  certbot ${CERTBOT_ARGS}
else
  echo "Certificate found, attempting to renew if necessary..."
  certbot ${CERTBOT_ARGS}
fi

echo "STAGING Certificate check/acquisition process finished."

echo "Stopping background Nginx daemon..."
nginx -s stop
sleep 2

echo "Generating final Nginx config with SSL..."
envsubst '${DOMAIN_NAME}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf


echo "Setting up Certbot auto-renewal cron job (for production certs)..."
echo "0 */12 * * * root certbot renew --webroot -w ${WEBROOT_PATH} --quiet --post-hook 'nginx -s reload'" > /etc/cron.d/certbot_renew
chmod 0644 /etc/cron.d/certbot_renew
echo "Cron job created. Ensure cron daemon is managed if needed."

echo "Starting Nginx in foreground with final configuration..."
exec nginx -g 'daemon off;'
