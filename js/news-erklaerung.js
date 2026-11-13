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
   - Code-Ausschnitte: Eine Station kann rechts neben sich (Smartphone:
     darunter) ein kleines Editor-Fenster mit einem Ausschnitt aus einer
     Datei zeigen – Feld "ausschnitt" in der Konfiguration. Die Zeilen
     stehen wörtlich dort, die Hervorhebung macht faerbeZeile().
   - Einblenden: IntersectionObserver.
   - Pfad: Zwischen je zwei Stationen liegt ein eigenes kleines SVG. Es
     beginnt unter dem Text der einen Station und endet knapp über dem
     Kreis der nächsten – der Pfad läuft nie durch einen Kreis. Gezeichnet
     wird nur über das Strichmuster (stroke-dasharray) des Teilstücks, das
     gerade im Bild ist; beim Scrollen wird nichts ausgemessen.
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
  //
  // Optional: ausschnitt – ein Stück echter Code im Editor-Fenster:
  //   datei:   Name in der Leiste des Fensters, z. B. "pipeline/news.py"
  //   sprache: Schlüssel in "sprachen" (unten) – bestimmt die Hervorhebung
  //   zeilen:  Liste aus [Zeilennummer in der Datei, Text der Zeile].
  //            Die Texte WÖRTLICH aus der Datei übernehmen (samt Einrückung).
  //            Ausgelassene Teile: [null, "    …"] – ohne Nummer.
  //   seite:   "rechts" (Vorgabe) oder "links" – auf welcher Seite der Station
  //            das Fenster am Computer steht (schmal: immer unter dem Text)
  //   live:    "news" – der Inhalt kommt live aus data/news.json (dieselbe
  //            Antwort, die auch die Vorschau der letzten Station füllt);
  //            "zeilen" ist dann nur der Ersatz, falls die Datei nicht lädt.
  // Ändert sich die Datei, einen festen Ausschnitt hier von Hand nachziehen.
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
      ausschnitt: {
        datei: "pipeline/news.py",
        sprache: "python",
        zeilen: [
          [15, 'for feed in feeds:'],
          [16, '    daten = feedparser.parse(feed["url"])'],
          [17, '    for meldung in daten.entries:'],
          [18, '        if "published_parsed" not in meldung:'],
          [19, '            continue'],
          [20, '        eintrag = {'],
          [21, '            "titel": meldung.title,'],
          [null, '            …'],
          [27, '        }'],
          [28, '        alle_meldungen.append(eintrag)'],
        ],
      },
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
      ausschnitt: {
        datei: "data/news.json",
        sprache: "json",
        seite: "links",
        live: "news",
        // Ersatz, falls data/news.json nicht geladen werden kann – klar als Beispiel erkennbar
        zeilen: [
          [1, '{'],
          [2, '  "aktualisiert": "2026-01-01T05:17:00+00:00",'],
          [3, '  "meldungen": ['],
          [4, '    {'],
          [5, '      "titel": "Beispielmeldung",'],
          [6, '      "zusammenfassung": "Dies ist nur ein Beispiel …",'],
          [7, '      "url": "https://example.com/beispiel",'],
          [8, '      "quelle": "Beispielquelle",'],
          [9, '      "veroeffentlicht": "2026-01-01T05:00:00+00:00"'],
          [10, '    },'],
          [null, '    …'],
          [null, '  ]'],
          [null, '}'],
        ],
      },
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

  // Hervorhebung in den Code-Ausschnitten, je Sprache:
  //   kommentar:  Zeichen, mit dem ein Kommentar bis zum Zeilenende beginnt ("" = keine)
  //   woerter:    Schlüsselwörter
  //   schluessel: true – ein Text in Anführungszeichen direkt vor einem
  //               Doppelpunkt ist ein Schlüssel und wird eigens gefärbt
  //   zeichen:    Klammern und Satzzeichen, die eigens gefärbt werden
  // Texte in Anführungszeichen werden in jeder Sprache erkannt.
  sprachen: {
    python: {
      kommentar: "#",
      woerter: ["import", "from", "as", "def", "return", "for", "in", "if", "elif", "else", "not", "and", "or",
        "continue", "break", "with", "while", "True", "False", "None", "print", "len", "sorted"],
    },
    json: { kommentar: "", woerter: ["true", "false", "null"], schluessel: true, zeichen: "{}[],:" },
    yaml: { kommentar: "#", woerter: ["true", "false", "null", "on"] },
  },

  // Live-Ausschnitt aus data/news.json: Zeilen, die länger wären als so viele
  // Zeichen, werden im Wert gekürzt und enden auf "…"
  ausschnittBreite: 56,

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
  // Abstand des Pfadendes zum Kreis der nächsten Station (px)
  kreisAbstand: 12,
  // Strichmuster des gezeichneten Pfads: Länge eines Strichs und der Lücke (px)
  strich: { lang: 9, luecke: 10 },
  // So viele Stützpunkte merkt sich jedes Teilstück, um aus einer Höhe die
  // Länge des Pfads bis dorthin zu bestimmen
  stuetzpunkte: 16,
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
  let stuecke = [];              // die Teilstücke des Pfads, eines je Übergang (siehe baueWegBild)
  let wegOben = 0;               // Oberkante des Wegs auf der Seite (px ab Seitenanfang)
  let seitenHoehe = 0;           // Höhe der ganzen Seite – gemerkt, damit beim Scrollen nichts gemessen wird
  let tiefsteLinie = -Infinity;  // so weit unten war die Zeichenlinie schon (Gezeichnetes bleibt)
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
      let fenster = null, code = null;
      if (s.ausschnitt) {
        const teile = baueAusschnitt(s.ausschnitt);
        fenster = teile.fenster;
        code = teile.code;
        abschnitt.classList.add("ne-station--mit-ausschnitt");
        if (s.ausschnitt.seite === "links") abschnitt.classList.add("ne-station--ausschnitt-links");
        abschnitt.appendChild(fenster);
      }
      if (i === 0) abschnitt.appendChild(baueScrollHinweis());
      liste.appendChild(abschnitt);
      return { abschnitt: abschnitt, marke: marke, inhalt: inhalt, fenster: fenster, code: code, ausschnitt: s.ausschnitt || null };
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
   * Die Teilstücke des Pfads: zwischen je zwei Stationen ein eigenes
   * kleines SVG mit zweimal derselben Kurve.
   * - .ne-pfad-spur:   die ganze Strecke, blass – zeigt, wohin es geht
   * - .ne-pfad-strich: der gezeichnete Teil in der Akzentfarbe. Wie weit er
   *   reicht, bestimmt allein sein Strichmuster (siehe zeichneStueck()).
   * Die SVGs stehen im Dokument VOR der Liste der Stationen und liegen
   * unter ihr (z-index in css/news-erklaerung.css).
   */
  function baueWegBild() {
    stuecke = [];
    for (let i = 0; i < K.stationen.length - 1; i++) {
      const bild = svgTeil("svg", { "aria-hidden": "true", focusable: "false" });
      bild.setAttribute("class", "ne-pfad");
      const spur = svgTeil("path", { fill: "none" });
      spur.setAttribute("class", "ne-pfad-spur");
      const strich = svgTeil("path", { fill: "none", visibility: "hidden" });
      strich.setAttribute("class", "ne-pfad-strich");
      bild.appendChild(spur);
      bild.appendChild(strich);
      el.weg.appendChild(bild);
      stuecke.push({ bild: bild, spur: spur, strich: strich, form: "", oben: 0, unten: 0, laenge: 0, hoehen: [], gezeichnet: -1 });
    }
  }

  /* ---------- Code-Ausschnitt im Editor-Fenster ---------- */

  /**
   * Zerlegt eine Zeile Code in gefärbte Stücke: Kommentar, Text in
   * Anführungszeichen, Schlüsselwort – alles andere bleibt neutral.
   * Jedes Stück wird ein <span> mit reinem Text (textContent).
   * @param {HTMLElement} ziel – hier werden die Stücke angehängt
   * @param {string} zeile
   * @param {{kommentar: string, woerter: string[]}} sprache
   */
  function faerbeZeile(ziel, zeile, sprache) {
    // Reihenfolge der Gruppen: 1 = Text in Anführungszeichen, 2 = Wort, 3 = alles andere
    const muster = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g;
    let neutral = "";
    function leere() {
      if (neutral) ziel.appendChild(document.createTextNode(neutral));
      neutral = "";
    }
    let treffer;
    while ((treffer = muster.exec(zeile)) !== null) {
      // Kommentar: der Rest der Zeile (ein Kommentarzeichen in Anführungszeichen zählt nicht)
      if (sprache.kommentar && !treffer[1] && zeile.startsWith(sprache.kommentar, treffer.index)) {
        leere();
        ziel.appendChild(neu("span", "ne-code-kommentar", zeile.slice(treffer.index)));
        return;
      }
      if (treffer[1]) {
        leere();
        // Schlüssel: Text in Anführungszeichen direkt vor einem Doppelpunkt
        const istSchluessel = sprache.schluessel && /^\s*:/.test(zeile.slice(muster.lastIndex));
        ziel.appendChild(neu("span", istSchluessel ? "ne-code-schluessel" : "ne-code-text", treffer[1]));
      } else if (sprache.zeichen && treffer[3] && sprache.zeichen.indexOf(treffer[3]) >= 0) {
        leere();
        ziel.appendChild(neu("span", "ne-code-zeichen", treffer[3]));
      } else if (treffer[2] && sprache.woerter.indexOf(treffer[2]) >= 0) {
        leere();
        ziel.appendChild(neu("span", "ne-code-wort", treffer[2]));
      } else {
        neutral += treffer[0];
      }
    }
    leere();
  }

  /**
   * Ein kleines Editor-Fenster: oben eine Leiste mit dem Dateinamen,
   * darunter der Code mit Zeilennummern. Zu lange Zeilen scrollen im
   * Fenster waagerecht (auch per Tastatur: das Feld ist fokussierbar).
   * @param {{datei: string, sprache: string, zeilen: Array}} a – siehe Konfiguration
   * @returns {{fenster: HTMLElement, code: HTMLElement}}
   */
  function baueAusschnitt(a) {
    const fenster = neu("figure", "ne-ausschnitt");
    fenster.appendChild(neu("figcaption", "ne-ausschnitt-leiste", a.datei));
    const code = neu("pre", "ne-code");
    code.tabIndex = 0;
    code.setAttribute("aria-label", "Ausschnitt aus " + a.datei);
    fuelleAusschnitt(code, a.zeilen, a.sprache);
    fenster.appendChild(code);
    return { fenster: fenster, code: code };
  }

  /**
   * Füllt ein Code-Fenster (neu): eine Zeile je Eintrag, mit Nummer und
   * Hervorhebung. Auch für Inhalte, die erst später feststehen (live).
   * @param {HTMLElement} code – das <pre> aus baueAusschnitt
   * @param {Array} zeilen – [[Nummer oder null, Text], …]
   * @param {string} spracheName – Schlüssel in K.sprachen
   */
  function fuelleAusschnitt(code, zeilen, spracheName) {
    const sprache = K.sprachen[spracheName] || { kommentar: "", woerter: [] };
    code.textContent = "";
    zeilen.forEach(function (z, i) {
      const zeile = neu("span", "ne-code-zeile");
      zeile.style.setProperty("--ne-zeile", i);          // Reihenfolge fürs Erscheinen
      const nummer = neu("span", "ne-code-nummer", z[0] === null ? "" : String(z[0]));
      nummer.setAttribute("aria-hidden", "true");
      const inhalt = neu("span", "ne-code-inhalt");
      // Auslassung ("…" allein in der Zeile): gedämpft, ohne Hervorhebung
      if (z[1].trim() === "…") inhalt.appendChild(neu("span", "ne-code-luecke", z[1]));
      else faerbeZeile(inhalt, z[1], sprache);
      zeile.appendChild(nummer);
      zeile.appendChild(inhalt);
      code.appendChild(zeile);
    });
  }

  /**
   * Baut aus data/news.json die Zeilen für das Code-Fenster: "aktualisiert"
   * und die ERSTE Meldung mit allen Feldern in der Reihenfolge der Datei,
   * dann "…" für die weiteren Meldungen und die schließenden Klammern –
   * eingerückt wie die Datei selbst. Lange Werte werden gekürzt ("…").
   * @param {object} roh – der Inhalt der Datei (JSON.parse)
   * @param {string} text – der Text der Datei (für die Nummern der letzten Zeilen)
   * @returns {Array|null} Zeilen wie in der Konfiguration; null, wenn es keine Meldung gibt
   */
  function newsZeilen(roh, text) {
    const erste = roh && Array.isArray(roh.meldungen) ? roh.meldungen[0] : null;
    if (!erste || typeof erste !== "object" || Array.isArray(erste)) return null;
    const zeilen = [];
    let nr = 0;
    const zeile = function (inhalt) { zeilen.push([++nr, inhalt]); };

    /** "schluessel": wert – passt die Zeile nicht, wird der Wert gekürzt und endet auf "…". */
    function feld(einzug, schluessel, wert, komma) {
      const anfang = einzug + JSON.stringify(schluessel) + ": ";
      let w = JSON.stringify(wert);
      const platz = K.ausschnittBreite - anfang.length - komma.length;
      if (w.length > platz) {
        if (typeof wert === "string") {
          // im Text kürzen, bis die Zeile passt – die Anführungszeichen bleiben
          let n = Math.max(1, platz - 3);
          do {
            w = JSON.stringify(wert.slice(0, n).trimEnd() + "…");
            n--;
          } while (w.length > platz && n > 0);
        } else {
          w = w.slice(0, Math.max(1, platz - 1)) + "…";
        }
      }
      zeile(anfang + w + komma);
    }

    zeile("{");
    if ("aktualisiert" in roh) feld("  ", "aktualisiert", roh.aktualisiert, ",");
    zeile('  "meldungen": [');
    zeile("    {");
    const felder = Object.keys(erste);
    felder.forEach(function (name, i) { feld("      ", name, erste[name], i < felder.length - 1 ? "," : ""); });
    const weitere = roh.meldungen.length > 1;
    zeile(weitere ? "    }," : "    }");
    if (weitere) zeilen.push([null, "    …"]);
    // Nummern der beiden letzten Zeilen: aus der Datei, wenn sie so endet wie erwartet
    const alle = text.replace(/\s+$/, "").split("\n");
    const passt = weitere && alle.length > nr + 2 && alle[alle.length - 1].trim() === "}" && alle[alle.length - 2].trim() === "]";
    zeilen.push([passt ? alle.length - 1 : weitere ? null : ++nr, "  ]"]);
    zeilen.push([passt ? alle.length : weitere ? null : ++nr, "}"]);
    return zeilen;
  }

  /** Füllt alle Fenster mit live: "news" – aus der geladenen Datei oder mit dem Ersatz. */
  function fuelleLiveAusschnitte(roh, text) {
    const live = roh ? newsZeilen(roh, text) : null;
    stationen.forEach(function (s) {
      if (!s.ausschnitt || s.ausschnitt.live !== "news") return;
      fuelleAusschnitt(s.code, live || s.ausschnitt.zeilen, s.ausschnitt.sprache);
    });
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
    tiefsteLinie = -Infinity;
    stuecke.forEach(function (st) { zeichneStueck(st, 0); });
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
   * Legt die Teilstücke: jedes beginnt unter dem Text einer Station und
   * endet in einer sanften S-Kurve knapp ÜBER dem Kreis der nächsten
   * (abwechselnd nach links und rechts ausweichend). Hier – und nur hier –
   * wird ausgemessen: beim Öffnen und bei jeder Größenänderung, nie beim
   * Scrollen.
   */
  function legePfad() {
    const rahmen = el.weg.getBoundingClientRect();
    if (!rahmen.width || !stationen.length) return;
    const schwung = Math.min(K.schwung.max, rahmen.width * K.schwung.anteil);
    // Alle Maße zuerst lesen, dann erst schreiben
    const formen = stuecke.map(function (st, i) {
      const von = stationen[i].inhalt.getBoundingClientRect();
      const bis = stationen[i + 1].marke.getBoundingClientRect();
      // Steht ein Code-Fenster unter dem Text (Smartphone), beginnt der Pfad erst darunter
      let unten = von.bottom;
      const fenster = stationen[i].fenster && stationen[i].fenster.getBoundingClientRect();
      if (fenster && fenster.left <= von.left + von.width / 2 && fenster.right >= von.left + von.width / 2) {
        unten = Math.max(unten, fenster.bottom);
      }
      const x0 = von.left + von.width / 2 - rahmen.left;
      const y0 = unten - rahmen.top + K.luft;
      const x1 = bis.left + bis.width / 2 - rahmen.left;
      const y1 = bis.top - rahmen.top - K.kreisAbstand;         // endet über dem Kreis
      const seite = (i % 2 === 0 ? 1 : -1) * schwung;
      // Das SVG umschließt nur dieses Teilstück (mit etwas Rand für die Strichenden)
      const links = Math.floor(Math.min(x0, x1) - schwung - 6);
      const breite = Math.ceil(Math.max(x0, x1) + schwung + 6) - links;
      const oben = Math.floor(y0 - 6);
      const hoehe = Math.ceil(y1 + 6) - oben;
      const drittel = (y1 - y0) / 3;
      const r = function (zahl) { return Math.round(zahl * 10) / 10; };
      const d = y1 - y0 < 24 ? "" :                               // kein Platz: kein Pfad
        "M" + r(x0 - links) + " " + r(y0 - oben) +
        " C" + r(x0 + seite - links) + " " + r(y0 + drittel - oben) +
        " " + r(x1 - seite - links) + " " + r(y1 - drittel - oben) +
        " " + r(x1 - links) + " " + r(y1 - oben);
      return { links: links, oben: oben, breite: breite, hoehe: hoehe, d: d };
    });
    wegOben = rahmen.top + window.scrollY;
    seitenHoehe = document.documentElement.scrollHeight;

    stuecke.forEach(function (st, i) {
      const f = formen[i];
      const form = [f.links, f.oben, f.breite, f.hoehe, f.d].join("|");
      if (form === st.form) return;                               // unverändert: nichts anfassen
      st.form = form;
      st.bild.style.left = f.links + "px";
      st.bild.style.top = f.oben + "px";
      st.bild.style.width = f.breite + "px";
      st.bild.style.height = f.hoehe + "px";
      st.bild.setAttribute("viewBox", "0 0 " + f.breite + " " + f.hoehe);
      st.spur.setAttribute("d", f.d);
      st.strich.setAttribute("d", f.d);
      st.laenge = f.d ? st.strich.getTotalLength() : 0;
      // Stützpunkte: in welcher Höhe (im Weg) liegt der Pfad nach 0/n, 1/n … n/n seiner Länge?
      st.hoehen = [];
      for (let k = 0; k <= K.stuetzpunkte && st.laenge; k++) {
        st.hoehen.push(f.oben + st.strich.getPointAtLength(st.laenge * k / K.stuetzpunkte).y);
      }
      st.oben = st.hoehen.length ? st.hoehen[0] : 0;
      st.unten = st.hoehen.length ? st.hoehen[st.hoehen.length - 1] : 0;
      st.gezeichnet = -1;                                         // Strichmuster neu setzen
    });
    planeBild();
  }

  /** Länge des Teilstücks bis zur Höhe y (der Pfad läuft nur abwärts). */
  function laengeBis(st, y) {
    if (y <= st.oben) return 0;
    if (y >= st.unten) return st.laenge;
    let k = 1;
    while (st.hoehen[k] < y) k++;
    const anteil = (y - st.hoehen[k - 1]) / (st.hoehen[k] - st.hoehen[k - 1] || 1);
    return st.laenge * (k - 1 + anteil) / K.stuetzpunkte;
  }

  /**
   * Zeichnet ein Teilstück bis zur Länge "bis" – nur über das Strichmuster:
   * so viele Striche, wie hineinpassen (der letzte angeschnitten), danach
   * eine Lücke über den ganzen Rest. Kein Beschnitt, keine Maske.
   */
  function zeichneStueck(st, bis) {
    bis = Math.round(bis);
    if (bis === st.gezeichnet) return;                            // nichts Neues: nichts anfassen
    st.gezeichnet = bis;
    if (bis <= 0) {
      st.strich.setAttribute("visibility", "hidden");
      return;
    }
    const takt = K.strich.lang + K.strich.luecke;
    const ganze = Math.floor(bis / takt);
    const rest = Math.min(K.strich.lang, bis - ganze * takt);
    const leer = Math.ceil(st.laenge) + takt;                     // Lücke bis über das Ende hinaus
    let muster = "";
    for (let k = 0; k < ganze - (rest ? 0 : 1); k++) muster += K.strich.lang + " " + K.strich.luecke + " ";
    muster += (rest || K.strich.lang) + " " + leer;
    st.strich.setAttribute("stroke-dasharray", muster);
    st.strich.setAttribute("visibility", "visible");
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
   * Höchstens einmal pro Bild: Wie weit reicht die Zeichenlinie in den Weg
   * hinein? Der Pfad folgt ihr direkt. Gerechnet wird nur mit der
   * Scrollposition und gemerkten Maßen – nichts wird ausgemessen. Angefasst
   * wird nur das Teilstück, dessen gezeichnete Länge sich ändert (in der
   * Regel das eine, das gerade im Bild ist). Einmal Gezeichnetes bleibt
   * stehen, auch wenn man wieder nach oben scrollt.
   */
  function rechne() {
    if (!istSichtbar()) return;
    const scroll = window.scrollY, fenster = window.innerHeight;
    const alles = ruhigAbfrage.matches || scroll + fenster >= seitenHoehe - 2;
    const linie = alles ? Infinity : scroll + fenster * K.zeichenLinie - wegOben;
    tiefsteLinie = Math.max(tiefsteLinie, linie);
    stuecke.forEach(function (st) { zeichneStueck(st, laengeBis(st, tiefsteLinie)); });
  }


  /* ---------- Live-Vorschau ---------- */

  /**
   * Holt data/news.json EINMAL frisch – für die Vorschau der letzten Station
   * (geprüft mit NewsDaten aus js/news.js) und für die Live-Ausschnitte.
   */
  function ladeVorschau() {
    const nummer = ++abruf;
    el.vorschau.textContent = "";
    el.vorschau.appendChild(neu("p", "ne-vorschau-hinweis", "Vorschau wird geladen …"));
    fetch(NEWS_KONFIG.datei + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("HTTP " + antwort.status);
        return antwort.text();                  // als Text – für die Zeilennummern im Ausschnitt
      })
      .then(function (text) {
        if (nummer !== abruf) return;
        const roh = JSON.parse(text);
        const p = NewsDaten.pruefeDaten(roh);
        if (!p.ok) throw new Error("Format");
        fuelleLiveAusschnitte(roh, text);
        zeigeVorschau(p);
      })
      .catch(function () {
        if (nummer !== abruf) return;
        fuelleLiveAusschnitte(null, "");        // fester Beispiel-Ausschnitt
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
