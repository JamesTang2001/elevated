#!/bin/bash
# Double-click this file to start Elevated, then open http://localhost:8787 in your browser.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  (sleep 1.5; open "http://localhost:8787") &
  python3 server.py
else
  echo "Python 3 isn't installed. Install it from https://www.python.org/downloads/ and double-click this file again."
  read -n 1 -s -r -p "Press any key to close."
fi
