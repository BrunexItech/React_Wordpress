#!/bin/bash
set -e

# Start the original wordpress entrypoint (which initializes WP and starts apache)
# but run it in background so we can run WP-CLI activation after core is ready.
docker-entrypoint.sh apache2-foreground &
child=$!

# Wait until WordPress core is installed (i.e., DB connection ready & WP files present)
echo "Waiting for WordPress to be ready..."
until wp core is-installed --path=/var/www/html --allow-root; do
  sleep 5
done

# --- FIX: Ensure plugins are readable by WordPress ---
echo "Fixing plugin folder permissions..."
chown -R www-data:www-data /var/www/html/wp-content/plugins
chmod -R 755 /var/www/html/wp-content/plugins

# Activate all plugins that exist in wp-content/plugins
echo "Activating all plugins..."
wp plugin activate --all --path=/var/www/html --allow-root || true

# Wait for the original entrypoint process (apache) to exit (forward its exit)
wait $child
