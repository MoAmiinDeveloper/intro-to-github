#!/usr/bin/env python3
"""
Document to Speech Converter
Converts PDF/DOCX documents to MP4 audio using university lecturer personas.
Uses Microsoft Edge neural voices (edge-tts) for natural-sounding speech.
Falls back to espeak-ng if network is unavailable.
"""

import argparse
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# ---------------------------------------------------------------------------
# Personas — Microsoft Edge neural voices with rate/pitch tuning
# rate: percentage relative to default e.g. "+10%" faster, "-5%" slower
# pitch: Hz offset e.g. "+5Hz" higher, "-10Hz" lower
# ---------------------------------------------------------------------------
PERSONAS = {
    "oxford": {
        "name": "Professor Smith (Oxford)",
        "description": "Formal British male, authoritative and measured",
        "voice": "en-GB-RyanNeural",
        "rate": "-8%",
        "pitch": "-5Hz",
    },
    "cambridge": {
        "name": "Professor Davies (Cambridge)",
        "description": "British female, precise and scholarly",
        "voice": "en-GB-SoniaNeural",
        "rate": "-12%",
        "pitch": "-3Hz",
    },
    "american": {
        "name": "Dr. Johnson (MIT)",
        "description": "American male, confident and clear",
        "voice": "en-US-GuyNeural",
        "rate": "+5%",
        "pitch": "+0Hz",
    },
    "american_female": {
        "name": "Dr. Chen (Stanford)",
        "description": "American female, warm and engaging",
        "voice": "en-US-JennyNeural",
        "rate": "+0%",
        "pitch": "+2Hz",
    },
    "australian": {
        "name": "Professor Walsh (Melbourne)",
        "description": "Australian male, relaxed and approachable",
        "voice": "en-AU-WilliamNeural",
        "rate": "-5%",
        "pitch": "-2Hz",
    },
    "australian_female": {
        "name": "Dr. Murray (Sydney)",
        "description": "Australian female, clear and enthusiastic",
        "voice": "en-AU-NatashaNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
    },
    "indian": {
        "name": "Professor Patel (IIT Delhi)",
        "description": "Indian female, articulate and thorough",
        "voice": "en-IN-NeerjaNeural",
        "rate": "-5%",
        "pitch": "+0Hz",
    },
    "irish": {
        "name": "Dr. O'Brien (Trinity College)",
        "description": "Irish male, warm and expressive",
        "voice": "en-IE-ConnorNeural",
        "rate": "-3%",
        "pitch": "+2Hz",
    },
}

# Fallback espeak voices (used only if edge-tts fails / no internet)
_ESPEAK_FALLBACK = {
    "oxford":            {"voice": "en-gb-x-rp",      "speed": 120, "pitch": 45, "gap": 15},
    "cambridge":         {"voice": "en-gb-x-rp",      "speed": 115, "pitch": 35, "gap": 18},
    "american":          {"voice": "en-us",            "speed": 145, "pitch": 58, "gap": 10},
    "american_female":   {"voice": "en-us",            "speed": 140, "pitch": 62, "gap": 10},
    "australian":        {"voice": "en-gb",            "speed": 130, "pitch": 50, "gap": 12},
    "australian_female": {"voice": "en-gb",            "speed": 135, "pitch": 58, "gap": 11},
    "indian":            {"voice": "en-gb",            "speed": 128, "pitch": 55, "gap": 11},
    "irish":             {"voice": "en-gb-scotland",   "speed": 130, "pitch": 52, "gap": 12},
}


# ---------------------------------------------------------------------------
# Tool discovery
# ---------------------------------------------------------------------------

def _find_ffmpeg_candidates() -> list:
    candidates = [
        "ffmpeg",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
    ]
    try:
        users_dir = Path("C:\\Users")
        for user_dir in users_dir.iterdir():
            winget_base = user_dir / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
            for exe in winget_base.glob("Gyan.FFmpeg*\\ffmpeg*\\bin\\ffmpeg.exe"):
                candidates.append(str(exe))
            scoop_exe = user_dir / "scoop" / "apps" / "ffmpeg" / "current" / "bin" / "ffmpeg.exe"
            if scoop_exe.exists():
                candidates.append(str(scoop_exe))
    except Exception:
        pass
    return candidates


