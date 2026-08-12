#!/bin/sh
set -e

SAMPLES_DIR="${SAMPLES_DIR:-/app/public/samples}"
DEFAULT_SAMPLES_DIR="${DEFAULT_SAMPLES_DIR:-/app/default-samples}"

seed_sample_folder() {
  folder="$1"
  label="$2"
  target="$SAMPLES_DIR/$folder"
  source="$DEFAULT_SAMPLES_DIR/$folder"

  mkdir -p "$target"

  echo "Seeding missing default $label samples..."

  # Seed each missing file rather than requiring the entire category to be empty.
  # find passes paths as arguments so filenames with spaces remain intact. cp -n
  # protects a file that might appear between the existence check and the copy.
  if [ -d "$source" ]; then
    find "$source" -type f ! -name .gitkeep -exec sh -c '
      source_root="$1"
      target_root="$2"
      shift 2

      for source_file do
        relative_path=${source_file#"$source_root"/}
        target_file="$target_root/$relative_path"

        if [ ! -e "$target_file" ]; then
          mkdir -p "$(dirname "$target_file")"
          cp -n "$source_file" "$target_file"
        fi
      done
    ' sh "$source" "$target" {} +
  fi
}

seed_sample_folder oneshots "one-shot"
seed_sample_folder loops "loop"

echo "Default sample seeding complete."

exec "$@"
