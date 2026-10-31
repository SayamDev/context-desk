#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 -m pip install --upgrade --target .runtime -r requirements-import.txt
mkdir -p .runtime/bin
if command -v ffmpeg >/dev/null 2>&1; then
  ln -sf "$(command -v ffmpeg)" .runtime/bin/ffmpeg
else
  echo 'Install FFmpeg using its official installation guidance, or set FFMPEG_PATH to an existing executable.'
fi
