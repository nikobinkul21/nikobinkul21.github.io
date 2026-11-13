/* ==========================================================================
   news-erklaerung.js – "Wie funktioniert der Feed?"
   Eine kurze, interaktive Erklärung, wie der News-Feed der Startseite
   entsteht. In der Kopfzeile des Feeds sitzt ein kleiner Knopf; er öffnet
   einen Dialog, in dem man nach unten durch einzelne Stationen scrollt.
   Ein gestrichelter Pfad verbindet die Stationen und "zeichnet" sich beim
   Scrollen nach und nach; jede Station blendet ein, sobald der Pfad sie
   erreicht. Die letzte Station zeigt das Ergebnis live: Stand und die
   ersten drei Schlagzeilen aus data/news.json.

   Die Texte der Stationen beschreiben, was pipeline/news.py und
   .github/workflows/news.yml tatsächlich tun. Ändert sich dort etwas
   (Feeds, Anzahl der Meldungen, Uhrzeit), bitte unten in
   NEWS_ERKLAERUNG_KONFIG anpassen.

   - Geprüft werden die Daten mit NewsDaten aus js/news.js (nichts wird
     hier neu geparst). Der Feed selbst bleibt unverändert.
   - Texte kommen nur als reiner Text in die Seite (textContent), Symbole
     entstehen als SVG-Elemente – nirgends innerHTML.
   - Dialog: natives <dialog> mit showModal() – der Fokus bleibt im Dialog,
     Esc schließt, danach kehrt der Fokus zum Knopf zurück.
   - "Bewegung reduzieren": Pfad und Stationen sind sofort sichtbar.

   Aussehen: css/news-erklaerung.css. Eingebunden von js/home.js.
   ========================================================================== */

