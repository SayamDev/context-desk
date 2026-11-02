#!/bin/sh
# One-command setup: npm run setup
# Checks each requirement, installs what can be installed safely, and says exactly what to do for
# the rest. Safe to run again: finished steps are skipped. Nothing here reads or prints secrets.
set -u
cd "$(dirname "$0")/.."
ok(){ printf '  \033[32m✓\033[0m %s\n' "$1"; }
todo(){ printf '  \033[33m!\033[0m %s\n      %s\n' "$1" "$2"; MISSING=$((MISSING+1)); }
MISSING=0
echo "Context Desk setup"

# 1. Node.js 22.13 or newer runs the app.
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -ge 22 ]; then ok "Node.js $(node -v)"; else todo "Node.js 22.13 or newer is needed" "Install it from https://nodejs.org (LTS), then run npm run setup again."; fi

# 2. FFmpeg with subtitle burning (libass). Homebrew's ffmpeg-full includes it.
FULL=""
for candidate in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg /usr/local/opt/ffmpeg-full/bin/ffmpeg; do [ -x "$candidate" ] && FULL="$candidate" && break; done
if [ -z "$FULL" ] && command -v brew >/dev/null 2>&1; then
  echo "  … installing FFmpeg with subtitle support (brew install ffmpeg-full, a few minutes)"
  brew install ffmpeg-full >/dev/null 2>&1 && for candidate in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg /usr/local/opt/ffmpeg-full/bin/ffmpeg; do [ -x "$candidate" ] && FULL="$candidate" && break; done
fi
mkdir -p .runtime/bin
if [ -n "$FULL" ]; then ln -sf "$FULL" .runtime/bin/ffmpeg; ok "FFmpeg with subtitle burning"
elif command -v ffmpeg >/dev/null 2>&1; then ln -sf "$(command -v ffmpeg)" .runtime/bin/ffmpeg
  if ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' ass '; then ok "FFmpeg with subtitle burning"; else todo "FFmpeg is installed but cannot burn in captions" "On a Mac: install Homebrew (https://brew.sh), then run npm run setup again."; fi
else todo "FFmpeg is missing" "On a Mac: install Homebrew (https://brew.sh), then run npm run setup again. Elsewhere: install an FFmpeg build with libass."; fi

# 3. The video importer (yt-dlp) for YouTube, Twitch and Kick links, installed inside this folder.
if command -v python3 >/dev/null 2>&1; then
  if PYTHONPATH=.runtime python3 -c 'import yt_dlp' 2>/dev/null; then ok "Video link importer"
  else echo "  … installing the video link importer"; python3 -m pip install --quiet --upgrade --target .runtime -r requirements-import.txt >/dev/null 2>&1 && ok "Video link importer" || todo "The video link importer could not be installed" "Run: python3 -m pip install --target .runtime -r requirements-import.txt"; fi
else todo "Python 3 is missing (needed to import video links)" "Install Python 3 from https://www.python.org, then run npm run setup again. Uploading video files works without it."; fi

# 4. Apple Vision features (speaker framing, Find what's shown) need the Swift tools on a Mac.
if [ "$(uname)" = "Darwin" ]; then
  if /usr/bin/swift --version >/dev/null 2>&1; then ok "Apple Vision features"; else todo "Swift command-line tools are missing (speaker framing, Find what's shown)" "Run: xcode-select --install"; fi
fi

# 5. Settings file. The AI key is yours to add; this script never writes or prints it.
if [ ! -f .env ]; then cp .env.example .env; ok "Created .env from .env.example"; else ok ".env exists"; fi
if grep -Eq '^MODEL_API_KEY=.+' .env; then ok "AI key is set"; else todo "No AI key yet (needed for speech, translation and clip finding)" "Open .env and set MODEL_API_KEY= to your Meta model API key."; fi

echo
if [ "$MISSING" -eq 0 ]; then echo "All set. Start it with: npm run dev   then open http://localhost:3001"
else echo "$MISSING item(s) above need attention. The app's Setup check panel shows the same list."; fi
echo "Optional: laughter detection for live streams: npm run setup:laughter"
