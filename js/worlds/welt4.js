/* ==========================================================================
   worlds/welt4.js – Welt 4: "Schnee und Berge" (Level 61 bis 80)
   Verschneite Gipfel, Tannen und eisige Pässe.
   Noch leer: Solange "bosse" leer ist, wird die Welt übersprungen – nach
   der letzten gebauten Welt beginnt die nächste Runde bei Welt 1.
   Aufbau der Bosse wie in worlds/welt1.js (genau 20, Level 5/10/15 Elite,
   Level 20 Weltboss).
   ========================================================================== */

(function () {
  const welt = {
    nummer: 4,
    id: "schnee",
    name: "Schnee und Berge",
    hintergrund: "schnee",
    farben: {
      himmelOben: "#9db8d8", himmelUnten: "#e4eef7",
      boden: "#eef4fa", bodenDunkel: "#c3d3e3",
      fern: "#8ea3bd", akzent: "#5fb0e8",
    },
    bosse: [],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = welt;
  else (window.SUDOKU_WELTEN = window.SUDOKU_WELTEN || [])[welt.nummer - 1] = welt;
})();
