/* ==========================================================================
   seitenwechsel.js – Übergänge zwischen den Ansichten
   Eine kurze, ruhige Überblendung: Der Inhalt blendet aus, die neue Ansicht
   erscheint und blendet ein. Gilt für jeden Wechsel zwischen zwei
   Ansichten (Karten der Startseite, Navigation, Zurück-Button).
   "Bewegung reduzieren": ohne Überblendung, sofort.
   Neuladen und direkte Links: ohne Übergang (app.js).
   Dauer: CSS-Variable --uebergang-dauer in css/style.css.
   Animiert wird nur opacity (Web Animations API).
   ========================================================================== */

const Seitenwechsel = (function () {

  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  let laeuft = false;          // gerade ein Übergang aktiv?
  let aktiv = null;            // { ende() } des laufenden Übergangs

  function dauer() {
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--uebergang-dauer"));
    return isNaN(z) ? 200 : z;
  }

  /**
   * Wird von app.js bei jedem hashchange aufgerufen.
   * @param {string} von  – bisher sichtbare Ansicht (z. B. "home")
   * @param {{name, unterseite}} ziel
   * @param {function} zeige – blendet die Zielansicht ein (zeigeAnsicht)
   */
  function wechsle(von, ziel, zeige) {
    // Läuft noch ein Übergang (z. B. Zurück-Button mitten drin)? Sofort beenden.
    if (aktiv) aktiv.ende();
    // Gleiche Ansicht (z. B. #games → #games/sudoku) oder "Bewegung reduzieren": sofort
    if (von === ziel.name || von === null || ruhigAbfrage.matches) {
      zeige();
      if (von !== ziel.name) window.scrollTo(0, 0);
      return;
    }
    ueberblenden(zeige, dauer());
  }

  function istAktiv() {
    return laeuft;
  }

  // Enter/Leertaste auf Links und Knöpfen während der Überblendung abfangen
  document.addEventListener("keydown", function (event) {
    if (laeuft && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  /** Inhalt aus-, Ansicht wechseln, Inhalt einblenden (je die halbe Dauer). */
  function ueberblenden(zeige, ms) {
    laeuft = true;
    const haupt = document.getElementById("main");
    const aus = haupt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms / 2, easing: "ease-in", fill: "forwards" });
    let ein = null, gezeigt = false, erledigt = false;
    function wechseln() {
      if (gezeigt) return;
      gezeigt = true;
      zeige();
      window.scrollTo(0, 0);
    }
    function fertig() {
      if (erledigt) return;
      erledigt = true;
      aus.cancel();
      if (ein) ein.cancel();
      laeuft = false;
      aktiv = null;
    }
    aktiv = { ende: function () { wechseln(); fertig(); } };
    aus.finished.then(function () {
      if (erledigt) return;
      wechseln();
      ein = haupt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms / 2, easing: "ease-out" });
      aus.cancel();
      ein.finished.then(fertig, function () {});
    }, function () {});
  }

  return {
    wechsle: wechsle,
    istAktiv: istAktiv,
  };
})();
