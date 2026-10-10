/* ==========================================================================
   Games
   Übersicht aller Spiele. Sudoku wird hier später als erstes Spiel erscheinen.
   ========================================================================== */

/**
 * Startet die Games-Übersicht.
 * Wird von app.js EINMAL aufgerufen, wenn die Games-Ansicht
 * zum ersten Mal geöffnet wird.
 *
 * @param {HTMLElement} container – das Element <div id="games-root">,
 *                                  in das die Übersicht gezeichnet wird
 */
function initGames(container) {
  // Platzhalter-Karte – wird später durch eine Karte pro Spiel ersetzt
  container.innerHTML =
    '<div class="karte">' +
      "<h2>Sudoku</h2>" +
      '<p class="platzhalter">Kommt bald.</p>' +
    "</div>";
}
