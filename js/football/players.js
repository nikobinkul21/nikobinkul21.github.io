/* ==========================================================================
   football/players.js – der Kader des Fußball-Duells (7 Spieler)
   Jeder Spieler ist ein Eintrag:
     name, nummer (Rückennummer), rolle (kurze Bezeichnung),
     aussehen   – frisur (Name einer Frisur in football/sprites.js), extras
                  (Bart, Narbe, Haarband, Sommersprossen …) und die Farben
                  haut, hautSchatten, haare, haareGlanz, augen.
                  Die Trikotfarben kommen vom Team (konfig.kader.trikots).
     werte      – passen, dribbeln, schiessen, zweikampf, passBlockieren,
                  torBlockieren (Grundwerte; gewürfelt wird Wert + W6)
     faehigkeit – Kennung aus football/abilities.js. Wertezuschläge der
                  Fähigkeit (z. B. Übersicht: Passen +3) kommen dazu.
   Neuer Spieler? Einen Eintrag ergänzen – mehr ist nicht nötig.
   Alle Spieler sind eigene Erfindungen für NTB.
   ========================================================================== */

const FootballKader = {

  // 1. Spielmacher – der bisherige Hauptcharakter
  haru: {
    name: "Haru Takane",
    nummer: 7,
    rolle: "Spielmacher",
    aussehen: {
      frisur: "zurueck", extras: [],
      haut: "#f2c9a0", hautSchatten: "#d9a77c", haare: "#8a3b22", haareGlanz: "#b0553a", augen: "#2fa65a",
    },
    werte: { passen: 6, dribbeln: 5, schiessen: 5, zweikampf: 5, passBlockieren: 5, torBlockieren: 4 },
    faehigkeit: "uebersicht",
  },

  // 2. Dribbler
  pico: {
    name: "Pico Almeida",
    nummer: 10,
    rolle: "Dribbler",
    aussehen: {
      frisur: "irokese", extras: [],
      haut: "#c98d63", hautSchatten: "#a8704a", haare: "#f07f1e", haareGlanz: "#ffa651", augen: "#5a3a1e",
    },
    werte: { passen: 4, dribbeln: 6, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 4 },
    faehigkeit: "ballzauber",
  },

  // 3. Torjäger
  bruno: {
    name: "Bruno Kastell",
    nummer: 9,
    rolle: "Torjäger",
    aussehen: {
      frisur: "kahlBand", extras: ["stirnband"],
      haut: "#e3b089", hautSchatten: "#c48f68", haare: "#e3b089", haareGlanz: "#f0c6a2", augen: "#8b9097",
    },
    werte: { passen: 4, dribbeln: 4, schiessen: 6, zweikampf: 5, passBlockieren: 4, torBlockieren: 4 },
    faehigkeit: "kanone",
  },

  // 4. Ballkünstler (seltene Fähigkeit → etwas niedrigere Grundwerte)
  mattis: {
    name: "Mattis Lindqvist",
    nummer: 14,
    rolle: "Ballkünstler",
    aussehen: {
      frisur: "zopf", extras: [],
      haut: "#f0c7a2", hautSchatten: "#d4a47f", haare: "#6b4325", haareGlanz: "#8d5d36", augen: "#d08a1e",
    },
    werte: { passen: 5, dribbeln: 5, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 3 },
    faehigkeit: "traumannahme",
  },

  // 5. Verteidiger
  henrik: {
    name: "Henrik Stahl",
    nummer: 4,
    rolle: "Verteidiger",
    aussehen: {
      frisur: "blondKurz", extras: ["stoppelbart"],
      haut: "#f2c6a0", hautSchatten: "#d6a57e", haare: "#e8c85a", haareGlanz: "#f6dd86", augen: "#3b78d8",
    },
    werte: { passen: 4, dribbeln: 3, schiessen: 3, zweikampf: 7, passBlockieren: 7, torBlockieren: 7 },
    faehigkeit: "mauer",
  },

  // 6. Solospieler (seltene Fähigkeit)
  kian: {
    name: "Kian Voss",
    nummer: 8,
    rolle: "Solospieler",
    aussehen: {
      frisur: "buzzcut", extras: ["narbe"],
      haut: "#b97a52", hautSchatten: "#98603d", haare: "#2d6fe0", haareGlanz: "#5a93f2", augen: "#8b9097",
    },
    werte: { passen: 3, dribbeln: 6, schiessen: 5, zweikampf: 4, passBlockieren: 3, torBlockieren: 3 },
    faehigkeit: "sologang",
  },

  // 7. Akrobat (seltene Fähigkeit)
  fenn: {
    name: "Fenn Ashby",
    nummer: 17,
    rolle: "Akrobat",
    aussehen: {
      frisur: "locken", extras: ["haarband", "sommersprossen"],
      haut: "#f5d2b3", hautSchatten: "#dcb08c", haare: "#c8341f", haareGlanz: "#e65a3e", augen: "#3f6f4e",
    },
    werte: { passen: 4, dribbeln: 5, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 3 },
    faehigkeit: "akrobatik",
  },
};

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballKader;
}
