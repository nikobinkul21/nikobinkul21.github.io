/* ==========================================================================
   news-erklaerung.js – die Seite "Wie der News-Feed entsteht" (#feed-erklaerung)
   Eine lange Seite, die Schritt für Schritt erklärt, wie der News-Feed der
   Startseite entsteht. Jede Station ist ein eigener, großer Abschnitt
   (etwa eine Bildschirmhöhe): großes Symbol, große Überschrift, ein bis
   zwei Sätze. Ein gestrichelter Pfad führt von jeder Station zum Symbol
   der nächsten und "zeichnet" sich passend zur Scrollposition weiter.
   Erreicht man eine Station, erscheinen nacheinander Symbol, Überschrift
   und Text; noch nicht erreichte Stationen zeigen nur ihr Symbol, gedämpft.
   Die letzte Station zeigt das Ergebnis live: Stand und die ersten drei
   Schlagzeilen aus data/news.json.

   Die Texte der Stationen beschreiben, was pipeline/news.py und
   .github/workflows/news.yml tatsächlich tun. Ändert sich dort etwas
   (Feeds, Anzahl der Meldungen, Uhrzeit), bitte unten in
   NEWS_ERKLAERUNG_KONFIG anpassen.

   - Aufruf: Link "Wie funktioniert der Feed?" in der Kopfzeile des Feeds
     (verlinke(), aufgerufen von js/home.js). Die Seite selbst ist eine
     Ansicht wie alle anderen (ANSICHTEN in js/app.js) – der Zurück-Knopf
     des Browsers funktioniert.
   - Geprüft werden die Daten mit NewsDaten aus js/news.js (nichts wird
     hier neu geparst). Der Feed selbst bleibt unverändert.
   - Texte kommen nur als reiner Text in die Seite (textContent), Symbole
     entstehen als SVG-Elemente – nirgends innerHTML.
   - Einblenden: IntersectionObserver. Pfad: eine sparsame Berechnung pro
     Bild (requestAnimationFrame), die nur läuft, solange sich etwas bewegt.
   - "Bewegung reduzieren": Pfad und alle Stationen sind sofort sichtbar.

   Aussehen: css/news-erklaerung.css.
   ========================================================================== */

const NEWS_ERKLAERUNG_KONFIG = {
  adresse: "#feed-erklaerung",
  ausloeser: "Wie funktioniert der Feed?",
  zurueck: "Startseite",
  scrollHinweis: "Scrollen",

  // Die Stationen in Reihenfolge. symbol = Schlüssel in SYMBOLE (weiter unten).
  // Die letzte Station (ergebnis: true) bekommt die Live-Vorschau.
  stationen: [
    {
      symbol: "rss",
      titel: "Quellen",
      text: "Zwei Nachrichtenseiten bieten ihre neuesten Meldungen als RSS-Feed an: tagesschau und Spiegel. " +
        "Ein RSS-Feed ist eine Liste, die Programme leicht lesen können.",
    },
    {
      symbol: "python",
      titel: "Abholen",
      text: "Ein kleines Python-Skript lädt beide Feeds mit dem Paket feedparser.",
    },
    {
      symbol: "filter",
      titel: "Aufbereiten",
      text: "Von jeder Meldung bleiben nur Schlagzeile, Anreißer, Link, Quelle und Datum. " +
        "Ganze Artikel werden nie kopiert – zum Lesen führt der Link zur Quelle.",
    },
    {
      symbol: "sortieren",
      titel: "Auswählen",
      text: "Meldungen ohne Datum werden übersprungen. Der Rest wird nach Datum sortiert, " +
        "die 15 neuesten bleiben übrig.",
    },
    {
      symbol: "klammern",
      titel: "Speichern",
      text: "Das Ergebnis landet als data/news.json im Projekt – in einem festen Format, das die Website versteht. " +
        "Findet das Skript keine Meldungen, bleibt die alte Datei erhalten.",
    },
    {
      symbol: "uhr",
      titel: "Automatisch",
      text: "GitHub Actions startet jeden Morgen um 05:17 Uhr Weltzeit (in Deutschland 06:17 Uhr, im Sommer 07:17 Uhr) " +
        "einen Cloud-Rechner. Er führt das Skript aus und legt die neue Datei im Projekt ab.",
    },
    {
      symbol: "feed",
      titel: "Ergebnis",
      text: "Die Website lädt die Datei bei jedem Besuch frisch und zeigt sie als News-Feed. So sieht er gerade aus:",
      ergebnis: true,
    },
  ],

  // Vorschau in der letzten Station
  vorschauAnzahl: 3,
  vorschauFehler: "Die Vorschau ist gerade nicht verfügbar – data/news.json konnte nicht geladen werden.",
  vorschauLeer: "Die Datei enthält zurzeit keine Meldungen.",
  zumFeed: "Zum Feed",

  // Der Pfad ist bis zu dieser Höhe des Bildschirms gezeichnet (0 = oben, 1 = unten).
  // Eine Station gilt als erreicht, sobald ihr Symbol über diese Linie kommt.
  zeichenLinie: 0.84,
  // So weicht der Pfad zwischen zwei Stationen zur Seite aus: Anteil der
  // Seitenbreite, höchstens so viele Pixel
  schwung: { anteil: 0.1, max: 110 },
  // Abstand des Pfadanfangs zum Text darüber (px)
  luft: 28,
  // Nachziehen des Pfads: Anteil des restlichen Wegs pro Bild (1 = sofort)
  nachziehen: 0.2,
};


