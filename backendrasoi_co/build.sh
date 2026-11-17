#!/usr/bin/env bash
# Render build script for the Rasoi & Co. backend (project: appliances, app: kitchen)
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput

# Optional: create the admin user automatically (Render free plan has no Shell).
# Set DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD in Render.
if [[ -n "$DJANGO_SUPERUSER_USERNAME" ]]; then
  python manage.py createsuperuser --noinput || echo "Superuser already exists — skipping."
fi

# Optional: load sample content once. Set SEED_DATA=True in Render, deploy, then remove it.
if [[ "$SEED_DATA" == "True" ]]; then
  python manage.py seed_data
fi
