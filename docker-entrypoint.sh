#!/bin/sh
# Writes runtime configuration into config.js before nginx starts.
# All values come from environment variables set in docker-compose.yml / .env.

cat > /usr/share/nginx/html/config.js <<EOF
window.HUB_CONFIG = {
  REGISTRY_URL: "${REGISTRY_URL:-./registry.json}",
  MAP_ZOOM:     "${MAP_ZOOM:-5}",
  MAP_MIN_ZOOM: "${MAP_MIN_ZOOM:-4}",
  MAP_CENTER:   "${MAP_CENTER:-10.5,51.2}"
};
EOF

exec nginx -g 'daemon off;'
