#!/usr/bin/env python3
"""
Document to Speech Converter
Converts PDF/DOCX documents to MP4 audio using university lecturer personas.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


PERSONAS = {
    "oxford": {
        "name": "Professor Smith (Oxford)",
        "description": "Formal British academic, authoritative and measured",
        "voice": "en-gb-x-rp",
        "speed": 120,
        "pitch": 45,
        "gap": 15,
    },
    "american": {
        "name": "Dr. Johnson (MIT)",
        "description": "Energetic American professor, enthusiastic and clear",
        "voice": "en-us",
        "speed": 145,
        "pitch": 58,
        "gap": 10,
    },
    "scottish": {
        "name": "Professor MacGregor (Edinburgh)",
        "description": "Scottish academic, warm and deliberate",
        "voice": "en-gb-scotland",
        "speed": 125,
        "pitch": 40,
        "gap": 12,
    },
    "lancaster": {
        "name": "Dr. Clarke (Lancaster)",
        "description": "Northern English lecturer, approachable and thorough",
        "voice": "en-gb-x-gbclan",
        "speed": 130,
        "pitch": 52,
        "gap": 11,
    },
    "received": {
        "name": "Professor Davies (Cambridge)",
        "description": "Classic Received Pronunciation, precise and scholarly",
        "voice": "en-gb-x-rp",
        "speed": 115,
        "pitch": 35,
        "gap": 18,
    },
    "newyork": {
        "name": "Dr. Rivera (Columbia)",
        "description": "New York academic, direct and engaging",
        "voice": "en-us-nyc",
        "speed": 150,
        "pitch": 55,
        "gap": 9,
    },
    "caribbean": {
        "name": "Professor Williams (UWI)",
        "description": "Caribbean academic, rhythmic and expressive",
        "voice": "en-029",
        "speed": 135,
        "pitch": 60,
        "gap": 10,
    },
    "westmidlands": {
        "name": "Dr. Patel (Birmingham)",
        "description": "West Midlands lecturer, conversational and patient",
        "voice": "en-gb-x-gbcwmd",
        "speed": 128,
        "pitch": 50,
        "gap": 12,
    },
}


def extract_text_from_pdf(path: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text.strip())
            return "\n\n".join(pages)
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        sys.exit(1)


def extract_text_from_docx(path: str) -> str:
    try:
        from docx import Document
        doc = Document(path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception as e:
        print(f"Error reading DOCX: {e}", file=sys.stderr)
        sys.exit(1)


def extract_text(path: str) -> str:
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext in (".docx", ".doc"):
        return extract_text_from_docx(path)
    elif ext == ".txt":
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        print(f"Unsupported file type: {ext}. Supported: pdf, docx, txt", file=sys.stderr)
        sys.exit(1)


def clean_text(text: str) -> str:
    """Remove characters that cause issues with espeak."""
    import re
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove non-printable chars except newlines
    text = re.sub(r'[^\x20-\x7E\n]', ' ', text)
    # Limit length (espeak can handle ~10k chars at once)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 5000) -> list[str]:
    """Split text into chunks at sentence boundaries."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = []
    current_len = 0
    for sentence in sentences:
        if current_len + len(sentence) > chunk_size and current:
            chunks.append(" ".join(current))
            current = [sentence]
            current_len = len(sentence)
        else:
            current.append(sentence)
            current_len += len(sentence)
    if current:
        chunks.append(" ".join(current))
    return chunks


def text_to_wav(text: str, persona: dict, output_wav: str) -> bool:
    """Convert text to WAV using espeak-ng with persona settings."""
    chunks = chunk_text(clean_text(text))
    wav_parts = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, chunk in enumerate(chunks):
            part_wav = os.path.join(tmpdir, f"part_{i:04d}.wav")
            cmd = [
                "espeak-ng",
                "-v", persona["voice"],
                "-s", str(persona["speed"]),
                "-p", str(persona["pitch"]),
                "-g", str(persona["gap"]),
                chunk,
                "-w", part_wav,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"espeak-ng error: {result.stderr}", file=sys.stderr)
                return False
            wav_parts.append(part_wav)

        if len(wav_parts) == 1:
            import shutil
            shutil.copy(wav_parts[0], output_wav)
        else:
            # Concatenate WAV files using ffmpeg
            list_file = os.path.join(tmpdir, "parts.txt")
            with open(list_file, "w") as f:
                for p in wav_parts:
                    f.write(f"file '{p}'\n")
            cmd = ["ffmpeg", "-f", "concat", "-safe", "0", "-i", list_file,
                   "-c", "copy", output_wav, "-y", "-loglevel", "error"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"ffmpeg concat error: {result.stderr}", file=sys.stderr)
                return False

    return True


