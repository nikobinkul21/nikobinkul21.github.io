/* ==========================================================================
   seitenwechsel.js – Übergänge zwischen den Ansichten

   Ein Schnitt wie im Film: Die Seite blendet kurz in Schwarz ab, im Schwarz
   wechselt der Abschnitt, dann blendet er aus dem Schwarz auf (zusammen
   etwa eine halbe Sekunde). Gilt für jeden Wechsel zwischen zwei
   Ansichten – über die Kacheln der Startseite wie über die Navigation.
   "Bewegung reduzieren": nur eine kurze Überblendung des Inhalts, ohne
   Schwarzblende.

   Neuladen und direkte Links: ohne Übergang (app.js).
   Dauern und Farbe der Blende: CSS-Variablen --uebergang-… in css/style.css.
   Animiert wird nur opacity (Web Animations API).
   ========================================================================== */

const Seitenwechsel = (function () {

  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  let laeuft = false;          // gerade ein Übergang aktiv?
  let aktiv = null;            // { ende() } des laufenden Übergangs

  /** Dauern aus den CSS-Variablen (in Millisekunden). */
  function konfig() {
    const s = getComputedStyle(document.documentElement);
    const zahl = function (name, ersatz) {
      const z = parseFloat(s.getPropertyValue(name));
      return isNaN(z) ? ersatz : z;
    };
    return {
      ab: zahl("--uebergang-abblende-dauer", 220),
      schwarz: zahl("--uebergang-schwarz-dauer", 60),
      auf: zahl("--uebergang-aufblende-dauer", 260),
      ruhig: zahl("--uebergang-ruhig-dauer", 160),
    };
  }

  /**
   * Wird von app.js bei jedem hashchange aufgerufen.
   * @param {string} von  – bisher sichtbare Ansicht (z. B. "home")
   * @param {{name, unterseite}} ziel
   * @param {function} zeige – blendet die Zielansicht ein (zeigeAnsicht)
   */
  function wechsle(von, ziel, zeige) {
    // Läuft noch ein Übergang (z. B. Zurück-Button mitten im Schnitt)?
    // Dann den alten sofort beenden und den neuen starten.
    if (aktiv) aktiv.ende();

    // Gleiche Ansicht (z. B. #games → #games/sudoku): ohne Übergang
    if (von === ziel.name || von === null) {
      zeige();
      return;
    }
    const c = konfig();
    if (ruhigAbfrage.matches) ueberblenden(zeige, c.ruhig);
    else schnitt(zeige, c);
  }

  function istAktiv() {
    return laeuft;
  }

  // Enter/Leertaste auf Links und Knöpfen während des Übergangs abfangen
  document.addEventListener("keydown", function (event) {
    if (laeuft && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);


  /* ==========================================================================
     SCHNITT: abblenden in Schwarz → Abschnitt wechseln → aufblenden
     Die Blende liegt über allem und fängt solange alle Klicks ab.
     ========================================================================== */

  function schnitt(zeige, c) {
    laeuft = true;
    const blende = document.createElement("div");
    blende.className = "seitenwechsel-blende";
    document.body.appendChild(blende);

    let gezeigt = false, erledigt = false, auf = null;
    const ab = blende.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: c.ab, easing: "ease-in", fill: "forwards" });

    function wechseln() {
      if (gezeigt) return;
      gezeigt = true;
      zeige();
      window.scrollTo(0, 0);
    }
    function fertig() {
      if (erledigt) return;
      erledigt = true;
      ab.cancel();
      if (auf) auf.cancel();
      blende.remove();
      laeuft = false;
      aktiv = null;
    }
    aktiv = { ende: function () { wechseln(); fertig(); } };

    ab.finished.then(function () {
      if (erledigt) return;
      wechseln();
      auf = blende.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: c.auf, delay: c.schwarz, easing: "ease-out", fill: "forwards" });
      auf.finished.then(fertig, function () {});
    }, function () {});
  }


  /* ==========================================================================
     ÜBERBLENDUNG ("Bewegung reduzieren"): Inhalt kurz aus- und einblenden
     ========================================================================== */

  function ueberblenden(zeige, dauer) {
    laeuft = true;
    const haupt = document.getElementById("main");
    const aus = haupt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dauer / 2, easing: "ease-in", fill: "forwards" });
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
      ein = haupt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dauer / 2, easing: "ease-out" });
      aus.cancel();
      ein.finished.then(fertig, function () {});
    }, function () {});
  }


  return {
    wechsle: wechsle,
    istAktiv: istAktiv,
  };
})();
