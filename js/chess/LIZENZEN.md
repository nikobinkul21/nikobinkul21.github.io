# Schach: fremde Bestandteile und ihre Lizenzen

Das Schachspiel (`#games/chess`) nutzt drei fremde Bestandteile. Alle liegen
lokal im Projekt; es wird nichts von anderen Servern geladen.

| Bestandteil | Zweck | Version | Lizenz | Lizenztext |
|---|---|---|---|---|
| chess.js | Schachregeln, Zuggenerator, PGN | 1.4.0 | BSD-2-Clause | `vendor/chess.LICENSE.txt` |
| Stockfish.js | Engine (Bot und Analyse), WebAssembly | 19.0.1 (Stockfish 19) | GPL-3.0 | `vendor/stockfish/COPYING.txt` |
| Figurensatz „Standard“ | Bilder der Schachfiguren | aus cm-chessboard 8.15.4 | CC BY-SA 3.0 | `figuren/LIZENZ.md` |

## chess.js

- Quelle: https://github.com/jhlywa/chess.js (npm-Paket `chess.js`, Datei `dist/cjs/chess.js`)
- Copyright (c) Jeff Hlywa
- Datei im Projekt: `vendor/chess.js`. Unverändert bis auf eine Hülle am Anfang
  und Ende, damit die Datei ohne Build-Schritt als `<script>` läuft (im
  Kopfkommentar der Datei beschrieben).

## Stockfish.js (GPL-3.0)

- Quelle des Pakets: https://github.com/nmrugg/stockfish.js (npm-Paket `stockfish`,
  Dateien `bin/stockfish-19-lite-single.js` und `.wasm`), unverändert übernommen.
- Stockfish selbst: https://github.com/official-stockfish/Stockfish
- Der vollständige Quelltext zu den beiden Dateien steht in den genannten
  Repositories (Stockfish.js, Version 19.0.1).
- Stockfish steht unter der GNU General Public License Version 3. Der Text
  liegt in `vendor/stockfish/COPYING.txt`.
- Die Engine läuft als eigenes Programm in einem Web Worker; die Seite spricht
  mit ihr nur über Textzeilen (UCI-Protokoll, `engine.js`).

## Figuren (CC BY-SA 3.0)

Siehe `figuren/LIZENZ.md`.

## Eigenes

Brett, Claudy (Figur und Texte), Bot-Abschwächung, Mustererkennung und alle
übrigen Dateien in `js/chess/` sowie `css/chess.css` gehören zu diesem Projekt.