const NEWS_ERKLAERUNG_KONFIG = {
  ausloeser: "Wie funktioniert der Feed?",
  titel: "Wie der News-Feed entsteht",
  einleitung: "Sieben Stationen – von den Nachrichtenseiten bis zu dieser Startseite.",

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
      text: "Ein kleines Python-Skript (pipeline/news.py) lädt beide Feeds mit dem Paket feedparser.",
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
      text: "Die Website lädt die Datei bei jedem Besuch frisch und zeigt sie als News-Feed. So sieht sie gerade aus:",
      ergebnis: true,
    },
  ],

  // Vorschau in der letzten Station
  vorschauAnzahl: 3,
  vorschauFehler: "Die Vorschau ist gerade nicht verfügbar – data/news.json konnte nicht geladen werden.",
  vorschauLeer: "Die Datei enthält zurzeit keine Meldungen.",
  zumFeed: "Zum Feed",

  // Der Pfad ist bis zu dieser Höhe des sichtbaren Bereichs gezeichnet (0 = oben, 1 = unten)
  zeichenLinie: 0.62,
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
    schliessen: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
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
  let stationen = [];            // [{ li, symbol }] in Reihenfolge
  let pfadLaenge = 0;
  let gezeichnet = 0;            // Anteil des Pfads, der schon gezeichnet ist (0–1)
  let bildGeplant = false;       // wartet schon ein Neuzeichnen auf das nächste Bild?
  let abruf = 0;                 // laufende Nummer der Vorschau-Abrufe
  let zumFeedNachSchliessen = false;


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


  /* ---------- Aufbau ---------- */

  /**
   * Setzt den Knopf in die Kopfzeile des Feeds und baut den Dialog.
   * Wird von home.js EINMAL aufgerufen – nach NewsFeed.init.
   * @param {HTMLElement} feed – <section class="news">
   */
  function init(feed) {
    const kopf = feed && feed.querySelector(".news-kopf");
    if (!kopf || el.dialog) return;
    el.feed = feed;

    // Auslöser: steht direkt neben "NEWS"
    el.ausloeser = neu("button", "ne-ausloeser");
    el.ausloeser.type = "button";
    el.ausloeser.setAttribute("aria-haspopup", "dialog");
    el.ausloeser.appendChild(symbol("info", "ne-ausloeser-symbol"));
    el.ausloeser.appendChild(neu("span", "", K.ausloeser));
    el.ausloeser.addEventListener("click", oeffne);
    const titel = kopf.querySelector(".news-titel");
    kopf.insertBefore(el.ausloeser, titel ? titel.nextSibling : kopf.firstChild);

    baueDialog();
  }

  function baueDialog() {
    el.dialog = neu("dialog", "ne-dialog");
    el.dialog.setAttribute("aria-modal", "true");
    el.dialog.setAttribute("aria-labelledby", "ne-titel");

    const kopf = neu("div", "ne-kopf");
    const titel = neu("h2", "ne-titel", K.titel);
    titel.id = "ne-titel";
    const zu = neu("button", "ne-schliessen");
    zu.type = "button";
    zu.setAttribute("aria-label", "Erklärung schließen");
    zu.appendChild(symbol("schliessen", "ne-schliessen-symbol"));
    zu.addEventListener("click", function () { el.dialog.close(); });
    kopf.appendChild(titel);
    kopf.appendChild(zu);

    // Der Bereich, in dem man durch die Stationen scrollt (auch per Tastatur)
    el.rolle = neu("div", "ne-rolle");
    el.rolle.tabIndex = 0;
    el.rolle.setAttribute("role", "group");
    el.rolle.setAttribute("aria-label", "Stationen");
    el.rolle.appendChild(neu("p", "ne-einleitung", K.einleitung));

    // Der Weg: hinten der Pfad (SVG), davor die Stationen
    el.weg = neu("div", "ne-weg");
    baueWegBild();
    const liste = neu("ol", "ne-stationen");
    stationen = K.stationen.map(function (s) {
      const li = neu("li", "ne-station");
      const marke = neu("span", "ne-marke");
      marke.appendChild(symbol(s.symbol, "ne-marke-symbol"));
      const inhalt = neu("div", "ne-inhalt");
      inhalt.appendChild(neu("h3", "ne-station-titel", s.titel));
      inhalt.appendChild(neu("p", "ne-station-text", s.text));
      if (s.ergebnis) inhalt.appendChild(baueErgebnis());
      li.appendChild(marke);
      li.appendChild(inhalt);
      liste.appendChild(li);
      return { li: li, marke: marke };
    });
    el.weg.appendChild(liste);
    el.rolle.appendChild(el.weg);

    el.dialog.appendChild(kopf);
    el.dialog.appendChild(el.rolle);
    document.body.appendChild(el.dialog);

    // Klick neben den Dialog (auf den Schleier) schließt
    el.dialog.addEventListener("click", function (event) {
      if (event.target === el.dialog) el.dialog.close();
    });
    el.dialog.addEventListener("close", nachSchliessen);
    el.rolle.addEventListener("scroll", planeBild, { passive: true });
    // Wechselt die Ansicht (z. B. Zurück-Taste), verschwindet auch die Erklärung
    window.addEventListener("hashchange", function () { if (el.dialog.open) el.dialog.close(); });
    // Ändert sich die Größe (Fenster, nachgeladene Vorschau), passt sich der Pfad an
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { if (el.dialog.open) legePfad(); }).observe(el.weg);
    } else {
      window.addEventListener("resize", function () { if (el.dialog.open) legePfad(); });
    }
  }

  /**
   * Das Bild hinter den Stationen: zweimal derselbe Pfad.
   * - .ne-pfad-spur:  die ganze Strecke, blass – zeigt, wohin es geht
   * - .ne-pfad-strich: gestrichelt in der Akzentfarbe, aber nur dort sichtbar,
   *   wo die Maske es erlaubt. Die Maske ist derselbe Pfad als durchgehende
   *   Linie, die per stroke-dashoffset "wächst" (siehe zeichne()).
   */
  function baueWegBild() {
    el.bild = svgTeil("svg", { "aria-hidden": "true", focusable: "false" });
    el.bild.setAttribute("class", "ne-pfad");
    const maske = svgTeil("mask", { id: "ne-pfad-maske", maskUnits: "userSpaceOnUse" });
    // Weiß bedeutet in einer Maske "sichtbar" – keine Farbe der Seite
    el.maskenPfad = svgTeil("path", { fill: "none", stroke: "white", "stroke-width": 8, "stroke-linecap": "round" });
    el.maskenPfad.setAttribute("class", "ne-pfad-maske");
    maske.appendChild(el.maskenPfad);
    const defs = svgTeil("defs");
    defs.appendChild(maske);
    el.spur = svgTeil("path", { fill: "none" });
    el.spur.setAttribute("class", "ne-pfad-spur");
    el.strich = svgTeil("path", { fill: "none", mask: "url(#ne-pfad-maske)" });
    el.strich.setAttribute("class", "ne-pfad-strich");
    el.bild.appendChild(defs);
    el.bild.appendChild(el.spur);
    el.bild.appendChild(el.strich);
    el.weg.appendChild(el.bild);
    el.maske = maske;
  }

  /** Die Live-Vorschau der letzten Station samt Knopf "Zum Feed". */
  function baueErgebnis() {
    const kasten = neu("div", "ne-ergebnis");
    el.vorschau = neu("div", "ne-vorschau");
    el.vorschau.setAttribute("aria-live", "polite");
    const knopf = neu("button", "knopf knopf--haupt ne-zum-feed", K.zumFeed);
    knopf.type = "button";
    knopf.addEventListener("click", function () {
      zumFeedNachSchliessen = true;
      el.dialog.close();
    });
    kasten.appendChild(el.vorschau);
    kasten.appendChild(knopf);
    return kasten;
  }


  /* ---------- Öffnen und Schließen ---------- */

  function oeffne() {
    if (el.dialog.open) return;
    zumFeedNachSchliessen = false;
    document.documentElement.classList.add("ne-offen");      // die Seite dahinter scrollt nicht mit
    el.dialog.classList.toggle("ist-ruhig", ruhigAbfrage.matches);
    // Von vorn: nichts gezeichnet, keine Station sichtbar
    gezeichnet = 0;
    stationen.forEach(function (s) { s.li.classList.remove("ist-da"); });
    el.dialog.showModal();
    el.rolle.scrollTop = 0;
    legePfad();
    ladeVorschau();
  }

  function nachSchliessen() {
    document.documentElement.classList.remove("ne-offen");
    if (!zumFeedNachSchliessen) {
      el.ausloeser.focus();                  // Fokus zurück zum Auslöser
      return;
    }
    // "Zum Feed": zum Feed springen und den Fokus auf die erste Meldung setzen
    zumFeedNachSchliessen = false;
    el.feed.scrollIntoView({ behavior: ruhigAbfrage.matches ? "auto" : "smooth", block: "start" });
    const ziel = el.feed.querySelector(".news-top, .news-eintrag") || el.ausloeser;
    ziel.focus({ preventScroll: true });
  }


  /* ---------- Der Pfad ---------- */

  /**
   * Legt den Pfad durch die Mitten aller Marken: von Marke zu Marke eine
   * sanfte S-Kurve (die Marken stehen abwechselnd leicht links und rechts).
   * Wird beim Öffnen und bei jeder Größenänderung aufgerufen.
   */
  function legePfad() {
    const rahmen = el.weg.getBoundingClientRect();
    if (!rahmen.width || !stationen.length) return;
    const punkte = stationen.map(function (s) {
      const r = s.marke.getBoundingClientRect();
      return { x: r.left + r.width / 2 - rahmen.left, y: r.top + r.height / 2 - rahmen.top };
    });
    let d = "M" + punkte[0].x + " " + punkte[0].y;
    for (let i = 1; i < punkte.length; i++) {
      const a = punkte[i - 1], b = punkte[i], mitte = (a.y + b.y) / 2;
      d += " C" + a.x + " " + mitte + " " + b.x + " " + mitte + " " + b.x + " " + b.y;
    }
    el.bild.setAttribute("viewBox", "0 0 " + rahmen.width + " " + rahmen.height);
    el.maske.setAttribute("x", 0);
    el.maske.setAttribute("y", 0);
    el.maske.setAttribute("width", rahmen.width);
    el.maske.setAttribute("height", rahmen.height);
    [el.spur, el.strich, el.maskenPfad].forEach(function (p) { p.setAttribute("d", d); });
    pfadLaenge = el.maskenPfad.getTotalLength();
    el.maskenPfad.style.strokeDasharray = pfadLaenge + " " + pfadLaenge;
    stationen.forEach(function (s, i) { s.y = punkte[i].y; });
    zeichne();
  }

  /** Pfadlänge bis zur Höhe y (der Pfad läuft nur abwärts – Suche durch Halbieren). */
  function laengeBis(y) {
    let unten = 0, oben = pfadLaenge;
    for (let i = 0; i < 14; i++) {
      const mitte = (unten + oben) / 2;
      if (el.maskenPfad.getPointAtLength(mitte).y < y) unten = mitte;
      else oben = mitte;
    }
    return (unten + oben) / 2;
  }

  function planeBild() {
    if (bildGeplant) return;
    bildGeplant = true;
    requestAnimationFrame(function () {
      bildGeplant = false;
      zeichne();
    });
  }

  /**
   * Zeichnet den Pfad bis zur "Zeichenlinie" im sichtbaren Bereich und
   * blendet alle Stationen ein, die der Pfad schon erreicht hat. Einmal
   * Gezeichnetes bleibt stehen, auch wenn man wieder nach oben scrollt.
   */
  function zeichne() {
    if (!pfadLaenge) return;
    const rolle = el.rolle;
    const amEnde = rolle.scrollTop + rolle.clientHeight >= rolle.scrollHeight - 2;
    let anteil = 1, bisY = Infinity;
    if (!ruhigAbfrage.matches && !amEnde) {
      // Höhe der Zeichenlinie, gemessen ab der Oberkante des Wegs
      bisY = rolle.getBoundingClientRect().top + rolle.clientHeight * K.zeichenLinie - el.weg.getBoundingClientRect().top;
      anteil = Math.max(0, Math.min(1, laengeBis(bisY) / pfadLaenge));
    }
    gezeichnet = Math.max(gezeichnet, anteil);
    el.maskenPfad.style.strokeDashoffset = pfadLaenge * (1 - gezeichnet);
    stationen.forEach(function (s) {
      if (gezeichnet >= 1 || s.y <= bisY) s.li.classList.add("ist-da");
    });
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
    const stand = neu("p", "ne-vorschau-stand", "Stand: " + NewsDaten.standText(daten.aktualisiert, jetzt));
    if (NewsDaten.istVeraltet(daten.aktualisiert, jetzt)) stand.appendChild(neu("span", "ne-vorschau-veraltet", "nicht aktuell"));
    el.vorschau.appendChild(stand);
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
    oeffne: oeffne,
  };
})();
