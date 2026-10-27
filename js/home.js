/* ==========================================================================
   home.js – die Startseite als Bento-Raster
   Sechs rechteckige Kacheln unterschiedlicher Größe füllen ein Raster
   lückenlos (Computer: 4 Spalten × 3 Zeilen, Smartphone: 2 Spalten).
   Wie groß eine Kachel ist, richtet sich nach der Nutzung: Jedes Öffnen
   eines Abschnitts wird lokal gezählt (ältere Aufrufe zählen weniger,
   nach 30 Tagen gar nicht mehr). Der meistgenutzte Abschnitt bekommt die
   große 2×2-Kachel oben links, die nächsten breite oder hohe Kacheln, die
   am wenigsten genutzten 1×1. Neu berechnet wird höchstens einmal am Tag;
   ändert sich die Anordnung, gleiten die Kacheln beim Öffnen an ihren
   neuen Platz.
   Darüber rechts ein kleiner Zeitstempel (Datum und Uhrzeit in Monospace),
   darunter die Schnellzugriffe. Die ganze Startseite passt ohne Scrollen
   in die Bildschirmhöhe – das Raster nimmt den übrigen Platz ein.
   Am unteren Rand liegt ein kaum sichtbares Meer ferner Lichter (Canvas,
   ohne Bilddatei).

   Aufbau der Datei:
     KONFIG            – alle Werte (Raster, Zählung, Schnellzugriffe)
     StartseiteLayout  – reine Rechnung (Punkte, Größen, Belegung); läuft
                         auch in Node für Tests
     StartseiteAnsicht – die Ansicht im Browser
   Gespeichert unter localStorage "ntb-startseite":
     { version: 1, nachNutzung: true,
       aufrufe: { kalender: [Zeitstempel in ms, …], … },
       anordnung: { tag: "2026-10-27", reihenfolge: ["todo", …] } }
   Aussehen: css/home.css, Farben und Effekte: css/style.css.
   ========================================================================== */

const STARTSEITE_KONFIG = {
  // Optionaler Name für die Begrüßung, z. B. "Niko" → "Guten Morgen, Niko"
  name: "",

  // Die Abschnitte als Kacheln. Reihenfolge = Startanordnung ohne
  // Nutzungsdaten (der erste bekommt die große Kachel).
  // ansicht = Name in app.js (ANSICHTEN), symbol = Schlüssel in SYMBOLE unten
  kacheln: [
    { id: "kalender", ansicht: "kalender", href: "#kalender", name: "Kalender", symbol: "kalender" },
    { id: "todo", ansicht: "todo", href: "#todo", name: "Zu erledigen", symbol: "haken" },
    { id: "stundenplan", ansicht: "schedule", href: "#schedule", name: "Stundenplan/Termine", symbol: "uhr" },
    { id: "prompts", ansicht: "prompts", href: "#prompts", name: "Prompts", symbol: "text" },
    { id: "games", ansicht: "games", href: "#games", name: "Games", symbol: "wuerfel" },
    { id: "media", ansicht: "media", href: "#media", name: "Filme/Serien", symbol: "film" },
  ],

  // Raster: Spalten × Zeilen. Die Summe der Kachelflächen muss die
  // Rasterfläche ergeben (hier 12 Felder).
  raster: {
    computer: { spalten: 4, zeilen: 3 },
    handy: { spalten: 2, zeilen: 6 },
  },
  // Ab dieser Breite gilt das Computer-Raster (wie in css/home.css)
  computerAb: "(min-width: 700px)",

  // Kachelgrößen in Stufen: 2 = 2×2, 1 = breit (2×1) oder hoch (1×2), 0 = 1×1.
  // Gewünschte Stufe je Platz in der Rangfolge (Platz 1 = meistgenutzt).
  stufenNachRang: [2, 1, 1, 1, 0, 0],

  // Zählung der Aufrufe
  zaehlung: {
    halbwertszeitTage: 7,         // ein Aufruf von vor 7 Tagen zählt halb so viel
    maxAlterTage: 30,             // ältere Aufrufe zählen gar nicht mehr
    maxProAbschnitt: 300,         // höchstens so viele Zeitstempel je Abschnitt
  },

  // Schnellzugriffe unten: Name und Adresse, Reihenfolge = Anzeige.
  // Moodle und ZPA: Platzhalter – hier die echten Adressen eintragen.
  schnellzugriffe: [
    { name: "Claude", url: "https://claude.ai" },
    { name: "Gemini", url: "https://gemini.google.com" },
    { name: "Moodle", url: "https://moodle.hm.edu/my/index.php" },
    { name: "ZPA", url: "https://zpa.example.org" },
  ],

  speicherSchluessel: "ntb-startseite",
};


