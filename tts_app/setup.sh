#!/bin/bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y espeak-ng ffmpeg

# Install Python dependencies
pip install -r requirements.txt

echo ""
echo "Setup complete. Run:"
echo "  python tts_converter.py --list               # show all personas"
echo "  python tts_converter.py doc.pdf -o out.mp4   # convert with default persona"
