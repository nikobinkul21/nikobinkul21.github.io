/* ==========================================================================
   chess/konfig.js – alle Stellschrauben des Schachspiels (#games/chess)
   Hier steht alles, was man ohne Blick in den übrigen Code ändern kann:
   Spielstärken des Bots, Denkzeiten, Schwellen der Zugbewertung, die
   Hilfestufen von Claudy, die Elo-Bereiche der Statistik.

   Die Dateien des Spiels (in dieser Reihenfolge eingebunden):
     vendor/chess.js   Schachregeln (chess.js, BSD-2-Clause)
     konfig.js         diese Datei
     muster.js         Mustererkennung und Claudys Textbausteine (ohne Seite)
     speicher.js       Einstellungen, laufende Partie, Statistik (localStorage)
     engine.js         Stockfish im Web Worker (vendor/stockfish, GPL-3.0)
     bot.js            der Gegner: Zugwahl je nach Elo
     brett.js          das Brett: Zeichnen, Klicken, Ziehen, Pfeile
     claudy.js         die Figur Claudy mit Sprechblase
     spiel.js          Ablauf der Partie und die Oberfläche
   Lizenzen und Quellen: js/chess/LIZENZEN.md.
   Läuft auch in Node (für Tests).
   ========================================================================== */

const SchachKonfig = {
  speicherSchluessel: "ntb-schach",

  // Bereich, aus dem die Spielstärke des Bots gezogen wird (Elo). Der eigene
  // Bereich in den Einstellungen muss innerhalb dieser Grenzen liegen.
  elo: { min: 200, max: 2800, schritt: 10, mindestBreite: 100 },

  /* ---------- Der Bot ---------- */

  // Ab dieser Elo begrenzt Stockfish seine Stärke selbst
  // (UCI_LimitStrength und UCI_Elo; Stockfish erlaubt das ab 1320).
  grenzeStockfish: 1350,

  // Darunter: eigene Abschwächung. Zwischen den Zeilen wird je nach Elo
  // gleitend gemischt.
  //   tiefe      – Rechentiefe der Engine (Halbzüge)
  //   kandidaten – unter so vielen besten Zügen wird ausgewählt
  //   streuung   – ein Kandidat darf höchstens so viel schlechter sein als
  //                der beste Zug (in Hundertstel Bauern)
  //   zufall     – Fehlerquote: Anteil der Züge, die völlig planlos sind
  //                (irgendein erlaubter Zug – so bleiben Figuren ungedeckt
  //                stehen und Geschenke werden übersehen)
  staerken: [
    { elo: 200,  tiefe: 1, kandidaten: 5, streuung: 400, zufall: 0.55 },
    { elo: 500,  tiefe: 1, kandidaten: 5, streuung: 300, zufall: 0.38 },
    { elo: 800,  tiefe: 2, kandidaten: 4, streuung: 200, zufall: 0.20 },
    { elo: 1100, tiefe: 3, kandidaten: 3, streuung: 120, zufall: 0.08 },
    { elo: 1350, tiefe: 5, kandidaten: 2, streuung: 60,  zufall: 0.02 },
  ],

  // Bedenkzeit des Bots in Millisekunden: schwache Bots ziehen schnell,
  // starke überlegen länger (gleitend zwischen elo.min und elo.max)
  denkzeit: { min: 300, max: 1500 },

  // Remisangebot: Der Bot nimmt an, wenn er (aus seiner Sicht, in Hundertstel
  // Bauern) nicht besser steht als "ausgeglichenBis" und schon "abZug" Züge
  // gespielt sind – oder jederzeit, wenn er schlechter steht als "schlechterAls".
  remis: { ausgeglichenBis: 20, abZug: 15, schlechterAls: -150 },

  /* ---------- Analyse für Claudy und die Zugbewertung ---------- */

  // Volle Stärke: Rechentiefe, höchstens so viele Millisekunden, so viele Züge
  analyse: { tiefe: 14, zeit: 1500, linien: 3 },

  // Einstufung eines Zugs nach dem Verlust an Gewinnchance in Prozentpunkten
  // (aus der Bewertung der Engine vor und nach dem Zug). Erste passende Zeile.
  klassen: [
    { id: "sehrgut", name: "Sehr gut",      bis: 2 },
    { id: "gut",     name: "Gut",           bis: 6 },
    { id: "ungenau", name: "Ungenau",       bis: 12 },
    { id: "fehler",  name: "Fehler",        bis: 22 },
    { id: "grob",    name: "Grober Fehler", bis: Infinity },
  ],
  // Diese Klassen zählen in der Statistik als "Fehler pro Partie"
  fehlerKlassen: ["fehler", "grob"],

  // Kandidaten-Hilfe: Züge, die höchstens so viel schlechter sind als der beste
  kandidatenToleranz: 80,

  /* ---------- Claudy ---------- */

  hilfen: [
    { id: "aus",        name: "Aus",        text: "Claudy ist still." },
    { id: "schubs",     name: "Schubs",     text: "Markiert die Figur, mit der du ziehen solltest." },
    { id: "idee",       name: "Idee",       text: "Nennt das Motiv, aber nicht den Zug." },
    { id: "kandidaten", name: "Kandidaten", text: "Zeigt zwei oder drei gute Züge als Pfeile." },
    { id: "loesung",    name: "Lösung",     text: "Zeigt den besten Zug mit kurzer Begründung." },
  ],

  /* ---------- Statistik ---------- */

  // Elo-Bereiche der Übersicht (Grenzen: von … bis unter …)
  bereiche: [200, 800, 1400, 2000, 2801],
  // So viele Partien bleiben gespeichert; so viele zeigt der Verlauf
  statistik: { hoechstens: 500, verlauf: 30 },

  // Figuren: Dateien in js/chess/figuren/ (wk.svg = weißer König …)
  figurenPfad: "js/chess/figuren/",
  // Engine: Stockfish 19, kleine Variante ohne Threads (läuft ohne besondere Server-Einstellungen)
  enginePfad: "js/chess/vendor/stockfish/stockfish-19-lite-single.js",
  engineStartZeit: 15000,          // so lange darf das Laden dauern (ms)
};

if (typeof module !== "undefined") module.exports = SchachKonfig;