_ESPEAK_CANDIDATES = [
    "espeak-ng",
    r"C:\Program Files\eSpeak NG\espeak-ng.exe",
    r"C:\Program Files (x86)\eSpeak NG\espeak-ng.exe",
]
_FFMPEG_CANDIDATES = _find_ffmpeg_candidates()

FFMPEG = None


def _find_tool(candidates: list, name: str) -> str:
    for c in candidates:
        if shutil.which(c) or (os.path.isabs(c) and os.path.isfile(c)):
            return c
    print(
        f"\n[ERROR] '{name}' not found.\n"
        + ("  Install from: https://github.com/espeak-ng/espeak-ng/releases\n"
           "  Then open a NEW terminal.\n"
           if name == "espeak-ng" else
           "  Run:  winget install Gyan.FFmpeg\n"
           "  Then open a NEW terminal.\n"),
        file=sys.stderr,
    )
    sys.exit(1)


def _get_ffmpeg() -> str:
    global FFMPEG
    if FFMPEG is None:
        FFMPEG = _find_tool(_FFMPEG_CANDIDATES, "ffmpeg")
    return FFMPEG


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(path: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text() for page in pdf.pages]
            return "\n\n".join(p.strip() for p in pages if p)
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


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    import re
    text = re.sub(r'\s+', ' ', text)
    # Keep printable ASCII + common unicode punctuation
    text = re.sub(r'[^\x20-\x7E‘’“”–—]', ' ', text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 4000) -> list:
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, current, current_len = [], [], 0
    for sentence in sentences:
        if current_len + len(sentence) > chunk_size and current:
            chunks.append(" ".join(current))
            current, current_len = [sentence], len(sentence)
        else:
            current.append(sentence)
            current_len += len(sentence)
    if current:
        chunks.append(" ".join(current))
    return chunks


# ---------------------------------------------------------------------------
# TTS: edge-tts (neural) — primary
# ---------------------------------------------------------------------------

async def _edge_tts_chunk(text: str, voice: str, rate: str, pitch: str, out_mp3: str):
    import edge_tts
    tts = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await tts.save(out_mp3)


async def _synthesize_edge(text: str, persona: dict, output_wav: str) -> bool:
    chunks = chunk_text(clean_text(text))
    ffmpeg = _get_ffmpeg()

    with tempfile.TemporaryDirectory() as tmpdir:
        mp3_parts = []
        total = len(chunks)
        for i, chunk in enumerate(chunks, 1):
            print(f"\r  Chunk {i}/{total}...", end="", flush=True)
            part_mp3 = os.path.join(tmpdir, f"part_{i:04d}.mp3")
            await _edge_tts_chunk(chunk, persona["voice"], persona["rate"], persona["pitch"], part_mp3)
            mp3_parts.append(part_mp3)
        print()  # newline after progress

        if len(mp3_parts) == 1:
            # Convert single mp3 to wav
            cmd = [ffmpeg, "-i", mp3_parts[0], output_wav, "-y", "-loglevel", "error"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0

        # Concatenate all mp3s then convert to wav
        list_file = os.path.join(tmpdir, "parts.txt")
        concat_mp3 = os.path.join(tmpdir, "concat.mp3")
        with open(list_file, "w") as f:
            for p in mp3_parts:
                f.write(f"file '{p}'\n")
        cmd = [ffmpeg, "-f", "concat", "-safe", "0", "-i", list_file,
               "-c", "copy", concat_mp3, "-y", "-loglevel", "error"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"\nffmpeg concat error: {result.stderr}", file=sys.stderr)
            return False

        cmd = [ffmpeg, "-i", concat_mp3, output_wav, "-y", "-loglevel", "error"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"\nffmpeg convert error: {result.stderr}", file=sys.stderr)
            return False

    return True


# ---------------------------------------------------------------------------
# TTS: espeak-ng — offline fallback
# ---------------------------------------------------------------------------

def _synthesize_espeak(text: str, persona_key: str, output_wav: str) -> bool:
    espeak = _find_tool(_ESPEAK_CANDIDATES, "espeak-ng")
    ffmpeg = _get_ffmpeg()
    fb = _ESPEAK_FALLBACK.get(persona_key, _ESPEAK_FALLBACK["oxford"])
    chunks = chunk_text(clean_text(text))

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_parts = []
        for i, chunk in enumerate(chunks):
            part_wav = os.path.join(tmpdir, f"part_{i:04d}.wav")
            cmd = [espeak, "-v", fb["voice"], "-s", str(fb["speed"]),
                   "-p", str(fb["pitch"]), "-g", str(fb["gap"]), chunk, "-w", part_wav]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"espeak-ng error: {result.stderr}", file=sys.stderr)
                return False
            wav_parts.append(part_wav)

        if len(wav_parts) == 1:
            shutil.copy(wav_parts[0], output_wav)
        else:
            list_file = os.path.join(tmpdir, "parts.txt")
            with open(list_file, "w") as f:
                for p in wav_parts:
                    f.write(f"file '{p}'\n")
            cmd = [ffmpeg, "-f", "concat", "-safe", "0", "-i", list_file,
                   "-c", "copy", output_wav, "-y", "-loglevel", "error"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"ffmpeg concat error: {result.stderr}", file=sys.stderr)
                return False
    return True


