/* ==========================================================================
   football/figuren.js – die Torhüter des Fußball-Duells
   Die Feldspieler stehen im Kader (football/players.js). Hier bleiben die
   beiden Torhüter als eigene, schlichte Figuren:
     name, nummer, palette (Farben des Sprites, mit Trikot), sprite
     (frisur, torwart: Handschuhe), werte (nur Tor blockieren zählt –
     ein Torhüter greift nur beim Schuss ein).
   Eigene Erfindungen für NTB.
   ========================================================================== */

const FootballFiguren = {

  // Dein Torwart: greift nur ein, wenn der Gegner schießt
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

  // Torwart des Gegners
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
