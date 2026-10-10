/* ==========================================================================
   clock.js – rote LED-Digitaluhr für die Home-Ansicht
   Die Ziffern sind als Sieben-Segment-Anzeige mit SVG gezeichnet – ganz
   ohne Schriftart. Aussehen (Farbe, Leuchten, Größe): css/home.css

   Sieben-Segment-Anzeige: Jede Ziffer besteht aus 7 Balken (Segmenten),
   die mit Buchstaben benannt sind:

        aaa
       f   b
       f   b
        ggg
       e   c
       e   c
        ddd

   Für die "4" leuchten z. B. f, g, b und c.
   ========================================================================== */

const Uhr = (function () {

  // Welche Segmente leuchten bei welcher Ziffer?
  const SEGMENTE_JE_ZIFFER = {
    0: "abcdef",
    1: "bc",
    2: "abdeg",
    3: "abcdg",
    4: "bcfg",
    5: "acdfg",
    6: "acdefg",
    7: "abc",
    8: "abcdefg",
    9: "abcdfg",
  };

  const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
    "August", "September", "Oktober", "November", "Dezember"];

  /* ------------------------------------------------------------------------
     GEOMETRIE (in SVG-Einheiten, nicht in Pixeln – das SVG skaliert frei)
     Eine Ziffer ist 60 breit und 100 hoch, ein Segment 10 dick.
     ------------------------------------------------------------------------ */
  const ZIFFER_BREITE = 60;
  const ZIFFER_HOEHE = 100;
  const ABSTAND = 12;           // Abstand zwischen zwei Ziffern
  const DOPPELPUNKT_BREITE = 24;

  /** Waagerechtes Segment als Sechseck: von x1 bis x2 auf Höhe y. */
  function waagerecht(x1, x2, y) {
    return [[x1, y], [x1 + 5, y - 5], [x2 - 5, y - 5], [x2, y], [x2 - 5, y + 5], [x1 + 5, y + 5]];
  }

  /** Senkrechtes Segment als Sechseck: von y1 bis y2 auf Position x. */
  function senkrecht(x, y1, y2) {
    return [[x, y1], [x + 5, y1 + 5], [x + 5, y2 - 5], [x, y2], [x - 5, y2 - 5], [x - 5, y1 + 5]];
  }

  // Die sieben Segmente einer Ziffer (mit kleinen Lücken an den Ecken)
  const SEGMENT_FORMEN = {
    a: waagerecht(9, 51, 5),
    b: senkrecht(55, 9, 47),
    c: senkrecht(55, 53, 91),
    d: waagerecht(9, 51, 95),
    e: senkrecht(5, 53, 91),
    f: senkrecht(5, 9, 47),
    g: waagerecht(9, 51, 50),
  };

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Die 6 Ziffern (HH MM SS): je ein Objekt { buchstabe → <polygon> }
  const ziffern = [];
  let zuletztGezeigt = "";      // "143059" – damit nur Geänderte neu gezeichnet werden
  let timer = null;
  const el = {};


  /* ------------------------------------------------------------------------
     AUFBAU
     ------------------------------------------------------------------------ */

  /**
   * Baut die Uhr auf. Wird von app.js EINMAL aufgerufen (Home-Ansicht).
   * @param {HTMLElement} container – das Element <div id="uhr-root">
   */
  function init(container) {
    container.innerHTML =
      '<div class="uhr">' +
        // Für Screenreader: Uhrzeit als Text (nur minütlich aktualisiert,
        // sonst würde jede Sekunde vorgelesen)
        '<p class="nur-screenreader uhr-text"></p>' +
        '<div class="uhr-anzeige-rahmen" aria-hidden="true"></div>' +
        '<p class="uhr-datum"></p>' +
      "</div>";

    el.text = container.querySelector(".uhr-text");
    el.datum = container.querySelector(".uhr-datum");
    container.querySelector(".uhr-anzeige-rahmen").appendChild(baueSvg());

    ticken();

    // Kam der Tab aus dem Hintergrund zurück? Sofort neu stellen –
    // Browser bremsen Timer in Hintergrund-Tabs aus.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) ticken();
    });
  }

  /** Baut das SVG mit 6 Ziffern und 2 Doppelpunkten: 88:88:88 */
  function baueSvg() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "uhr-anzeige");

    // Leicht schräg gestellt wie bei echten LED-Anzeigen
    const gruppe = document.createElementNS(SVG_NS, "g");
    gruppe.setAttribute("transform", "skewX(-6)");
    svg.appendChild(gruppe);

    let x = 8;   // etwas Platz links wegen der Schräge
    for (let i = 0; i < 6; i++) {
      gruppe.appendChild(baueZiffer(x));
      x += ZIFFER_BREITE + ABSTAND;
      // Nach der 2. und 4. Ziffer kommt ein Doppelpunkt
      if (i === 1 || i === 3) {
        // Mitte der Lücke zwischen den beiden Ziffern
        gruppe.appendChild(baueDoppelpunkt(x - ABSTAND / 2 + DOPPELPUNKT_BREITE / 2));
        x += DOPPELPUNKT_BREITE;
      }
    }

    const breite = x - ABSTAND + 8;
    svg.setAttribute("viewBox", "0 -4 " + breite + " " + (ZIFFER_HOEHE + 8));
    return svg;
  }

  /** Eine Ziffer: 7 Segmente, verschoben an Position x. */
  function baueZiffer(x) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("transform", "translate(" + x + " 0)");
    const segmente = {};
    Object.keys(SEGMENT_FORMEN).forEach(function (buchstabe) {
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", SEGMENT_FORMEN[buchstabe].map(function (p) { return p.join(","); }).join(" "));
      polygon.setAttribute("class", "uhr-segment");
      g.appendChild(polygon);
      segmente[buchstabe] = polygon;
    });
    ziffern.push(segmente);
    return g;
  }

  /** Doppelpunkt: zwei Punkte, mittig an Position x. */
  function baueDoppelpunkt(x) {
    const g = document.createElementNS(SVG_NS, "g");
    [32, 68].forEach(function (y) {
      const punkt = document.createElementNS(SVG_NS, "circle");
      punkt.setAttribute("cx", x);
      punkt.setAttribute("cy", y);
      punkt.setAttribute("r", 5.5);
      punkt.setAttribute("class", "uhr-segment ist-an");   // Doppelpunkte leuchten immer
      g.appendChild(punkt);
    });
    return g;
  }


  /* ------------------------------------------------------------------------
     TAKT
     ------------------------------------------------------------------------ */

  /**
   * Zeigt die aktuelle Zeit und plant den nächsten Aufruf GENAU auf den
   * nächsten Sekundenwechsel.
   * Warum nicht einfach setInterval(…, 1000)? Das läuft mit der Zeit aus
   * dem Takt (jeder Aufruf kommt ein paar Millisekunden zu spät) und wird
   * in Hintergrund-Tabs gebremst. Hier wird jedes Mal die echte Uhrzeit
   * gelesen und neu berechnet, wie lange es bis zur nächsten Sekunde ist.
   */
  function ticken() {
    clearTimeout(timer);
    const jetzt = new Date();
    zeige(jetzt);
    const bisNaechsteSekunde = 1000 - jetzt.getMilliseconds();
    timer = setTimeout(ticken, bisNaechsteSekunde + 5);   // 5 ms Puffer: sicher NACH dem Wechsel
  }

  /** Stellt Ziffern, Screenreader-Text und Datum. */
  function zeige(jetzt) {
    const zwei = function (n) { return String(n).padStart(2, "0"); };
    const stelle = zwei(jetzt.getHours()) + zwei(jetzt.getMinutes()) + zwei(jetzt.getSeconds());

    // Nur Ziffern anfassen, die sich geändert haben
    for (let i = 0; i < 6; i++) {
      if (stelle[i] !== zuletztGezeigt[i]) {
        const an = SEGMENTE_JE_ZIFFER[stelle[i]];
        Object.keys(ziffern[i]).forEach(function (buchstabe) {
          ziffern[i][buchstabe].classList.toggle("ist-an", an.includes(buchstabe));
        });
      }
    }

    // Minute oder Tag gewechselt (oder erster Aufruf): Texte aktualisieren
    if (stelle.slice(0, 4) !== zuletztGezeigt.slice(0, 4)) {
      el.text.textContent = "Es ist " + stelle.slice(0, 2) + ":" + stelle.slice(2, 4) + " Uhr.";
      el.datum.textContent = WOCHENTAGE[jetzt.getDay()] + ", " + jetzt.getDate() + ". " +
        MONATE[jetzt.getMonth()] + " " + jetzt.getFullYear();
    }
    zuletztGezeigt = stelle;
  }


  return {
    init: init,
  };
})();
