#!/bin/bash
set -euo pipefail

ORIG_ENTRYPOINT="/usr/local/bin/docker-entrypoint.sh"
WP_PATH="/var/www/html"
WP="wp --path=$WP_PATH --allow-root"

echo "[bootstrap] Waiting for DB..."
# Wait for MySQL socket to be reachable
until php -r '
$h=getenv("WORDPRESS_DB_HOST"); if(!$h){exit(1);}
list($host,$port) = array_pad(explode(":", $h, 2), 2, 3306);
$t = @fsockopen($host, (int)$port, $errno, $errstr, 2);
if($t){fclose($t); exit(0);} else {fwrite(STDERR,"$errstr\n"); exit(1);}
'; do
  sleep 2
done

# Permissions (especially important with bind-mounted wp-content)
echo "[bootstrap] Fixing permissions..."
chown -R www-data:www-data "$WP_PATH"
find "$WP_PATH" -type d -exec chmod 755 {} \; || true
find "$WP_PATH" -type f -exec chmod 644 {} \; || true

# Ensure wp-config exists and install if needed
if ! $WP core is-installed >/dev/null 2>&1; then
  echo "[bootstrap] No WordPress install detected. Creating wp-config..."
  $WP config create \
    --dbname="${WORDPRESS_DB_NAME}" \
    --dbuser="${WORDPRESS_DB_USER}" \
    --dbpass="${WORDPRESS_DB_PASSWORD}" \
    --dbhost="${WORDPRESS_DB_HOST}" \
    --skip-check

  SITE_URL="${WP_HOME:-http://localhost:8000}"
  echo "[bootstrap] Installing core at ${SITE_URL}..."
  $WP core install \
    --url="${SITE_URL}" \
    --title="${WP_TITLE:-My Site}" \
    --admin_user="${WP_ADMIN_USER:-admin}" \
    --admin_password="${WP_ADMIN_PASSWORD:-admin}" \
    --admin_email="${WP_ADMIN_EMAIL:-admin@example.com}"
else
  echo "[bootstrap] WordPress already installed. Skipping core install."
fi

# Keep siteurl/home in sync (useful if port changes)
if [[ -n "${WP_HOME:-}" ]]; then $WP option update home "${WP_HOME}" || true; fi
if [[ -n "${WP_SITEURL:-}" ]]; then $WP option update siteurl "${WP_SITEURL}" || true; fi

# Activate requested plugins if they exist
if [[ -n "${WP_PLUGINS:-}" ]]; then
  echo "[bootstrap] Activating plugins: ${WP_PLUGINS}"
  for slug in ${WP_PLUGINS}; do
    if $WP plugin is-installed "$slug" >/dev/null 2>&1; then
      $WP plugin activate "$slug" || true
      echo "[bootstrap] Activated: $slug"
    else
      echo "[bootstrap][WARN] Not found: $slug (check folder name under wp-content/plugins)"
    fi
  done
else
  echo "[bootstrap] No WP_PLUGINS specified."
fi

# Permalinks (needed for /graphql & pretty URLs)
$WP rewrite structure '/%postname%/' --hard || true
$WP rewrite flush --hard || true

# Final permission pass
chown -R www-data:www-data "$WP_PATH"

echo "[bootstrap] Handing off to original entrypoint..."
exec "$ORIG_ENTRYPOINT" apache2-foreground
