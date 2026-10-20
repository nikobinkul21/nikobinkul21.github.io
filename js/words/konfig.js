/* ==========================================================================
   words/konfig.js – alle Werte des Worträtsels an einer Stelle
   Regeln:      js/words/regeln.js
   Speicher:    js/words/speicher.js
   Darstellung: js/words/darstellung.js, css/words.css
   Wortlisten:  js/words/<sprache>-solutions.js und -allowed.js
   ========================================================================== */

const WoerterKonfig = {
  laenge: 5,                 // Buchstaben je Wort
  versuche: 6,               // Versuche je Wort
  standardSprache: "de",

  sprachen: {
    de: {
      name: "Deutsch",
      kurz: "DE",
      // Erlaubte Zeichen: Ä, Ö und Ü sind eigene Buchstaben (je ein Zeichen),
      // ß kommt nicht vor
      buchstaben: "abcdefghijklmnopqrstuvwxyzäöü",
      // Bildschirmtastatur QWERTZ. "enter" und "zurueck" sind die Sondertasten.
      tastatur: [
        ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
        ["enter", "y", "x", "c", "v", "b", "n", "m", "zurueck"],
      ],
      // Dateien mit den Wortlisten (werden erst beim Öffnen des Spiels geladen)
      dateien: { loesungen: "js/words/de-solutions.js", erlaubt: "js/words/de-allowed.js" },
    },
    en: {
      name: "Englisch",
      kurz: "EN",
      buchstaben: "abcdefghijklmnopqrstuvwxyz",
      // Bildschirmtastatur QWERTY
      tastatur: [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["enter", "z", "x", "c", "v", "b", "n", "m", "zurueck"],
      ],
      dateien: { loesungen: "js/words/en-solutions.js", erlaubt: "js/words/en-allowed.js" },
    },
  },

  // Texte der Meldungen
  texte: {
    ungueltig: "Kein bekanntes Wort",
    zuKurz: "Zu wenige Buchstaben",
    gewonnen: ["Genial!", "Großartig!", "Stark!", "Sehr gut!", "Gut gemacht!", "Puh, geschafft!"],
    verloren: "Das Wort war",
    rekord: "Neuer Rekord",
    sprachWechsel: "Das laufende Wort wird beendet und zählt nicht für den Streak. Trotzdem wechseln?",
    laden: "Wörter werden geladen …",
    ladeFehler: "Die Wortlisten konnten nicht geladen werden.",
  },

  // Zeiten in Millisekunden
  zeit: {
    meldung: 1600,           // so lange steht eine kurze Meldung
    ploppen: 110,            // Buchstabe ploppt beim Tippen
    drehen: 480,             // ein Feld dreht sich um
    drehVersatz: 240,        // das nächste Feld beginnt so viel später
    huepfen: 520,            // Zeile hüpft bei einem Sieg (je Feld)
    huepfVersatz: 90,
    schuetteln: 480,         // Zeile schüttelt bei ungültigem Wort
    naechstesWort: 1300,     // nach einem Sieg: so lange (nach dem Aufdecken) bis zum nächsten Wort
    rekord: 2200,            // so lange wird ein neuer Rekord gefeiert
    ruhig: 160,              // "Bewegung reduzieren": nur kurze Farbwechsel
  },

  speicherSchluessel: "ntb-woerter",
};

if (typeof module !== "undefined") module.exports = WoerterKonfig;
