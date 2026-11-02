#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 -m pip install --upgrade --target .runtime -r requirements-import.txt
mkdir -p .runtime/bin
# Burned-in captions need FFmpeg's libass ("ass" filter). Homebrew's plain ffmpeg no longer
# ships it; its keg-only ffmpeg-full does, so prefer that when present.
FULL=""
for candidate in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg /usr/local/opt/ffmpeg-full/bin/ffmpeg; do [ -x "$candidate" ] && FULL="$candidate" && break; done
if [ -n "$FULL" ]; then
  ln -sf "$FULL" .runtime/bin/ffmpeg
elif command -v ffmpeg >/dev/null 2>&1; then
  ln -sf "$(command -v ffmpeg)" .runtime/bin/ffmpeg
  if ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' ass '; then echo 'Warning: this FFmpeg cannot burn in captions (no libass). On macOS run: brew install ffmpeg-full, then npm run setup:imports again.'; fi
else
  echo 'Install FFmpeg using its official installation guidance, or set FFMPEG_PATH to an existing executable.'
fi
