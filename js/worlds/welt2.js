/* ==========================================================================
   worlds/welt2.js – Welt 2: "Wald" (Level 21 bis 40)
   Dichter Wald, Lichtungen und alte Bäume.
   Noch leer: Solange "bosse" leer ist, wird die Welt übersprungen – nach
   der letzten gebauten Welt beginnt die nächste Runde bei Welt 1.
   Aufbau der Bosse wie in worlds/welt1.js (genau 20, Level 5/10/15 Elite,
   Level 20 Weltboss).
   ========================================================================== */

(function () {
  const welt = {
    nummer: 2,
    id: "wald",
    name: "Wald",
    hintergrund: "wald",
    farben: {
      himmelOben: "#5d9c6b", himmelUnten: "#a9d39a",
      boden: "#4f7f3a", bodenDunkel: "#355a27",
      fern: "#3f6f45", akzent: "#9bd16a",
    },
    bosse: [],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = welt;
  else (window.SUDOKU_WELTEN = window.SUDOKU_WELTEN || [])[welt.nummer - 1] = welt;
})();
