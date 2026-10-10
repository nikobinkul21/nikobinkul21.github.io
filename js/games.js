/* ==========================================================================
   Games
   Übersicht aller Spiele. Ein Klick auf eine Karte öffnet das Spiel
   unter einer eigenen Adresse, z. B. #games/sudoku.
   ========================================================================== */

// Alle Spiele. Neues Spiel? Einen Eintrag ergänzen:
//   id           – Teil der Adresse (#games/<id>)
//   name         – Titel der Karte und des Spiels
//   beschreibung – kurzer Text auf der Karte
//   init         – Startfunktion des Spiels (aus seiner eigenen Datei)
const SPIELE = [
  {
    id: "sudoku",
    name: "Sudoku",
    beschreibung: "Das klassische 9×9-Zahlenrätsel in vier Schwierigkeitsgraden.",
    init: initSudoku,
  },
];

// Merkt sich, welche Spiele schon gestartet wurden (init nur 1x)
const gestarteteSpiele = {};

/**
 * Baut die Games-Ansicht auf: die Übersicht mit einer Karte pro Spiel
 * und für jedes Spiel einen (zunächst versteckten) Bereich.
 * Wird von app.js EINMAL aufgerufen.
 *
 * @param {HTMLElement} container – das Element <div id="games-root">
 */
function initGames(container) {
  let html = '<div class="spiele-uebersicht">';
  SPIELE.forEach(function (spiel) {
    html +=
      '<a class="karte spiel-karte" href="#games/' + spiel.id + '">' +
        "<h2>" + spiel.name + "</h2>" +
        "<p>" + spiel.beschreibung + "</p>" +
      "</a>";
  });
  html += "</div>";

  SPIELE.forEach(function (spiel) {
    html +=
      '<div class="spiel-bereich" id="spiel-' + spiel.id + '" hidden>' +
        '<a class="zurueck-link" href="#games">← Zur Übersicht</a>' +
        '<h2 class="spiel-titel" tabindex="-1">' + spiel.name + "</h2>" +
        '<div class="spiel-inhalt"></div>' +
      "</div>";
  });

  container.innerHTML = html;
}

/**
 * Zeigt die Übersicht oder ein bestimmtes Spiel.
 * Wird von app.js bei JEDEM Öffnen der Games-Ansicht aufgerufen.
 *
 * @param {string} unterseite – der Teil der Adresse nach "#games/",
 *                              z. B. "sudoku" (leer = Übersicht)
 * @returns {HTMLElement|null} – Element, das den Fokus bekommen soll
 *                              (null = die Überschrift "Games")
 */
function zeigeGames(unterseite) {
  const container = document.getElementById("games-root");
  const spiel = SPIELE.find(function (s) { return s.id === unterseite; });

  // Übersicht nur zeigen, wenn kein (bekanntes) Spiel gewählt ist
  container.querySelector(".spiele-uebersicht").hidden = Boolean(spiel);
  SPIELE.forEach(function (s) {
    document.getElementById("spiel-" + s.id).hidden = s !== spiel;
  });

  if (!spiel) {
    return null;
  }

  // Spiel beim ersten Öffnen starten
  const bereich = document.getElementById("spiel-" + spiel.id);
  if (!gestarteteSpiele[spiel.id]) {
    spiel.init(bereich.querySelector(".spiel-inhalt"));
    gestarteteSpiele[spiel.id] = true;
  }
  return bereich.querySelector(".spiel-titel");
}
