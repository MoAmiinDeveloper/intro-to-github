# Document to Speech Converter - PowerShell Setup
# Run with: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Document to Speech Converter - Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$missing = @()

# Check Python
try {
    $pyver = python --version 2>&1
    Write-Host "[OK] $pyver" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found." -ForegroundColor Red
    Write-Host "        Download: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "        Check 'Add Python to PATH' during install." -ForegroundColor Yellow
    $missing += "python"
}

# Install Python packages
if (-not $missing.Contains("python")) {
    Write-Host ""
    Write-Host "Installing Python packages..." -ForegroundColor Cyan
    pip install pdfplumber python-docx pydub
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] pip install failed." -ForegroundColor Red
    } else {
        Write-Host "[OK] Python packages installed." -ForegroundColor Green
    }
}

# Check espeak-ng
Write-Host ""
try {
    espeak-ng --version 2>&1 | Out-Null
    Write-Host "[OK] espeak-ng found." -ForegroundColor Green
} catch {
    Write-Host "[MISSING] espeak-ng not found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Download the .msi installer from:" -ForegroundColor Cyan
    Write-Host "  https://github.com/espeak-ng/espeak-ng/releases" -ForegroundColor White
    Write-Host "  (Choose espeak-ng-X.XX-x64.msi)" -ForegroundColor White
    $missing += "espeak-ng"
}

# Check ffmpeg
Write-Host ""
$ffmpegOk = $false
try {
    ffmpeg -version 2>&1 | Select-Object -First 1 | Write-Host -ForegroundColor Green
    $ffmpegOk = $true
    Write-Host "[OK] ffmpeg found." -ForegroundColor Green
} catch {
    Write-Host "[MISSING] ffmpeg not found." -ForegroundColor Yellow
}

if (-not $ffmpegOk) {
    # Try installing via winget
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "  Attempting install via winget..." -ForegroundColor Cyan
        winget install Gyan.FFmpeg
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] ffmpeg installed via winget." -ForegroundColor Green
            Write-Host "     Restart your terminal for PATH to update." -ForegroundColor Yellow
        } else {
            Write-Host "[ERROR] winget install failed." -ForegroundColor Red
            $missing += "ffmpeg"
        }
    } else {
        Write-Host ""
        Write-Host "  Manual install options:" -ForegroundColor Cyan
        Write-Host "    winget install Gyan.FFmpeg" -ForegroundColor White
        Write-Host "    or download from https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor White
        $missing += "ffmpeg"
    }
}

Write-Host ""
if ($missing.Count -gt 0) {
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host " Missing: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host " Install them, then re-run this script." -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
} else {
    Write-Host "============================================" -ForegroundColor Green
    Write-Host " All done! Usage examples:" -ForegroundColor Green
    Write-Host ""
    Write-Host "   python tts_app\tts_converter.py --list"
    Write-Host "   python tts_app\tts_converter.py lecture.pdf -o out.mp4"
    Write-Host "   python tts_app\tts_converter.py notes.docx -o out.mp4 --persona american"
    Write-Host "============================================" -ForegroundColor Green
}
