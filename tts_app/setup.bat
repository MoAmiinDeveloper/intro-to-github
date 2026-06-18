@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo  Document to Speech Converter - Windows Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Download it from https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo [OK] Python found.

:: Check pip
pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip not found. Try reinstalling Python.
    pause
    exit /b 1
)
echo [OK] pip found.

:: Install Python dependencies
echo.
echo Installing Python packages...
pip install pdfplumber python-docx pydub
if errorlevel 1 (
    echo [ERROR] Failed to install Python packages.
    pause
    exit /b 1
)
echo [OK] Python packages installed.

:: Check for espeak-ng
echo.
espeak-ng --version >nul 2>&1
if errorlevel 1 (
    echo [MISSING] espeak-ng not found.
    echo.
    echo  Download and install from:
    echo  https://github.com/espeak-ng/espeak-ng/releases
    echo.
    echo  Choose the latest .msi installer, e.g.:
    echo    espeak-ng-X.XX-x64.msi
    echo.
    echo  After installing, re-run this setup.bat
    echo.
    set MISSING=1
) else (
    echo [OK] espeak-ng found.
)

:: Check for ffmpeg
echo.
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo [MISSING] ffmpeg not found.
    echo.
    echo  Option A - winget (Windows 10/11^):
    echo    winget install Gyan.FFmpeg
    echo.
    echo  Option B - Manual:
    echo    1. Download from https://www.gyan.dev/ffmpeg/builds/
    echo    2. Extract the zip
    echo    3. Add the bin\ folder to your PATH environment variable
    echo.
    echo  After installing, re-run this setup.bat
    echo.
    set MISSING=1
) else (
    echo [OK] ffmpeg found.
)

echo.
if defined MISSING (
    echo [!] Some dependencies are missing. See instructions above.
    echo     After installing them, run setup.bat again to verify.
) else (
    echo ============================================
    echo  Setup complete! Try it out:
    echo.
    echo    python tts_app\tts_converter.py --list
    echo    python tts_app\tts_converter.py doc.pdf -o out.mp4
    echo    python tts_app\tts_converter.py doc.pdf -o out.mp4 --persona american
    echo ============================================
)

echo.
pause
