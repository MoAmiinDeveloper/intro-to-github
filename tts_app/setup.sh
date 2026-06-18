#!/bin/bash
# Linux/macOS setup script
# For Windows, use setup.bat or setup.ps1 instead.

set -e

echo "Installing system dependencies..."
if command -v apt-get &>/dev/null; then
    sudo apt-get install -y espeak-ng ffmpeg
elif command -v brew &>/dev/null; then
    brew install espeak ffmpeg
else
    echo "Please install espeak-ng and ffmpeg manually for your OS."
    exit 1
fi

echo "Installing Python packages..."
pip install -r requirements.txt

echo ""
echo "Setup complete. Run:"
echo "  python tts_converter.py --list"
echo "  python tts_converter.py doc.pdf -o out.mp4"
echo "  python tts_converter.py notes.docx -o out.mp4 --persona american"
