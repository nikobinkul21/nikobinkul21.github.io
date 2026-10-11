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
    weltbossAuftritt: 2200, // eigener Auftritt des Weltbosses (Bühne dunkel, großes Banner)
    weltEinblendung: 1900,  // Name der Welt beim Betreten (blockiert nichts)
    // Sprechblasen der Bosse (blockieren nichts, laufen neben der Warteschlange)
    blaseZeichen: 32,       // je Buchstabe
    blaseHalten: 2600,      // danach stehen lassen
    blaseKurz: 1000,        // … nur so lange, wenn schon die nächste wartet
    blaseAus: 250,          // Ausblenden
    eliteSieg: 1500,   // größere Siegesanimation nach einem Elite-Boss
    walze: 1900,       // Slot-Walze bis zum Stillstand
    walzePause: 550,   // kurz stehen lassen, bevor das Sudoku startet
    walzeSpecial: 900, // bei Special Grade etwas länger
    angriffAnsage: 450,  // Boss holt aus, der Name des Angriffs erscheint
    angriffWirkung: 650, // eigene Animation des Angriffs
    parade: 700,         // Held pariert mit dem Schwert
    // Buchschlag (Normal, Desktop; Schnell/Smartphone kürzer): zusammen etwa 2 Sekunden
    buchFeld: 110,       // Abstand, in dem die neun Felder aufleuchten und ihre Ziffer losschicken
    buchFlug: 320,       // Flugzeit einer Ziffer zum Schwert
    buchAufladen: 180,   // Schwert voll aufgeladen, kurz halten
    buchZahl: 500,       // Schadenszahl mit dem Namen des Buchs stehen lassen
  };

  /** Farbe der Bücher (Karten, Reihe im Kampffenster, Zahlenfeld). */
  const BUCH_FARBE = "#9a5b2a";

  /**
   * Wann gilt der Handy-Aufbau? Schmal im Hochformat oder flach im Querformat
   * auf einem Touch-Gerät. Dieselbe Bedingung steht in css/sudoku-mobil.css.
   */
  const HANDY_MEDIEN = "(max-width: 767px), (orientation: landscape) and (max-height: 500px) and (hover: none)";

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
    sprechblase: '<path d="M0 0h7v5H3v1H2v1H1V5H0z"/><path fill="rgba(255,255,255,.6)" d="M1 2h1v1H1zM3 2h1v1H3zM5 2h1v1H5z"/>',
    // Gegenangriffe der Bosse und die Parade
    // Einschüchtern: finsterer Blick (zwei schräge Brauen, zwei Augen)
    einschuechtern: '<path d="M0 1h1v1h1v1h1v1H1V3H0zM6 1h1v2H6v1H4V3h1V2h1z"/><path d="M1 5h2v1H1zM4 5h2v1H4z"/>',
    siegel: '<path d="M2 0h3v1h1v2H5V1H2v2H1V1h1z"/><path d="M0 3h7v4H0z"/><path fill="rgba(0,0,0,.5)" d="M3 4h1v2H3z"/>',
    finsternis: '<path d="M2 0h3v1H3v1H2v3h1v1h2v1H2V6H1V5H0V2h1V1h1z"/><path d="M5 2h1v1H5zM6 4h1v1H6z"/>',
    fluch: '<path d="M1 0h5v1h1v3H6v1H5v2H2V5H1V4H0V1h1z"/><path fill="rgba(0,0,0,.6)" d="M2 2h1v1H2zM4 2h1v1H4zM3 4h1v1H3z"/>',
    hieb: '<path d="M5 0h1v1H5zM4 1h1v1H4zM3 2h1v1H3zM2 3h1v1H2zM1 4h1v1H1zM6 2h1v1H6zM5 3h1v1H5zM4 4h1v1H4zM3 5h1v1H3zM2 6h1v1H2z"/>',
    schild: '<path d="M0 0h7v4H6v1H5v1H4v1H3V6H2V5H1V4H0z"/><path fill="rgba(255,255,255,.6)" d="M1 1h2v1H1zM1 2h1v1H1z"/>',
    // Buch: Einband mit hellen Seiten am Rand
    buch: '<path d="M0 0h6v1h1v6H1V6H0z"/><path fill="rgba(255,255,255,.75)" d="M1 6h6v1H1zM6 1h1v5H6z"/><path fill="rgba(0,0,0,.3)" d="M1 0h1v6H1z"/>',
    // Reihenbrecher: eine Reihe Blöcke, in der Mitte zerbrochen
    reihe: '<path d="M0 2h2v3H0zM5 2h2v3H5z"/><path d="M3 1h1v2H3zM2 4h1v2H2zM4 3h1v1H4z"/><path fill="rgba(255,255,255,.55)" d="M0 2h1v1H0zM5 2h1v1H5z"/>',
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
          // Bei mehreren Würfeln (Bücher): jeder einzelne Würfel als kleines Kästchen
          '<div class="wuerfel-mehr" aria-hidden="true"></div>' +
          '<p class="wuerfel-info"><span class="wuerfel-seiten">W20</span><span class="wuerfel-art"></span></p>' +
        "</div>";
      g.flaeche = platz.querySelector(".wuerfel-flaeche");
      g.knopf = platz.querySelector(".wuerfel-knopf");
      g.koerper = platz.querySelector(".wuerfel-koerper");
      g.zahl = platz.querySelector(".wuerfel-zahl");
      g.seiten = platz.querySelector(".wuerfel-seiten");
      g.art = platz.querySelector(".wuerfel-art");
      g.mehr = platz.querySelector(".wuerfel-mehr");
      // Ein Klick auf den Würfel überspringt die laufende Animation (Würfel UND Schadensaufbau)
      g.knopf.addEventListener("click", beimKlick);
    }
    klein.addEventListener("click", beimKlick);
    // Nebenwürfel auch am kleinen Würfel (Smartphone)
    const kleinMehr = document.createElement("span");
    kleinMehr.className = "kampf-wuerfel-mehr";
    kleinMehr.setAttribute("aria-hidden", "true");
    klein.parentNode.insertBefore(kleinMehr, klein.nextSibling);   // neben dem Würfel (er ist sechseckig zugeschnitten)

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

    /** Was der Würfel zeigt: bei mehreren Würfeln die Summe bzw. den höheren Wurf. */
    function hauptwert(e) {
      if (e.wuerfe && e.wuerfe.length > 1 && e.wuerfelModus === "summe") {
        return e.wuerfe.reduce(function (a, b) { return a + b; }, 0);
      }
      return e.wurf;
    }

    /**
     * Nebenwürfel: jeder Würfel einzeln (Augenzahl, kritisch, immun, Fehlschlag;
     * beim "höheren Wurf" ist der zweite ausgegraut). rollend = noch unbekannt.
     */
    function zeigeMehr(e, rollend) {
      const mehr = e && e.wuerfe && e.wuerfe.length > 1 ? e.wuerfe : [];
      const hoechster = mehr.length ? mehr.indexOf(Math.max.apply(null, mehr)) : -1;
      [g.mehr, kleinMehr].forEach(function (ziel) {
        if (!ziel) return;
        ziel.innerHTML = "";
        mehr.forEach(function (w, k) {
          const kasten = document.createElement("span");
          kasten.className = "wuerfel-neben" + (rollend ? " rollt" : "");
          kasten.textContent = rollend ? "?" : w;
          if (!rollend) {
            const teil = e.rechnung && e.rechnung.wuerfel ? e.rechnung.wuerfel[k] : null;
            if (teil && teil.kritisch) kasten.classList.add("ist-kritisch");
            if (teil && (teil.immun || teil.geblockt)) kasten.classList.add("ist-immun");
            if (teil && teil.fehlschlag) kasten.classList.add("ist-fehlschlag");
            if (e.wuerfelModus === "hoechster" && k !== hoechster) kasten.classList.add("zaehlt-nicht");
          }
          ziel.appendChild(kasten);
        });
      });
      if (platz) g.flaeche.classList.toggle("hat-mehr", mehr.length > 0);
    }

    /** Ergebnis eines Wurfs zeigen (Hauptwürfel und Nebenwürfel). */
    function zeigeErgebnis(e, art) {
      zeige(hauptwert(e), art, e.wuerfelSeiten);
      zeigeMehr(e, false);
      if (e.wuerfe && e.wuerfe.length > 1 && platz) {
        g.seiten.textContent = e.wuerfe.length + "×W" + e.wuerfelSeiten + (e.wuerfelModus === "hoechster" ? " · höherer" : " · Summe");
      }
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
        zeigeErgebnis(e, art);
        return Promise.resolve();
      }
      zeigeMehr(e, true);
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
      zeigeErgebnis(lauf.e, lauf.art);
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
      zeigeErgebnis(l.e, l.art);
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

    /** Würfel zurücksetzen (auch die Nebenwürfel). */
    function zeigeLeer() {
      zeige(null, "");
      zeigeMehr(null, false);
    }

    return { rolle: rolle, ueberspringe: ueberspringe, zeige: zeige, zeigeLeer: zeigeLeer, punkt: punkt, gross: grossSichtbar };
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
        // Welt und Level mit Fortschrittsleiste (Elite-Bosse und Weltboss markiert)
        '<div class="kampf-welt">' +
          '<p class="kampf-welt-text"><span class="kampf-welt-name"></span>' +
            '<span class="kampf-welt-level"></span><span class="kampf-welt-durchlauf" hidden></span></p>' +
          '<ol class="kampf-welt-leiste" aria-hidden="true"></ol>' +
        "</div>" +
        '<div class="kampf-buehne">' +
          // Pixel-Hintergrund der Welt (hinter allem)
          '<canvas class="kampf-hintergrund" aria-hidden="true"></canvas>' +
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
          // Über dem Boss: sein angekündigter Angriff mit Zähler ("Siegel in 8 Zügen")
          '<button type="button" class="kampf-absicht hat-tipp" hidden>' +
            '<span class="kampf-absicht-kopf"><span class="kampf-absicht-symbol"></span><span class="kampf-absicht-name"></span></span>' +
            '<span class="kampf-absicht-text"></span>' + tippHtml() +
          "</button>" +
          // Held unten: Figur links, Herzen, Münzen und Würfel rechts
          '<div class="kampf-figur kampf-figur--held"><canvas class="kampf-held"></canvas></div>' +
          // Eingeschüchtert (Angriff des Bosses): der nächste Treffer macht halben Schaden
          '<span class="kampf-held-status" role="img" aria-label="Eingeschüchtert: Dein nächster Treffer macht nur halben Schaden." hidden title="Eingeschüchtert: Dein nächster Treffer macht nur halben Schaden.">' +
            symbolSvg("einschuechtern") + "<span>½</span></span>" +
          // Schild beim Helden: leuchtet im Zug des Angriffs (dann pariert eine fertige Einheit)
          '<button type="button" class="kampf-parade hat-tipp">' + symbolSvg("schild") + tippHtml() + "</button>" +
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
          // Sprechblase des Bosses (vorgelesen wird der Satz über die Statuszeile)
          '<div class="kampf-sprechblase-platz" aria-hidden="true"></div>' +
        "</div>" +
        // Leiste unter der Bühne: fünf Plätze für Verbesserungen und Bücher
        // (nur Symbole – Name und Wirkung im Glas-Panel) und der Buch-Bonus
        '<div class="kampf-leiste">' +
          '<div class="kampf-verbesserungen" role="group" aria-label="Deine Verbesserungen"></div>' +
          // Buch-Bonus des laufenden Sudokus: eigener Schadensbonus (bei 0 ausgeblendet)
          '<span class="kampf-buchbonus" role="img" hidden>' + symbolSvg("buch") + '<span class="kampf-buchbonus-wert"></span></span>' +
          '<div class="kampf-platz-info" role="tooltip" id="kampf-platz-info" hidden></div>' +
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
      kampf: container.querySelector(".kampf"),
      welt: container.querySelector(".kampf-welt"),
      weltName: container.querySelector(".kampf-welt-name"),
      weltLevel: container.querySelector(".kampf-welt-level"),
      weltDurchlauf: container.querySelector(".kampf-welt-durchlauf"),
      weltLeiste: container.querySelector(".kampf-welt-leiste"),
      hintergrund: container.querySelector(".kampf-hintergrund"),
      blasenPlatz: container.querySelector(".kampf-sprechblase-platz"),
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
      leiste: container.querySelector(".kampf-leiste"),
      platzInfo: container.querySelector(".kampf-platz-info"),
      heldStatus: container.querySelector(".kampf-held-status"),
      verbesserungen: container.querySelector(".kampf-verbesserungen"),
      buchBonus: container.querySelector(".kampf-buchbonus"),
      buchBonusWert: container.querySelector(".kampf-buchbonus-wert"),
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
      absicht: container.querySelector(".kampf-absicht"),
      absichtSymbol: container.querySelector(".kampf-absicht-symbol"),
      absichtName: container.querySelector(".kampf-absicht-name"),
      absichtText: container.querySelector(".kampf-absicht-text"),
      absichtTipp: container.querySelector(".kampf-absicht .kampf-tipp"),
      parade: container.querySelector(".kampf-parade"),
      paradeTipp: container.querySelector(".kampf-parade .kampf-tipp"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    const wuerfel = erstelleWuerfel(optionen && optionen.wuerfelPlatz, el.wuerfel, el.wuerfelZahl,
      function () { beschleunige(); });

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Schmales Fenster (alter Aufbau ohne Handy-Modus): Antippen der kompakten Zeile klappt die drei Blöcke auf
    el.kurz.addEventListener("click", function () {
      if (handy.an) return;                 // im Handy-Aufbau öffnet der Streifen das Blatt
      const offen = el.panel.classList.toggle("offen");
      el.kurz.setAttribute("aria-expanded", String(offen));
    });

    /* ---------- Handy-Aufbau ----------
       Auf dem Smartphone (HANDY_MEDIEN, gleiche Bedingung wie in
       css/sudoku-mobil.css) wird das Kampffenster zu einem flachen Streifen:
       Boss, Held, die fünf Plätze, Würfel und eine Zeile mit dem letzten Zug. Welt und
       Level sowie Leben und Münzen wandern in die Kopfzeile des Sudokus,
       alles Weitere (letzter Treffer, Belohnung, Verlauf, Erklärungen zu den
       Verbesserungen und zum Boss) in ein Blatt, das von unten einfährt.
       Verschoben werden die Elemente selbst – alle Verweise in "el" bleiben
       gültig, die Anzeige wird also genauso aktualisiert wie sonst. */
    const handy = { an: false, plaetze: [] };
    const blatt = document.createElement("div");
    blatt.className = "kampf-blatt";
    blatt.hidden = true;
    blatt.innerHTML =
      '<div class="kampf-blatt-hintergrund"></div>' +
      '<section class="kampf-blatt-inhalt" role="dialog" aria-modal="true" aria-label="Kampf-Details">' +
        '<div class="kampf-blatt-griff" aria-hidden="true"></div>' +
        '<button type="button" class="kampf-blatt-zu" aria-label="Schließen">×</button>' +
        '<section class="kampf-blatt-boss" aria-label="Der Boss"></section>' +
        '<section class="kampf-blatt-plaetze" aria-label="Deine Verbesserungen"></section>' +
        '<div class="kampf-blatt-teile"></div>' +
      "</section>";
    container.querySelector(".kampf").appendChild(blatt);
    const blattInhalt = blatt.querySelector(".kampf-blatt-inhalt");
    const blattTeile = blatt.querySelector(".kampf-blatt-teile");
    const blattBoss = blatt.querySelector(".kampf-blatt-boss");
    const blattPlaetze = blatt.querySelector(".kampf-blatt-plaetze");
    const panelOben = container.querySelector(".panel-oben");
    const panelVerlauf = container.querySelector(".panel-verlauf");
    const fuss = container.querySelector(".kampf-fuss");

    /** Merkt sich die Stelle eines Elements und hängt es woanders ein. */
    function verschiebe(element, ziel, vorne) {
      if (!element || !ziel) return;
      const marke = document.createComment("platz");
      element.parentNode.insertBefore(marke, element);
      handy.plaetze.push({ element: element, marke: marke });
      if (vorne) ziel.insertBefore(element, ziel.firstChild); else ziel.appendChild(element);
    }

    function setzeHandy(an) {
      if (an === handy.an) return;
      handy.an = an;
      el.kampf.classList.toggle("ist-handy", an);
      if (an) {
        const kopf = optionen && optionen.kopf;
        if (kopf) {
          verschiebe(el.welt, kopf.ort);
          verschiebe(el.herzen, kopf.stand);
          verschiebe(el.muenzen, kopf.stand);
        }
        verschiebe(el.leiste, el.buehne);       // die fünf Plätze stehen im Streifen
        verschiebe(el.platzInfo, el.kampf);      // ihr Glas-Panel erscheint unter dem Streifen
        verschiebe(el.kurz, el.buehne);
        verschiebe(panelOben, blattTeile);
        verschiebe(panelVerlauf, blattTeile);
        verschiebe(fuss, blattTeile);
      } else {
        schliesseBlatt();
        // in umgekehrter Reihenfolge zurück an die gemerkten Stellen
        handy.plaetze.reverse().forEach(function (p) {
          p.marke.parentNode.insertBefore(p.element, p.marke);
          p.marke.remove();
        });
        handy.plaetze = [];
      }
    }

    /** Erklärungen zum aktuellen Boss (Eigenheit, seltene Eigenschaft, Angriff) für das Blatt. */
    function fuelleBlattBoss() {
      blattBoss.innerHTML = "";
      const kopf = document.createElement("h3");
      kopf.className = "panel-titel";
      kopf.textContent = el.bossName.textContent;
      blattBoss.appendChild(kopf);
      [
        !el.eigenheit.disabled && el.eigenheitTipp.textContent,
        !el.selten.hidden && el.seltenTipp.textContent,
        !el.absicht.hidden && el.absichtTipp.textContent,
        el.eliteHinweis.textContent,
      ].filter(Boolean).forEach(function (text) {
        const p = document.createElement("p");
        p.className = "kampf-blatt-erklaerung";
        p.textContent = text;
        blattBoss.appendChild(p);
      });
    }

    /** Die belegten Plätze mit Name, Stufe und Wirkung für das Blatt. */
    function fuelleBlattPlaetze() {
      blattPlaetze.innerHTML = '<h3 class="panel-titel">Verbesserungen und Bücher</h3>';
      if (anzeige.gesammelt.length === 0) {
        const p = document.createElement("p");
        p.className = "kampf-blatt-erklaerung";
        p.textContent = "Noch keine – nach jedem Boss wählst du eine (" + K.plaetze + " Plätze).";
        blattPlaetze.appendChild(p);
        return;
      }
      anzeige.gesammelt.forEach(function (v) {
        const p = document.createElement("p");
        p.className = "kampf-blatt-erklaerung";
        p.textContent = platzText(v).titel + ": " + platzText(v).wirkung;
        blattPlaetze.appendChild(p);
      });
    }

    function oeffneBlatt() {
      if (!handy.an || !blatt.hidden) return;
      fuelleBlattBoss();
      fuelleBlattPlaetze();
      blatt.hidden = false;
      blattInhalt.style.transform = "";
      void blatt.offsetWidth;
      blatt.classList.add("offen");
      blatt.querySelector(".kampf-blatt-zu").focus();
    }

    function schliesseBlatt() {
      if (blatt.hidden) return;
      blatt.classList.remove("offen");
      blattInhalt.style.transform = "";
      setTimeout(function () { if (!blatt.classList.contains("offen")) blatt.hidden = true; }, ohneBewegung() ? 0 : 220);
    }

    // Antippen des Streifens öffnet das Blatt (der Würfel kürzt weiter die Animationen ab)
    el.buehne.addEventListener("click", function (event) {
      // Würfel kürzt ab, die Plätze zeigen ihr Glas-Panel – alles andere öffnet das Blatt
      if (!handy.an || event.target.closest(".wuerfel-knopf, .kampf-wuerfel, .kampf-platz")) return;
      event.preventDefault();
      event.stopPropagation();
      oeffneBlatt();
    }, true);
    blatt.querySelector(".kampf-blatt-hintergrund").addEventListener("click", schliesseBlatt);
    blatt.querySelector(".kampf-blatt-zu").addEventListener("click", schliesseBlatt);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !blatt.hidden) schliesseBlatt();
    });
    // Wischen nach unten schließt das Blatt (nur, wenn es nicht gerade selbst scrollt)
    let wischStart = null;
    blattInhalt.addEventListener("touchstart", function (event) {
      wischStart = blattInhalt.scrollTop <= 0 ? event.touches[0].clientY : null;
    }, { passive: true });
    blattInhalt.addEventListener("touchmove", function (event) {
      if (wischStart === null) return;
      const dy = event.touches[0].clientY - wischStart;
      blattInhalt.style.transform = dy > 0 ? "translateY(" + dy + "px)" : "";
    }, { passive: true });
    blattInhalt.addEventListener("touchend", function (event) {
      if (wischStart === null) return;
      const dy = event.changedTouches[0].clientY - wischStart;
      wischStart = null;
      if (dy > 70) schliesseBlatt(); else blattInhalt.style.transform = "";
    });

    const handyMedien = window.matchMedia(HANDY_MEDIEN);
    setzeHandy(handyMedien.matches);
    handyMedien.addEventListener("change", function () { setzeHandy(handyMedien.matches); });

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
    const anzeige = { bossNummer: 0, weltId: null, muenzen: 0, maxLeben: SudokuRPG.KONFIG.maxLeben, gesammelt: [] };
    const K = SudokuRPG.KONFIG;

    /* ---------- Warteschlange ----------
       Jeder Schritt bekommt eine Nummer. Kommt ein neuer Zug, bevor die
       Animationen des letzten fertig sind, werden alle älteren Schritte
       "eilig": Sie springen sofort zu ihrem Ende (beschleunige). So staut
       sich nichts an. */
    let kette = Promise.resolve();
    let schrittNummer = 0;       // zuletzt vergebene Nummer
    let laufend = 0;             // Nummer des gerade laufenden Schritts (0 = keiner)
    let fertigBis = 0;           // Nummer des zuletzt beendeten Schritts
    let eiligBis = 0;            // alle Schritte bis zu dieser Nummer laufen ohne Wartezeit
    const wartende = new Set();  // laufende Wartezeiten – beschleunige() beendet sie sofort

    function einreihen(schritt) {
      const nummer = ++schrittNummer;
      kette = kette
        .then(function () { laufend = nummer; return schritt(); })
        .catch(function (fehler) { console.error(fehler); })
        .then(function () { if (laufend === nummer) laufend = 0; fertigBis = nummer; });
      return kette;
    }

    /** Sind noch Schritte offen (laufend oder wartend)? */
    function laeuft() {
      return fertigBis < schrittNummer;
    }

    /**
     * Eine sichtbare Folge des Zugs außerhalb des Kampffensters (z. B. das
     * Gitter ausgrauen) – läuft erst, wenn alle vorher eingereihten
     * Animationen fertig sind. So verrät nichts vorzeitig den Ausgang.
     */
    function danach(schritt) {
      return einreihen(schritt);
    }

    let regenbogenLaeuft = false;   // Regenbogenschlag läuft → nichts wird abgekürzt

    /** Läuft gerade ein Schritt, der übersprungen werden soll? */
    function eilig() {
      return laufend !== 0 && laufend <= eiligBis;
    }

    /** Alle bisher eingereihten Schritte sofort zu Ende bringen (der Würfel landet sofort). */
    function beschleunige() {
      if (regenbogenLaeuft) return;        // der Regenbogenschlag lässt sich nicht abkürzen
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
      zeigeWelt(boss);
      el.bossName.textContent = boss.name;
      // Elite-Boss: Zusatz "Elite" am Namen, größere Figur mit Aura, eigener HP-Rahmen (CSS).
      // Der Weltboss: noch größer, eigene Kennzeichnung.
      el.bossNr.textContent = boss.weltboss ? "♛ Weltboss" : boss.elite ? "★ Elite" : "Lv. " + boss.weltLevel;
      el.bossNr.title = "Boss Nr. " + boss.nummer;
      el.buehne.classList.toggle("ist-elite", boss.elite);
      el.buehne.classList.toggle("ist-weltboss", Boolean(boss.weltboss));
      zeigeEigenheit(boss.eigenheit);
      zeigeSelten(boss.elite ? boss.selten : null);
      // Klein links unter dem HP-Balken: Zähler der seltenen Eigenschaft bzw.
      // bei normalen Bossen, wann der nächste Elite-Boss kommt
      let hinweis = "";
      if (boss.elite) {
        hinweis = boss.selten && boss.selten.zaehlerText ? "🛡 " + boss.selten.zaehlerText : "";
      } else if (boss.bisElite !== null) {
        const art = boss.weltLevel + boss.bisElite === boss.weltbossLevel ? "Weltboss" : "Elite";
        hinweis = boss.bisElite === 1 ? "Nächster: " + art + "!" : art + " in " + boss.bisElite;
      }
      el.eliteHinweis.textContent = hinweis;
      el.eliteHinweis.title = boss.elite ? "" : "So viele Bosse bis zum nächsten Elite-Boss";
    }

    /**
     * Welt und Level über der Bühne ("Felder und Tavernen · Level 7/20"),
     * Fortschrittsleiste, Pixel-Hintergrund und Farbstimmung der Welt.
     */
    function zeigeWelt(boss) {
      const w = boss.welt;
      el.weltName.textContent = w.name;
      el.weltLevel.textContent = " · Level " + boss.weltLevel + "/" + boss.levelProWelt;
      el.weltDurchlauf.hidden = boss.durchlauf <= 1;
      el.weltDurchlauf.textContent = " · Durchlauf " + boss.durchlauf;
      el.welt.setAttribute("aria-label", w.name + ", Level " + boss.weltLevel + " von " + boss.levelProWelt +
        (boss.durchlauf > 1 ? ", Durchlauf " + boss.durchlauf : ""));
      // Leiste: ein Abschnitt je Level – geschafft, aktuell, Elite, Weltboss
      if (el.weltLeiste.children.length !== boss.levelProWelt) {
        el.weltLeiste.innerHTML = "";
        for (let i = 1; i <= boss.levelProWelt; i++) el.weltLeiste.appendChild(document.createElement("li"));
      }
      Array.prototype.forEach.call(el.weltLeiste.children, function (li, k) {
        const level = k + 1;
        li.className = "kampf-welt-abschnitt" +
          (level === boss.weltbossLevel ? " ist-weltboss" : boss.eliteLevel.indexOf(level) !== -1 ? " ist-elite" : "") +
          (level < boss.weltLevel ? " ist-geschafft" : level === boss.weltLevel ? " ist-aktuell" : "");
      });
      // Hintergrund und Farbstimmung nur beim Wechsel der Welt neu
      if (anzeige.weltId !== w.id) {
        anzeige.weltId = w.id;
        el.kampf.dataset.welt = w.id;
        el.kampf.style.setProperty("--welt-akzent", w.farben.akzent);
        el.kampf.style.setProperty("--welt-himmel", w.farben.himmelOben);
        el.kampf.style.setProperty("--welt-boden", w.farben.bodenDunkel);
        SudokuSprites.zeichneHintergrund(el.hintergrund, w);
      }
    }

    /**
     * Kurze Einblendung beim Betreten einer Welt (Name, Nummer, ggf. Durchlauf).
     * Blockiert nichts; bei "Bewegung reduzieren" ohne Bewegung, nur Ein-/Ausblenden.
     */
    function weltEinblendung(boss) {
      el.buehne.querySelectorAll(".kampf-welt-einblendung").forEach(function (alt) { alt.remove(); });
      const e = document.createElement("div");
      e.className = "kampf-welt-einblendung";
      e.setAttribute("aria-hidden", "true");
      e.innerHTML = '<span class="kampf-welt-einblendung-nr"></span><span class="kampf-welt-einblendung-name"></span>';
      e.querySelector(".kampf-welt-einblendung-nr").textContent = "Welt " + boss.welt.nummer +
        (boss.durchlauf > 1 ? " · Durchlauf " + boss.durchlauf : "");
      e.querySelector(".kampf-welt-einblendung-name").textContent = boss.welt.name;
      el.buehne.appendChild(e);
      meldung("Welt " + boss.welt.nummer + ": " + boss.welt.name + (boss.durchlauf > 1 ? ", Durchlauf " + boss.durchlauf : "") + ".");
      setTimeout(function () { e.remove(); }, DAUER.weltEinblendung);
    }

    /* ---------- Sprechblasen ----------
       Laufen neben der Warteschlange her: Ein Satz erscheint Buchstabe für
       Buchstabe über dem Boss und verschwindet nach ein paar Sekunden. Kommt
       ein weiterer Satz, steht der laufende sofort ganz da und geht früher.
       Abkürzen (beschleunige) überspringt keine Sprechblase. */
    const blasen = [];          // wartende Sätze { name, text }
    let blase = null;           // die gerade sichtbare { div, textEl, voll, zeit }

    /** Ein Satz des Bosses: als Sprechblase, im Verlauf und für Screenreader. */
    function sprechblase(name, text, art) {
      if (!text) return;
      verlaufEintrag({ text: name + ": „" + text + "“", wert: "", art: "satz", symbol: "sprechblase" });
      // an die Meldung dieses Schritts anhängen (z. B. "… ist besiegt!")
      meldung((el.status.textContent ? el.status.textContent + " " : "") + name + ": " + text);
      blasen.push({ name: name, text: text, art: art || "" });
      if (blase) {
        zeigeGanz(blase);                    // die laufende macht Platz
      } else {
        naechsteBlase();
      }
    }

    function zeigeGanz(b) {
      if (b.voll) return;
      clearInterval(b.tippen);
      b.textEl.textContent = b.text;
      b.voll = true;
      halten(b);
    }

    function halten(b) {
      clearTimeout(b.zeit);
      b.zeit = setTimeout(function () {
        b.div.classList.add("geht");
        b.zeit = setTimeout(function () {
          b.div.remove();
          blase = null;
          naechsteBlase();
        }, DAUER.blaseAus);
      }, blasen.length > 0 ? DAUER.blaseKurz : DAUER.blaseHalten);
    }

    function naechsteBlase() {
      const n = blasen.shift();
      if (!n) return;
      const div = document.createElement("div");
      div.className = "kampf-sprechblase" + (n.art ? " kampf-sprechblase--" + n.art : "");
      div.innerHTML = '<span class="kampf-sprechblase-name"></span><span class="kampf-sprechblase-text"></span>';
      div.querySelector(".kampf-sprechblase-name").textContent = n.name;
      const textEl = div.querySelector(".kampf-sprechblase-text");
      // Platz für den ganzen Satz reservieren, damit die Blase beim Tippen nicht wächst
      div.style.setProperty("--blase-laenge", String(n.text.length));
      el.blasenPlatz.innerHTML = "";
      el.blasenPlatz.appendChild(div);
      blase = { div: div, textEl: textEl, text: n.text, voll: false, zeit: 0, tippen: 0 };
      const b = blase;
      if (ohneBewegung() || blasen.length > 0) {
        zeigeGanz(b);
        return;
      }
      let k = 0;
      b.tippen = setInterval(function () {
        k++;
        textEl.textContent = n.text.slice(0, k);
        if (k >= n.text.length) zeigeGanz(b);
      }, DAUER.blaseZeichen);
    }

    /** Alle Sprechblasen weg (neues Abenteuer). */
    function blasenLeeren() {
      blasen.length = 0;
      if (blase) { clearInterval(blase.tippen); clearTimeout(blase.zeit); blase = null; }
      el.blasenPlatz.innerHTML = "";
    }

    /**
     * Auftritt eines Bosses ohne Kampfwechsel (neues Abenteuer, Neustart):
     * Einblendung der Welt (bei Level 1) und sein Satz.
     */
    function auftritt(boss) {
      return einreihen(function () {
        zeigeBoss(boss);
        meldung("");
        if (boss.weltLevel === 1) weltEinblendung(boss);
        sprechblase(boss.name, boss.erscheinen, "erscheinen");
      });
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

    /** Buch-Bonus des laufenden Sudokus neben den Plätzen ("+15 %", bei 0 ausgeblendet). */
    function zeigeBuchBonus(bonus) {
      if (typeof bonus !== "number") return;
      const prozent = Math.round(bonus * 100);
      el.buchBonus.hidden = prozent <= 0;
      el.buchBonusWert.textContent = "+" + prozent + " %";
      el.buchBonus.setAttribute("aria-label", "Buch-Bonus " + prozent + " Prozent mehr Schaden");
      el.buchBonus.title = "Buch-Bonus: +" + prozent + " % Schaden in diesem Sudoku";
    }

    /** Name, Stufe und Wirkung einer Verbesserung bzw. eines Buchs (Glas-Panel, Blatt, Vorlesen). */
    function platzText(v) {
      if (v.art === "buch") {
        return { titel: v.name + " · Stufe " + v.stufe + "/" + v.maxStufe + " · " + v.seltenheitName,
          wirkung: v.grundText + " Zusatz: " + v.zusatzText };
      }
      return { titel: v.name + " · Stufe " + v.stufe + "/" + v.maxStufe, wirkung: v.beschreibung + " (je Stufe)" };
    }

    /**
     * Die fünf Plätze: belegte zeigen Symbol (Bücher: Buch mit Ziffer, Rahmen
     * in der Farbe der Seltenheit) und Stufe in der Ecke, freie Plätze nur einen
     * dezenten Umriss. Name und Wirkung zeigt das Glas-Panel.
     */
    function zeigeVerbesserungen(liste, neueId) {
      anzeige.gesammelt = liste.slice();
      versteckePlatzInfo();
      el.verbesserungen.innerHTML = "";
      const plaetze = Math.max(K.plaetze, liste.length);
      el.verbesserungen.setAttribute("aria-label", "Deine Verbesserungen: " + liste.length + " von " + K.plaetze + " Plätzen belegt");
      for (let k = 0; k < plaetze; k++) {
        const v = liste[k];
        if (!v) {
          const leer = document.createElement("span");
          leer.className = "kampf-platz ist-leer";
          leer.setAttribute("aria-hidden", "true");
          el.verbesserungen.appendChild(leer);
          continue;
        }
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "kampf-platz";
        knopf.dataset.id = v.id;           // Herkunft fliegender Boni (sudoku-damage-fx.js), Aufleuchten
        knopf.setAttribute("aria-describedby", "kampf-platz-info");
        knopf.style.setProperty("--chip-farbe", v.farbe);
        if (v.art === "buch") {
          knopf.classList.add("kampf-platz--buch", "kampf-platz--" + v.seltenheit);
          knopf.dataset.ziffer = v.ziffer;
          knopf.innerHTML = '<span class="kampf-buch-symbol">' + symbolSvg("buch") + '<span class="kampf-buch-ziffer"></span></span>' +
            '<span class="kampf-platz-stufe"></span>';
          knopf.querySelector(".kampf-buch-ziffer").textContent = v.ziffer;
        } else {
          knopf.innerHTML = symbolSvg(v.symbol) + '<span class="kampf-platz-stufe"></span>';
        }
        knopf.querySelector(".kampf-platz-stufe").textContent = v.stufe;
        const t = platzText(v);
        knopf.setAttribute("aria-label", t.titel + ". " + t.wirkung);
        knopf.addEventListener("mouseenter", function () { zeigePlatzInfo(knopf, v); });
        knopf.addEventListener("mouseleave", function () { if (document.activeElement !== knopf) versteckePlatzInfo(); });
        knopf.addEventListener("focus", function () { zeigePlatzInfo(knopf, v); });
        knopf.addEventListener("blur", versteckePlatzInfo);
        knopf.addEventListener("click", function (event) {
          event.stopPropagation();
          // Antippen: auf, erneutes Antippen: zu (der Fokus beim selben Tippen hat es gerade erst geöffnet)
          const geradeGeoeffnet = performance.now() - platzInfoSeit < 400;
          if (platzInfoFuer === knopf && !el.platzInfo.hidden && !geradeGeoeffnet) versteckePlatzInfo(); else zeigePlatzInfo(knopf, v);
        });
        el.verbesserungen.appendChild(knopf);
        if (v.id === neueId) animiere(knopf, "ist-neu", 600);
      }
    }

    // Glas-Panel mit Name, Stufe und Wirkung über dem gezeigten Platz
    let platzInfoFuer = null;
    let platzInfoSeit = 0;
    function zeigePlatzInfo(knopf, v) {
      if (platzInfoFuer !== knopf || el.platzInfo.hidden) platzInfoSeit = performance.now();
      const t = platzText(v);
      el.platzInfo.innerHTML = '<strong class="kampf-platz-info-titel"></strong><span class="kampf-platz-info-text"></span>';
      el.platzInfo.querySelector(".kampf-platz-info-titel").textContent = t.titel;
      el.platzInfo.querySelector(".kampf-platz-info-text").textContent = t.wirkung;
      el.platzInfo.hidden = false;
      platzInfoFuer = knopf;
      // Waagerecht über dem Platz, aber innerhalb der Leiste
      const leiste = el.leiste.getBoundingClientRect();
      const platz = knopf.getBoundingClientRect();
      const breite = el.platzInfo.offsetWidth;
      const mitte = platz.left + platz.width / 2 - leiste.left;
      el.platzInfo.style.left = Math.max(0, Math.min(leiste.width - breite, mitte - breite / 2)) + "px";
    }
    function versteckePlatzInfo() {
      el.platzInfo.hidden = true;
      platzInfoFuer = null;
    }
    document.addEventListener("click", function (event) {
      if (!el.platzInfo.hidden && !event.target.closest(".kampf-platz")) versteckePlatzInfo();
    });

    /** Plätze, deren Verbesserung bei diesem Treffer gewirkt hat, leuchten kurz auf. */
    function leuchtePlaetze(ids) {
      if (eilig()) return;
      (ids || []).forEach(function (id) {
        const platz = el.verbesserungen.querySelector('.kampf-platz[data-id="' + id + '"]');
        if (!platz) return;
        // Nicht über animiere(): Auch bei "Bewegung reduzieren" zeigt der Platz
        // kurz, dass er gewirkt hat (dann als ruhiger Rahmen, siehe CSS)
        platz.classList.remove("leuchtet");
        void platz.offsetWidth;
        platz.classList.add("leuchtet");
        setTimeout(function () { platz.classList.remove("leuchtet"); }, 700);
      });
    }

    /** Eingeschüchtert (Angriff): Marke beim Helden an oder aus. */
    function zeigeEingeschuechtert(an) {
      el.heldStatus.hidden = !an;
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
      // Jede Zeile weiß, zu welchem Schritt der Rechnung sie gehört (schritt) –
      // so zeigt der Schadensaufbau sie im richtigen Moment (zeigeAufbau)
      const zeilen = [];
      // kurz, damit die Zeile in die schmale Spalte passt ("Buch 8")
      const buchName = e.buch ? "Buch " + e.buch.ziffer : "Buch";
      if (e.regenbogen) {
        // Kein Wurf, keine Rechnung: der Boss ist sofort besiegt
        return [{ key: "regenbogen", label: "Regenbogen", wert: String(e.schaden), art: "regenbogen", schritt: 0 }];
      }
      if (e.immun) {
        // "Wurf 6 · gerade · immun" – sonst wurde nichts berechnet
        const z = e.rechnung.wuerfel ? wuerfelZeilen(e) : [{ key: "wurf", label: "Wurf", wert: String(e.wurf), schritt: 0 }];
        return z.concat([
          { key: "immun", label: e.selten.grund, wert: e.selten.art, art: "selten", farbe: e.selten.farbe, schritt: 0 },
          { key: "selten", label: e.selten.name, wert: "", art: "notiz", schritt: 0 },
        ]);
      }
      e.rechnung.schritte.forEach(function (schritt, i) {
        // Mehrere Würfel (Bücher): je Würfel eine Zeile
        if (/^Würfel /.test(schritt)) {
          wuerfelZeilen(e).forEach(function (z) { zeilen.push(z); });
          // Buch des Achten/Neunten: alle Würfel zählen → Summe mit Herkunft
          const summe = /= (\d+)$/.exec(schritt);
          if (e.wuerfelModus === "summe" && summe) {
            zeilen.push({ key: "wuerfelSumme", label: buchName,
              wert: "Σ " + summe[1], art: "buch", schritt: i });
          }
          return;
        }
        // Buch-Bonus: "Buch-Bonus +15 %" (eigener Schadensbonus)
        const buch = /^Buch-Bonus \+(\d+) %$/.exec(schritt);
        if (buch) {
          zeilen.push({ key: "buecher", label: "Buch-Bonus", wert: "+" + buch[1] + " %", art: "buch", schritt: i });
          return;
        }
        const teil = /^(.*) (\S+)$/.exec(schritt);
        const name = teil ? teil[1] : schritt;
        const wert = teil ? teil[2] : "";
        const grad = gradMitName(name);
        if (name === "Wurf") {
          zeilen.push({ key: "wurf", label: "Wurf", wert: wert, schritt: i });
          // Buch des Zweiten: zwei Würfel, der höhere zählt
          if (e.wuerfelModus === "hoechster") {
            zeilen.push({ key: "zweiWuerfel", label: buchName, wert: e.wuerfe.join(" / "), art: "buch", schritt: i });
          }
        } else if (name === "Mindestwurf") {
          zeilen.push({ key: "mindestwurf", label: buchName, wert: "≥ 10 (" + wert + ")", art: "buch", schritt: i });
        } else if (name === "Kritisch") {
          const durchBuch = e.buch && e.buch.zusatz === "kritisch";
          zeilen.push({ key: "kritisch", label: durchBuch ? "Krit. (" + buchName + ")" : "Kritisch", wert: wert, art: "kritisch", schritt: i });
        } else if (schritt === "Fehlschlag") {
          zeilen.push({ key: "fehlschlag", label: "Fehlschlag", wert: "×0", art: "daneben", schritt: i });
        } else if (name === "Zuschlag") {
          zeilen.push({ key: "zuschlag", label: "Zuschlag", wert: wert, schritt: i });
        } else if (name === "Eingeschüchtert") {
          zeilen.push({ key: "eingeschuechtert", label: "Eingeschüchtert", wert: wert, art: "daneben", schritt: i });
        } else if (grad) {
          zeilen.push({ key: "schwierigkeit", label: "Schwierigkeit",
            wert: "+" + Math.round(SudokuRPG.belohnung(grad.id).schadensBonus * 100) + " %", schritt: i });
        } else if (name === "Doppelt") {
          zeilen.push({ key: "doppelt", label: "Doppelschaden", wert: wert, art: "doppelt", schritt: i });
        } else if (name === "Fluch") {
          zeilen.push({ key: "fluch", label: "Fluch", wert: wert, art: "fluch", schritt: i });
        } else if (name === "Reihenbrecher") {
          zeilen.push({ key: "reihen", label: "Reihenbrecher", wert: wert, art: "reihe", schritt: i });
        } else if (e.boss.selten && name === e.boss.selten.name) {
          zeilen.push({ key: "selten", label: name, wert: wert, art: "selten", farbe: e.boss.selten.farbe, schritt: i });
        } else if (e.eigenheit && name === e.eigenheit.name) {
          zeilen.push({ key: "eigenheit", label: name, wert: wert, art: "eigenheit", farbe: e.eigenheit.farbe, schritt: i });
        } else {
          zeilen.push({ key: "schritt" + i, label: name, wert: wert, schritt: i });
        }
      });
      const ende = e.rechnung.schritte.length;
      if (e.gift > 0) {
        const durchBuch = e.buch && e.buch.zusatz === "gift" && !(e.powerup && e.powerup.typ === "gift");
        zeilen.push({ key: "gift", label: durchBuch ? "Gift (" + buchName + ")" : "Gift", wert: "+" + e.gift, art: "gift", schritt: ende });
      }
      // Buch des Vierten: Angriff des Bosses kommt einen Zug später
      if (e.buchAngriff > 0) {
        zeilen.push({ key: "buchAngriff", label: buchName, wert: "+" + e.buchAngriff + " Zug", art: "buch", schritt: ende });
      }
      if (e.fehlschlag && e.spruch) zeilen.push({ key: "spruch", label: e.spruch, wert: "", art: "notiz", schritt: ende });
      return zeilen;
    }

    /** Je Würfel eine Zeile: "Würfel 2 · 20 krit → 60", "Würfel 1 · 4 immun" … */
    function wuerfelZeilen(e) {
      return e.rechnung.wuerfel.map(function (w, k) {
        let wert = String(w.wurf);
        if (w.kritisch) wert += " ×" + SudokuRPG.zahlText(K.kritischFaktor) + " = " + w.wert;
        else if (w.immun || w.geblockt) wert += " " + (w.abwehrArt || "geblockt");
        else if (w.fehlschlag) wert += " Fehlschlag";
        return { key: "wuerfel" + k, label: "Würfel " + (k + 1), wert: wert,
          art: w.kritisch ? "kritisch" : w.immun || w.geblockt || w.fehlschlag ? "daneben" : "", schritt: 0 };
      });
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
      if (e.buchMuenzen > 0) {
        zeilen.push({ key: "buchMuenzen", label: e.buch ? "Buch " + e.buch.ziffer : "Buch", wert: "+" + e.buchMuenzen, art: "gold" });
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
      const art = e.regenbogen ? "regenbogen" : e.verflucht ? "fluch" : e.immun ? "selten" : e.kritisch ? "kritisch" : e.fehlschlag ? "daneben" :
        e.eigenheit ? "eigenheit" : e.doppelt ? "doppelt" : "";
      const farbe = e.immun ? e.selten.farbe : e.eigenheit ? e.eigenheit.farbe : null;
      let kurz = gesamt + " Schaden";
      if (e.regenbogen) kurz = "Regenbogenschlag";
      else if (e.verflucht) kurz = "Verflucht";
      else if (e.immun) kurz = e.selten.art === "geblockt" ? "Geblockt" : "Immun";
      else if (e.fehlschlag) kurz = "Fehlschlag";
      else if (e.eigenheit) kurz = "Geblockt";
      zeigeZug({
        treffer: rechnungsZeilen(e),
        schaden: { label: "Gesamt", wert: String(gesamt), art: art, farbe: farbe },
        belohnung: belohnungsZeilen(e),
        muenzen: { label: "Summe", wert: muenzenText(muenzen), art: "gold" },
        kurz: { schaden: kurz, schadenArt: art, muenzen: muenzenText(muenzen) + " Münzen" },
      });
      if (e.regenbogen) {
        verlaufEintrag({ text: "Regenbogenschlag!", wert: "−" + gesamt, art: "regenbogen", symbol: "stern" });
      } else if (e.verflucht) {
        verlaufEintrag({ text: "Fluch: " + e.ziffer + " macht keinen Schaden", wert: "0", art: "fluch", symbol: "fluch" });
      } else if (e.immun) {
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


    /* ---------- Gegenangriff: Absicht des Bosses und Parade ---------- */

    /** "in 8 Zügen", "in 1 Zug", "jetzt!" (die zweite Zeile der Absicht) */
    function zaehlerText(zaehler) {
      return zaehler <= 0 ? "jetzt!" : "in " + zaehler + (zaehler === 1 ? " Zug" : " Zügen");
    }

    /** "Siegel in 8 Zügen" bzw. "Siegel jetzt!" (für Screenreader) */
    function absichtText(a, zaehler) {
      return a.name + " " + zaehlerText(zaehler);
    }

    /**
     * Zeigt den Gegenangriff-Stand SOFORT: Absicht über dem Boss (Warnung in
     * den letzten Zügen), Schild beim Helden. Gibt den Stand auch an das
     * Spielfeld weiter (optionen.beimGegenangriff), das daraus Siegel,
     * Finsternis und Fluch zeichnet. Wird nur aus Schritten der Warteschlange
     * aufgerufen – so passt alles zur Reihenfolge der Animationen.
     * @param {object} stand – { angriff, zaehler, warnung, paradeMoeglich, wirkungen }
     */
    function zeigeGegenangriff(stand) {
      if (!stand) return;
      const a = stand.angriff;
      el.absicht.hidden = !a;
      if (a) {
        el.absicht.style.setProperty("--angriff-farbe", a.farbe);
        el.absichtSymbol.innerHTML = symbolSvg(a.symbol);
        el.absichtName.textContent = a.name;
        el.absichtText.textContent = zaehlerText(stand.zaehler);
        el.absicht.classList.toggle("warnt", Boolean(stand.warnung));
        const erklaerung = a.name + ": " + a.beschreibung + " Kommt alle " + a.abstand +
          " Züge – jede gesetzte Zahl zählt. Vervollständigst du im Zug des Angriffs eine Zeile, Spalte oder einen Block, pariert der Held.";
        el.absichtTipp.textContent = erklaerung;
        el.absicht.setAttribute("aria-label", absichtText(a, stand.zaehler) + ". " + erklaerung);
      }
      // Mit dem nächsten Zug greift der Boss an: Jetzt zählt die Parade
      const moeglich = Boolean(stand.paradeMoeglich && a);
      el.parade.classList.toggle("ist-moeglich", moeglich);
      const paradeText = moeglich
        ? "Parade jetzt möglich: Der Boss greift mit deinem nächsten Zug an. Vervollständigst du damit eine Zeile, Spalte oder einen 3×3-Block, wehrt der Held ab."
        : "Parade: Vervollständige im Zug des Angriffs eine Zeile, Spalte oder einen 3×3-Block – dann wehrt der Held ab.";
      el.paradeTipp.textContent = paradeText;
      el.parade.setAttribute("aria-label", paradeText);
      if (optionen && optionen.beimGegenangriff) optionen.beimGegenangriff(stand);
    }

    /** Ein Symbol mitten auf der Bühne (oder am Boss), das kurz auftaucht und verschwindet. */
    function angriffSymbol(e, ort, zusatz) {
      const s = document.createElement("div");
      s.className = "kampf-angriff-symbol kampf-angriff-symbol--" + ort;
      s.style.setProperty("--angriff-farbe", e.angriff.farbe);
      s.innerHTML = symbolSvg(e.angriff.symbol) + (zusatz ? '<span class="kampf-angriff-zusatz"></span>' : "");
      if (zusatz) s.querySelector(".kampf-angriff-zusatz").textContent = zusatz;
      el.effekte.appendChild(s);
      setTimeout(function () { s.remove(); }, DAUER.angriffWirkung + 400);
      return s;
    }

    /**
     * Die eigene Animation jedes Angriffs (nach der Ansage). Neuer Angriff ohne
     * Eintrag hier? Dann erscheint nur sein Symbol (siehe angriff()).
     */
    const ANGRIFF_ANIMATION = {
      // Einschüchtern: der Boss starrt, der Held duckt sich, bis zum nächsten
      // Treffer steht "½" beim Helden
      einschuechtern: function (e) {
        angriffSymbol(e, "held");
        animiere(el.heldFigur, "duckt-sich", DAUER.angriffWirkung);
        zeigeEingeschuechtert(true);
        return pause(DAUER.angriffWirkung);
      },
      // Siegel: ein Schloss dreht sich in der Bühnenmitte, Ketten erscheinen im Sudoku
      siegel: function (e) {
        angriffSymbol(e, "mitte", "Block " + (e.wirkung.daten.block + 1));
        return pause(DAUER.angriffWirkung);
      },
      // Finsternis: die Bühne verdunkelt sich kurz
      finsternis: function (e) {
        angriffSymbol(e, "mitte");
        faerbe(el.buehne, "verdunkelt", DAUER.angriffWirkung + 200);
        return pause(DAUER.angriffWirkung);
      },
      // Fluch: ein Totenkopf mit der verfluchten Ziffer steigt über dem Boss auf
      fluch: function (e) {
        angriffSymbol(e, "boss", String(e.wirkung.daten.ziffer));
        return pause(DAUER.angriffWirkung);
      },
      // Hieb: der Boss springt vor, der Held wird getroffen, ein Herz geht verloren
      hieb: function (e) {
        angriffSymbol(e, "held");
        animiere(el.bossFigur, "greift-an", DAUER.angriff);
        return warte(DAUER.angriff / 2).then(function () {
          zeigeHerzen(e.leben, e.maxLeben);
          const herz = el.herzen.children[e.leben];
          if (herz) animiere(herz, "verschwindet", 400);
          animiere(el.heldFigur, "wird-getroffen", 300);
          faerbe(el.blitz, "an-hieb", 300);
          schwebeZahl("−" + (e.lebenVorher - e.leben) + " ♥", "hieb");
          return pause(DAUER.angriffWirkung - DAUER.angriff / 2);
        });
      },
    };

    /** Text für Meldung und Verlauf. */
    function angriffMeldung(e) {
      if (e.pariert) return e.boss.name + " greift an – " + e.angriff.name + "! Pariert!";
      if (e.verpufft) return e.boss.name + " greift an – " + e.angriff.name + " verpufft.";
      const dauer = e.wirkung ? " für " + e.wirkung.rest + " Züge" : "";
      return e.boss.name + " greift an – " + e.angriff.name + "! " + e.text + dauer + ".";
    }

    /**
     * Der Boss greift an (Schritt der Warteschlange, nach Würfel, Schaden und
     * Treffer dieses Zugs): Ansage → Parade, Verpuffen oder die Wirkung →
     * neuer Stand (Zähler von vorn, Schild, Spielfeld).
     */
    function angriff(e) {
      return einreihen(function () {
        meldung(angriffMeldung(e));
        const ansage = banner(e.angriff.name + "!", e.angriff.farbe, "angriff");
        faerbe(el.absicht, "loest-aus", DAUER.angriffAnsage);
        animiere(el.bossFigur, "holt-aus", DAUER.angriffAnsage);
        return pause(DAUER.angriffAnsage).then(function () {
          if (e.pariert) {
            // Der Held reißt das Schwert hoch, der Angriff prallt ab
            ansage.remove();               // Platz für das große "Pariert!"
            animiere(el.heldFigur, "pariert", DAUER.parade);
            faerbe(el.parade, "pariert", DAUER.parade);
            banner("Pariert!", null, "pariert");
            verlaufEintrag({ text: "Pariert: " + e.angriff.name, wert: "Einheit fertig", art: "parade", symbol: "schild" });
            return pause(DAUER.parade);
          }
          if (e.verpufft) {
            schwebeZahl("Verpufft", "daneben");
            verlaufEintrag({ text: e.angriff.name + " verpufft", wert: "", art: "daneben", symbol: e.angriff.symbol });
            return pause(DAUER.angriffWirkung / 2);
          }
          verlaufEintrag({ text: e.angriff.name + ": " + e.text, wert: e.wirkung ? e.wirkung.rest + " Züge" : "",
            art: "angriff", symbol: e.angriff.symbol, farbe: e.angriff.farbe });
          const animation = ANGRIFF_ANIMATION[e.angriff.id] || function () {
            angriffSymbol(e, "mitte");
            return pause(DAUER.angriffWirkung);
          };
          return animation(e);
        }).then(function () {
          zeigeGegenangriff(e.stand);     // Zähler von vorn, Schild, Siegel/Finsternis/Fluch im Sudoku
        });
      });
    }


    /* ---------- Öffentliche Schritte (laufen über die Warteschlange) ---------- */

    /**
     * Zeigt einen Stand SOFORT (ohne Animation) – z. B. nach dem Laden.
     * @param {object} stand – { boss, hp, leben, maxLeben, muenzen, rekord,
     *                           verbesserungen, buchBonus, eingeschuechtert, gegenangriff }
     */
    function zeigeStand(stand) {
      return einreihen(function () {
        zeigeBoss(stand.boss);
        zeigeHp(stand.hp, stand.boss.maxHp);
        zeigeHerzen(stand.leben, stand.maxLeben);
        zeigeMuenzen(stand.muenzen, false);
        zeigeVerbesserungen(stand.verbesserungen);
        zeigeEingeschuechtert(Boolean(stand.eingeschuechtert));
        zeigeBuchBonus(stand.buchBonus);
        zeigeRekord(stand.boss, stand.rekord);
        zeigeGegenangriff(stand.gegenangriff);
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite", "loest-sich-auf", "ist-ruhig");
      });
    }

    /** Fasst zusammen, was eine richtige Zahl bewirkt hat – mit der Rechnung. */
    function trefferText(e) {
      const teile = [];
      if (e.regenbogen) {
        teile.push("Regenbogenschlag! " + e.boss.name + " ist mit einem Schlag besiegt.");
      } else if (e.verflucht) {
        teile.push("Fluch! Die " + e.ziffer + " ist verflucht und macht keinen Schaden.");
      } else if (e.immun) {
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
     * Münzen, Leben – kurz nacheinander; wirksame Plätze leuchten auf.
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
        quelle: function (name, schritt) {
          if (name === "klinge") return mitte(el.verbesserungen.querySelector('[data-id="klinge"]'));
          // Bücher: vom Buch der gesetzten Ziffer auf seinem Platz (sonst vom Buch-Bonus)
          if (name === "buecher" || name === "buch") {
            return (e.buch && mitte(el.verbesserungen.querySelector('[data-id="' + e.buch.id + '"]'))) || mitte(el.buchBonus);
          }
          if (name === "boss") return mitte(el.bossFigur);          // Einschüchtern
          if (name === "selten") return el.selten.hidden ? null : mitte(el.selten);
          if (name === "grad") return mitte(optionen && optionen.gradAnzeige);
          if (name === "doppelt") return einheitMitte(e);
          if (name === "reihe") return einheitMitte(e, schritt && schritt.einheit);
          return null;
        },
        warte: warte,
        pause: pause,
        eilig: eilig,
        // i = Index des Schritts in rechnung.schritte, ohne den Wurf
        beimSchritt: function (i, wert) { zeigeAufbau(e, i + 2, wert); },
      };
    }

    /**
     * Mitte der Zeile, Spalte oder des Blocks, die diese Zahl vervollständigt hat.
     * @param {string} [welche] – "zeile", "spalte" oder "block"; sonst die erste fertige
     */
    function einheitMitte(e, welche) {
      if (!optionen || !optionen.gitterFeld) return null;
      const z = Math.floor(e.index / 9), sp = e.index % 9;
      const ein = welche ? { zeile: welche === "zeile", spalte: welche === "spalte", block: welche === "block" } : e.einheiten;
      let ecken;
      if (ein.zeile) ecken = [z * 9, z * 9 + 8];
      else if (ein.spalte) ecken = [sp, 72 + sp];
      else if (ein.block) {
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
      // Zeilen der ersten n Schritte (eine Zeile kann mehrere Würfel umfassen, siehe rechnungsZeilen)
      const zeilen = rechnungsZeilen(e).filter(function (z) { return z.key !== "gift" && z.key !== "spruch" && z.key !== "buchAngriff"; });
      setzeZeilen(el.trefferZeilen, zeilen.filter(function (z) { return z.schritt < n; }));
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
      if (e.regenbogen) regenbogenLaeuft = true;   // ab jetzt kürzt nichts mehr ab
      return einreihen(function () {
        zeigeBoss(e.boss);
        // Regenbogenfeld: kein Würfel – der Boss wird mit einem Schlag besiegt
        if (e.regenbogen) {
          return regenbogenSchlag(e).then(function () {
            protokolliereTreffer(e);
            schwebeZahl("+" + (e.muenzenPlus + e.eliteBonus), "muenzen");
            return zeigeMuenzen(e.muenzen, true);
          }).then(function () { regenbogenLaeuft = false; },
            function (fehler) { regenbogenLaeuft = false; throw fehler; });
        }
        // 1. Würfel rollt – erst wenn er gelandet ist, wird der Treffer sichtbar
        return wuerfel.rolle(e, eilig()).then(function () {
          meldung(trefferText(e));
          leuchtePlaetze(e.wirksam);          // was bei diesem Treffer wirkt, leuchtet auf
          if (e.eingeschuechtert) zeigeEingeschuechtert(false);
          const u = fxUmgebung(e);
          if (e.fehlschlag || e.immun || e.eigenheit || e.verflucht) return keinAufbau(e, u);
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
          // Gegenangriff: Zähler eins weiter, Wirkungen laufen ab
          zeigeGegenangriff(e.gegenangriff);
          // Buch-Bonus des laufenden Sudokus
          if (typeof e.buchBonus === "number") {
            zeigeBuchBonus(e.buchBonus);
            if (e.buchBonusPlus > 0) animiere(el.buchBonus, "pulsiert", 300);
          }
          return zeigeMuenzen(e.muenzen, true);
        });
      });
    }

    /** Wartezeit, die NICHT abgebrochen werden kann (für den Regenbogenschlag). */
    function fest(ms) {
      return new Promise(function (fertig) { setTimeout(fertig, Math.max(0, ms)); });
    }

    /**
     * Regenbogenschlag (etwa 3 Sekunden, nicht abkürzbar):
     * Feld zerspringt → Regenbogenstrahl zum Schwert → Schwert lädt sich in
     * allen Farben auf → Riesenschlag → Bildschirm blitzt, HP in einem Zug auf
     * null → Boss zerfällt in bunte Funken. Ruhige Fassung bei "Bewegung
     * reduzieren" oder Kampfanimationen "Aus": sanftes Einblenden, gleiches Ergebnis.
     */
    function regenbogenSchlag(e) {
      const T = SudokuSchadenFx.KONFIG.regenbogenSchlag;
      const regenbogenStufe = SudokuSchadenFx.stufeFuer(Infinity);
      meldung(trefferText(e));
      wuerfel.zeigeLeer();
      banner("Regenbogenschlag!", null, "regenbogen");
      zeigeAufbau(e, 1, "…");

      if (ohneBewegung() || wuerfelEinstellung().fx === 0) {
        el.buehne.classList.add("regenbogen-ruhig");
        return fest(T.ruhig * 0.4).then(function () {
          zeigeAufbau(e, Infinity, e.schaden);
          zeigeHp(0, e.boss.maxHp);
          el.bossFigur.classList.add("loest-sich-auf", "ist-ruhig");
          return fest(T.ruhig * 0.6);
        }).then(function () {
          el.buehne.classList.remove("regenbogen-ruhig");
        });
      }

      const u = fxUmgebung(e);
      const feld = optionen && optionen.gitterFeld ? optionen.gitterFeld(e.index) : null;
      const r = feld ? feld.getBoundingClientRect() : null;
      const feldMitte = r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : u.start;
      // 1. Das Feld zerspringt in buntes Licht
      SudokuSchadenFx.zerspringen(feldMitte, T.zerspringen);
      return fest(T.zerspringen * 0.6).then(function () {
        // 2. Ein Regenbogenstrahl fliegt zum Schwert
        SudokuSchadenFx.regenbogenStrahl(feldMitte, u.schwert, T.strahl);
        return fest(T.strahl * 0.8 + T.zerspringen * 0.4);
      }).then(function () {
        // 3. Das Schwert lädt sich in allen Farben auf
        SudokuSchadenFx.schwertLeuchten(el.heldFigur, regenbogenStufe);
        el.heldFigur.classList.add("laedt-regenbogen");
        return fest(T.aufladen);
      }).then(function () {
        // 4. Riesenschlag
        el.heldFigur.classList.remove("laedt-regenbogen");
        el.heldFigur.classList.add("riesenschlag");
        return fest(T.ausholen + T.strahl * 0.2);
      }).then(function () {
        // 5. Bildschirm blitzt, HP in einem Zug auf null, Boss zerfällt
        SudokuSchadenFx.schwertAus(el.heldFigur);
        SudokuSchadenFx.bildschirmBlitz(T.aufloesen * 0.6);
        el.buehne.classList.add("wackelt-max");
        el.hpFuellung.classList.add("faellt-auf-null");
        zeigeAufbau(e, Infinity, e.schaden);
        zeigeHp(0, e.boss.maxHp);
        schwebeZahl("−" + e.schaden, "regenbogen");
        el.bossFigur.classList.add("loest-sich-auf");
        if (u.boss) SudokuSchadenFx.aufloesen(u.boss, T.aufloesen);
        return fest(T.aufloesen);
      }).then(function () {
        el.heldFigur.classList.remove("riesenschlag");
        el.buehne.classList.remove("wackelt-max");
        el.hpFuellung.classList.remove("faellt-auf-null");
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
      if (e.verflucht) {
        // Fluch des Bosses: Die Zahl prallt ab, der Totenkopf blitzt auf
        schwebeZahl("Verflucht!", "fluch");
        animiere(el.bossFigur, "wehrt-ab", DAUER.treffer);
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

    /** Falsche Zahl: Boss greift an, ein Leben geht verloren, ggf. Eigenheit. */
    function fehler(e) {
      beschleunige();
      return einreihen(function () {
        let text = e.boss.name + " greift an! Falsche Zahl, " +
          (e.leben === 0 ? "keine Leben mehr." : "noch " + e.leben + " Leben.");
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
          return angriff;
        }).then(function () {
          zeigeGegenangriff(e.gegenangriff);    // auch eine falsche Zahl zählt als Zug
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
        // Sein letzter Satz – auch beim Abkürzen der Animationen
        sprechblase(e.boss.name, e.boss.niederlage, "niederlage");
        verlaufEintrag(e.elite
          ? { text: "Elite " + e.boss.name + " besiegt!", wert: "+" + e.eliteBonus, art: "elite", symbol: "krone" }
          : { text: e.boss.name + " besiegt!", wert: "", art: "besiegt", symbol: "krone" });
        zeigeHp(0, e.boss.maxHp);
        // Nach dem Regenbogenschlag ist der Boss schon in Funken zerfallen
        if (ohneBewegung() || eilig() || el.bossFigur.classList.contains("loest-sich-auf")) {
          return Promise.resolve();
        }
        if (e.elite) {
          // Größer: goldener Blitz, starkes Wackeln, längeres Verglühen, Hinweis mit Bonus
          faerbe(el.blitz, "an-gold", 420);
          animiere(el.buehne, "wackelt-stark", DAUER.kritisch);
          banner((e.boss.weltboss ? "Weltboss besiegt! +" : "Elite besiegt! +") + e.eliteBonus + " Münzen", null, "elite-sieg");
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
        const boss = e.boss;
        const ort = boss.welt.name + ", Level " + boss.weltLevel;
        let text = (boss.weltboss ? "Der Weltboss erscheint! " : boss.elite ? "Ein Elite-Boss erscheint! " : "") +
          ort + ": " + boss.name + ", " + boss.maxHp + " HP.";
        if (boss.eigenheit) text += " Eigenheit " + boss.eigenheit.name + ": " + boss.eigenheit.beschreibung;
        if (boss.selten) text += " Selten, " + boss.selten.name + ": " + boss.selten.beschreibung;
        meldung(text);
        verlaufEintrag(boss.elite
          ? { text: (boss.weltboss ? "Weltboss" : "Elite") + " · Level " + boss.weltLevel + ": " + boss.name + (boss.selten ? " · " + boss.selten.name : ""),
              wert: boss.maxHp + " HP", art: "elite", symbol: boss.weltboss ? "krone" : "stern" }
          : boss.eigenheit
          ? { text: "Level " + boss.weltLevel + ": " + boss.name + " · " + boss.eigenheit.name, wert: "",
              art: "eigenheit", symbol: "warnung", farbe: boss.eigenheit.farbe }
          : { text: "Level " + boss.weltLevel + ": " + boss.name, wert: boss.maxHp + " HP" });
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite", "loest-sich-auf", "ist-ruhig");
        zeigeEingeschuechtert(false);          // Einschüchtern endet mit dem besiegten Boss
        zeigeBoss(boss);
        zeigeHp(e.hp, boss.maxHp);
        zeigeHerzen(e.leben, e.maxLeben);
        zeigeRekord(boss, rekord);
        zeigeGegenangriff(e.gegenangriff);      // neuer Angriff, neuer Zähler
        // Neue Welt (oder neuer Durchlauf): kurze Einblendung mit ihrem Namen
        if (boss.weltLevel === 1) weltEinblendung(boss);
        // Sein Satz beim Erscheinen – auch beim Abkürzen
        sprechblase(boss.name, boss.erscheinen, "erscheinen");
        if (boss.weltboss) {
          // Eigener Auftritt: Bühne verdunkelt, Boss wächst heran, großes Banner
          if (!ohneBewegung() && !eilig()) {
            const b = banner("Der Weltboss erscheint!", null, "weltboss");
            setTimeout(function () { b.remove(); }, DAUER.weltbossAuftritt);
            animiere(el.buehne, "weltboss-auftritt", DAUER.weltbossAuftritt);
            return animiere(el.bossFigur, "erscheint-weltboss", DAUER.weltbossAuftritt);
          }
          return Promise.resolve();
        }
        if (boss.elite) {
          // Eigene Einblendung (entfällt bei "Bewegung reduzieren" – die Kennzeichnungen bleiben)
          if (!ohneBewegung() && !eilig()) {
            const b = banner("Ein Elite-Boss erscheint!", null, "elite");
            setTimeout(function () { b.remove(); }, DAUER.eliteAuftritt);
          }
        } else if (boss.eigenheit) {
          banner(boss.eigenheit.name, boss.eigenheit.farbe, "eigenheit");
        }
        return animiere(el.bossFigur, "erscheint", DAUER.erscheinen);
      });
    }

    /** Eine Verbesserung wurde gewählt: Symbole und ggf. Herzen aktualisieren. */
    function verbesserung(e) {
      return einreihen(function () {
        if (e.art === "muenzbeutel") {
          // Münzbeutel: kein Platz, nur Münzen
          meldung(e.name + ": +" + e.muenzenPlus + " Münzen.");
          verlaufEintrag({ text: e.name, wert: "+" + e.muenzenPlus, art: "gold", symbol: "muenze" });
          schwebeZahl("+" + e.muenzenPlus, "muenzen");
          return zeigeMuenzen(e.muenzen, true);
        }
        meldung(e.name + ", Stufe " + e.stufe + "." + (e.lebenPlus > 0 ? " +" + e.lebenPlus + " Leben." : ""));
        verlaufEintrag(e.art === "buch"
          ? { text: e.name, wert: "Stufe " + e.stufe, art: "buch", symbol: "buch" }
          : { text: e.name, wert: "Stufe " + e.stufe });
        zeigeVerbesserungen(e.gesammelt, e.id);
        zeigeHerzen(e.leben, e.maxLeben);
        return null;
      });
    }

    /** Leuchtstufe des Schwerts, wenn k von 9 Ziffern angekommen sind (glimmen … regenbogen). */
    function buchLeuchtstufe(k, anzahl) {
      const stufen = SudokuSchadenFx.KONFIG.stufen;
      const nummer = Math.min(stufen.length - 1, Math.floor((k / anzahl) * (stufen.length - 1) + 1e-9));
      return Object.assign({ nummer: nummer }, stufen[nummer]);
    }

    /**
     * Buchschlag (Schritt der Warteschlange, nach dem Treffer dieses Zugs bzw.
     * nach dem Erscheinen des nächsten Bosses): Die neun Felder der Ziffer
     * leuchten nacheinander auf, je eine leuchtende Kopie der Ziffer fliegt
     * zum Schwert, das sich immer stärker auflädt; dann schlägt der Held zu,
     * die Schadenszahl erscheint mit dem Namen des Buchs. Etwa 2 Sekunden,
     * abkürzbar. "Bewegung reduzieren"/"Aus": nur Aufleuchten und Schadenszahl.
     */
    function buchschlag(e) {
      return einreihen(function () {
        meldung("Buchschlag! " + e.buch.name + ": " + e.schaden + " Schaden.");
        const felder = optionen && optionen.gitterFeld ? e.felder.map(optionen.gitterFeld).filter(Boolean) : [];
        const u = fxUmgebung(e);
        const t = function (ms) { return ms * (u.aktiv ? u.faktor : 1); };
        const endstufe = SudokuSchadenFx.stufeFuer(e.schaden);

        // Zum Schluss: Schlag, HP, Schadenszahl mit Namen
        const zuschlagen = function () {
          SudokuSchadenFx.schwertAus(el.heldFigur);
          zeigeHp(e.hpNachher, e.boss.maxHp);
          schwebeZahl("−" + e.schaden, "buch");
          banner(e.buch.name, BUCH_FARBE, "buch");
          verlaufEintrag({ text: "Buchschlag: " + e.buch.name, wert: "−" + e.schaden, art: "buch", symbol: "buch" });
          if (e.eliteBonus > 0 || e.besiegt) {
            zeigeMuenzen(e.muenzen, true);
            zeigeHerzen(e.leben, e.maxLeben);
          }
          const getroffen = bossGetroffen(e, endstufe);
          return u.aktiv && !u.reduziert ? Promise.all([getroffen, SudokuSchadenFx.entladen(endstufe, u)]) : getroffen;
        };

        if (ohneBewegung() || !u.aktiv) {
          felder.forEach(function (f) { faerbe(f, "buch-leuchtet", t(DAUER.buchFeld) * 6); });
          return pause(400).then(zuschlagen).then(function () { return pause(DAUER.buchZahl); });
        }

        // Felder nacheinander: aufleuchten, Ziffer fliegt zum Schwert, Schwert lädt sich auf
        let kette = Promise.resolve();
        let angekommen = 0;
        felder.forEach(function (f, k) {
          kette = kette.then(function () {
            if (eilig()) return null;
            faerbe(f, "buch-leuchtet", t(DAUER.buchFlug) + t(DAUER.buchFeld) * 2);
            const r = f.getBoundingClientRect();
            SudokuSchadenFx.zifferFlug({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, u.schwert, e.buch.ziffer, t(DAUER.buchFlug));
            setTimeout(function () {
              if (eilig()) return;
              angekommen++;
              SudokuSchadenFx.schwertLeuchten(el.heldFigur, buchLeuchtstufe(angekommen, felder.length));
            }, t(DAUER.buchFlug));
            return warte(t(DAUER.buchFeld));
          });
        });
        return kette.then(function () {
          return warte(t(DAUER.buchFlug) + t(DAUER.buchAufladen));
        }).then(function () {
          // Der Held schlägt zu – die Entladung beginnt mitten im Schlag
          animiere(el.heldFigur, "schlaegt-stark", DAUER.schlag);
          return warte(DAUER.schlag * 0.5);
        }).then(zuschlagen).then(function () {
          return warte(t(DAUER.buchZahl));
        });
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
      blasenLeeren();
      return einreihen(function () {
        leerePanel();
        wuerfel.zeigeLeer();
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
      if (info.grund === "frei") {
        // Ausgleich für eine entfernte Verbesserung (z. B. "Kombo-Meister"): freie Wahl
        titel = "Eine deiner Verbesserungen gibt es nicht mehr – wähle frei eine andere:";
      } else if (info.rest > 1) {
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
          if (info.grund === "frei") overlay.classList.add("ist-frei");   // viele Karten → Raster, scrollbar
          const karten = overlay.querySelector(".auswahl-karten");
          angebote.forEach(function (v) {
            const karte = document.createElement("button");
            karte.type = "button";
            karte.className = "auswahl-karte";
            karte.dataset.id = v.id;
            karte.style.setProperty("--chip-farbe", v.farbe);
            if (v.art === "muenzbeutel") {
              // Münzbeutel: füllt auf, wenn es weniger mögliche Karten gibt
              karte.classList.add("auswahl-karte--muenzbeutel");
              karte.innerHTML =
                '<span class="auswahl-symbol">' + symbolSvg("muenze") + "</span>" +
                '<span class="auswahl-name"></span>' +
                '<span class="auswahl-text"></span>' +
                '<span class="auswahl-stufe">Belegt keinen Platz</span>';
              karte.querySelector(".auswahl-name").textContent = v.name + ": " + v.muenzen + " Münzen";
              karte.querySelector(".auswahl-text").textContent = v.beschreibung;
            } else if (v.art === "buch") {
              // Buch: Rahmen in der Farbe der Seltenheit; neu → Grund- und
              // Zusatzwirkung, sonst die Änderung der nächsten Stufe
              karte.classList.add("auswahl-karte--buch", "auswahl-karte--" + v.seltenheit);
              karte.innerHTML =
                '<span class="auswahl-seltenheit"></span>' +
                '<span class="auswahl-symbol auswahl-symbol--buch">' + symbolSvg("buch") + '<span class="kampf-buch-ziffer"></span></span>' +
                '<span class="auswahl-name"></span>' +
                '<span class="auswahl-text"></span>' +
                '<span class="auswahl-zusatz"></span>' +
                '<span class="auswahl-stufe"></span>';
              karte.querySelector(".auswahl-seltenheit").textContent = v.seltenheitName;
              karte.querySelector(".kampf-buch-ziffer").textContent = v.ziffer;
              karte.querySelector(".auswahl-name").textContent = v.name;
              karte.querySelector(".auswahl-text").textContent = v.stufe === 0 ? v.grundText : v.naechste;
              karte.querySelector(".auswahl-zusatz").textContent = v.stufe === 0 ? "Zusatz: " + v.zusatzText : "";
              karte.querySelector(".auswahl-stufe").textContent = v.stufe === 0
                ? "Neues Buch · Platz " + v.platz + " von " + v.plaetze
                : "Stufe " + v.stufe + " → " + (v.stufe + 1) + " (max. " + v.maxStufe + ")";
            } else {
              karte.innerHTML =
                '<span class="auswahl-symbol">' + symbolSvg(v.symbol) + "</span>" +
                '<span class="auswahl-name"></span>' +
                '<span class="auswahl-text"></span>' +
                '<span class="auswahl-stufe"></span>';
              karte.querySelector(".auswahl-name").textContent = v.name;
              karte.querySelector(".auswahl-text").textContent = v.beschreibung;
              // Was die nächste Stufe bringt (z. B. "Stufe 3 auf 4: 30 auf 40 Extra-Schaden"),
              // sonst nur der Stufensprung
              karte.querySelector(".auswahl-stufe").textContent = v.stufe === 0
                ? "Neu · Platz " + v.platz + " von " + v.plaetze
                : v.naechste
                ? v.naechste + " (max. Stufe " + v.maxStufe + ")"
                : "Stufe " + v.stufe + " → " + (v.stufe + 1) + " (max. " + v.maxStufe + ")";
            }
            karte.addEventListener("click", function () {
              overlay.remove();
              offeneAuswahl = null;
              beimWaehlen(v.id);       // Regeln: Verbesserung anwenden → Ereignisse
              weiter();
            });
            karten.appendChild(karte);
          });
          rahmen.appendChild(overlay);
          // Legendäre Karte: eigene kurze Animation beim Erscheinen
          if (!ohneBewegung()) overlay.querySelectorAll(".auswahl-karte--legendaer").forEach(function (k) { k.classList.add("erscheint-legendaer"); });
          offeneAuswahl = { overlay: overlay, weiter: weiter };
          karten.firstChild.focus({ preventScroll: true });   // die Überlagerung bleibt oben (Titel sichtbar)
        });
      });
    }

    /**
     * Älterer Spielstand mit mehr Verbesserungen als Plätzen: Man wählt selbst,
     * welche bleiben (genau K.plaetze, höchstens maxBuecher Bücher).
     * @param {HTMLElement} rahmen
     * @param {object[]} gesammelt – alle Verbesserungen und Bücher (für die Anzeige)
     * @param {function} beimBestaetigen – bekommt die ids, die bleiben
     */
    function behalten(rahmen, gesammelt, beimBestaetigen) {
      schliesseAuswahl();
      const maxBuecher = K.buchGrundwirkung.maxBuecher;
      return einreihen(function () {
        meldung("Wähle " + K.plaetze + " Verbesserungen, die du behältst.");
        return new Promise(function (weiter) {
          const overlay = document.createElement("div");
          overlay.className = "auswahl ist-frei ist-behalten";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-label", "Verbesserungen behalten");
          overlay.innerHTML =
            '<div class="auswahl-kasten">' +
              '<p class="auswahl-titel"></p>' +
              '<div class="auswahl-karten"></div>' +
              '<p class="behalten-stand" aria-live="polite"></p>' +
              '<button type="button" class="behalten-knopf" disabled>Behalten</button>' +
            "</div>";
          overlay.querySelector(".auswahl-titel").textContent = "Es gibt jetzt nur noch " + K.plaetze +
            " Plätze für Verbesserungen. Wähle " + K.plaetze + ", die du behältst (höchstens " + maxBuecher + " Bücher):";
          const karten = overlay.querySelector(".auswahl-karten");
          const stand = overlay.querySelector(".behalten-stand");
          const knopf = overlay.querySelector(".behalten-knopf");
          const gewaehlt = [];
          function aktualisiere() {
            const buecher = gewaehlt.filter(function (id) { return /^buch/.test(id); }).length;
            stand.textContent = gewaehlt.length + " von " + K.plaetze + " gewählt" + (buecher ? " · " + buecher + " von " + maxBuecher + " Büchern" : "");
            knopf.disabled = gewaehlt.length !== K.plaetze;
            karten.querySelectorAll(".auswahl-karte").forEach(function (k) {
              const an = gewaehlt.indexOf(k.dataset.id) !== -1;
              k.classList.toggle("ist-gewaehlt", an);
              k.setAttribute("aria-pressed", String(an));
            });
          }
          gesammelt.forEach(function (v) {
            const karte = document.createElement("button");
            karte.type = "button";
            karte.className = "auswahl-karte" + (v.art === "buch" ? " auswahl-karte--buch auswahl-karte--" + v.seltenheit : "");
            karte.dataset.id = v.id;
            karte.style.setProperty("--chip-farbe", v.farbe);
            karte.innerHTML = v.art === "buch"
              ? '<span class="auswahl-symbol auswahl-symbol--buch">' + symbolSvg("buch") + '<span class="kampf-buch-ziffer"></span></span>'
              : '<span class="auswahl-symbol">' + symbolSvg(v.symbol) + "</span>";
            karte.insertAdjacentHTML("beforeend", '<span class="auswahl-name"></span><span class="auswahl-stufe"></span>');
            if (v.art === "buch") karte.querySelector(".kampf-buch-ziffer").textContent = v.ziffer;
            karte.querySelector(".auswahl-name").textContent = v.name;
            karte.querySelector(".auswahl-stufe").textContent = "Stufe " + v.stufe + "/" + v.maxStufe;
            karte.addEventListener("click", function () {
              const i = gewaehlt.indexOf(v.id);
              if (i !== -1) gewaehlt.splice(i, 1);
              else if (gewaehlt.length < K.plaetze &&
                (v.art !== "buch" || gewaehlt.filter(function (id) { return /^buch/.test(id); }).length < maxBuecher)) gewaehlt.push(v.id);
              aktualisiere();
            });
            karten.appendChild(karte);
          });
          knopf.addEventListener("click", function () {
            if (gewaehlt.length !== K.plaetze) return;
            overlay.remove();
            offeneAuswahl = null;
            beimBestaetigen(gewaehlt.slice());
            weiter();
          });
          aktualisiere();
          rahmen.appendChild(overlay);
          offeneAuswahl = { overlay: overlay, weiter: weiter };
          karten.firstChild.focus({ preventScroll: true });
        });
      });
    }

    /** Schließt eine offene Auswahl ohne Wahl (z. B. beim Zurücksetzen) – auch eine Buchauswahl. */
    function schliesseAuswahl() {
      auswahlNummer++;                // noch wartende Auswahlen verfallen
      if (offeneAuswahl) {
        offeneAuswahl.overlay.remove();
        offeneAuswahl.weiter();
        offeneAuswahl = null;
      }
    }

    /**
     * Buch-Spin zu Beginn eines Abenteuers: Slot-Walze im Stil der
     * Schwierigkeits-Auslosung, sie bleibt auf dem ausgelosten Buch stehen.
     * Danach steht das Buch in der Leiste.
     * @param {object[]} buecher – alle Bücher für die Walze { id, name, ziffer, seltenheit, farbe }
     * @param {object} ergebnis  – von den Regeln: { buch, gesammelt }
     * @returns {Promise} – erfüllt, wenn die Walze steht und die Pause vorbei ist
     */
    function buchSpin(rahmen, buecher, ergebnis) {
      const ziel = ergebnis.buch;
      const overlay = document.createElement("div");
      overlay.className = "slot slot--buch";
      overlay.innerHTML =
        '<div class="slot-kasten">' +
          '<p class="slot-titel">Buch-Spin …</p>' +
          '<div class="slot-fenster"><div class="slot-walze"></div></div>' +
          '<p class="slot-belohnung"></p>' +
        "</div>";
      const walze = overlay.querySelector(".slot-walze");
      const titel = overlay.querySelector(".slot-titel");
      rahmen.appendChild(overlay);
      const legendaer = ziel.seltenheit === "legendaer";

      const zielIndex = buecher.findIndex(function (b) { return b.id === ziel.id; });
      const eintraege = [];
      if (ohneBewegung()) {
        eintraege.push(ziel);
      } else {
        for (let r = 0; r < 3; r++) buecher.forEach(function (b) { eintraege.push(b); });
        eintraege.push.apply(eintraege, buecher.slice(0, zielIndex + 1));
      }
      eintraege.forEach(function (b) {
        const zeile = document.createElement("div");
        zeile.className = "slot-eintrag slot-eintrag--buch";
        zeile.style.setProperty("--chip-farbe", b.farbe);
        zeile.innerHTML = '<span class="kampf-buch-symbol">' + symbolSvg("buch") + '<span class="kampf-buch-ziffer"></span></span><span class="slot-buch-name"></span>';
        zeile.querySelector(".kampf-buch-ziffer").textContent = b.ziffer;
        zeile.querySelector(".slot-buch-name").textContent = b.name;
        walze.appendChild(zeile);
      });

      const fertig = function () {
        titel.textContent = (legendaer ? "★ " : "") + ziel.name + (legendaer ? " ★" : "");
        overlay.querySelector(".slot-belohnung").textContent = ziel.seltenheitName + " · " + ziel.zusatzText;
        overlay.classList.add("ist-fertig");
        overlay.style.setProperty("--chip-farbe", ziel.farbe);
        if (legendaer) overlay.classList.add("ist-special");
        meldung("Buch-Spin: " + ziel.name + ", " + ziel.seltenheitName + ".");
        verlaufEintrag({ text: "Buch-Spin: " + ziel.name, wert: ziel.seltenheitName, art: "buch", symbol: "buch" });
        zeigeVerbesserungen(ergebnis.gesammelt, ziel.id);
      };
      const pause = DAUER.walzePause + (legendaer ? DAUER.walzeSpecial : 0) + 500;

      if (ohneBewegung()) {
        fertig();
        return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { overlay.remove(); });
      }
      const hoehe = walze.firstChild.getBoundingClientRect().height;
      walze.style.transform = "translateY(0)";
      void walze.offsetWidth;
      walze.style.transitionDuration = DAUER.walze + "ms";
      walze.style.transform = "translateY(" + (-(eintraege.length - 1) * hoehe) + "px)";
      return warte(DAUER.walze).then(function () {
        fertig();
        return warte(pause);
      }).then(function () {
        overlay.remove();
      });
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
      oeffneBlatt: oeffneBlatt,
      schliesseBlatt: schliesseBlatt,
      zeigeStand: zeigeStand,
      zeigeMuenzen: zeigeMuenzen,
      zeigeWurf: zeigeWurf,
      treffer: treffer,
      fehler: fehler,
      angriff: angriff,
      zeigeGegenangriff: zeigeGegenangriff,
      buchschlag: buchschlag,
      buchSpin: buchSpin,
      zeigeBuchBonus: zeigeBuchBonus,
      sieg: sieg,
      neuerBoss: neuerBoss,
      auftritt: auftritt,
      verbesserung: verbesserung,
      auswahl: auswahl,
      behalten: behalten,
      schliesseAuswahl: schliesseAuswahl,
      text: text,
      neuesAbenteuer: neuesAbenteuer,
      beschleunige: beschleunige,
      laeuft: laeuft,
      danach: danach,
      fertig: fertig,
      losen: losen,
      niederlage: niederlage,
    };
  }

  return {
    HANDY_MEDIEN: HANDY_MEDIEN,
    WUERFEL: W,
    wuerfelEinstellung: wuerfelEinstellung,
    setzeWuerfelEinstellung: setzeWuerfelEinstellung,
    erstelle: erstelle,
    symbolSvg: symbolSvg,
  };
})();