def wav_to_mp4(wav_path: str, mp4_path: str, title: str = "", persona_name: str = "") -> bool:
    """Convert WAV to MP4 (audio-only) with AAC encoding."""
    cmd = [
        "ffmpeg", "-i", wav_path,
        "-c:a", "aac", "-b:a", "128k",
    ]
    if title:
        cmd += ["-metadata", f"title={title}"]
    if persona_name:
        cmd += ["-metadata", f"artist={persona_name}"]
    cmd += [mp4_path, "-y", "-loglevel", "error"]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ffmpeg encode error: {result.stderr}", file=sys.stderr)
        return False
    return True


def list_personas():
    print("\nAvailable lecturer personas:\n")
    print(f"  {'Key':<15} {'Name':<35} Description")
    print("  " + "-" * 75)
    for key, p in PERSONAS.items():
        print(f"  {key:<15} {p['name']:<35} {p['description']}")
    print()


def convert(input_path: str, output_path: str, persona_key: str, verbose: bool = False):
    if persona_key not in PERSONAS:
        print(f"Unknown persona '{persona_key}'. Use --list to see available personas.")
        sys.exit(1)

    persona = PERSONAS[persona_key]
    doc_title = Path(input_path).stem

    if verbose:
        print(f"Persona   : {persona['name']}")
        print(f"Document  : {input_path}")
        print(f"Output    : {output_path}")

    print("Extracting text...", end=" ", flush=True)
    text = extract_text(input_path)
    word_count = len(text.split())
    print(f"done ({word_count:,} words)")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = tmp.name

    try:
        print("Synthesizing speech...", end=" ", flush=True)
        ok = text_to_wav(text, persona, tmp_wav)
        if not ok:
            sys.exit(1)
        print("done")

        print("Encoding to MP4...", end=" ", flush=True)
        ok = wav_to_mp4(tmp_wav, output_path, title=doc_title, persona_name=persona["name"])
        if not ok:
            sys.exit(1)
        print("done")

        size_kb = os.path.getsize(output_path) / 1024
        print(f"\nOutput saved: {output_path} ({size_kb:.1f} KB)")
    finally:
        if os.path.exists(tmp_wav):
            os.unlink(tmp_wav)


def main():
    parser = argparse.ArgumentParser(
        description="Convert PDF/DOCX documents to speech (MP4) with university lecturer personas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tts_converter.py lecture.pdf -o lecture.mp4
  python tts_converter.py notes.docx -o notes.mp4 --persona oxford
  python tts_converter.py paper.pdf -o paper.mp4 --persona american -v
  python tts_converter.py --list
        """,
    )
    parser.add_argument("input", nargs="?", help="Input file (PDF, DOCX, or TXT)")
    parser.add_argument("-o", "--output", help="Output MP4 file path")
    parser.add_argument(
        "--persona",
        default="oxford",
        metavar="NAME",
        help="Lecturer persona to use (default: oxford). Use --list to see all.",
    )
    parser.add_argument("--list", action="store_true", help="List available personas and exit")
    parser.add_argument("-v", "--verbose", action="store_true", help="Show detailed output")

    args = parser.parse_args()

    if args.list:
        list_personas()
        return

    if not args.input:
        parser.print_help()
        sys.exit(1)

    if not os.path.exists(args.input):
        print(f"File not found: {args.input}")
        sys.exit(1)

    output = args.output or (Path(args.input).stem + f"_{args.persona}.mp4")
    convert(args.input, output, args.persona, verbose=args.verbose)


if __name__ == "__main__":
    main()
