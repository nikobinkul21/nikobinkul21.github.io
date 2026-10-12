/* ==========================================================================
   football/figuren.js – die Figuren des Fußball-Duells
   Jede Figur ist ein Eintrag:
     name, nummer (Rückennummer),
     palette  – Farben, mit denen ihr Sprite gezeichnet wird
                (haut, hautSchatten, haare, haareGlanz, augen, trikot,
                 trikotSchatten, hose, stutzen, schuhe, nummer),
     sprite   – welche Teile aus football/sprites.js sie benutzt
                (frisur: Name einer Frisur, torwart: Handschuhe und Kappe),
     werte    – passen, dribbeln, schiessen (Angriff),
                zweikampf, passBlockieren, torBlockieren (Verteidigung).
                Gewürfelt wird Wert + W6 (siehe konfig.regeln.wuerfel).
   Alle Figuren, Namen und Farben sind eigene Erfindungen für NTB.
   ========================================================================== */

const FootballFiguren = {

  // Hauptfigur: schwarze, kurze Strubbelhaare mit einer Strähne nach vorn,
  // blaue Augen, blaues Trikot mit der 11. Ausgewogen, stark im Schießen.
  haru: {
    name: "Haru Takane",
    nummer: 11,
    palette: {
      haut: "#f2c9a0", hautSchatten: "#d9a77c", haare: "#16161d", haareGlanz: "#3a3f55",
      augen: "#2f7bff", trikot: "#2b63d9", trikotSchatten: "#1d47a3", hose: "#f4f6fb",
      stutzen: "#2b63d9", schuhe: "#22252e", nummer: "#ffffff",
    },
    sprite: { frisur: "strubbel" },
    werte: { passen: 6, dribbeln: 6, schiessen: 8, zweikampf: 5, passBlockieren: 5, torBlockieren: 5 },
  },

  // Mitspieler: ruhiger Passgeber in den Teamfarben
  milo: {
    name: "Milo Brandt",
    nummer: 6,
    palette: {
      haut: "#d9a27a", hautSchatten: "#b9825c", haare: "#6a4224", haareGlanz: "#8d5d36",
      augen: "#3b2a1e", trikot: "#2b63d9", trikotSchatten: "#1d47a3", hose: "#f4f6fb",
      stutzen: "#2b63d9", schuhe: "#22252e", nummer: "#ffffff",
    },
    sprite: { frisur: "kurz" },
    werte: { passen: 6, dribbeln: 4, schiessen: 4, zweikampf: 6, passBlockieren: 6, torBlockieren: 5 },
  },

  // Eigener Torwart: greift nur ein, wenn der Gegner schießt
  timo: {
    name: "Timo Wendt",
    nummer: 1,
    palette: {
      haut: "#f0c39c", hautSchatten: "#d39f78", haare: "#c9a243", haareGlanz: "#e3c46c",
      augen: "#3c5a3a", trikot: "#2fae6b", trikotSchatten: "#1f7f4c", hose: "#22252e",
      stutzen: "#2fae6b", schuhe: "#22252e", nummer: "#ffffff",
    },
    sprite: { frisur: "kurz", torwart: true },
    werte: { passen: 3, dribbeln: 2, schiessen: 2, zweikampf: 3, passBlockieren: 3, torBlockieren: 5 },
  },

  // Gegner (Team "Glutwerk"): orange-schwarze Trikots
  viktor: {
    name: "Viktor Raske",
    nummer: 9,
    palette: {
      haut: "#e8b48a", hautSchatten: "#c99068", haare: "#b23a1c", haareGlanz: "#d9572f",
      augen: "#2d2d2d", trikot: "#f07a1a", trikotSchatten: "#bd5a0c", hose: "#26232a",
      stutzen: "#f07a1a", schuhe: "#f4f6fb", nummer: "#26232a",
    },
    sprite: { frisur: "stachel" },
    werte: { passen: 6, dribbeln: 7, schiessen: 8, zweikampf: 5, passBlockieren: 4, torBlockieren: 4 },
  },

  jano: {
    name: "Jano Petrik",
    nummer: 4,
    palette: {
      haut: "#a8714d", hautSchatten: "#87553a", haare: "#1d1a1a", haareGlanz: "#3a3232",
      augen: "#1d1a1a", trikot: "#f07a1a", trikotSchatten: "#bd5a0c", hose: "#26232a",
      stutzen: "#f07a1a", schuhe: "#f4f6fb", nummer: "#26232a",
    },
    sprite: { frisur: "band" },
    werte: { passen: 5, dribbeln: 4, schiessen: 4, zweikampf: 7, passBlockieren: 7, torBlockieren: 6 },
  },

  bo: {
    name: "Bo Kessler",
    nummer: 1,
    palette: {
      haut: "#f2cba6", hautSchatten: "#d5a882", haare: "#5b5f6b", haareGlanz: "#7d828f",
      augen: "#2d2d2d", trikot: "#8d4fd6", trikotSchatten: "#6533a3", hose: "#26232a",
      stutzen: "#8d4fd6", schuhe: "#26232a", nummer: "#ffffff",
    },
    sprite: { frisur: "kurz", torwart: true },
    werte: { passen: 3, dribbeln: 2, schiessen: 2, zweikampf: 3, passBlockieren: 3, torBlockieren: 6 },
  },
};

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballFiguren;
}
