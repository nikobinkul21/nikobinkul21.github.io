/* ==========================================================================
   sudoku-battle-ui.js – Kampffenster, Slot-Walze und Animationen
   für das Sudoku-Abenteuer. Die REGELN stehen in js/sudoku-rpg.js –
   diese Datei zeigt nur an, was die Regeln melden.
   Aussehen: css/sudoku-rpg.css

   Wichtig: Animationen laufen nacheinander über eine Warteschlange.
   Der Spielstand ist dabei längst aktuell – sichtbar wird ein Treffer
   erst, wenn der Würfel gelandet ist. Setzt man die nächste Zahl vorher,
   springt alles Laufende sofort zu seinem Ende (beschleunige), es staut
   sich nichts an. Nur die Verbesserungsauswahl hält die Schlange an.
   ========================================================================== */

/* --------------------------------------------------------------------------
   KAMPFANIMATIONEN (Würfel und Schadensaufbau) – alle Werte an einer Stelle
   Die Stufe wählt man in den Einstellungen; gespeichert wird sie im Browser.
   Die Werte des Schadensaufbaus selbst: SUDOKU_FX_KONFIG in js/sudoku-damage-fx.js
   -------------------------------------------------------------------------- */
const SUDOKU_WUERFEL_KONFIG = {
  speicherSchluessel: "ntb-kampf-animation",
  alterSchluessel: "ntb-wuerfel-animation",   // frühere Einstellung "Würfelanimation"
  standard: "normal",
  // Würfel in Millisekunden: "gross" = eigene Würfelfläche (Desktop),
  // "klein" = Würfel im Kampffenster (Smartphone).
  // "fx" = Tempo des Schadensaufbaus (1 = normal, 0 = aus)
  stufen: [
    { id: "normal", name: "Normal", gross: 2000, klein: 800, fx: 1 },
    { id: "schnell", name: "Schnell", gross: 600, klein: 600, fx: 0.4 },
    { id: "aus", name: "Aus", gross: 0, klein: 0, fx: 0 },
  ],
  landung: 0.2,            // Anteil der Dauer für den Aufprall am Ende
  umdrehungen: 3,          // so oft dreht sich der große Würfel im Flug
  ueberschlaege: 5,        // so oft "überschlägt" er sich (Stauchen)
  pauseReduziert: 350,     // "Bewegung reduzieren": kurze Pause, dann das Ergebnis
  ab: "(min-width: 1000px)", // ab dieser Breite gibt es die eigene Würfelfläche
};


