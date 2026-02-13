@echo off
echo.
echo   ══════════════════════════════════
echo     ARCANE STEEL — Local Server
echo     http://localhost:8080
echo     Press Ctrl+C to stop
echo   ══════════════════════════════════
echo.
cd /d "%~dp0"
python -m http.server 8080
