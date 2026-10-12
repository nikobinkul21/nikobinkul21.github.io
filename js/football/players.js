/* ==========================================================================
   football/players.js – der Kader des Fußball-Duells (7 Spieler)
   Jeder Spieler ist ein Eintrag:
     name, nummer (Rückennummer), rolle (kurze Bezeichnung),
     aussehen   – frisur (Name einer Frisur in football/sprites.js),
                  extras (stoppelbart, narbe, sommersprossen …) und die
                  Farben haut, hautSchatten, haare, haareGlanz (zweite
                  Haarfarbe bzw. Glanz), haareDrei (dritte Haarfarbe),
                  band (Stirn-/Haarband), augen.
                  Die Trikotfarben kommen vom Team (konfig.kader.trikots).
     werte      – passen, dribbeln, schiessen, zweikampf, passBlockieren,
                  torBlockieren (Grundwerte; gewürfelt wird Wert + W6)
     faehigkeit – Kennung aus football/abilities.js. Wertezuschläge der
                  Fähigkeit (z. B. Übersicht: Passen +3) kommen dazu.
   Neuer Spieler? Einen Eintrag ergänzen – mehr ist nicht nötig.
   Namen und Aussehen hat der Nutzer festgelegt.
   ========================================================================== */

const FootballKader = {

  // 1. Spielmacher – der bisherige Hauptcharakter
  ihsaki: {
    name: "Ihsaki Oich",
    nummer: 7,
    rolle: "Spielmacher",
    aussehen: {
      frisur: "zurueck", extras: [],
      haut: "#f2c9a0", hautSchatten: "#d9a77c", haare: "#16161d", haareGlanz: "#3a3f55", augen: "#2f7bff",
    },
    werte: { passen: 6, dribbeln: 5, schiessen: 5, zweikampf: 5, passBlockieren: 5, torBlockieren: 4 },
    faehigkeit: "uebersicht",
  },

  // 2. Dribbler – Irokese in Gelb und Schwarz
  sachira: {
    name: "Sachira Monster",
    nummer: 10,
    rolle: "Dribbler",
    aussehen: {
      frisur: "irokese", extras: [],
      haut: "#e8b48a", hautSchatten: "#c99068", haare: "#f2d23a", haareGlanz: "#1b1b22", augen: "#5a3a1e",
    },
    werte: { passen: 4, dribbeln: 6, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 4 },
    faehigkeit: "ballzauber",
  },

  // 3. Torjäger – dunkelgrüne Haare mit schwarzem Stirnband
  rhen: {
    name: "Rhen Aitosh",
    nummer: 9,
    rolle: "Torjäger",
    aussehen: {
      frisur: "kurzBand", extras: [],
      haut: "#e3b089", hautSchatten: "#c48f68", haare: "#1f5a3a", haareGlanz: "#2f7a52", band: "#15161c", augen: "#8b9097",
    },
    werte: { passen: 4, dribbeln: 4, schiessen: 6, zweikampf: 5, passBlockieren: 4, torBlockieren: 4 },
    faehigkeit: "kanone",
  },

  // 4. Ballkünstler – langer Zopf in Gelb, Weiß und Rot (seltene Fähigkeit → niedrigere Grundwerte)
  zhidou: {
    name: "Zhidou Nasar",
    nummer: 14,
    rolle: "Ballkünstler",
    aussehen: {
      frisur: "zopf", extras: [],
      haut: "#f0c7a2", hautSchatten: "#d4a47f", haare: "#f2d23a", haareGlanz: "#ffffff", haareDrei: "#e0402a", augen: "#d08a1e",
    },
    werte: { passen: 5, dribbeln: 5, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 3 },
    faehigkeit: "traumannahme",
  },

  // 5. Verteidiger – kurze grünblaue Haare, Stoppelbart
  haiku: {
    name: "Haiku Oli",
    nummer: 4,
    rolle: "Verteidiger",
    aussehen: {
      frisur: "kurzGlatt", extras: ["stoppelbart"],
      haut: "#f2c6a0", hautSchatten: "#d6a57e", haare: "#2a9d9a", haareGlanz: "#4cc7c0", bart: "#8a6a4a", augen: "#3b78d8",
    },
    werte: { passen: 4, dribbeln: 3, schiessen: 3, zweikampf: 7, passBlockieren: 7, torBlockieren: 7 },
    faehigkeit: "mauer",
  },

  // 6. Solospieler – schwarze, nach oben gegelte Haare, rote Augen, Narbe (seltene Fähigkeit)
  pharou: {
    name: "Pharou Makhi",
    nummer: 8,
    rolle: "Solospieler",
    aussehen: {
      frisur: "gegelt", extras: ["narbe"],
      haut: "#b97a52", hautSchatten: "#98603d", haare: "#121217", haareGlanz: "#3a3a48", narbe: "#e9c2a8", augen: "#d4202a",
    },
    werte: { passen: 3, dribbeln: 6, schiessen: 5, zweikampf: 4, passBlockieren: 3, torBlockieren: 3 },
    faehigkeit: "sologang",
  },

  // 7. Akrobat – weiße Locken mit dunklem Haarband, Sommersprossen (seltene Fähigkeit)
  naki: {
    name: "Naki Senjiro",
    nummer: 17,
    rolle: "Akrobat",
    aussehen: {
      frisur: "locken", extras: ["sommersprossen"],
      haut: "#f5d2b3", hautSchatten: "#dcb08c", haare: "#f4f6fa", haareGlanz: "#c3ccd8", band: "#2a2e38",
      sommersprossen: "#c98a5e", augen: "#3f6f4e",
    },
    werte: { passen: 4, dribbeln: 5, schiessen: 5, zweikampf: 4, passBlockieren: 4, torBlockieren: 3 },
    faehigkeit: "akrobatik",
  },
};

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballKader;
}