const SudokuKampf = (function () {

  const W = SUDOKU_WUERFEL_KONFIG;

  /** Die gewählte Stufe der Würfelanimation ({ id, name, gross, klein }). */
  function wuerfelEinstellung() {
    let id = null;
    try {
      id = localStorage.getItem(W.speicherSchluessel) || localStorage.getItem(W.alterSchluessel);
    } catch (fehler) { /* gesperrt */ }
    return W.stufen.find(function (st) { return st.id === id; }) ||
      W.stufen.find(function (st) { return st.id === W.standard; });
  }

  function setzeWuerfelEinstellung(id) {
    try { localStorage.setItem(W.speicherSchluessel, id); } catch (fehler) { /* gesperrt */ }
  }

  // Dauer der einzelnen Animationen (Millisekunden)
  const DAUER = {
    schlag: 260,
    treffer: 420,
    angriff: 380,
    sieg: 900,
    erscheinen: 450,
    kritisch: 560,     // Wackeln bei kritischem Treffer
    stolpern: 520,
    banner: 1100,      // Hinweis, wenn eine Boss-Eigenheit auslöst
    eliteAuftritt: 1500, // Einblendung "Ein Elite-Boss erscheint"
    eliteSieg: 1500,   // größere Siegesanimation nach einem Elite-Boss
    walze: 1900,       // Slot-Walze bis zum Stillstand
    walzePause: 550,   // kurz stehen lassen, bevor das Sudoku startet
    walzeSpecial: 900, // bei Special Grade etwas länger
  };

  /** Bei "Bewegung reduzieren" fallen alle Animationen weg. */
  function ohneBewegung() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }


  /* ------------------------------------------------------------------------
     SYMBOLE als kleine Pixel-SVGs (harte Kanten). Werden im Kampffenster
     UND auf den Power-up-Feldern im Gitter benutzt (sudoku-ui.js).
     Neuer Power-up-Typ oder neue Verbesserung mit neuem Symbol? Hier ein
     weiteres Symbol ergänzen und in SUDOKU_RPG_KONFIG den Namen eintragen.
     ------------------------------------------------------------------------ */
  const SYMBOLE = {
    herz: '<path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/>',
    muenze: '<path d="M2 0h3v1h1v1h1v3H6v1H5v1H2V6H1V5H0V2h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M3 2h1v3H3z"/>',
    tropfen: '<path d="M3 0h1v1h1v2h1v3H5v1H2V6H1V3h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M2 4h1v1H2z"/>',
    stern: '<path d="M3 0h1v2h3v1H6v1h1v3H6V6H5V5H2v1H1v1H0V4h1V3H0V2h3z"/>',
    blitz: '<path d="M3 0h3v2H5v1h2v1H6v1H5v1H4v1H3V5h1V4H1V3h1V2h1z"/>',
    wuerfel: '<path d="M1 0h5v1h1v5H6v1H1V6H0V1h1z"/><path fill="#fff" d="M1 1h1v1H1zM5 1h1v1H5zM3 3h1v1H3zM1 5h1v1H1zM5 5h1v1H5z"/>',
    klinge: '<path d="M5 0h2v2H6v1H5v1H4v1H3v1H2V5H1V4h1V3h1V2h1V1h1z"/><path d="M0 6h1v1H0zM1 5h1v1H1zM0 4h1v1H0zM2 6h1v1H2z"/>',
    karte: '<path d="M0 1h7v5H0z"/><path fill="rgba(0,0,0,.55)" d="M3 2h1v1H3zM5 2h1v1H5zM4 3h1v1H4zM3 4h1v1H3zM5 4h1v1H5zM1 4h1v1H1z"/>',
    pilz: '<path d="M2 0h3v1h1v1h1v2H0V2h1V1h1z"/><path fill="#f4ead5" d="M2 4h3v3H2z"/><path fill="#fff" d="M2 1h1v1H2zM4 2h1v1H4z"/>',
    magnet: '<path d="M0 0h2v4h3V0h2v5H6v1H5v1H2V6H1V5H0z"/><path fill="#fff" d="M0 0h2v1H0zM5 0h2v1H5z"/>',
    kreuz: '<path d="M0 0h2v1H0zM5 0h2v1H5zM1 1h2v1H1zM4 1h2v1H4zM2 2h3v1H2zM3 3h1v1H3zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z"/>',
    warnung: '<path d="M3 0h1v1h1v2h1v2h1v2H0V5h1V3h1V1h1z"/><path fill="#fff" d="M3 2h1v2H3zM3 5h1v1H3z"/>',
    krone: '<path d="M0 1h1v2h1V2h1V0h1v2h1v1h1V1h1v6H0z"/>',
  };

  /** Ein Symbol als fertiges SVG (Farbe kommt über CSS: fill). */
  function symbolSvg(name) {
    return '<svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges">' +
      (SYMBOLE[name] || SYMBOLE.stern) + "</svg>";
  }

  // Das Herz für die Lebensanzeige
  const HERZ_SVG = symbolSvg("herz");


  /**
   * Der große Würfel als SVG: eine stilisierte Form mit Facetten (kein echtes
   * 3D-Modell – die Seitenzahl ändert sich ja durch Verbesserungen).
   * Die Farben kommen aus dem CSS (Klassen wf-…).
   */
  function wuerfelSvg() {
    return '<svg class="wuerfel-form" viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon class="wf-grund" points="50,4 90,27 90,73 50,96 10,73 10,27"/>' +
      '<polygon class="wf-hell" points="10,27 50,4 50,22"/>' +
      '<polygon class="wf-heller" points="50,4 90,27 50,22"/>' +
      '<polygon class="wf-dunkel" points="90,27 90,73 80,68 50,22"/>' +
      '<polygon class="wf-mittel" points="10,27 50,22 20,68 10,73"/>' +
      '<polygon class="wf-dunkler" points="20,68 80,68 90,73 50,96 10,73"/>' +
      '<polygon class="wf-front" points="50,22 80,68 20,68"/>' +
      '<polygon class="wf-rand" points="50,4 90,27 90,73 50,96 10,73 10,27"/>' +
      "</svg>";
  }

  /** Ein Element, das beim Darüberfahren oder Antippen einen Erklärtext zeigt. */
  function tippHtml() {
    return '<span class="kampf-tipp" aria-hidden="true"></span>';
  }

  /**
   * Der Würfel: auf dem Desktop groß in einer eigenen Fläche, auf dem
   * Smartphone klein im Kampffenster (welcher sichtbar ist, regelt das CSS).
   * @param {HTMLElement|null} platz – Platz für den großen Würfel
   * @param {HTMLElement} klein     – der kleine Würfel im Kampffenster
   * @param {HTMLElement} kleinZahl – seine Zahl
   * @param {function} beimKlick    – Klick auf den Würfel (überspringt den Ablauf)
   * @returns {{ rolle, ueberspringe, zeige, punkt, gross }}
   */
  function erstelleWuerfel(platz, klein, kleinZahl, beimKlick) {
    const g = {};       // Teile des großen Würfels
    if (platz) {
      platz.innerHTML =
        '<div class="wuerfel-flaeche">' +
          '<button type="button" class="wuerfel-knopf" aria-label="Würfel, noch nicht gewürfelt">' +
            '<span class="wuerfel-koerper">' + wuerfelSvg() + '<span class="wuerfel-zahl">–</span></span>' +
          "</button>" +
          '<p class="wuerfel-info"><span class="wuerfel-seiten">W20</span><span class="wuerfel-art"></span></p>' +
        "</div>";
      g.flaeche = platz.querySelector(".wuerfel-flaeche");
      g.knopf = platz.querySelector(".wuerfel-knopf");
      g.koerper = platz.querySelector(".wuerfel-koerper");
      g.zahl = platz.querySelector(".wuerfel-zahl");
      g.seiten = platz.querySelector(".wuerfel-seiten");
      g.art = platz.querySelector(".wuerfel-art");
      // Ein Klick auf den Würfel überspringt die laufende Animation (Würfel UND Schadensaufbau)
      g.knopf.addEventListener("click", beimKlick);
    }
    klein.addEventListener("click", beimKlick);

    let lauf = null;    // der laufende Wurf: { e, art, animationen, zeit, fertig }

    const ART_TEXT = { kritisch: "Kritisch!", fehlschlag: "Fehlschlag", immun: "Immun", geblockt: "Geblockt" };

    /** Wie ist der Wurf ausgegangen? (bestimmt die Landung und die Farbe) */
    function artVon(e) {
      if (e.immun) return e.selten.art;          // "immun" oder "geblockt" (seltene Eigenschaft)
      if (e.eigenheit) return "geblockt";        // Rüstung
      if (e.kritisch) return "kritisch";
      if (e.fehlschlag) return "fehlschlag";
      return "";
    }

    /** Ist gerade der große Würfel zu sehen? */
    function grossSichtbar() {
      return Boolean(platz) && window.matchMedia(W.ab).matches;
    }

    /** Ergebnis (oder null = noch keins) auf beiden Würfeln zeigen. */
    function zeige(zahl, art, seiten) {
      const text = zahl === null ? "–" : String(zahl);
      kleinZahl.textContent = text;
      klein.dataset.art = art || "";
      klein.classList.remove("rollt", "wartet");
      klein.setAttribute("aria-label", zahl === null ? "Noch nicht gewürfelt" : "Letzter Wurf: " + zahl);
      if (!platz) return;
      g.zahl.textContent = text;
      g.flaeche.dataset.art = art || "";
      g.flaeche.classList.remove("rollt", "wartet");
      g.art.textContent = art ? ART_TEXT[art] : "";
      if (seiten) g.seiten.textContent = "W" + seiten;
      g.knopf.setAttribute("aria-label", zahl === null ? "Würfel, noch nicht gewürfelt"
        : "Letzter Wurf: " + zahl + (art ? ", " + ART_TEXT[art] : ""));
    }

    /**
     * Zahlen, die während des Rollens wechseln – immer langsamer.
     * Das Ergebnis selbst erscheint dabei nie (es soll nichts verraten).
     */
    function flackern(seiten, ergebnis, dauer) {
      const start = performance.now();
      let letzte = 0;
      function naechste() {
        const t = Math.min(1, (performance.now() - start) / dauer);
        let z;
        do {
          z = 1 + Math.floor(Math.random() * seiten);
        } while ((z === ergebnis || z === letzte) && seiten > 2);
        letzte = z;
        kleinZahl.textContent = z;
        if (platz) g.zahl.textContent = z;
        if (lauf && t < 1) lauf.zeit = setTimeout(naechste, 45 + 230 * t * t);
      }
      naechste();
    }

    /**
     * Flugbahn des großen Würfels: hineingeworfen von links oben, dreht sich
     * (immer langsamer) und überschlägt sich (Stauchen in der Höhe).
     */
    function flugBilder() {
      const bilder = [];
      const anzahl = 40;
      for (let i = 0; i <= anzahl; i++) {
        const t = i / anzahl;
        const p = 1 - Math.pow(1 - t, 3);                  // schnell los, dann langsamer
        const x = -150 * (1 - p);
        const y = -110 * Math.pow(1 - p, 2);
        const drehung = 360 * W.umdrehungen * p;
        const kippen = 0.4 + 0.6 * Math.abs(Math.cos(Math.PI * W.ueberschlaege * p));
        const groesse = 0.65 + 0.35 * p;
        bilder.push({ transform: "translate(" + x + "%, " + y + "%) rotate(" + drehung + "deg) scale(" + groesse + ", " + (groesse * kippen) + ")" });
      }
      return bilder;
    }

    /** Der kleine Würfel dreht sich nur (immer langsamer). */
    function drehBilder() {
      return [{ transform: "rotate(0deg) scale(0.85)" }, { transform: "rotate(" + (360 * 2) + "deg) scale(1)" }];
    }

    /**
     * Würfeln. Das Ergebnis steht schon fest (die Regeln haben gewürfelt) –
     * hier wird es nur gezeigt.
     * @param {object} e – das Ereignis "richtig" (wurf, wuerfelSeiten, kritisch …)
     * @param {boolean} sofort – ohne Animation (der Zug wird übersprungen)
     * @returns {Promise} – erfüllt, wenn der Würfel gelandet ist
     */
    function rolle(e, sofort) {
      ueberspringe();
      const art = artVon(e);
      const gross = grossSichtbar();
      const stufe = wuerfelEinstellung();
      const normal = gross ? stufe.gross : stufe.klein;
      let dauer = normal;
      if (ohneBewegung()) dauer = normal > 0 ? W.pauseReduziert : 0;
      if (sofort) dauer = 0;
      if (platz) {
        g.seiten.textContent = "W" + e.wuerfelSeiten;
        g.art.textContent = "";
      }
      if (dauer === 0) {
        zeige(e.wurf, art, e.wuerfelSeiten);
        return Promise.resolve();
      }
      return new Promise(function (fertig) {
        lauf = { e: e, art: art, animationen: [], zeit: null, fertig: fertig, gross: gross };
        if (ohneBewegung()) {
          // Nichts dreht sich: kurz abgedunkelt warten, dann das Ergebnis
          klein.classList.add("wartet");
          if (platz) g.flaeche.classList.add("wartet");
          kleinZahl.textContent = "…";
          if (platz) g.zahl.textContent = "…";
          lauf.zeit = setTimeout(function () { lande(false); }, dauer);
          return;
        }
        const flugDauer = dauer * (1 - W.landung);
        const ziel = gross ? g.koerper : klein;
        if (gross) g.flaeche.classList.add("rollt");
        klein.classList.add("rollt");
        const flug = ziel.animate(gross ? flugBilder() : drehBilder(),
          { duration: flugDauer, easing: gross ? "linear" : "cubic-bezier(0.2, 0.7, 0.3, 1)" });
        lauf.animationen.push(flug);
        flackern(e.wuerfelSeiten, e.wurf, flugDauer);
        flug.onfinish = function () { aufprall(dauer * W.landung); };
      });
    }

    /** Aufprall: kurzes Stauchen, dann ist der Würfel gelandet. */
    function aufprall(ms) {
      if (!lauf) return;
      clearTimeout(lauf.zeit);
      zeige(lauf.e.wurf, lauf.art, lauf.e.wuerfelSeiten);
      const ziel = lauf.gross ? g.koerper : klein;
      const stoss = ziel.animate([
        { transform: "scale(1.16, 0.84)" },
        { transform: "scale(0.94, 1.06)" },
        { transform: "none" },
      ], { duration: ms, easing: "ease-out" });
      lauf.animationen.push(stoss);
      landeVariante(lauf.art, lauf.gross);
      stoss.onfinish = function () { lande(true); };
    }

    /** Je nach Ergebnis: Aufleuchten mit Erschütterung (kritisch), müdes Umkippen (Fehlschlag) … */
    function landeVariante(art, gross) {
      if (art === "kritisch" && gross) {
        g.flaeche.animate([
          { transform: "none" }, { transform: "translate(-6px, 3px)" }, { transform: "translate(5px, -4px)" },
          { transform: "translate(-3px, 2px)" }, { transform: "none" },
        ], { duration: 360, easing: "linear" });
      }
      // Das Umkippen beim Fehlschlag und das Leuchten beim kritischen Treffer
      // erledigt das CSS über data-art (siehe css/sudoku-rpg.css)
    }

    /** Der Wurf ist zu Ende (gelandet oder übersprungen). */
    function lande(mitAufprall) {
      const l = lauf;
      if (!l) return;
      lauf = null;
      clearTimeout(l.zeit);
      l.animationen.forEach(function (a) { a.onfinish = null; a.cancel(); });
      zeige(l.e.wurf, l.art, l.e.wuerfelSeiten);
      if (!mitAufprall && l.art === "kritisch" && l.gross && !ohneBewegung()) landeVariante(l.art, true);
      l.fertig();
    }

    /** Laufenden Wurf sofort beenden – er zeigt dann direkt sein Ergebnis. */
    function ueberspringe() {
      if (lauf) lande(false);
    }

    /** Mitte der Zahl auf dem gerade sichtbaren Würfel (Seitenkoordinaten). */
    function punkt() {
      const r = (grossSichtbar() ? g.zahl : klein).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    return { rolle: rolle, ueberspringe: ueberspringe, zeige: zeige, punkt: punkt, gross: grossSichtbar };
  }

  /**
   * Baut ein Kampffenster.
   * @param {HTMLElement} container – wohin das Fenster gezeichnet wird
   * @param {object} optionen
   *   beimZuruecksetzen – Funktion, die bei Klick auf "Abenteuer zurücksetzen" läuft
   *   wuerfelPlatz      – Element für den großen Würfel (Desktop), optional
   *   gitterFeld(i)     – liefert Feld i des Sudokus (Herkunft des Doppelschadens)
   *   gradAnzeige       – Element mit der Schwierigkeit (Herkunft des Schwierigkeitsbonus)
   * @returns {object} Steuerung des Fensters (siehe unten "return")
   */
  function erstelle(container, optionen) {
    container.innerHTML =
      '<section class="kampf" aria-label="Kampf">' +
        '<div class="kampf-buehne">' +
          // Boss oben: Infokasten links (mit Eigenheit), Figur rechts
          '<div class="kampf-info kampf-info--boss">' +
            '<div class="kampf-name"><span class="kampf-boss-name"></span> <span class="kampf-boss-nr"></span></div>' +
            '<button type="button" class="kampf-eigenheit hat-tipp">' +
              '<span class="kampf-eigenheit-name"></span>' + tippHtml() +
            "</button>" +
            // Nur bei Elite-Bossen: die seltene Eigenschaft
            '<button type="button" class="kampf-selten hat-tipp" hidden>' +
              '<span class="kampf-selten-marke">Selten</span><span class="kampf-selten-name"></span>' + tippHtml() +
            "</button>" +
            '<div class="kampf-hp"><span class="kampf-hp-label">HP</span>' +
              '<div class="kampf-hp-balken"><div class="kampf-hp-fuellung"></div></div>' +
            "</div>" +
            // Links: wann der nächste Elite-Boss kommt bzw. Zähler der seltenen Eigenschaft
            '<div class="kampf-hp-zeile"><span class="kampf-elite-hinweis"></span><span class="kampf-hp-zahl"></span></div>' +
          "</div>" +
          '<div class="kampf-figur kampf-figur--boss"><canvas class="kampf-boss"></canvas></div>' +
          // Held unten: Figur links, Herzen, Münzen und Würfel rechts
          '<div class="kampf-figur kampf-figur--held"><canvas class="kampf-held"></canvas></div>' +
          '<div class="kampf-info kampf-info--held">' +
            '<div class="kampf-herzen" role="img"></div>' +
            '<div class="kampf-info-zeile">' +
              // Münzstand mit Münzsymbol
              '<div class="kampf-muenzen" role="img">' + symbolSvg("muenze") +
                '<span class="kampf-muenzen-zahl">0</span></div>' +
              '<div class="kampf-wuerfel" role="img"><span class="kampf-wuerfel-zahl">–</span></div>' +
            "</div>" +
          "</div>" +
          // Kurzes Aufblitzen bei kritischen Treffern
          '<div class="kampf-blitz" aria-hidden="true"></div>' +
          // Ebene für aufsteigende Zahlen und Hinweise
          '<div class="kampf-effekte" aria-hidden="true"></div>' +
        "</div>" +
        // Leiste unter der Bühne: Kombo und gesammelte Verbesserungen
        '<div class="kampf-leiste">' +
          '<div class="kampf-kombo" data-stufe="0" role="img">' +
            '<span class="kampf-kombo-titel">Kombo</span>' +
            '<span class="kampf-kombo-zahl">0</span>' +
            '<span class="kampf-kombo-bonus"></span>' +
          "</div>" +
          '<div class="kampf-verbesserungen" role="list" aria-label="Deine Verbesserungen"></div>' +
        "</div>" +
        // Kurze Meldungen für Screenreader (unsichtbar, wird vorgelesen)
        '<p class="kampf-status nur-vorlesen" role="status"></p>' +
        // Das Protokoll: letzter Treffer, Belohnung, Verlauf.
        // Auf schmalen Bildschirmen nur eine kompakte Zeile zum Aufklappen.
        '<div class="kampf-panel ist-leer">' +
          '<button type="button" class="panel-kurz" aria-expanded="false">' +
            '<span class="panel-kurz-titel">Letzter Zug</span>' +
            '<span class="panel-kurz-schaden">Noch kein Zug</span>' +
            '<span class="panel-kurz-muenzen"></span>' +
            '<span class="panel-kurz-pfeil" aria-hidden="true">▾</span>' +
          "</button>" +
          '<div class="panel-details">' +
            '<div class="panel-oben">' +
              '<p class="panel-hinweis">Setze eine Zahl. Hier siehst du dann, wie dein Schaden entsteht und welche Münzen du bekommst.</p>' +
              '<section class="panel-block panel-treffer" aria-label="Letzter Treffer">' +
                '<h3 class="panel-titel">Letzter Treffer</h3>' +
                '<div class="panel-zeilen"></div>' +
                '<div class="panel-summe"><span class="panel-label">Gesamt</span><span class="panel-wert"></span></div>' +
              "</section>" +
              '<section class="panel-block panel-belohnung" aria-label="Belohnung">' +
                '<h3 class="panel-titel">Belohnung</h3>' +
                '<div class="panel-zeilen"></div>' +
                '<div class="panel-summe"><span class="panel-label">Summe</span><span class="panel-wert"></span></div>' +
              "</section>" +
            "</div>" +
            '<section class="panel-block panel-verlauf" aria-label="Verlauf">' +
              '<h3 class="panel-titel">Verlauf</h3>' +
              '<ol class="panel-verlauf-liste"></ol>' +
            "</section>" +
          "</div>" +
        "</div>" +
        '<div class="kampf-fuss">' +
          '<span class="kampf-rekord"></span>' +
          '<button type="button" class="kampf-reset">Abenteuer zurücksetzen</button>' +
        "</div>" +
      "</section>";

    const el = {
      bossName: container.querySelector(".kampf-boss-name"),
      bossNr: container.querySelector(".kampf-boss-nr"),
      eigenheit: container.querySelector(".kampf-eigenheit"),
      eigenheitName: container.querySelector(".kampf-eigenheit-name"),
      eigenheitTipp: container.querySelector(".kampf-eigenheit .kampf-tipp"),
      hpFuellung: container.querySelector(".kampf-hp-fuellung"),
      hpBalken: container.querySelector(".kampf-hp-balken"),
      hpZahl: container.querySelector(".kampf-hp-zahl"),
      bossInfo: container.querySelector(".kampf-info--boss"),
      selten: container.querySelector(".kampf-selten"),
      seltenName: container.querySelector(".kampf-selten-name"),
      seltenTipp: container.querySelector(".kampf-selten .kampf-tipp"),
      eliteHinweis: container.querySelector(".kampf-elite-hinweis"),
      bossFigur: container.querySelector(".kampf-figur--boss"),
      bossCanvas: container.querySelector(".kampf-boss"),
      heldFigur: container.querySelector(".kampf-figur--held"),
      heldCanvas: container.querySelector(".kampf-held"),
      herzen: container.querySelector(".kampf-herzen"),
      wuerfel: container.querySelector(".kampf-wuerfel"),
      wuerfelZahl: container.querySelector(".kampf-wuerfel-zahl"),
      blitz: container.querySelector(".kampf-blitz"),
      effekte: container.querySelector(".kampf-effekte"),
      buehne: container.querySelector(".kampf-buehne"),
      muenzen: container.querySelector(".kampf-muenzen"),
      muenzenZahl: container.querySelector(".kampf-muenzen-zahl"),
      kombo: container.querySelector(".kampf-kombo"),
      komboZahl: container.querySelector(".kampf-kombo-zahl"),
      komboBonus: container.querySelector(".kampf-kombo-bonus"),
      verbesserungen: container.querySelector(".kampf-verbesserungen"),
      status: container.querySelector(".kampf-status"),
      panel: container.querySelector(".kampf-panel"),
      kurz: container.querySelector(".panel-kurz"),
      kurzSchaden: container.querySelector(".panel-kurz-schaden"),
      kurzMuenzen: container.querySelector(".panel-kurz-muenzen"),
      trefferZeilen: container.querySelector(".panel-treffer .panel-zeilen"),
      trefferSumme: container.querySelector(".panel-treffer .panel-summe"),
      belohnungZeilen: container.querySelector(".panel-belohnung .panel-zeilen"),
      belohnungSumme: container.querySelector(".panel-belohnung .panel-summe"),
      verlauf: container.querySelector(".panel-verlauf-liste"),
      rekord: container.querySelector(".kampf-rekord"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    const wuerfel = erstelleWuerfel(optionen && optionen.wuerfelPlatz, el.wuerfel, el.wuerfelZahl,
      function () { beschleunige(); });

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Smartphone: Antippen der kompakten Zeile klappt die drei Blöcke auf
    el.kurz.addEventListener("click", function () {
      const offen = el.panel.classList.toggle("offen");
      el.kurz.setAttribute("aria-expanded", String(offen));
    });

    // Erklärtexte: Darüberfahren zeigt sie (CSS), Antippen/Klicken klappt sie
    // auf und wieder zu. Ein Klick woanders schließt sie.
    container.addEventListener("click", function (event) {
      const knopf = event.target.closest(".hat-tipp");
      container.querySelectorAll(".hat-tipp.offen").forEach(function (k) {
        if (k !== knopf) { k.classList.remove("offen"); k.setAttribute("aria-expanded", "false"); }
      });
      if (knopf && !knopf.disabled) {
        const offen = knopf.classList.toggle("offen");
        knopf.setAttribute("aria-expanded", String(offen));
      }
    });
    document.addEventListener("click", function (event) {
      if (!container.contains(event.target)) {
        container.querySelectorAll(".hat-tipp.offen").forEach(function (k) {
          k.classList.remove("offen");
          k.setAttribute("aria-expanded", "false");
        });
      }
    });

    // Was gerade ANGEZEIGT wird (kann wegen der Warteschlange kurz hinter
    // dem echten Spielstand liegen)
    const anzeige = { bossNummer: 0, muenzen: 0, kombo: 0, maxLeben: SudokuRPG.KONFIG.maxLeben };
    const K = SudokuRPG.KONFIG;

    /* ---------- Warteschlange ----------
       Jeder Schritt bekommt eine Nummer. Kommt ein neuer Zug, bevor die
       Animationen des letzten fertig sind, werden alle älteren Schritte
       "eilig": Sie springen sofort zu ihrem Ende (beschleunige). So staut
       sich nichts an. */
    let kette = Promise.resolve();
    let schrittNummer = 0;       // zuletzt vergebene Nummer
    let laufend = 0;             // Nummer des gerade laufenden Schritts (0 = keiner)
    let eiligBis = 0;            // alle Schritte bis zu dieser Nummer laufen ohne Wartezeit
    const wartende = new Set();  // laufende Wartezeiten – beschleunige() beendet sie sofort

    function einreihen(schritt) {
      const nummer = ++schrittNummer;
      kette = kette
        .then(function () { laufend = nummer; return schritt(); })
        .catch(function (fehler) { console.error(fehler); })
        .then(function () { if (laufend === nummer) laufend = 0; });
      return kette;
    }

    /** Läuft gerade ein Schritt, der übersprungen werden soll? */
    function eilig() {
      return laufend !== 0 && laufend <= eiligBis;
    }

    /** Alle bisher eingereihten Schritte sofort zu Ende bringen (der Würfel landet sofort). */
    function beschleunige() {
      eiligBis = schrittNummer;
      wartende.forEach(function (sofort) { sofort(); });
      wuerfel.ueberspringe();
      SudokuSchadenFx.aufraeumen();
    }

    /** Pause, die auch bei "Bewegung reduzieren" wartet (z. B. Hochzählen an Ort und Stelle). */
    function pause(ms) {
      if (ms <= 0 || eilig()) return Promise.resolve();
      return wartezeit(ms);
    }

    /** Wartet ms Millisekunden – außer bei "Bewegung reduzieren" oder wenn es eilt. */
    function warte(ms) {
      if (ohneBewegung() || ms <= 0 || eilig()) return Promise.resolve();
      return wartezeit(ms);
    }

    /** Eine Wartezeit, die beschleunige() abbrechen kann. */
    function wartezeit(ms) {
      return new Promise(function (fertig) {
        const sofort = function () { clearTimeout(zeit); wartende.delete(sofort); fertig(); };
        const zeit = setTimeout(sofort, ms);
        wartende.add(sofort);
      });
    }

    /** Setzt eine CSS-Klasse für eine Animation – startet sie auch neu, falls sie gerade läuft. */
    function animiere(element, klasse, ms) {
      if (ohneBewegung() || eilig()) return Promise.resolve();
      element.classList.remove(klasse);
      void element.offsetWidth;            // Browser "bemerkt" das Entfernen → Neustart möglich
      element.classList.add(klasse);
      return warte(ms).then(function () { element.classList.remove(klasse); });
    }


    /* ---------- Bausteine der Anzeige ---------- */

    function zeigeBoss(boss) {
      if (anzeige.bossNummer !== boss.nummer) {
        SudokuSprites.zeichne(el.bossCanvas, boss.sprite, boss.runde);
        anzeige.bossNummer = boss.nummer;
      }
      el.bossName.textContent = boss.name;
      // Elite-Boss: Zusatz "Elite" am Namen, größere Figur mit Aura, eigener HP-Rahmen (CSS)
      el.bossNr.textContent = boss.elite ? "★ Elite" : "Nr. " + boss.nummer;
      el.bossNr.title = "Boss Nr. " + boss.nummer;
      el.buehne.classList.toggle("ist-elite", boss.elite);
      zeigeEigenheit(boss.eigenheit);
      zeigeSelten(boss.elite ? boss.selten : null);
      // Klein links unter dem HP-Balken: Zähler der seltenen Eigenschaft bzw.
      // bei normalen Bossen, wann der nächste Elite-Boss kommt
      let hinweis = "";
      if (boss.elite) {
        hinweis = boss.selten && boss.selten.zaehlerText ? "🛡 " + boss.selten.zaehlerText : "";
      } else if (boss.bisElite !== null) {
        hinweis = boss.bisElite === 1 ? "Nächster: Elite!" : "Elite in " + boss.bisElite;
      }
      el.eliteHinweis.textContent = hinweis;
      el.eliteHinweis.title = boss.elite ? "" : "So viele Bosse bis zum nächsten Elite-Boss";
    }

    /** Seltene Eigenschaft unter der Eigenheit – mit Kennzeichnung "Selten" und Erklärung. */
    function zeigeSelten(selten) {
      el.selten.classList.remove("offen");
      el.selten.hidden = !selten;
      if (!selten) return;
      el.selten.style.setProperty("--selten-farbe", selten.farbe);
      el.seltenName.textContent = selten.name;
      el.seltenTipp.textContent = "Selten – " + selten.name + ": " + selten.beschreibung;
      el.selten.setAttribute("aria-label", "Seltene Eigenschaft " + selten.name + ": " + selten.beschreibung);
      el.selten.setAttribute("aria-expanded", "false");
    }

    /** Eigenheit unter dem Bossnamen – mit Erklärung beim Darüberfahren/Antippen. */
    function zeigeEigenheit(eigenheit) {
      el.eigenheit.classList.remove("offen");
      el.eigenheit.disabled = !eigenheit;
      el.eigenheit.classList.toggle("ist-leer", !eigenheit);
      if (!eigenheit) {
        el.eigenheitName.textContent = "Keine Eigenheit";
        el.eigenheitTipp.textContent = "";
        el.eigenheit.removeAttribute("aria-label");
        el.eigenheit.removeAttribute("aria-expanded");
        return;
      }
      el.eigenheit.style.setProperty("--eigenheit-farbe", eigenheit.farbe);
      el.eigenheitName.textContent = "⚠ " + eigenheit.name;
      el.eigenheitTipp.textContent = eigenheit.name + ": " + eigenheit.beschreibung;
      el.eigenheit.setAttribute("aria-label", "Eigenheit " + eigenheit.name + ": " + eigenheit.beschreibung);
      el.eigenheit.setAttribute("aria-expanded", "false");
    }

    function zeigeHp(hp, maxHp) {
      const anteil = Math.max(0, hp) / maxHp;
      el.hpFuellung.style.width = (anteil * 100) + "%";
      // Farbe wie in klassischen Spielen: grün → gelb → rot
      el.hpBalken.dataset.stufe = anteil > 0.5 ? "voll" : anteil > 0.2 ? "mittel" : "knapp";
      el.hpZahl.textContent = Math.max(0, hp) + "/" + maxHp;
      el.hpBalken.setAttribute("aria-label", "HP " + Math.max(0, hp) + " von " + maxHp);
    }

    /**
     * Leben als Herzen. Es gibt immer mindestens so viele Plätze wie
     * Startleben (verlorene sind leer), bei mehr Leben entsprechend mehr.
     */
    function zeigeHerzen(leben, maxLeben) {
      if (maxLeben) anzeige.maxLeben = maxLeben;
      const plaetze = Math.max(K.startLeben, leben);
      if (el.herzen.children.length !== plaetze) {
        el.herzen.innerHTML = "";
        for (let i = 0; i < plaetze; i++) {
          const herz = document.createElement("span");
          herz.className = "kampf-herz";
          herz.innerHTML = HERZ_SVG;
          el.herzen.appendChild(herz);
        }
      }
      Array.from(el.herzen.children).forEach(function (herz, i) {
        herz.classList.toggle("ist-leer", i >= leben);
      });
      el.herzen.setAttribute("aria-label", leben + " Leben (höchstens " + anzeige.maxLeben + ")");
    }

    /**
     * Münzstand. animiert = true: Der Zähler zählt in kleinen Schritten hoch (oder runter).
     */
    function zeigeMuenzen(ziel, animiert) {
      const start = anzeige.muenzen;
      anzeige.muenzen = ziel;
      el.muenzen.setAttribute("aria-label", ziel + " Münzen");
      if (!animiert || ohneBewegung() || ziel === start) {
        el.muenzenZahl.textContent = ziel;
        return Promise.resolve();
      }
      return new Promise(function (fertig) {
        const dauer = 420;
        const t0 = performance.now();
        function schritt(jetzt) {
          const anteil = Math.min(1, (jetzt - t0) / dauer);
          el.muenzenZahl.textContent = Math.round(start + (ziel - start) * (eilig() ? 1 : anteil));
          if (anteil < 1 && !eilig()) {
            requestAnimationFrame(schritt);
          } else {
            el.muenzenZahl.textContent = ziel;
            fertig();
          }
        }
        requestAnimationFrame(schritt);
      });
    }

    /**
     * Kombo-Zähler. Je höher die Kombo, desto auffälliger (data-stufe 0–4, siehe CSS).
     * pulsieren = true: kurzes Aufpulsen beim Anstieg.
     */
    function zeigeKombo(kombo, bonus, pulsieren) {
      anzeige.kombo = kombo;
      const stufe = kombo === 0 ? 0 : kombo < 3 ? 1 : kombo < 6 ? 2 : kombo < 10 ? 3 : 4;
      el.kombo.dataset.stufe = stufe;
      el.komboZahl.textContent = kombo;
      el.komboBonus.textContent = bonus > 0 ? "+" + Math.round(bonus * 100) + " %" : "";
      el.kombo.setAttribute("aria-label", kombo === 0
        ? "Keine Kombo"
        : "Kombo " + kombo + ", " + Math.round(bonus * 100) + " Prozent mehr Schaden");
      if (pulsieren) animiere(el.kombo, "pulsiert", 300);
    }

    /** Kombo zerbricht: zwei Hälften fallen auseinander, der Zähler steht wieder auf 0. */
    function zerbrichKombo() {
      if (!ohneBewegung()) {
        const rahmen = el.kombo.getBoundingClientRect();
        const leiste = el.kombo.parentNode.getBoundingClientRect();
        ["links", "rechts"].forEach(function (seite) {
          const haelfte = el.kombo.cloneNode(true);
          haelfte.removeAttribute("role");
          haelfte.setAttribute("aria-hidden", "true");
          haelfte.className = "kampf-kombo kampf-kombo-scherbe kampf-kombo-scherbe--" + seite;
          haelfte.style.left = (rahmen.left - leiste.left) + "px";
          haelfte.style.top = (rahmen.top - leiste.top) + "px";
          haelfte.style.width = rahmen.width + "px";
          el.kombo.parentNode.appendChild(haelfte);
          setTimeout(function () { haelfte.remove(); }, 650);
        });
      }
      zeigeKombo(0, 0, false);
      return faerbe(el.kombo, "zerbrochen", 650);
    }

    /** Gesammelte Verbesserungen als kleine Symbole mit Stufe. */
    function zeigeVerbesserungen(liste, neueId) {
      el.verbesserungen.innerHTML = "";
      if (liste.length === 0) {
        const leer = document.createElement("span");
        leer.className = "kampf-verbesserungen-leer";
        leer.textContent = "Noch keine Verbesserungen";
        el.verbesserungen.appendChild(leer);
        return;
      }
      liste.forEach(function (v) {
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "kampf-chip hat-tipp";
        knopf.dataset.id = v.id;           // Herkunft fliegender Boni (sudoku-damage-fx.js)
        knopf.setAttribute("role", "listitem");
        knopf.style.setProperty("--chip-farbe", v.farbe);
        knopf.innerHTML = symbolSvg(v.symbol) + '<span class="kampf-chip-stufe"></span>' + tippHtml();
        knopf.querySelector(".kampf-chip-stufe").textContent = v.stufe;
        knopf.querySelector(".kampf-tipp").textContent =
          v.name + " – Stufe " + v.stufe + "/" + v.maxStufe + ": " + v.beschreibung + " (je Stufe)";
        knopf.setAttribute("aria-label", v.name + ", Stufe " + v.stufe + " von " + v.maxStufe + ": " + v.beschreibung + " (je Stufe)");
        knopf.setAttribute("aria-expanded", "false");
        el.verbesserungen.appendChild(knopf);
        if (v.id === neueId) animiere(knopf, "ist-neu", 600);
      });
    }

    function zeigeWurf(zahl) {
      wuerfel.zeige(zahl, "");
    }

    function zeigeRekord(boss, rekord) {
      // Kurz, damit die Fußzeile in eine Zeile passt (die Bossnummer steht im Kampffenster)
      el.rekord.textContent = "Rekord: " + (rekord === 0 ? "noch keiner" : rekord + (rekord === 1 ? " Boss" : " Bosse"));
      el.rekord.title = "Höchster besiegter Boss";
    }

    /** Kurze Meldung für Screenreader (die sichtbare Darstellung übernimmt das Panel). */
    function meldung(text) {
      el.status.textContent = text;
    }


    /* ---------- Das Panel: letzter Treffer, Belohnung, Verlauf ----------
       Aktualisiert wird in der Warteschlange: ein Treffer erst, wenn der
       Würfel gelandet ist. Kommt ein neuer Zug, springen die älteren sofort
       zu ihrem Ende – das Panel zeigt also immer den neuesten gelandeten Zug. */

    const VERLAUF_LAENGE = 5;

    /** Hebt ein Element kurz hervor (nur Farbe – auch bei "Bewegung reduzieren"). */
    function hervorheben(element) {
      element.classList.remove("panel-neu");
      void element.offsetWidth;
      element.classList.add("panel-neu");
      clearTimeout(element.hervorhebung);
      element.hervorhebung = setTimeout(function () { element.classList.remove("panel-neu"); }, 900);
    }

    /** Eine Zeile "Bezeichnung … Wert" setzen – nur Geändertes wird hervorgehoben. */
    function setzeZeile(zeile, eintrag, immerHervorheben) {
      const label = zeile.querySelector(".panel-label");
      const wert = zeile.querySelector(".panel-wert");
      const geaendert = label.textContent !== eintrag.label || wert.textContent !== eintrag.wert;
      label.textContent = eintrag.label;
      wert.textContent = eintrag.wert;
      zeile.className = zeile.className.split(" ").filter(function (k) {
        return k.indexOf("panel-zeile--") !== 0 && k.indexOf("panel-summe--") !== 0;
      }).join(" ");
      if (eintrag.art) zeile.classList.add((zeile.classList.contains("panel-summe") ? "panel-summe--" : "panel-zeile--") + eintrag.art);
      if (eintrag.farbe) zeile.style.setProperty("--zeilen-farbe", eintrag.farbe);
      else zeile.style.removeProperty("--zeilen-farbe");
      if (geaendert || immerHervorheben) hervorheben(zeile);
    }

    /**
     * Bringt eine Liste von Zeilen auf den neuen Stand. Vorhandene Zeilen
     * (gleicher key) bleiben stehen und werden nur aktualisiert – so springt nichts.
     * @param {object[]} eintraege – { key, label, wert, art, farbe }
     */
    function setzeZeilen(container, eintraege) {
      const alte = {};
      Array.from(container.children).forEach(function (z) { alte[z.dataset.key] = z; });
      eintraege.forEach(function (eintrag) {
        let zeile = alte[eintrag.key];
        if (zeile) {
          delete alte[eintrag.key];
        } else {
          zeile = document.createElement("div");
          zeile.className = "panel-zeile";
          zeile.dataset.key = eintrag.key;
          zeile.innerHTML = '<span class="panel-label"></span><span class="panel-wert"></span>';
        }
        setzeZeile(zeile, eintrag, false);
        container.appendChild(zeile);         // bringt die Zeilen in die richtige Reihenfolge
      });
      Object.keys(alte).forEach(function (key) { alte[key].remove(); });
    }

    /**
     * Zeigt einen Zug im Panel.
     * @param {object} zug – { treffer: [Zeilen], schaden: {wert, art},
     *                         belohnung: [Zeilen], muenzen: {wert, art},
     *                         kurz: {schaden, schadenArt, muenzen} }
     */
    function zeigeZug(zug) {
      el.panel.classList.remove("ist-leer");
      setzeZeilen(el.trefferZeilen, zug.treffer);
      setzeZeile(el.trefferSumme, zug.schaden, true);
      setzeZeilen(el.belohnungZeilen, zug.belohnung);
      setzeZeile(el.belohnungSumme, zug.muenzen, true);
      el.kurzSchaden.textContent = zug.kurz.schaden;
      el.kurzSchaden.dataset.art = zug.kurz.schadenArt || "";
      el.kurzMuenzen.textContent = zug.kurz.muenzen;
      el.kurzMuenzen.dataset.art = zug.kurz.muenzenArt || "";
      hervorheben(el.kurz);
    }

    /**
     * Neuer Eintrag oben im Verlauf; der älteste fällt nach fünf Einträgen weg.
     * @param {object} e – { text, wert, art, symbol, farbe }
     */
    function verlaufEintrag(e) {
      const li = document.createElement("li");
      li.className = "panel-eintrag" + (e.art ? " panel-eintrag--" + e.art : "");
      if (e.farbe) li.style.setProperty("--zeilen-farbe", e.farbe);
      li.innerHTML = '<span class="panel-symbol">' + (e.symbol ? symbolSvg(e.symbol) : "") + "</span>" +
        '<span class="panel-eintrag-text"></span><span class="panel-eintrag-wert"></span>';
      li.querySelector(".panel-eintrag-text").textContent = e.text;
      li.querySelector(".panel-eintrag-wert").textContent = e.wert || "";
      el.verlauf.insertBefore(li, el.verlauf.firstChild);
      while (el.verlauf.children.length > VERLAUF_LAENGE) el.verlauf.lastChild.remove();
      hervorheben(li);
    }

    /** Name eines Schwierigkeitsgrads → seine id (für die Zeile "Schwierigkeit"). */
    function gradMitName(name) {
      return SudokuEngine.SCHWIERIGKEITSGRADE.find(function (g) { return g.name === name; });
    }

    /**
     * Die Schadensrechnung als Zeilen. Gelesen wird aus rechnung.schritte –
     * so erscheinen genau die Stufen, die bei diesem Treffer gewirkt haben
     * (auch solche aus Erweiterungen).
     */
    function rechnungsZeilen(e) {
      const zeilen = [];
      if (e.immun) {
        // "Wurf 6 · gerade · immun" – sonst wurde nichts berechnet
        return [
          { key: "wurf", label: "Wurf", wert: String(e.wurf) },
          { key: "immun", label: e.selten.grund, wert: e.selten.art, art: "selten", farbe: e.selten.farbe },
          { key: "selten", label: e.selten.name, wert: "", art: "notiz" },
        ];
      }
      e.rechnung.schritte.forEach(function (schritt, i) {
        const teil = /^(.*) (\S+)$/.exec(schritt);
        const name = teil ? teil[1] : schritt;
        const wert = teil ? teil[2] : "";
        const grad = gradMitName(name);
        if (name === "Wurf") {
          zeilen.push({ key: "wurf", label: "Wurf", wert: wert });
        } else if (name === "Kritisch") {
          zeilen.push({ key: "kritisch", label: "Kritisch", wert: wert, art: "kritisch" });
        } else if (schritt === "Fehlschlag") {
          zeilen.push({ key: "fehlschlag", label: "Fehlschlag", wert: "×0", art: "daneben" });
        } else if (name === "Zuschlag") {
          zeilen.push({ key: "zuschlag", label: "Zuschlag", wert: wert });
        } else if (name === "Kombo") {
          zeilen.push({ key: "kombo", label: "Kombo", wert: wert });
        } else if (grad) {
          zeilen.push({ key: "schwierigkeit", label: "Schwierigkeit",
            wert: "+" + Math.round(SudokuRPG.belohnung(grad.id).schadensBonus * 100) + " %" });
        } else if (name === "Doppelt") {
          zeilen.push({ key: "doppelt", label: "Doppelschaden", wert: wert, art: "doppelt" });
        } else if (e.boss.selten && name === e.boss.selten.name) {
          zeilen.push({ key: "selten", label: name, wert: wert, art: "selten", farbe: e.boss.selten.farbe });
        } else if (e.eigenheit && name === e.eigenheit.name) {
          zeilen.push({ key: "eigenheit", label: name, wert: wert, art: "eigenheit", farbe: e.eigenheit.farbe });
        } else {
          zeilen.push({ key: "schritt" + i, label: name, wert: wert });
        }
      });
      if (e.gift > 0) zeilen.push({ key: "gift", label: "Gift", wert: "+" + e.gift, art: "gift" });
      if (e.fehlschlag && e.spruch) zeilen.push({ key: "spruch", label: e.spruch, wert: "", art: "notiz" });
      return zeilen;
    }

    /** Münzen dieses Zugs mit Grund, dazu ein gewonnenes Leben. */
    function belohnungsZeilen(e) {
      const zeilen = [];
      const proZahl = e.werte ? e.werte.muenzenProZahl : K.muenzen.proZahl;
      zeilen.push({ key: "zahl", label: "Zahl", wert: "+" + proZahl });
      if (e.einheiten.zeile) zeilen.push({ key: "zeile", label: "Zeile", wert: "+" + K.muenzen.proZeileOderSpalte });
      if (e.einheiten.spalte) zeilen.push({ key: "spalte", label: "Spalte", wert: "+" + K.muenzen.proZeileOderSpalte });
      if (e.einheiten.block) zeilen.push({ key: "block", label: "Block", wert: "+" + K.muenzen.proBlock });
      if (e.powerup && e.powerupEffekt && e.powerupEffekt.muenzen > 0) {
        zeilen.push({ key: "powerup", label: e.powerup.name + "feld", wert: "+" + e.powerupEffekt.muenzen, art: "gold" });
      }
      if (e.muenzFaktor !== 1) {
        zeilen.push({ key: "faktor", label: "Schwierigkeit", wert: "×" + SudokuRPG.zahlText(e.muenzFaktor) });
      }
      if (e.eliteBonus > 0) zeilen.push({ key: "elite", label: "Elite-Bonus", wert: "+" + e.eliteBonus, art: "gold" });
      if (e.lebenPlus > 0) {
        zeilen.push({ key: "leben", label: "Leben", wert: "+" + e.lebenPlus, art: "leben" });
      } else if (e.lebenGewuenscht > 0) {
        zeilen.push({ key: "leben", label: "Leben", wert: "schon voll", art: "daneben" });
      }
      return zeilen;
    }

    function muenzenText(n) {
      return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);
    }

    /** Panel und Verlauf nach einer richtigen Zahl. */
    function protokolliereTreffer(e) {
      const gesamt = e.schaden + e.gift;
      const muenzen = e.muenzenPlus + e.eliteBonus;
      const art = e.immun ? "selten" : e.kritisch ? "kritisch" : e.fehlschlag ? "daneben" :
        e.eigenheit ? "eigenheit" : e.doppelt ? "doppelt" : "";
      const farbe = e.immun ? e.selten.farbe : e.eigenheit ? e.eigenheit.farbe : null;
      let kurz = gesamt + " Schaden";
      if (e.immun) kurz = e.selten.art === "geblockt" ? "Geblockt" : "Immun";
      else if (e.fehlschlag) kurz = "Fehlschlag";
      else if (e.eigenheit) kurz = "Geblockt";
      zeigeZug({
        treffer: rechnungsZeilen(e),
        schaden: { label: "Gesamt", wert: String(gesamt), art: art, farbe: farbe },
        belohnung: belohnungsZeilen(e),
        muenzen: { label: "Summe", wert: muenzenText(muenzen), art: "gold" },
        kurz: { schaden: kurz, schadenArt: art, muenzen: muenzenText(muenzen) + " Münzen" },
      });
      if (e.immun) {
        verlaufEintrag({ text: e.selten.name + ": Wurf " + e.wurf + " " + e.selten.art, wert: "0", art: "selten", symbol: "stern", farbe: e.selten.farbe });
      } else if (e.kritisch) {
        verlaufEintrag({ text: e.doppelt ? "Kritisch und doppelt!" : "Kritischer Treffer", wert: "−" + gesamt, art: "kritisch", symbol: "blitz" });
      } else if (e.fehlschlag) {
        verlaufEintrag({ text: "Fehlschlag", wert: "0", art: "daneben", symbol: "kreuz" });
      } else if (e.eigenheit) {
        verlaufEintrag({ text: e.eigenheit.name + " blockt", wert: "0", art: "eigenheit", symbol: "warnung", farbe: e.eigenheit.farbe });
      } else {
        verlaufEintrag({ text: e.doppelt ? "Doppelschaden" : "Treffer", wert: "−" + gesamt, art: e.doppelt ? "doppelt" : "" });
      }
    }

    /** Panel und Verlauf nach einer falschen Zahl. */
    function protokolliereFehler(e) {
      const treffer = [{ key: "falsch", label: "Falsche Zahl", wert: "✕", art: "fehler" }];
      if (e.komboVorher > 0) treffer.push({ key: "kombo", label: "Kombo", wert: e.komboVorher + " → 0", art: "fehler" });
      if (e.eigenheit && e.hp !== e.hpVorher) {
        treffer.push({ key: "eigenheit", label: e.eigenheit.name, wert: "+" + (e.hp - e.hpVorher) + " HP", art: "eigenheit", farbe: e.eigenheit.farbe });
      }
      const belohnung = [{ key: "leben", label: "Leben", wert: "−1", art: "fehler" }];
      const verlust = e.muenzen - e.muenzenVorher;
      if (verlust < 0) {
        belohnung.push({ key: "dieb", label: e.eigenheit ? e.eigenheit.name : "Verlust", wert: muenzenText(verlust), art: "fehler" });
      }
      zeigeZug({
        treffer: treffer,
        schaden: { label: "Gesamt", wert: "0", art: "fehler" },
        belohnung: belohnung,
        muenzen: { label: "Summe", wert: muenzenText(verlust), art: verlust < 0 ? "fehler" : "" },
        kurz: { schaden: "Falsche Zahl", schadenArt: "fehler", muenzenArt: "fehler", muenzen: "−1 Leben" + (verlust < 0 ? " · " + muenzenText(verlust) + " Münzen" : "") },
      });
      verlaufEintrag({ text: "Falsche Zahl", wert: "−1 Leben", art: "fehler", symbol: "herz" });
      if (e.eigenheit) {
        verlaufEintrag({ text: e.eigenheit.name + ": " + e.eigenheit.text, wert: "", art: "eigenheit", symbol: "warnung", farbe: e.eigenheit.farbe });
      }
    }

    /** Zurück zum Hinweistext (neues Abenteuer). */
    function leerePanel() {
      el.panel.classList.add("ist-leer");
      el.trefferZeilen.innerHTML = "";
      el.belohnungZeilen.innerHTML = "";
      el.verlauf.innerHTML = "";
      el.kurzSchaden.textContent = "Noch kein Zug";
      el.kurzSchaden.dataset.art = "";
      el.kurzMuenzen.textContent = "";
    }

    /**
     * Aufsteigende Zahl oder kurzes Wort.
     * Bei "Bewegung reduzieren" erscheint sie nur kurz an Ort und Stelle.
     * @param {string} ziel – "boss", "doppelt", "kritisch", "gift", "daneben",
     *                        "geblockt", "heilung", "muenzen" oder "muenzen-weg"
     */
    function schwebeZahl(text, ziel) {
      const zahl = document.createElement("span");
      zahl.className = "kampf-schwebezahl kampf-schwebezahl--" + ziel;
      zahl.textContent = text;
      el.effekte.appendChild(zahl);
      setTimeout(function () { zahl.remove(); }, 900);
    }

    /** Großer Hinweis mitten auf der Bühne (z. B. wenn eine Eigenheit auslöst). */
    function banner(text, farbe, art) {
      const b = document.createElement("div");
      b.className = "kampf-banner" + (art ? " kampf-banner--" + art : "");
      if (farbe) b.style.setProperty("--banner-farbe", farbe);
      b.textContent = text;
      el.effekte.appendChild(b);
      setTimeout(function () { b.remove(); }, art === "elite" || art === "elite-sieg" ? DAUER.eliteAuftritt : DAUER.banner);
      return b;
    }

    /** Eine Eigenheit hat ausgelöst: Hinweis auf der Bühne, Eigenheit blinkt auf. */
    function eigenheitAusgeloest(e) {
      banner(e.name + "! " + e.text.charAt(0).toUpperCase() + e.text.slice(1), e.farbe, "eigenheit");
      return faerbe(el.eigenheit, "ausgeloest", 900);
    }


    /* ---------- Öffentliche Schritte (laufen über die Warteschlange) ---------- */

    /**
     * Zeigt einen Stand SOFORT (ohne Animation) – z. B. nach dem Laden.
     * @param {object} stand – { boss, hp, leben, maxLeben, muenzen, rekord,
     *                           kombo, komboBonus, verbesserungen }
     */
    function zeigeStand(stand) {
      return einreihen(function () {
        zeigeBoss(stand.boss);
        zeigeHp(stand.hp, stand.boss.maxHp);
        zeigeHerzen(stand.leben, stand.maxLeben);
        zeigeMuenzen(stand.muenzen, false);
        zeigeKombo(stand.kombo, stand.komboBonus, false);
        zeigeVerbesserungen(stand.verbesserungen);
        zeigeRekord(stand.boss, stand.rekord);
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite");
      });
    }

    /** Fasst zusammen, was eine richtige Zahl bewirkt hat – mit der Rechnung. */
    function trefferText(e) {
      const teile = [];
      if (e.immun) {
        teile.push(e.selten.name + "! Wurf " + e.wurf + ", " + e.selten.grund + ", " + e.selten.art + ": kein Schaden.");
      } else if (e.fehlschlag) {
        teile.push(e.spruch);
      } else {
        let kopf = "";
        if (e.kritisch) kopf = "Kritischer Treffer! ";
        else if (e.eigenheit) kopf = e.eigenheit.name + "! ";
        else if (e.doppelt) kopf = "Doppelter Schaden! ";
        if (e.kritisch && e.doppelt) kopf += "Und doppelt! ";
        teile.push(kopf + e.rechnung.text + (e.gift > 0 ? " · Gift +" + e.gift : "") + ".");
      }
      if (e.powerup && e.lebenGewuenscht > 0) {
        teile.push(e.lebenPlus > 0 ? "+" + e.lebenPlus + " Leben!" : "Leben schon voll (" + e.maxLeben + ").");
      }
      if (e.powerup && e.powerup.typ === "gold") teile.push("Goldfeld!");
      teile.push("+" + e.muenzenPlus + (e.muenzenPlus === 1 ? " Münze." : " Münzen."));
      if (e.eliteBonus > 0) teile.push("Elite-Bonus +" + e.eliteBonus + " Münzen.");
      return teile.join(" ");
    }

    /**
     * Richtige Zahl: würfeln, zuschlagen (oder stolpern), Schaden, Gift,
     * Kombo, Münzen, Leben – kurz nacheinander.
     */
    /**
     * Alles, was der Schadensaufbau (js/sudoku-damage-fx.js) über die Seite
     * wissen muss: Punkte, Herkunft der Boni, Tempo, Wartezeiten.
     */
    function fxUmgebung(e) {
      const FX = SudokuSchadenFx.KONFIG;
      const stufe = wuerfelEinstellung();
      const handy = !wuerfel.gross();
      const mitte = function (element) {
        if (!element) return null;
        const r = element.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;      // unsichtbar
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const start = wuerfel.punkt();
      const versatz = handy ? FX.daneben.handy : FX.daneben.desktop;
      const held = el.heldFigur.getBoundingClientRect();
      return {
        aktiv: stufe.fx > 0,
        faktor: stufe.fx * (handy ? FX.faktorHandy : 1),
        reduziert: ohneBewegung(),
        start: start,
        daneben: { x: start.x + versatz.x, y: start.y + versatz.y },
        schwert: { x: held.left + held.width * FX.schwertPunkt.x, y: held.top + held.height * FX.schwertPunkt.y },
        boss: mitte(el.bossFigur),
        held: el.heldFigur,
        // Woher ein Bonus kommt
        quelle: function (name) {
          if (name === "kombo") return mitte(el.kombo);
          if (name === "klinge") return mitte(el.verbesserungen.querySelector('[data-id="klinge"]'));
          if (name === "selten") return el.selten.hidden ? null : mitte(el.selten);
          if (name === "grad") return mitte(optionen && optionen.gradAnzeige);
          if (name === "doppelt") return einheitMitte(e);
          return null;
        },
        warte: warte,
        pause: pause,
        eilig: eilig,
        beimSchritt: function (i, wert) { zeigeAufbau(e, i + 2, wert); },
      };
    }

    /** Mitte der Zeile, Spalte oder des Blocks, die diese Zahl vervollständigt hat. */
    function einheitMitte(e) {
      if (!optionen || !optionen.gitterFeld) return null;
      const z = Math.floor(e.index / 9), sp = e.index % 9;
      let ecken;
      if (e.einheiten.zeile) ecken = [z * 9, z * 9 + 8];
      else if (e.einheiten.spalte) ecken = [sp, 72 + sp];
      else if (e.einheiten.block) {
        const z0 = z - (z % 3), s0 = sp - (sp % 3);
        ecken = [z0 * 9 + s0, (z0 + 2) * 9 + s0 + 2];
      } else return null;
      const a = optionen.gitterFeld(ecken[0]).getBoundingClientRect();
      const b = optionen.gitterFeld(ecken[1]).getBoundingClientRect();
      return { x: (a.left + b.right) / 2, y: (a.top + b.bottom) / 2 };
    }

    /**
     * "Letzter Treffer" im Takt des Aufbaus: die ersten n Zeilen der Rechnung,
     * als Gesamt der aktuelle Zwischenwert. Belohnung kommt erst am Ende.
     */
    function zeigeAufbau(e, n, zwischenwert) {
      el.panel.classList.remove("ist-leer");
      const zeilen = rechnungsZeilen(e).filter(function (z) { return z.key !== "gift" && z.key !== "spruch"; });
      setzeZeilen(el.trefferZeilen, zeilen.slice(0, n));
      setzeZeile(el.trefferSumme, { label: "Gesamt", wert: String(zwischenwert) }, true);
      if (n === 1) {
        setzeZeilen(el.belohnungZeilen, []);
        setzeZeile(el.belohnungSumme, { label: "Summe", wert: "…" }, false);
      }
    }

    /** Der Boss wird getroffen – je höher die Leuchtstufe, desto heftiger. */
    function bossGetroffen(e, stufe) {
      const n = stufe.nummer;
      if (n >= 4) {
        faerbe(el.blitz, "an-regenbogen", 500);
        animiere(el.buehne, "wackelt-max", 700);
      } else if (n === 3) {
        faerbe(el.blitz, "an-glut", 360);
        animiere(el.buehne, "wackelt-stark", DAUER.kritisch);
      } else if (n === 2) {
        faerbe(el.blitz, "an-blau", 300);
        animiere(el.buehne, "wackelt", 360);
      }
      return animiere(el.bossFigur, n >= 2 ? "getroffen-stark" : "getroffen", n >= 3 ? DAUER.kritisch : DAUER.treffer);
    }

    /**
     * Richtige Zahl: würfeln → Schaden sichtbar aufbauen (Boni fliegen auf
     * die Zahl zu) → ins Schwert → Schlag → Einschlag im Boss → Gift, Münzen.
     */
    function treffer(e) {
      beschleunige();       // ein noch laufender Zug springt sofort zu seinem Ende
      return einreihen(function () {
        zeigeBoss(e.boss);
        // 1. Würfel rollt – erst wenn er gelandet ist, wird der Treffer sichtbar
        return wuerfel.rolle(e, eilig()).then(function () {
          meldung(trefferText(e));
          zeigeKombo(e.kombo, e.komboBonus, true);
          const u = fxUmgebung(e);
          if (e.fehlschlag || e.immun || e.eigenheit) return keinAufbau(e, u);
          return mitAufbau(e, u);
        }).then(function () {
          // Gift (grünes Power-up): wie bisher eigene grüne Zahl nach dem Treffer
          // (der Boss bleibt kurz grün, die Münzen kommen gleichzeitig)
          if (e.gift <= 0) return null;
          schwebeZahl("−" + e.gift, "gift");
          zeigeHp(e.hpNachher, e.boss.maxHp);
          faerbe(el.bossFigur, "vergiftet", 520);
          return warte(160);
        }).then(function () {
          // Münzen und Leben – jetzt steht auch "Letzter Treffer" komplett
          protokolliereTreffer(e);
          schwebeZahl("+" + (e.muenzenPlus + e.eliteBonus), "muenzen");
          if (e.lebenPlus > 0) {
            zeigeHerzen(e.leben, e.maxLeben);
            const neuesHerz = el.herzen.children[e.leben - 1];
            if (neuesHerz) animiere(neuesHerz, "verschwindet", 400);   // kurzes "Aufpoppen"
          }
          return zeigeMuenzen(e.muenzen, true);
        });
      });
    }

    /** Schaden wird aufgebaut, fliegt ins Schwert und entlädt sich im Boss. */
    function mitAufbau(e, u) {
      zeigeAufbau(e, 1, e.wurf);
      const aufbau = u.aktiv
        ? SudokuSchadenFx.aufbau(e, u)
        : Promise.resolve(SudokuSchadenFx.stufeFuer(e.schaden));
      return aufbau.then(function (stufe) {
        // Das Schwert leuchtet, der Held schlägt zu – die Entladung beginnt
        // mitten im Schlag (so bleibt der Ablauf kurz)
        animiere(el.heldFigur, e.kritisch ? "schlaegt-stark" : "schlaegt", DAUER.schlag);
        const mitte = DAUER.schlag * 0.5 * (u.aktiv ? Math.max(0.4, u.faktor) : 1);
        return warte(mitte).then(function () { return stufe; });
      }).then(function (stufe) {
        // … und das Leuchten entlädt sich im Boss. Erst jetzt sinkt der HP-Balken.
        SudokuSchadenFx.schwertAus(el.heldFigur);
        zeigeAufbau(e, Infinity, e.schaden);
        zeigeHp(e.hpNachSchaden, e.boss.maxHp);
        schwebeZahl("−" + e.schaden, e.kritisch ? "kritisch" : e.doppelt ? "doppelt" : "boss");
        // Ohne Schadensaufbau (Kampfanimationen aus) wird der Krit hier betont
        if (!u.aktiv && e.kritisch) banner("Kritisch!", null, "kritisch");
        // Boss blitzt und die Bühne wackelt weiter, während schon Gift und Münzen kommen
        const getroffen = bossGetroffen(e, stufe);
        return u.aktiv ? SudokuSchadenFx.entladen(stufe, u) : getroffen;
      });
    }

    /** Fehlschlag, immun oder geblockt: kein Aufbau, die Zahl zerfällt oder prallt ab. */
    function keinAufbau(e, u) {
      protokolliereTreffer(e);
      const art = e.fehlschlag ? "zerfallen" : "abprallen";
      const zahl = u.aktiv ? SudokuSchadenFx.abprallen(e, u, art) : Promise.resolve();
      if (e.fehlschlag) {
        animiere(el.heldFigur, "stolpert", DAUER.stolpern);
        schwebeZahl("Daneben!", "daneben");
        return zahl;
      }
      if (e.immun) {
        // Seltene Eigenschaft: Wurf wirkungslos – Würfel grau (siehe Würfel), Boss wehrt ab
        schwebeZahl(e.selten.art === "geblockt" ? "Geblockt!" : "Immun!", "immun");
        banner(e.selten.name + "!", e.selten.farbe, "selten");
        animiere(el.bossFigur, "wehrt-ab", DAUER.treffer);
        return Promise.all([zahl, faerbe(el.selten, "ausgeloest", 900)]);
      }
      // Rüstung hat den Wurf geblockt
      schwebeZahl("Geblockt!", "geblockt");
      animiere(el.bossFigur, "wehrt-ab", DAUER.treffer);
      return Promise.all([zahl, eigenheitAusgeloest(e.eigenheit)]);
    }

    /**
     * Färbt ein Element kurz um (z. B. Boss grün bei Gift). Anders als
     * animiere() auch bei "Bewegung reduzieren" – es ist nur eine Farbe.
     */
    function faerbe(element, klasse, ms) {
      element.classList.add(klasse);
      const ende = function () { element.classList.remove(klasse); };
      if (eilig()) {
        ende();
        return Promise.resolve();
      }
      return wartezeit(ms).then(ende);
    }

    /** Falsche Zahl: Boss greift an, ein Leben geht verloren, die Kombo zerbricht, ggf. Eigenheit. */
    function fehler(e) {
      beschleunige();
      return einreihen(function () {
        let text = e.boss.name + " greift an! Falsche Zahl, " +
          (e.leben === 0 ? "keine Leben mehr." : "noch " + e.leben + " Leben.");
        if (e.komboVorher > 0) text += " Kombo verloren.";
        if (e.eigenheit) text += " " + e.eigenheit.name + ": " + e.eigenheit.text + ".";
        meldung(text);
        protokolliereFehler(e);
        const rest = e.leben;
        const angriff = animiere(el.bossFigur, "greift-an", DAUER.angriff);
        return warte(DAUER.angriff / 2).then(function () {
          zeigeHerzen(rest, e.maxLeben);
          const herz = el.herzen.children[rest];
          if (herz) animiere(herz, "verschwindet", 400);
          animiere(el.heldFigur, "wird-getroffen", 300);
          const kombo = e.komboVorher > 0 ? zerbrichKombo() : null;
          return Promise.all([angriff, kombo]);
        }).then(function () {
          if (!e.eigenheit) return null;
          // Regeneration: HP steigen. Dieb: Münzen sinken.
          if (e.hp !== e.hpVorher) {
            schwebeZahl("+" + (e.hp - e.hpVorher), "heilung");
            zeigeHp(e.hp, e.boss.maxHp);
          }
          if (e.muenzen !== e.muenzenVorher) {
            schwebeZahl("−" + (e.muenzenVorher - e.muenzen), "muenzen-weg");
            zeigeMuenzen(e.muenzen, true);
          }
          return eigenheitAusgeloest(e.eigenheit);
        });
      });
    }

    /** Boss besiegt. */
    function sieg(e) {
      return einreihen(function () {
        meldung(e.boss.name + " ist besiegt!" + (e.elite ? " Elite-Bonus: " + e.eliteBonus + " Münzen." : ""));
        verlaufEintrag(e.elite
          ? { text: "Elite " + e.boss.name + " besiegt!", wert: "+" + e.eliteBonus, art: "elite", symbol: "krone" }
          : { text: e.boss.name + " besiegt!", wert: "", art: "besiegt", symbol: "krone" });
        zeigeHp(0, e.boss.maxHp);
        if (ohneBewegung() || eilig()) {
          return Promise.resolve();
        }
        if (e.elite) {
          // Größer: goldener Blitz, starkes Wackeln, längeres Verglühen, Hinweis mit Bonus
          faerbe(el.blitz, "an-gold", 420);
          animiere(el.buehne, "wackelt-stark", DAUER.kritisch);
          banner("Elite besiegt! +" + e.eliteBonus + " Münzen", null, "elite-sieg");
          el.bossFigur.classList.add("ist-besiegt-elite");
          return warte(DAUER.eliteSieg);
        }
        el.bossFigur.classList.add("ist-besiegt");
        return warte(DAUER.sieg);
      });
    }

    /** Der nächste Boss erscheint (volle HP, Leben aufgefüllt) – mit seiner Eigenheit. */
    function neuerBoss(e, rekord) {
      return einreihen(function () {
        let text = (e.boss.elite ? "Ein Elite-Boss erscheint! " : "") +
          "Boss " + e.boss.nummer + ": " + e.boss.name + ", " + e.boss.maxHp + " HP.";
        if (e.boss.eigenheit) text += " Eigenheit " + e.boss.eigenheit.name + ": " + e.boss.eigenheit.beschreibung;
        if (e.boss.selten) text += " Selten, " + e.boss.selten.name + ": " + e.boss.selten.beschreibung;
        meldung(text);
        verlaufEintrag(e.boss.elite
          ? { text: "Elite " + e.boss.nummer + ": " + e.boss.name + (e.boss.selten ? " · " + e.boss.selten.name : ""),
              wert: e.boss.maxHp + " HP", art: "elite", symbol: "stern" }
          : e.boss.eigenheit
          ? { text: "Boss " + e.boss.nummer + ": " + e.boss.name + " · " + e.boss.eigenheit.name, wert: "",
              art: "eigenheit", symbol: "warnung", farbe: e.boss.eigenheit.farbe }
          : { text: "Boss " + e.boss.nummer + ": " + e.boss.name, wert: e.boss.maxHp + " HP" });
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite");
        zeigeBoss(e.boss);
        zeigeHp(e.hp, e.boss.maxHp);
        zeigeHerzen(e.leben, e.maxLeben);
        zeigeRekord(e.boss, rekord);
        if (e.boss.elite) {
          // Eigene Einblendung (entfällt bei "Bewegung reduzieren" – die Kennzeichnungen bleiben)
          if (!ohneBewegung() && !eilig()) {
            const b = banner("Ein Elite-Boss erscheint!", null, "elite");
            setTimeout(function () { b.remove(); }, DAUER.eliteAuftritt);
          }
        } else if (e.boss.eigenheit) {
          banner(e.boss.eigenheit.name, e.boss.eigenheit.farbe, "eigenheit");
        }
        return animiere(el.bossFigur, "erscheint", DAUER.erscheinen);
      });
    }

    /** Eine Verbesserung wurde gewählt: Symbole und ggf. Herzen aktualisieren. */
    function verbesserung(e) {
      return einreihen(function () {
        meldung(e.name + ", Stufe " + e.stufe + "." + (e.lebenPlus > 0 ? " +" + e.lebenPlus + " Leben." : ""));
        verlaufEintrag({ text: e.name, wert: "Stufe " + e.stufe });
        zeigeVerbesserungen(e.gesammelt, e.id);
        zeigeHerzen(e.leben, e.maxLeben);
      });
    }

    /** Kurze Nachricht: im Verlauf und für Screenreader. */
    function text(nachricht) {
      return einreihen(function () {
        meldung(nachricht);
        verlaufEintrag({ text: nachricht, wert: "" });
      });
    }

    /** Ein neues Abenteuer: Panel zurück auf den Hinweistext. */
    function neuesAbenteuer() {
      beschleunige();
      return einreihen(function () {
        leerePanel();
        wuerfel.zeige(null, "");
      });
    }

    /** Wartet, bis alle Animationen in der Schlange abgespielt sind. */
    function fertig() {
      return einreihen(function () {});
    }


    /* ---------- Overlays über dem Sudoku ---------- */

    /** "Münzen ×1,5 · Schaden +20 %" */
    function belohnungText(b) {
      return "Münzen ×" + SudokuRPG.zahlText(b.muenzFaktor) + " · " +
        (b.schadensBonus > 0 ? "Schaden +" + Math.round(b.schadensBonus * 100) + " %" : "kein Schadensbonus");
    }

    /**
     * Slot-Walze: läuft durch die Schwierigkeitsgrade, wird langsamer und
     * bleibt auf dem ausgelosten Grad stehen. Danach steht dort, was er bringt.
     * @param {HTMLElement} rahmen – Bereich, über den die Walze gelegt wird
     * @param {object[]} grade     – alle Grade { id, name }
     * @param {object} ziel        – der ausgeloste Grad (aus den Regeln)
     * @param {object} belohnung   – { muenzFaktor, schadensBonus } des Grads
     * @returns {Promise} – erfüllt, wenn die Walze steht und die Pause vorbei ist
     */
    function losen(rahmen, grade, ziel, belohnung) {
      const overlay = document.createElement("div");
      overlay.className = "slot";
      overlay.innerHTML =
        '<div class="slot-kasten">' +
          '<p class="slot-titel">Schwierigkeit wird ausgelost …</p>' +
          '<div class="slot-fenster"><div class="slot-walze"></div></div>' +
          '<p class="slot-belohnung"></p>' +
        "</div>";
      const walze = overlay.querySelector(".slot-walze");
      const titel = overlay.querySelector(".slot-titel");
      rahmen.appendChild(overlay);
      const special = ziel.id === "special";

      // Die Walze: alle Grade 5× hintereinander, dann bis zum Zielgrad.
      // Ohne Bewegung steht nur der Zielgrad darauf.
      const zielIndex = grade.findIndex(function (g) { return g.id === ziel.id; });
      const eintraege = [];
      if (ohneBewegung()) {
        eintraege.push(ziel);
      } else {
        for (let r = 0; r < 5; r++) grade.forEach(function (g) { eintraege.push(g); });
        eintraege.push.apply(eintraege, grade.slice(0, zielIndex + 1));
      }
      eintraege.forEach(function (g) {
        const zeile = document.createElement("div");
        zeile.className = "slot-eintrag";
        zeile.textContent = g.name;
        walze.appendChild(zeile);
      });

      const fertigText = function () {
        titel.textContent = special ? "★ Special Grade! ★" : "Ausgelost: " + ziel.name;
        overlay.querySelector(".slot-belohnung").textContent = belohnung ? belohnungText(belohnung) : "";
        overlay.classList.add("ist-fertig");
        if (special) overlay.classList.add("ist-special");
      };
      const pause = DAUER.walzePause + (special ? DAUER.walzeSpecial : 0);

      if (ohneBewegung()) {
        fertigText();
        return new Promise(function (ok) { setTimeout(ok, 700 + (special ? 500 : 0)); }).then(function () { overlay.remove(); });
      }

      // Auf den letzten Eintrag fahren – das CSS-"ease-out" macht die
      // Walze am Ende immer langsamer
      const hoehe = walze.firstChild.getBoundingClientRect().height;
      walze.style.transform = "translateY(0)";
      void walze.offsetWidth;
      walze.style.transitionDuration = DAUER.walze + "ms";
      walze.style.transform = "translateY(" + (-(eintraege.length - 1) * hoehe) + "px)";

      return warte(DAUER.walze).then(function () {
        fertigText();
        return warte(pause);
      }).then(function () {
        overlay.remove();
      });
    }

    /**
     * Verbesserungsauswahl: Karten über dem Sudoku. Hält die Warteschlange an,
     * bis eine Karte gewählt ist – erst dann geht es weiter.
     * @param {HTMLElement} rahmen
     * @param {object[]} angebote – { id, name, symbol, farbe, stufe, maxStufe, beschreibung }
     * @param {function} beimWaehlen – bekommt die id der gewählten Verbesserung
     */
    let auswahlNummer = 0;          // nur die zuletzt angeforderte Auswahl wird gezeigt
    let offeneAuswahl = null;       // { overlay, weiter } der gerade sichtbaren Auswahl

    function auswahl(rahmen, angebote, beimWaehlen, info) {
      info = info || { rest: 1, elite: false };
      // Titel: "Boss besiegt! Wähle eine …" / "Elite besiegt! Wähle zwei …" / "Wähle noch eine …"
      const gesamt = info.elite ? Math.max(1, K.elite.verbesserungenWaehlen) : 1;
      const zahlwort = { 1: "eine", 2: "zwei", 3: "drei" };
      let titel;
      if (info.rest > 1) {
        titel = "Elite besiegt! Wähle " + (zahlwort[info.rest] || info.rest) + " Verbesserungen:";
      } else if (info.elite && gesamt > 1) {
        titel = "Wähle noch eine Verbesserung:";
      } else {
        titel = (info.elite ? "Elite" : "Boss") + " besiegt! Wähle eine Verbesserung:";
      }
      schliesseAuswahl();             // eine ältere (z. B. vor dem Neuladen) ist damit erledigt
      const nummer = ++auswahlNummer;
      return einreihen(function () {
        if (nummer !== auswahlNummer) return null;
        meldung("Wähle eine Verbesserung!");
        return new Promise(function (weiter) {
          const overlay = document.createElement("div");
          overlay.className = "auswahl";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-label", "Verbesserung wählen");
          overlay.innerHTML =
            '<div class="auswahl-kasten">' +
              '<p class="auswahl-titel"></p>' +
              '<div class="auswahl-karten"></div>' +
            "</div>";
          overlay.querySelector(".auswahl-titel").textContent = titel;
          if (info.elite) overlay.classList.add("ist-elite");
          const karten = overlay.querySelector(".auswahl-karten");
          angebote.forEach(function (v) {
            const karte = document.createElement("button");
            karte.type = "button";
            karte.className = "auswahl-karte";
            karte.dataset.id = v.id;
            karte.style.setProperty("--chip-farbe", v.farbe);
            karte.innerHTML =
              '<span class="auswahl-symbol">' + symbolSvg(v.symbol) + "</span>" +
              '<span class="auswahl-name"></span>' +
              '<span class="auswahl-text"></span>' +
              '<span class="auswahl-stufe"></span>';
            karte.querySelector(".auswahl-name").textContent = v.name;
            karte.querySelector(".auswahl-text").textContent = v.beschreibung;
            karte.querySelector(".auswahl-stufe").textContent = v.stufe === 0
              ? "Neu · max. Stufe " + v.maxStufe
              : "Stufe " + v.stufe + " → " + (v.stufe + 1) + " (max. " + v.maxStufe + ")";
            karte.addEventListener("click", function () {
              overlay.remove();
              offeneAuswahl = null;
              beimWaehlen(v.id);       // Regeln: Verbesserung anwenden → Ereignisse
              weiter();
            });
            karten.appendChild(karte);
          });
          rahmen.appendChild(overlay);
          offeneAuswahl = { overlay: overlay, weiter: weiter };
          karten.firstChild.focus();
        });
      });
    }

    /** Schließt eine offene Auswahl ohne Wahl (z. B. beim Zurücksetzen). */
    function schliesseAuswahl() {
      auswahlNummer++;                // noch wartende Auswahlen verfallen
      if (offeneAuswahl) {
        offeneAuswahl.overlay.remove();
        offeneAuswahl.weiter();
        offeneAuswahl = null;
      }
    }

    /**
     * Niederlage-Bildschirm: zeigt, wie weit man gekommen ist.
     * @returns {Promise} – erfüllt, wenn "Erneut antreten" gedrückt wurde
     */
    function niederlage(rahmen, e) {
      return einreihen(function () {
        meldung("Niederlage gegen " + e.boss.name + ".");
        verlaufEintrag({ text: "Niederlage gegen " + e.boss.name, wert: "", art: "fehler", symbol: "kreuz" });
        zeigeHerzen(0);
        return animiere(el.heldFigur, "faellt", 500);
      }).then(function () {
        return new Promise(function (weiter) {
          const overlay = document.createElement("div");
          overlay.className = "niederlage";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-label", "Niederlage");
          overlay.innerHTML =
            '<div class="niederlage-kasten">' +
              '<p class="niederlage-titel">Niederlage!</p>' +
              '<p class="niederlage-text"></p>' +
              '<p class="niederlage-rekord"></p>' +
              '<button type="button" class="niederlage-knopf">Erneut antreten</button>' +
            "</div>";
          overlay.querySelector(".niederlage-text").textContent =
            "Boss " + e.boss.nummer + " – " + e.boss.name + " war zu stark. Du hast " +
            e.schadenGemacht + " von " + e.boss.maxHp + " HP geschafft. " +
            "Deine Münzen und Verbesserungen bleiben.";
          overlay.querySelector(".niederlage-rekord").textContent = e.rekord === 0
            ? "Rekord: noch kein Boss besiegt."
            : "Rekord: " + e.rekord + (e.rekord === 1 ? " Boss besiegt." : " Bosse besiegt.");
          rahmen.appendChild(overlay);
          const knopf = overlay.querySelector(".niederlage-knopf");
          knopf.addEventListener("click", function () {
            overlay.remove();
            weiter();
          });
          knopf.focus();
        });
      });
    }

    return {
      zeigeStand: zeigeStand,
      zeigeMuenzen: zeigeMuenzen,
      zeigeWurf: zeigeWurf,
      treffer: treffer,
      fehler: fehler,
      sieg: sieg,
      neuerBoss: neuerBoss,
      verbesserung: verbesserung,
      auswahl: auswahl,
      schliesseAuswahl: schliesseAuswahl,
      text: text,
      neuesAbenteuer: neuesAbenteuer,
      beschleunige: beschleunige,
      fertig: fertig,
      losen: losen,
      niederlage: niederlage,
    };
  }

  return {
    WUERFEL: W,
    wuerfelEinstellung: wuerfelEinstellung,
    setzeWuerfelEinstellung: setzeWuerfelEinstellung,
    erstelle: erstelle,
    symbolSvg: symbolSvg,
  };
})();
