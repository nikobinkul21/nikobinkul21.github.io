/* ==========================================================================
   worlds/welt3.js – Welt 3: "Höhlen und Zwergenminen" (Level 41 bis 60)
   Tropfsteinhöhlen, Grubenlampen und Schienen der Zwerge.
   Noch leer: Solange "bosse" leer ist, wird die Welt übersprungen – nach
   der letzten gebauten Welt beginnt der nächste Durchlauf bei Welt 1.
   Aufbau der Bosse wie in worlds/welt1.js (genau 20, Level 5/10/15 Elite,
   Level 20 Weltboss).
   ========================================================================== */

(function () {
  const welt = {
    nummer: 3,
    id: "hoehlen",
    name: "Höhlen und Zwergenminen",
    hintergrund: "hoehlen",
    farben: {
      himmelOben: "#2b2a35", himmelUnten: "#4a4656",
      boden: "#5d5463", bodenDunkel: "#3c3542",
      fern: "#3a3542", akzent: "#f2a93a",
    },
    bosse: [],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = welt;
  else (window.SUDOKU_WELTEN = window.SUDOKU_WELTEN || [])[welt.nummer - 1] = welt;
})();
