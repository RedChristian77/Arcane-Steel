#!/bin/bash
# Arcane Steel — Local Development Server
# Run this script, then open http://localhost:8080 in your browser.

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║   ARCANE STEEL — Local Server    ║"
echo "  ║   http://localhost:8080          ║"
echo "  ║   Press Ctrl+C to stop           ║"
echo "  ╚══════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8080