# ---------------------------------------------------------------------------
# MP4 encoding
# ---------------------------------------------------------------------------

def wav_to_mp4(wav_path: str, mp4_path: str, title: str = "", persona_name: str = "") -> bool:
    ffmpeg = _get_ffmpeg()
    cmd = [ffmpeg, "-i", wav_path, "-c:a", "aac", "-b:a", "128k"]
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


# ---------------------------------------------------------------------------
# Main conversion flow
# ---------------------------------------------------------------------------

def list_personas():
    print("\nAvailable lecturer personas:\n")
    print(f"  {'Key':<20} {'Name':<38} {'Voice':<25} Description")
    print("  " + "-" * 100)
    for key, p in PERSONAS.items():
        print(f"  {key:<20} {p['name']:<38} {p['voice']:<25} {p['description']}")
    print()


def convert(input_path: str, output_path: str, persona_key: str, verbose: bool = False, force_espeak: bool = False):
    if persona_key not in PERSONAS:
        print(f"Unknown persona '{persona_key}'. Use --list to see available personas.")
        sys.exit(1)

    persona = PERSONAS[persona_key]
    doc_title = Path(input_path).stem

    if verbose:
        print(f"Persona   : {persona['name']} ({persona['voice']})")
        print(f"Document  : {input_path}")
        print(f"Output    : {output_path}")

    print("Extracting text...", end=" ", flush=True)
    text = extract_text(input_path)
    word_count = len(text.split())
    print(f"done ({word_count:,} words)")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = tmp.name

    try:
        print("Synthesizing speech (neural voice)...")
        ok = False

        if not force_espeak:
            try:
                import edge_tts  # noqa: F401
                ok = asyncio.run(_synthesize_edge(text, persona, tmp_wav))
            except ImportError:
                print("  edge-tts not installed, run: pip install edge-tts")
            except Exception as e:
                print(f"  Neural voice failed ({e}), falling back to offline voice...")

        if not ok:
            print("  Using offline fallback voice (install edge-tts for better quality)...")
            ok = _synthesize_espeak(text, persona_key, tmp_wav)

        if not ok:
            sys.exit(1)
        print("done")

        print("Encoding to MP4...", end=" ", flush=True)
        ok = wav_to_mp4(tmp_wav, output_path, title=doc_title, persona_name=persona["name"])
        if not ok:
            sys.exit(1)
        print("done")

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"\nOutput saved: {output_path} ({size_mb:.1f} MB)")
    finally:
        if os.path.exists(tmp_wav):
            os.unlink(tmp_wav)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

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
    parser.add_argument("--persona", default="oxford", metavar="NAME",
                        help="Lecturer persona (default: oxford). Use --list to see all.")
    parser.add_argument("--list", action="store_true", help="List available personas and exit")
    parser.add_argument("--offline", action="store_true",
                        help="Force offline espeak-ng voice (skip neural TTS)")
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
    convert(args.input, output, args.persona, verbose=args.verbose, force_espeak=args.offline)


if __name__ == "__main__":
    main()
