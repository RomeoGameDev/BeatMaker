#!/bin/sh
set -e

SAMPLES_DIR="${SAMPLES_DIR:-/app/public/samples}"
DEFAULT_SAMPLES_DIR="${DEFAULT_SAMPLES_DIR:-/app/default-samples}"

seed_sample_folder() {
  folder="$1"
  target="$SAMPLES_DIR/$folder"
  source="$DEFAULT_SAMPLES_DIR/$folder"

  mkdir -p "$target"

  # A mounted directory hides image content, so seed it only when truly empty.
  if [ -z "$(find "$target" -mindepth 1 -maxdepth 1 ! -name .gitkeep -print -quit)" ]; then
    if [ -d "$source" ] && [ -n "$(find "$source" -mindepth 1 -maxdepth 1 ! -name .gitkeep -print -quit)" ]; then
      # Alpine's cp supports -n; it also protects against a file appearing mid-copy.
      cp -R -n "$source"/. "$target"/
    fi
  fi
}

seed_sample_folder oneshots
seed_sample_folder loops

exec "$@"
