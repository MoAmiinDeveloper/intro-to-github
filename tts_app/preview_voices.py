#!/usr/bin/env python3
"""
Generate a short audio preview for every lecturer persona.
Run this first to hear all voices, then pick your favourite.
"""

import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Reuse helpers from tts_converter
sys.path.insert(0, str(Path(__file__).parent))
from tts_converter import PERSONAS, _find_ffmpeg_candidates, _find_tool, _ESPEAK_CANDIDATES

FFMPEG_CANDIDATES = _find_ffmpeg_candidates()

SAMPLE_TEXT = (
    "Hello, and welcome to today's lecture. "
    "My name is {name}. "
    "Today we will explore the fascinating world of data types and variables in programming. "
    "A variable is simply a named location in memory that stores a value. "
    "Let us begin."
)


async def _preview_edge(persona_key: str, persona: dict, out_mp3: str) -> bool:
    try:
        import edge_tts
        text = SAMPLE_TEXT.format(name=persona["name"])
        tts = edge_tts.Communicate(text, persona["voice"], rate=persona["rate"], pitch=persona["pitch"])
        await tts.save(out_mp3)
        return True
    except Exception as e:
        print(f"  (neural voice failed: {e})")
        return False


def _preview_espeak(persona_key: str, out_wav: str) -> bool:
    from tts_converter import _ESPEAK_FALLBACK
    try:
        espeak = _find_tool(_ESPEAK_CANDIDATES, "espeak-ng")
    except SystemExit:
        return False
    fb = _ESPEAK_FALLBACK.get(persona_key, _ESPEAK_FALLBACK["oxford"])
    persona = PERSONAS[persona_key]
    text = SAMPLE_TEXT.format(name=persona["name"])
    cmd = [espeak, "-v", fb["voice"], "-s", str(fb["speed"]),
           "-p", str(fb["pitch"]), "-g", str(fb["gap"]), text, "-w", out_wav]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


async def generate_previews(output_dir: str = "voice_previews"):
    os.makedirs(output_dir, exist_ok=True)
    ffmpeg = _find_tool(FFMPEG_CANDIDATES, "ffmpeg")

    print(f"\nGenerating voice previews into: {output_dir}\\\n")
    print(f"  {'Persona':<22} {'Voice':<25} Status")
    print("  " + "-" * 65)

    for key, persona in PERSONAS.items():
        mp4_out = os.path.join(output_dir, f"{key}.mp4")
        tmp_mp3 = os.path.join(output_dir, f"_{key}.mp3")
        tmp_wav = os.path.join(output_dir, f"_{key}.wav")

        ok = await _preview_edge(key, persona, tmp_mp3)

        if ok and os.path.exists(tmp_mp3):
            # mp3 → mp4
            cmd = [ffmpeg, "-i", tmp_mp3, "-c:a", "aac", "-b:a", "128k",
                   "-metadata", f"title={persona['name']}",
                   mp4_out, "-y", "-loglevel", "error"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                ok = False
            os.remove(tmp_mp3)

        if not ok:
            # fallback to espeak
            ok = _preview_espeak(key, tmp_wav)
            if ok:
                cmd = [ffmpeg, "-i", tmp_wav, "-c:a", "aac", "-b:a", "128k",
                       mp4_out, "-y", "-loglevel", "error"]
                result = subprocess.run(cmd, capture_output=True, text=True)
                ok = result.returncode == 0
            if os.path.exists(tmp_wav):
                os.remove(tmp_wav)

        status = f"OK  → {mp4_out}" if ok else "FAILED"
        print(f"  {key:<22} {persona['voice']:<25} {status}")

    print(f"\nDone! Open the '{output_dir}' folder and listen to each file.")
    print("Then convert your document with your chosen persona:\n")
    print("  python tts_app\\tts_converter.py doc.pdf -o out.mp4 --persona oxford")
    print("  python tts_app\\tts_converter.py doc.pdf -o out.mp4 --persona american")
    print("  (etc.)\n")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "voice_previews"
    asyncio.run(generate_previews(out))
