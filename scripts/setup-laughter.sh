#!/bin/sh
# Optional: local laughter detection for the live buffer (YAMNet via LiteRT, both Apache-2.0).
set -eu
cd "$(dirname "$0")/.."
python3 -m pip install --upgrade --target .runtime/laughter "ai-edge-litert==2.3.0" "numpy>=2"
mkdir -p .runtime/models
curl -fL -o .runtime/models/yamnet.tflite.download https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite
echo "4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf  .runtime/models/yamnet.tflite.download" | shasum -a 256 -c -
mv .runtime/models/yamnet.tflite.download .runtime/models/yamnet.tflite
echo 'Laughter detection installed.'