/* ==========================================================================
   STARTSEITE-LAYOUT: Punkte, Rangfolge, Größen und lückenlose Belegung
   ========================================================================== */

const StartseiteLayout = (function () {
  const K = STARTSEITE_KONFIG;
  const TAG_MS = 24 * 60 * 60 * 1000;

  // Kachelformen je Stufe (b = Spalten, h = Zeilen)
  const FORMEN = {
    2: [{ b: 2, h: 2 }],
    1: [{ b: 2, h: 1 }, { b: 1, h: 2 }],
    0: [{ b: 1, h: 1 }],
  };
  const FLAECHE = { 2: 4, 1: 2, 0: 1 };

  /** Gewichtete Punkte je Abschnitt: jeder Aufruf zählt 0,5^(Alter/Halbwertszeit). */
  function punkte(aufrufe, jetzt) {
    const z = K.zaehlung;
    const ergebnis = {};
    K.kacheln.forEach(function (k) {
      let summe = 0;
      (aufrufe[k.id] || []).forEach(function (t) {
        const alterTage = (jetzt - t) / TAG_MS;
        if (alterTage >= 0 && alterTage <= z.maxAlterTage) {
          summe += Math.pow(0.5, alterTage / z.halbwertszeitTage);
        }
      });
      ergebnis[k.id] = summe;
    });
    return ergebnis;
  }

  /** Rangfolge: meistgenutzt zuerst; Gleichstand (auch: keine Daten) → Startanordnung. */
  function rangfolge(p) {
    return K.kacheln.map(function (k, i) { return { id: k.id, p: p[k.id] || 0, i: i }; })
      .sort(function (a, b) { return b.p - a.p || a.i - b.i; })
      .map(function (e) { return e.id; });
  }

  /**
   * Findet eine lückenlose Belegung des Rasters für Kacheln mit festen
   * Stufen (in Rangfolge). Füllt immer das erste freie Feld (Zeile für
   * Zeile, von links) und probiert die Kacheln in Rangfolge – so stehen die
   * Meistgenutzten oben links. Breit oder hoch wählt die Suche selbst.
   * @returns {Array<{id, x, y, b, h}>|null} – null, wenn es keine gibt
   */
  function belege(ids, stufen, spalten, zeilen) {
    const frei = [];
    for (let i = 0; i < spalten * zeilen; i++) frei.push(true);
    const platz = [];
    const benutzt = ids.map(function () { return false; });

    function passt(x, y, f) {
      if (x + f.b > spalten || y + f.h > zeilen) return false;
      for (let dy = 0; dy < f.h; dy++) {
        for (let dx = 0; dx < f.b; dx++) {
          if (!frei[(y + dy) * spalten + x + dx]) return false;
        }
      }
      return true;
    }
    function setze(x, y, f, wert) {
      for (let dy = 0; dy < f.h; dy++) {
        for (let dx = 0; dx < f.b; dx++) frei[(y + dy) * spalten + x + dx] = wert;
      }
    }
    function suche() {
      const leer = frei.indexOf(true);
      if (leer === -1) return benutzt.every(Boolean);
      const x = leer % spalten, y = Math.floor(leer / spalten);
      for (let i = 0; i < ids.length; i++) {
        if (benutzt[i]) continue;
        // Abwechselnd zuerst breit oder zuerst hoch – so mischt sich das Raster
        const formen = stufen[i] === 1 && i % 2 === 0 ? FORMEN[1].slice().reverse() : FORMEN[stufen[i]];
        for (let j = 0; j < formen.length; j++) {
          const f = formen[j];
          if (!passt(x, y, f)) continue;
          setze(x, y, f, false);
          benutzt[i] = true;
          platz.push({ id: ids[i], x: x, y: y, b: f.b, h: f.h });
          if (suche()) return true;
          platz.pop();
          benutzt[i] = false;
          setze(x, y, f, true);
        }
      }
      return false;
    }
    return suche() ? platz : null;
  }

  /**
   * Größen und Plätze für ein Raster. Zuerst mit den gewünschten Stufen;
   * gibt es dafür keine lückenlose Belegung (oder passt die Fläche nicht),
   * werden Kacheln um eine Stufe kleiner oder größer – die Abweichung vom
   * Wunsch bleibt so klein wie möglich, Änderungen trifft zuerst die
   * weniger genutzten Kacheln.
   * @returns {{kacheln: Array<{id, x, y, b, h}>, stufen: number[]}}
   */
  function anordnung(reihenfolge, spalten, zeilen) {
    const wunsch = reihenfolge.map(function (id, i) {
      return K.stufenNachRang[Math.min(i, K.stufenNachRang.length - 1)];
    });
    const flaeche = spalten * zeilen;
    // Alle Stufen-Kombinationen mit passender Fläche, nach Abstand zum Wunsch
    const kandidaten = [];
    const n = reihenfolge.length;
    const s = [];
    (function alle(i, summe) {
      if (summe > flaeche) return;
      if (i === n) {
        if (summe !== flaeche) return;
        let abstand = 0, gewicht = 0;
        for (let k = 0; k < n; k++) {
          const d = Math.abs(s[k] - wunsch[k]);
          abstand += d;
          gewicht += d * (n - k);             // Abweichungen bei wichtigen Kacheln wiegen schwerer
        }
        // Größere Kacheln nie hinter kleinere in der Rangfolge
        let geordnet = 0;
        for (let k = 1; k < n; k++) if (s[k] > s[k - 1]) geordnet++;
        kandidaten.push({ stufen: s.slice(), abstand: abstand, gewicht: gewicht, geordnet: geordnet });
        return;
      }
      for (let st = 2; st >= 0; st--) {
        s[i] = st;
        alle(i + 1, summe + FLAECHE[st]);
      }
    })(0, 0);
    kandidaten.sort(function (a, b) {
      return a.geordnet - b.geordnet || a.abstand - b.abstand || a.gewicht - b.gewicht;
    });
    for (let i = 0; i < kandidaten.length; i++) {
      const platz = belege(reihenfolge, kandidaten[i].stufen, spalten, zeilen);
      if (platz) return { kacheln: platz, stufen: kandidaten[i].stufen };
    }
    return null;
  }

  /** Prüft, ob eine Belegung das Raster genau einmal und ohne Lücke füllt. */
  function istLueckenlos(kacheln, spalten, zeilen) {
    const feld = [];
    for (let i = 0; i < spalten * zeilen; i++) feld.push(0);
    let ok = true;
    kacheln.forEach(function (k) {
      const form = (k.b === 2 && k.h === 2) || (k.b + k.h === 3) || (k.b === 1 && k.h === 1);
      if (!form || k.x < 0 || k.y < 0 || k.x + k.b > spalten || k.y + k.h > zeilen) ok = false;
      for (let dy = 0; dy < k.h; dy++) {
        for (let dx = 0; dx < k.b; dx++) {
          const i = (k.y + dy) * spalten + k.x + dx;
          if (i >= 0 && i < feld.length) feld[i]++;
        }
      }
    });
    return ok && feld.every(function (n) { return n === 1; });
  }

  /** Datum als "JJJJ-MM-TT" in Ortszeit (für "einmal pro Tag"). */
  function tag(datum) {
    const d = new Date(datum);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  return {
    punkte: punkte,
    rangfolge: rangfolge,
    belege: belege,
    anordnung: anordnung,
    istLueckenlos: istLueckenlos,
    tag: tag,
  };
})();

if (typeof module !== "undefined") module.exports = { STARTSEITE_KONFIG: STARTSEITE_KONFIG, StartseiteLayout: StartseiteLayout };


/* ==========================================================================
   DIE ANSICHT
   ========================================================================== */

const StartseiteAnsicht = typeof document === "undefined" ? null : (function () {
  const K = STARTSEITE_KONFIG;
  const L = StartseiteLayout;

  const WOCHENTAGE = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

  // Schlichte Liniensymbole (24 × 24, Strichfarbe = Textfarbe)
  const SYMBOLE = {
    kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    haken: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
    uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    text: '<path d="M5 6.5h14M5 11h14M5 15.5h9"/><path d="M17 14v6"/>',
    wuerfel: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/>',
    film: '<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M7.5 5v14M16.5 5v14M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
  };

  const el = {};
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");
  const computerAbfrage = window.matchMedia(K.computerAb);
  let minutenTimer = null;
  let daten = null;
  let gezeigt = null;          // die Anordnung, die gerade im DOM steht (Reihenfolge als Text)
  let vorherReihenfolge = null;    // Anordnung vor der heutigen Neuberechnung


  /* ---------- Speicher ---------- */

  function leer() {
    return { version: 1, nachNutzung: true, aufrufe: {}, anordnung: null };
  }

  function laden() {
    try {
      const roh = JSON.parse(localStorage.getItem(K.speicherSchluessel) || "null");
      if (!roh || roh.version !== 1 || typeof roh.aufrufe !== "object") return leer();
      const d = leer();
      d.nachNutzung = roh.nachNutzung !== false;
      K.kacheln.forEach(function (k) {
        const liste = roh.aufrufe[k.id];
        if (Array.isArray(liste)) d.aufrufe[k.id] = liste.filter(function (t) { return typeof t === "number" && isFinite(t); });
      });
      const a = roh.anordnung;
      if (a && typeof a.tag === "string" && Array.isArray(a.reihenfolge) && gueltigeReihenfolge(a.reihenfolge)) {
        d.anordnung = { tag: a.tag, reihenfolge: a.reihenfolge.slice() };
      }
      return d;
    } catch (fehler) {
      return leer();
    }
  }

  function speichern() {
    try {
      localStorage.setItem(K.speicherSchluessel, JSON.stringify(daten));
    } catch (fehler) {
      // voll oder gesperrt – dann gilt die Zählung nur bis zum Neuladen
    }
  }

  function gueltigeReihenfolge(r) {
    return r.length === K.kacheln.length && K.kacheln.every(function (k) { return r.indexOf(k.id) !== -1; });
  }

  /**
   * Ein Abschnitt wurde geöffnet (app.js ruft das bei jedem Öffnen einer
   * Ansicht auf – über die Startseite oder die Navigation).
   */
  function merkeAufruf(ansicht) {
    const k = K.kacheln.find(function (k) { return k.ansicht === ansicht; });
    if (!k) return;
    if (!daten) daten = laden();
    const jetzt = Date.now();
    const grenze = jetzt - K.zaehlung.maxAlterTage * 24 * 60 * 60 * 1000;
    const liste = (daten.aufrufe[k.id] || []).filter(function (t) { return t >= grenze; });
    liste.push(jetzt);
    daten.aufrufe[k.id] = liste.slice(-K.zaehlung.maxProAbschnitt);
    speichern();
  }

  /** Die Startanordnung (ohne Nutzungsdaten oder mit ausgeschalteter Option). */
  function startReihenfolge() {
    return K.kacheln.map(function (k) { return k.id; });
  }

  /**
   * Die Reihenfolge für heute: höchstens einmal pro Tag aus den Punkten
   * neu berechnet. Merkt sich die vorige, damit die Kacheln von dort aus
   * an ihren neuen Platz gleiten können.
   */
  function reihenfolgeFuerHeute() {
    if (!daten.nachNutzung) return startReihenfolge();
    const heute = L.tag(Date.now());
    const a = daten.anordnung;
    if (a && a.tag === heute) return a.reihenfolge;
    const neu = L.rangfolge(L.punkte(daten.aufrufe, Date.now()));
    if (a) vorherReihenfolge = a.reihenfolge;
    daten.anordnung = { tag: heute, reihenfolge: neu };
    speichern();
    return neu;
  }


  /* ---------- Aufbau ---------- */

  /**
   * Baut die Startseite auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="home-root">
   */
  function init(container) {
    daten = daten || laden();
    container.innerHTML =
      '<canvas class="home-stadt" aria-hidden="true"></canvas>' +
      '<div class="home">' +
        '<div class="home-kopf">' +
          '<p class="home-zeit"><time></time></p>' +
        "</div>" +
        '<nav class="bento" aria-label="Bereiche"></nav>' +
        '<nav class="home-links" aria-label="Schnellzugriffe"><ul class="home-links-liste"></ul></nav>' +
      "</div>";

    el.home = container.querySelector(".home");
    el.gruss = document.getElementById("titel-home");
    el.zeit = container.querySelector(".home-zeit time");
    el.bento = container.querySelector(".bento");
    el.stadt = container.querySelector(".home-stadt");
    // Die Überschrift (h1 aus index.html) bleibt für Screenreader im Kopf –
    // sichtbar ist nur der Zeitstempel. Sie behält ihre ID: app.js setzt
    // Fokus und Seitentitel darüber.
    container.querySelector(".home-kopf").insertBefore(el.gruss, container.querySelector(".home-zeit"));

    zeichneStadt();
    window.addEventListener("resize", function () {
      clearTimeout(el.stadtTimer);
      el.stadtTimer = setTimeout(zeichneStadt, 200);
    });
    new MutationObserver(zeichneStadt).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    K.kacheln.forEach(function (k) {
      const link = document.createElement("a");
      link.className = "bento-kachel";
      link.href = k.href;
      link.dataset.kachel = k.id;
      link.innerHTML =
        '<span class="bento-nummer" aria-hidden="true"></span>' +
        '<svg class="bento-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SYMBOLE[k.symbol] + "</svg>" +
        '<span class="bento-titel"></span>';
      setzeName(link.querySelector(".bento-titel"), k.name);
      el.bento.appendChild(link);
    });

    baueSchnellzugriffe(container.querySelector(".home-links-liste"));

    // Smartphone ↔ Computer: Lesereihenfolge (und Tab-Reihenfolge) anpassen
    computerAbfrage.addEventListener("change", function () { ordneDom(); });
  }

  /** Schnellzugriffe als Liste schlichter Textlinks, jeweils in einem neuen Tab. */
  function baueSchnellzugriffe(liste) {
    K.schnellzugriffe.forEach(function (z) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.className = "home-link";
      link.href = z.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.setAttribute("aria-label", z.name + " (öffnet in neuem Tab)");
      link.textContent = z.name;
      const pfeil = document.createElement("span");
      pfeil.className = "home-link-pfeil";
      pfeil.setAttribute("aria-hidden", "true");
      pfeil.textContent = "↗";
      link.appendChild(pfeil);
      li.appendChild(link);
      liste.appendChild(li);
    });
  }

  /** Name als Text; nach jedem "/" darf umbrochen werden (<wbr>). */
  function setzeName(ziel, name) {
    name.split("/").forEach(function (teil, i, teile) {
      ziel.appendChild(document.createTextNode(teil + (i < teile.length - 1 ? "/" : "")));
      if (i < teile.length - 1) ziel.appendChild(document.createElement("wbr"));
    });
  }

  /**
   * Setzt Größe und Platz jeder Kachel – für beide Raster zugleich als
   * CSS-Variablen (--c-… Computer, --h-… Smartphone); welches gilt,
   * entscheidet css/home.css per Media Query.
   */
  function setzeAnordnung(reihenfolge) {
    const raster = { c: K.raster.computer, h: K.raster.handy };
    Object.keys(raster).forEach(function (art) {
      const r = raster[art];
      const a = L.anordnung(reihenfolge, r.spalten, r.zeilen);
      a.kacheln.forEach(function (p) {
        const kachel = el.bento.querySelector('[data-kachel="' + p.id + '"]');
        kachel.style.setProperty("--" + art + "-x", p.x + 1);
        kachel.style.setProperty("--" + art + "-y", p.y + 1);
        kachel.style.setProperty("--" + art + "-b", p.b);
        kachel.style.setProperty("--" + art + "-h", p.h);
        kachel.dataset[art === "c" ? "groesseC" : "groesseH"] = p.b + "x" + p.h;
      });
    });
    gezeigt = reihenfolge.join(",");
    ordneDom();
  }

  /**
   * DOM-Reihenfolge = Lesereihenfolge des aktuellen Rasters (Zeile für
   * Zeile, von links) – so stimmen Tab-Reihenfolge, Screenreader und die
   * Nummern in der Ecke mit dem überein, was man sieht.
   */
  function ordneDom() {
    const art = computerAbfrage.matches ? "c" : "h";
    const kacheln = Array.prototype.slice.call(el.bento.children);
    const wert = function (k, n) { return Number(k.style.getPropertyValue("--" + art + "-" + n)); };
    kacheln.sort(function (a, b) { return wert(a, "y") - wert(b, "y") || wert(a, "x") - wert(b, "x"); });
    kacheln.forEach(function (k, i) {
      el.bento.appendChild(k);
      k.querySelector(".bento-nummer").textContent = String(i + 1).padStart(2, "0");
      k.style.setProperty("--n", i);
    });
  }


  /* ---------- Öffnen ---------- */

  /**
   * Wird von app.js bei JEDEM Öffnen der Startseite aufgerufen.
   */
  function zeige() {
    zeichneZeit();
    const reihenfolge = reihenfolgeFuerHeute();
    if (gezeigt === null) {
      // Erstes Öffnen: von der zuletzt gezeigten Anordnung aus gleiten
      setzeAnordnung(vorherReihenfolge || reihenfolge);
    }
    const neu = reihenfolge.join(",") !== gezeigt;
    if (neu) gleite(reihenfolge);
    else aufblenden();

    clearInterval(minutenTimer);
    minutenTimer = setInterval(function () {
      if (document.getElementById("view-home").hidden) {
        clearInterval(minutenTimer);
        return;
      }
      zeichneZeit();
    }, 30 * 1000);
    return null;
  }

  /** Die Kacheln erscheinen nacheinander langsam aus dem Dunkel (CSS-Animation). */
  function aufblenden() {
    el.bento.classList.remove("blendet-auf");
    if (ruhigAbfrage.matches) return;
    void el.bento.offsetWidth;            // Neustart der Animation erzwingen
    el.bento.classList.add("blendet-auf");
  }

  /**
   * Neue Anordnung: die Kacheln gleiten sanft von ihrem alten an ihren
   * neuen Platz (alte Lage messen, neue setzen, den Versatz animieren).
   */
  function gleite(reihenfolge) {
    const kacheln = Array.prototype.slice.call(el.bento.children);
    const vorher = new Map(kacheln.map(function (k) { return [k, k.getBoundingClientRect()]; }));
    setzeAnordnung(reihenfolge);
    if (ruhigAbfrage.matches) return;
    kacheln.forEach(function (k) {
      const a = vorher.get(k), b = k.getBoundingClientRect();
      if (!a.width || !b.width) return;
      // Nur verschieben (Mitte zu Mitte), nicht strecken – die Schrift bleibt ruhig
      const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
      const dy = (a.top + a.height / 2) - (b.top + b.height / 2);
      k.animate([
        { transform: "translate(" + dx + "px, " + dy + "px)", opacity: 0.6 },
        { transform: "none", opacity: 1 },
      ], { duration: 900, easing: "cubic-bezier(0.3, 0, 0.2, 1)" });
    });
  }

  /** Zeitstempel wie im Film: "DI 27.10.2026  ·  20:42". Die Begrüßung nur für Screenreader. */
  function zeichneZeit() {
    const jetzt = new Date();
    const zwei = function (n) { return String(n).padStart(2, "0"); };
    el.gruss.textContent = begruessung(jetzt);
    el.zeit.textContent = WOCHENTAGE[jetzt.getDay()] + " " + zwei(jetzt.getDate()) + "." + zwei(jetzt.getMonth() + 1) + "." +
      jetzt.getFullYear() + "  ·  " + zwei(jetzt.getHours()) + ":" + zwei(jetzt.getMinutes());
    el.zeit.dateTime = jetzt.getFullYear() + "-" + zwei(jetzt.getMonth() + 1) + "-" + zwei(jetzt.getDate()) +
      "T" + zwei(jetzt.getHours()) + ":" + zwei(jetzt.getMinutes());
  }

  /** "Guten Morgen" (5–10 Uhr), "Guten Tag" (11–17 Uhr), "Guten Abend" (sonst). */
  function begruessung(jetzt) {
    const stunde = jetzt.getHours();
    let gruss = "Guten Abend";
    if (stunde >= 5 && stunde < 11) gruss = "Guten Morgen";
    else if (stunde >= 11 && stunde < 18) gruss = "Guten Tag";
    return K.name ? gruss + ", " + K.name : gruss;
  }

  /**
   * Ein Meer aus unscharfen, warmen Lichtpunkten am unteren Rand – wie eine
   * Stadt bei Nacht aus der Ferne. Einmal gezeichnet (bei Größen- oder
   * Designwechsel neu), mit festem Zufall: es sieht immer gleich aus.
   * Farbe, Stärke, Höhe und Anzahl: CSS-Variablen --stadt-… in style.css.
   */
  function zeichneStadt() {
    const c = el.stadt;
    const s = getComputedStyle(document.documentElement);
    const farbe = (s.getPropertyValue("--stadt-farbe").trim() || "236 214 170").split(/\s+/).join(",");
    const anzahl = parseInt(s.getPropertyValue("--stadt-punkte"), 10) || 420;
    const breite = window.innerWidth, hoehe = c.clientHeight || Math.round(window.innerHeight * 0.3);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(breite * dpr);
    c.height = Math.round(hoehe * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, breite, hoehe);
    // Einmal beim Zeichnen weichzeichnen: unscharf wie aus der Ferne
    // (ein CSS-Filter würde in jedem Bild neu gerechnet)
    ctx.filter = "blur(" + (parseFloat(s.getPropertyValue("--stadt-unschaerfe")) || 1.2) + "px)";
    let saat = 7;
    const zufall = function () { saat = (saat * 16807) % 2147483647; return saat / 2147483647; };
    for (let i = 0; i < anzahl; i++) {
      // Dichter nahe dem unteren Rand, in Gruppen wie Viertel einer Stadt
      const y = hoehe * (1 - Math.pow(zufall(), 1.8) * 0.85);
      const x = breite * (0.5 + (zufall() - 0.5) * 1.1 + Math.sin(i * 0.37) * 0.04);
      const tiefe = (y / hoehe);                    // weiter unten = näher = größer
      const r = 0.6 + zufall() * 1.6 * tiefe + (zufall() < 0.06 ? 4 + zufall() * 8 : 0);
      const a = r > 3 ? 0.05 + zufall() * 0.06 : 0.18 + zufall() * 0.5 * tiefe;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      g.addColorStop(0, "rgba(" + farbe + "," + a + ")");
      g.addColorStop(0.4, "rgba(" + farbe + "," + a * 0.45 + ")");
      g.addColorStop(1, "rgba(" + farbe + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }


  /* ---------- Einstellungen (js/settings.js) ---------- */

  function nachNutzung() {
    if (!daten) daten = laden();
    return daten.nachNutzung;
  }

  /** "Kachelgrößen nach Nutzung" an/aus – wirkt beim nächsten Öffnen der Startseite. */
  function setzeNachNutzung(an) {
    if (!daten) daten = laden();
    daten.nachNutzung = Boolean(an);
    daten.anordnung = null;              // sofort neu berechnen statt erst morgen
    speichern();
  }

  /** Alle Nutzungsdaten löschen; die Startseite zeigt wieder die Startanordnung. */
  function nutzungZuruecksetzen() {
    if (!daten) daten = laden();
    daten.aufrufe = {};
    daten.anordnung = null;
    speichern();
  }

  return {
    init: init,
    zeige: zeige,
    merkeAufruf: merkeAufruf,
    nachNutzung: nachNutzung,
    setzeNachNutzung: setzeNachNutzung,
    nutzungZuruecksetzen: nutzungZuruecksetzen,
  };
})();