const NewsErklaerung = (function () {
  const K = NEWS_ERKLAERUNG_KONFIG;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Schlichte Liniensymbole (Raster 24 × 24) als Listen von [Element, Attribute].
  // Das Python-Symbol: zwei ineinandergreifende Schlangen, die zweite ist die
  // erste um 180° gedreht.
  const SCHLANGE = "M12 3c2.5 0 4 1 4 3v3.5c0 1.4-1.1 2.5-2.5 2.5h-4C8.1 12 7 13.1 7 14.5V16H5.5C4 16 3 14.5 3 12s1-4 2.5-4H12V7H8V6c0-2 1.5-3 4-3z";
  const SYMBOLE = {
    info: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 11v6M12 7.4v.4" }]],
    rss: [["path", { d: "M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" }], ["circle", { cx: 6, cy: 18, r: 1.4 }]],
    python: [
      ["path", { d: SCHLANGE }],
      ["path", { d: SCHLANGE, transform: "rotate(180 12 12)" }],
      ["path", { d: "M10 5.4v.2M14 18.4v.2" }],
    ],
    filter: [["path", { d: "M4 5h16l-6 7v6l-4 2v-8z" }]],
    sortieren: [["path", { d: "M7 5v14M4 16l3 3 3-3M13 7h7M13 12h5M13 17h3" }]],
    klammern: [["path", { d: "M9 4c-2 0-3 1-3 3v2c0 1.5-.8 3-2 3 1.2 0 2 1.5 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1.5.8 3 2 3-1.2 0-2 1.5-2 3v2c0 2-1 3-3 3" }]],
    uhr: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M12 7.5V12l3 2" }]],
    feed: [["path", { d: "M5 6h14M5 10h9M5 15h14M5 19h9" }]],
  };

  const el = {};
  let stationen = [];            // [{ abschnitt, marke, inhalt }] in Reihenfolge
  let wegHoehe = 0;
  let zielY = 0;                 // bis zu dieser Höhe soll der Pfad gezeichnet sein
  let istY = 0;                  // bis hierhin ist er gerade gezeichnet (zieht nach)
  let bildGeplant = false;       // wartet schon eine Berechnung auf das nächste Bild?
  let beobachter = null;         // IntersectionObserver für das Erscheinen der Stationen
  let abruf = 0;                 // laufende Nummer der Vorschau-Abrufe


  /* ---------- kleine Helfer ---------- */

  /** Element mit Klasse und reinem Text. */
  function neu(tag, klasse, inhalt) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (inhalt) e.textContent = inhalt;
    return e;
  }

  /** SVG-Element mit Attributen. */
  function svgTeil(tag, attribute) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attribute || {}).forEach(function (name) { e.setAttribute(name, attribute[name]); });
    return e;
  }

  /** Ein Symbol aus SYMBOLE als <svg> (für Screenreader unsichtbar). */
  function symbol(name, klasse) {
    const svg = svgTeil("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" });
    svg.setAttribute("class", klasse);
    SYMBOLE[name].forEach(function (teil) { svg.appendChild(svgTeil(teil[0], teil[1])); });
    return svg;
  }

  function istSichtbar() {
    return el.ansicht && !el.ansicht.hidden;
  }


  /* ---------- Link in der Kopfzeile des Feeds ---------- */

  /**
   * Setzt den Link "Wie funktioniert der Feed?" direkt neben "NEWS".
   * Wird von home.js EINMAL aufgerufen – nach NewsFeed.init.
   * @param {HTMLElement} feed – <section class="news">
   */
  function verlinke(feed) {
    const kopf = feed && feed.querySelector(".news-kopf");
    if (!kopf || kopf.querySelector(".ne-ausloeser")) return;
    const link = neu("a", "ne-ausloeser");
    link.href = K.adresse;
    link.appendChild(symbol("info", "ne-ausloeser-symbol"));
    link.appendChild(neu("span", "", K.ausloeser));
    const titel = kopf.querySelector(".news-titel");
    kopf.insertBefore(link, titel ? titel.nextSibling : kopf.firstChild);
  }


  /* ---------- Aufbau der Seite ---------- */

  /**
   * Baut die Seite auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="feed-erklaerung-root">
   */
  function init(container) {
    el.ansicht = document.getElementById("view-feed-erklaerung");
    el.seite = neu("div", "ne-seite");

    // Kopf: links der Zurück-Link, daneben klein der Titel der Seite
    // (h1 aus index.html – behält seine ID: app.js setzt Fokus und Seitentitel darüber)
    const kopf = neu("div", "ne-kopf");
    const zurueck = neu("a", "ne-zurueck");
    zurueck.href = "#home";
    const pfeil = neu("span", "", "←");
    pfeil.setAttribute("aria-hidden", "true");
    zurueck.appendChild(pfeil);
    zurueck.appendChild(neu("span", "", K.zurueck));
    kopf.appendChild(zurueck);
    kopf.appendChild(document.getElementById("titel-feed-erklaerung"));
    el.seite.appendChild(kopf);

    // Der Weg: hinten der Pfad (SVG), davor die Stationen
    el.weg = neu("div", "ne-weg");
    baueWegBild();
    const liste = neu("ol", "ne-stationen");
    stationen = K.stationen.map(function (s, i) {
      const abschnitt = neu("li", "ne-station");
      if (s.ergebnis) abschnitt.classList.add("ne-station--ergebnis");
      const marke = neu("span", "ne-marke");
      marke.appendChild(symbol(s.symbol, "ne-marke-symbol"));
      const inhalt = neu("div", "ne-inhalt");
      inhalt.appendChild(neu("h2", "ne-station-titel", s.titel));
      inhalt.appendChild(neu("p", "ne-station-text", s.text));
      if (s.ergebnis) inhalt.appendChild(baueErgebnis());
      abschnitt.appendChild(marke);
      abschnitt.appendChild(inhalt);
      if (i === 0) abschnitt.appendChild(baueScrollHinweis());
      liste.appendChild(abschnitt);
      return { abschnitt: abschnitt, marke: marke, inhalt: inhalt };
    });
    el.weg.appendChild(liste);
    el.seite.appendChild(el.weg);
    container.appendChild(el.seite);

    // Erscheinen der Stationen: sobald das Symbol über die Zeichenlinie kommt
    // – und mit ihr alle davor (falls man mit einem Sprung an Stationen vorbeikommt)
    beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        const bis = stationen.findIndex(function (s) { return s.marke === e.target; });
        stationen.slice(0, bis + 1).forEach(function (s) { s.abschnitt.classList.add("ist-da"); });
      });
    }, { rootMargin: "0px 0px -" + Math.round((1 - K.zeichenLinie) * 100) + "% 0px" });

    window.addEventListener("scroll", beimScrollen, { passive: true });
    // Ändert sich die Größe (Fenster, Schriften, nachgeladene Vorschau), passt sich der Pfad an
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { if (istSichtbar()) legePfad(); }).observe(el.weg);
    } else {
      window.addEventListener("resize", function () { if (istSichtbar()) legePfad(); });
    }
    // Umschalten von "Bewegung reduzieren", während die Seite offen ist
    ruhigAbfrage.addEventListener("change", function () { if (istSichtbar()) zeige(); });
  }

  /**
   * Das Bild hinter den Stationen: zweimal derselbe Pfad.
   * - .ne-pfad-spur:   die ganze Strecke, blass – zeigt, wohin es geht
   * - .ne-pfad-strich: gestrichelt in der Akzentfarbe, aber beschnitten auf
   *   ein Rechteck, das von oben bis zur gezeichneten Höhe reicht. Weil der
   *   Pfad nur abwärts läuft, wächst er so Stück für Stück (siehe rechne()).
   */
  function baueWegBild() {
    el.bild = svgTeil("svg", { "aria-hidden": "true", focusable: "false" });
    el.bild.setAttribute("class", "ne-pfad");
    const ausschnitt = svgTeil("clipPath", { id: "ne-pfad-ausschnitt", clipPathUnits: "userSpaceOnUse" });
    el.ausschnitt = svgTeil("rect", { x: -20, y: 0, width: 0, height: 0 });
    ausschnitt.appendChild(el.ausschnitt);
    const defs = svgTeil("defs");
    defs.appendChild(ausschnitt);
    el.spur = svgTeil("path", { fill: "none" });
    el.spur.setAttribute("class", "ne-pfad-spur");
    el.strich = svgTeil("path", { fill: "none", "clip-path": "url(#ne-pfad-ausschnitt)" });
    el.strich.setAttribute("class", "ne-pfad-strich");
    el.bild.appendChild(defs);
    el.bild.appendChild(el.spur);
    el.bild.appendChild(el.strich);
    el.weg.appendChild(el.bild);
  }

  /** Dezenter Hinweis unten in der ersten Station; verschwindet nach dem ersten Scrollen. */
  function baueScrollHinweis() {
    el.hinweis = neu("p", "ne-scrollen");
    el.hinweis.setAttribute("aria-hidden", "true");
    el.hinweis.appendChild(neu("span", "", K.scrollHinweis));
    el.hinweis.appendChild(neu("span", "ne-scrollen-pfeil", "↓"));
    return el.hinweis;
  }

  /** Die Live-Vorschau der letzten Station samt Knopf "Zum Feed". */
  function baueErgebnis() {
    const kasten = neu("div", "ne-ergebnis");
    el.vorschau = neu("div", "ne-vorschau");
    el.vorschau.setAttribute("aria-live", "polite");
    const knopf = neu("a", "knopf knopf--haupt ne-zum-feed", K.zumFeed);
    knopf.href = "#home";
    kasten.appendChild(el.vorschau);
    kasten.appendChild(knopf);
    return kasten;
  }


  /* ---------- Öffnen ---------- */

  /** Wird von app.js bei JEDEM Öffnen der Seite aufgerufen: alles beginnt von vorn. */
  function zeige() {
    const ruhig = ruhigAbfrage.matches;
    el.seite.classList.toggle("ist-ruhig", ruhig);
    el.seite.classList.remove("hat-gescrollt");
    zielY = 0;
    istY = 0;
    beobachter.disconnect();
    stationen.forEach(function (s) {
      s.abschnitt.classList.toggle("ist-da", ruhig);     // ohne Bewegung: sofort alles sichtbar
      if (!ruhig) beobachter.observe(s.marke);
    });
    legePfad();
    ladeVorschau();
    return null;                               // Fokus auf die Überschrift (app.js)
  }


  /* ---------- Der Pfad ---------- */

  /**
   * Legt den Pfad: von unterhalb des Textes jeder Station in einer sanften
   * S-Kurve zur Mitte des Symbols der nächsten (abwechselnd nach links und
   * rechts ausweichend). Wird beim Öffnen und bei jeder Größenänderung aufgerufen.
   */
  function legePfad() {
    const rahmen = el.weg.getBoundingClientRect();
    if (!rahmen.width || !stationen.length) return;
    const schwung = Math.min(K.schwung.max, rahmen.width * K.schwung.anteil);
    let d = "";
    for (let i = 0; i < stationen.length - 1; i++) {
      const von = stationen[i].inhalt.getBoundingClientRect();
      const bis = stationen[i + 1].marke.getBoundingClientRect();
      const x0 = von.left + von.width / 2 - rahmen.left;
      const y0 = von.bottom - rahmen.top + K.luft;
      const x1 = bis.left + bis.width / 2 - rahmen.left;
      const y1 = bis.top + bis.height / 2 - rahmen.top;
      const drittel = (y1 - y0) / 3;
      const seite = (i % 2 === 0 ? 1 : -1) * schwung;
      d += "M" + x0 + " " + y0 +
        " C" + (x0 + seite) + " " + (y0 + drittel) + " " + (x1 - seite) + " " + (y1 - drittel) + " " + x1 + " " + y1 + " ";
    }
    wegHoehe = rahmen.height;
    el.bild.setAttribute("viewBox", "0 0 " + rahmen.width + " " + rahmen.height);
    el.ausschnitt.setAttribute("width", rahmen.width + 40);
    el.spur.setAttribute("d", d);
    el.strich.setAttribute("d", d);
    planeBild();
  }

  function beimScrollen() {
    if (!istSichtbar()) return;
    if (window.scrollY > 8) el.seite.classList.add("hat-gescrollt");
    planeBild();
  }

  function planeBild() {
    if (bildGeplant) return;
    bildGeplant = true;
    requestAnimationFrame(function () {
      bildGeplant = false;
      rechne();
    });
  }

  /**
   * Eine Berechnung pro Bild: Wie weit reicht die Zeichenlinie in den Weg
   * hinein? Bis dorthin wird der Pfad gezeichnet – er zieht weich nach und
   * bleibt stehen, auch wenn man wieder nach oben scrollt. Die Schleife
   * endet von selbst, sobald der Pfad sein Ziel erreicht hat.
   */
  function rechne() {
    if (!istSichtbar() || !wegHoehe) return;
    const ganzUnten = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const linie = window.innerHeight * K.zeichenLinie - el.weg.getBoundingClientRect().top;
    const neuesZiel = ruhigAbfrage.matches || ganzUnten ? wegHoehe : Math.max(0, Math.min(wegHoehe, linie));
    zielY = Math.max(zielY, neuesZiel);
    const rest = zielY - istY;
    if (ruhigAbfrage.matches || Math.abs(rest) < 0.5) istY = zielY;
    else istY += rest * K.nachziehen;
    el.ausschnitt.setAttribute("height", Math.max(0, istY));
    if (istY !== zielY) planeBild();
  }


  /* ---------- Live-Vorschau ---------- */

  /** Holt data/news.json frisch und prüft sie mit NewsDaten (js/news.js). */
  function ladeVorschau() {
    const nummer = ++abruf;
    el.vorschau.textContent = "";
    el.vorschau.appendChild(neu("p", "ne-vorschau-hinweis", "Vorschau wird geladen …"));
    fetch(NEWS_KONFIG.datei + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("HTTP " + antwort.status);
        return antwort.json();
      })
      .then(function (roh) {
        if (nummer !== abruf) return;
        const p = NewsDaten.pruefeDaten(roh);
        if (!p.ok) throw new Error("Format");
        zeigeVorschau(p);
      })
      .catch(function () {
        if (nummer !== abruf) return;
        el.vorschau.textContent = "";
        el.vorschau.appendChild(neu("p", "ne-vorschau-hinweis", K.vorschauFehler));
      });
  }

  /** Stand und die ersten Schlagzeilen – so, wie der Feed sie zeigt. */
  function zeigeVorschau(daten) {
    const jetzt = new Date();
    el.vorschau.textContent = "";
    const kopf = neu("div", "ne-vorschau-kopf");
    kopf.appendChild(neu("span", "ne-vorschau-name", "News"));
    const stand = neu("span", "ne-vorschau-stand", "Stand: " + NewsDaten.standText(daten.aktualisiert, jetzt));
    if (NewsDaten.istVeraltet(daten.aktualisiert, jetzt)) stand.appendChild(neu("span", "ne-vorschau-veraltet", "nicht aktuell"));
    kopf.appendChild(stand);
    el.vorschau.appendChild(kopf);
    if (!daten.meldungen.length) {
      el.vorschau.appendChild(neu("p", "ne-vorschau-hinweis", K.vorschauLeer));
      return;
    }
    const liste = neu("ol", "ne-vorschau-liste");
    daten.meldungen.slice(0, K.vorschauAnzahl).forEach(function (m) {
      const li = document.createElement("li");
      li.appendChild(neu("span", "ne-vorschau-titel", m.titel));
      li.appendChild(neu("span", "ne-vorschau-quelle", m.quelle));
      liste.appendChild(li);
    });
    el.vorschau.appendChild(liste);
  }

  return {
    init: init,
    zeige: zeige,
    verlinke: verlinke,
  };
})();
