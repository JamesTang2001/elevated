# Elevated — live on your Mac

1. Open `keys.env` in TextEdit, paste your CTA Train Tracker key after `CTA_TRAIN_KEY=`, and save.
2. Double-click `start.command`. Terminal opens and the map opens at http://localhost:8787.
   - The first time, macOS may say it can't verify the developer: right-click `start.command` → Open → Open.
3. To stop, close the Terminal window (or press Control-C in it).

What runs live: L train positions every 15 s (real run numbers, delays, ghost trains), ComEd's 5-minute
electricity price, live buses if you add a Bus Tracker key (refreshed every 2 minutes to stay under CTA's
daily limit), and a delay history saved in `history/` (one sample a minute, last 30 days shown).

Your keys stay in `keys.env` on this computer. The server only listens on this computer (127.0.0.1) and
never sends `keys.env` to the page.
