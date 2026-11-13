#!/usr/bin/env bash
# Builds the brand site. With BRAND_PASSWORD set, it also decrypts the team-only files in protected/
# (the FK Display fonts), builds them into the Typography page, and encrypts every page with that
# password. Without it, the site builds public and the team-only files are left out.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${BRAND_OUT:-./dist}"
rm -rf src/assets/protected
if [ -n "${BRAND_PASSWORD:-}" ]; then
  mkdir -p src/assets/protected
  for f in protected/*.enc; do
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$f" -out "src/assets/protected/$(basename "$f" .enc)" -pass env:BRAND_PASSWORD
  done
fi
npx astro build
rm -rf src/assets/protected
if [ -n "${BRAND_PASSWORD:-}" ]; then
  # staticrypt writes <tmp>/<name of the input folder>; encrypt there, then swap it in.
  TMP="$(mktemp -d)"
  STATICRYPT_PASSWORD="$BRAND_PASSWORD" npx staticrypt "$OUT" -r -d "$TMP" --short --remember 30 -c .staticrypt.json \
    -t scripts/password_template.html \
    --template-title "hzero brand guidelines" \
    --template-instructions "For the hzero team. Enter the password to continue." \
    --template-button "Open" \
    --template-placeholder "Password" \
    --template-error "That password is not right." \
    --template-remember "Remember me for 30 days" \
    --template-color-primary "#2ECCD4" \
    --template-color-secondary "#091314" < /dev/null
  rm -rf "$OUT"
  mv "$TMP/$(basename "$OUT")" "$OUT"
  rm -rf "$TMP"
  if grep -q "data:font/woff2" "$OUT/typography/index.html"; then echo "Encryption failed: font visible in plain HTML" >&2; exit 1; fi
  echo "Brand site encrypted."
else
  echo "BRAND_PASSWORD not set: brand site built without protection and without team-only files."
fi
