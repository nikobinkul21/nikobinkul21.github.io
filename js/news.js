/* ==========================================================================
   news.js – der News-Feed auf der Startseite
   Liest die Datei data/news.json (Format: docs/news-format.md), die eine
   eigene Nachrichten-Pipeline täglich erzeugt, und zeigt sie als ruhige
   Spalte: Kopfzeile mit Stand, Filter nach Region, Topmeldung, Liste.

   Sicherheit und Robustheit:
   - Die Datei wird beim Laden geprüft: Meldungen ohne Pflichtfelder werden
     übersprungen, unbekannte Felder ignoriert.
   - Texte kommen NUR als reiner Text in die Seite (textContent), nie als
     HTML. Links müssen mit http:// oder https:// beginnen.
   - Geladen wird ohne Zwischenspeicher (cache: "no-store").

   Aussehen: css/news.css. Eingebunden von js/home.js.
   Die Prüf- und Textfunktionen laufen auch in Node (für Tests).
   ========================================================================== */

const NEWS_KONFIG = {
  // Die Datei der Pipeline (relativ zu index.html)
  datei: "data/news.json",
  // Bekannte Regionen in der Reihenfolge der Filterleiste.
  // Andere Werte im Feld "region" werden ignoriert (Meldung ohne Region).
  regionen: ["Welt", "Europa", "Deutschland", "Wirtschaft", "Technik"],
  // Älter als so viele Stunden: Hinweis "nicht aktuell"
  veraltetNachStunden: 36,
  // Beim Öffnen der Startseite neu laden, wenn der letzte Abruf so lange her ist
  neuLadenNachMinuten: 10,
  // Obergrenzen – längere Texte werden gekürzt, weitere Meldungen nicht gezeigt
  grenzen: { meldungen: 30, titel: 200, zusammenfassung: 600, quelle: 80 },
  // Platzhalterzeilen der Ladeanzeige
  platzhalter: 5,
};


/* ==========================================================================
   PRÜFEN UND TEXTE (ohne Seite – auch in Node nutzbar)
   ========================================================================== */

const NewsDaten = (function () {
  const K = NEWS_KONFIG;

  /** Nicht leerer Text (ohne Leerraum am Rand), sonst "". */
  function text(wert, max) {
    if (typeof wert !== "string") return "";
    const t = wert.replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
  }

  /** Gültiger Zeitpunkt als Date, sonst null. */
  function zeitpunkt(wert) {
    if (typeof wert !== "string" || !wert) return null;
    const d = new Date(wert);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Nur Links ins Web – keine anderen Schemata (z. B. javascript:). */
  function webAdresse(wert) {
    if (typeof wert !== "string") return "";
    const t = wert.trim();
    if (!/^https?:\/\//i.test(t)) return "";
    try {
      return new URL(t).href;
    } catch (fehler) {
      return "";
    }
  }

  /**
   * Prüft eine Meldung. Fehlt ein Pflichtfeld, gibt es null (wird übersprungen).
   * Optionale Felder mit ungültigem Inhalt gelten als nicht vorhanden.
   */
  function pruefeMeldung(roh) {
    if (!roh || typeof roh !== "object") return null;
    const titel = text(roh.titel, K.grenzen.titel);
    const zusammenfassung = text(roh.zusammenfassung, K.grenzen.zusammenfassung);
    const url = webAdresse(roh.url);
    const quelle = text(roh.quelle, K.grenzen.quelle);
    if (!titel || !zusammenfassung || !url || !quelle) return null;
    const region = typeof roh.region === "string" ? roh.region.trim() : "";
    const anzahl = roh.anzahlQuellen;
    return {
      titel: titel,
      zusammenfassung: zusammenfassung,
      url: url,
      quelle: quelle,
      region: K.regionen.indexOf(region) >= 0 ? region : "",
      veroeffentlicht: zeitpunkt(roh.veroeffentlicht),
      anzahlQuellen: typeof anzahl === "number" && isFinite(anzahl) && anzahl >= 1 ? Math.floor(anzahl) : 0,
    };
  }

  /**
   * Prüft die ganze Datei.
   * @returns {{ok: true, aktualisiert: Date|null, meldungen: object[], uebersprungen: number}
   *          | {ok: false}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || !Array.isArray(roh.meldungen)) return { ok: false };
    const meldungen = [];
    let uebersprungen = 0;
    roh.meldungen.forEach(function (m) {
      const g = pruefeMeldung(m);
      if (!g) uebersprungen++;
      else if (meldungen.length < K.grenzen.meldungen) meldungen.push(g);
    });
    return { ok: true, aktualisiert: zeitpunkt(roh.aktualisiert), meldungen: meldungen, uebersprungen: uebersprungen };
  }

  /** Regionen, die in den Meldungen vorkommen – in der Reihenfolge der Konfiguration. */
  function regionenIn(meldungen) {
    return K.regionen.filter(function (r) {
      return meldungen.some(function (m) { return m.region === r; });
    });
  }

  const zwei = function (n) { return (n < 10 ? "0" : "") + n; };
  const uhrzeit = function (d) { return zwei(d.getHours()) + ":" + zwei(d.getMinutes()); };
  const tagMonat = function (d) { return zwei(d.getDate()) + "." + zwei(d.getMonth() + 1) + "."; };

  /** Wie viele Kalendertage liegt d vor jetzt? (0 = heute, 1 = gestern) */
  function tageZurueck(d, jetzt) {
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const b = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    return Math.round((b - a) / 86400000);
  }

  /** "09:45", "gestern 09:45" oder "11.11. 09:45" – für die Kopfzeile ("Stand: …"). */
  function standText(aktualisiert, jetzt) {
    if (!aktualisiert) return "unbekannt";
    const tage = tageZurueck(aktualisiert, jetzt);
    if (tage === 0) return uhrzeit(aktualisiert);
    if (tage === 1) return "gestern " + uhrzeit(aktualisiert);
    return tagMonat(aktualisiert) + " " + uhrzeit(aktualisiert);
  }

  /** Ist die Datei älter als die Grenze (oder ohne gültigen Zeitpunkt)? */
  function istVeraltet(aktualisiert, jetzt) {
    if (!aktualisiert) return true;
    return jetzt - aktualisiert > K.veraltetNachStunden * 3600000;
  }

  /** "vor 12 Min", "vor 2 Std", "gestern", "vor 3 Tagen", "03.11." – oder "" (Zukunft/unbekannt). */
  function relativeZeit(d, jetzt) {
    if (!d) return "";
    const min = Math.floor((jetzt - d) / 60000);
    if (min < 0) return "";
    if (min < 1) return "gerade eben";
    if (min < 60) return "vor " + min + " Min";
    if (min < 24 * 60) return "vor " + Math.floor(min / 60) + " Std";
    const tage = Math.floor(min / (24 * 60));
    if (tage === 1) return "gestern";
    if (tage < 7) return "vor " + tage + " Tagen";
    return tagMonat(d);
  }

  return {
    pruefeMeldung: pruefeMeldung,
    pruefeDaten: pruefeDaten,
    regionenIn: regionenIn,
    standText: standText,
    istVeraltet: istVeraltet,
    relativeZeit: relativeZeit,
  };
})();


/* ==========================================================================
   DARSTELLUNG
   ========================================================================== */

const NewsFeed = (function () {
  const K = NEWS_KONFIG;

  // Geräte ohne Maus: Antippen klappt die Zusammenfassung auf, erneutes Antippen öffnet
  const ohneHover = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(hover: none)") : { matches: false };

  const el = {};
  let stand = null;              // geprüfte Daten oder null
  let zustand = "laedt";         // "laedt" | "bereit" | "fehler"
  let filter = "";               // "" = alle, sonst eine Region
  let geladenUm = 0;             // Zeitpunkt des letzten Abrufs (ms)
  let abruf = 0;                 // laufende Nummer – veraltete Antworten werden verworfen

  /** Kleiner Helfer: Element mit Klasse und reinem Text. */
  function neu(tag, klasse, inhalt) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (inhalt) e.textContent = inhalt;
    return e;
  }

  /**
   * Baut das Gerüst des Feeds. Wird von home.js EINMAL aufgerufen.
   * @param {HTMLElement} container – <section class="news">
   */
  function init(container) {
    el.wurzel = container;
    container.setAttribute("aria-labelledby", "news-titel");

    const kopf = neu("div", "news-kopf");
    const titel = neu("h2", "news-titel", "News");
    titel.id = "news-titel";
    el.stand = neu("p", "news-stand");
    kopf.appendChild(titel);
    kopf.appendChild(el.stand);

    el.filter = neu("div", "news-filter");
    el.filter.setAttribute("role", "group");
    el.filter.setAttribute("aria-label", "Nach Region filtern");
    el.filter.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-region]");
      if (!knopf) return;
      filter = knopf.dataset.region;
      zeichne();
    });

    // Der Bereich, der auf dem Computer in sich scrollt
    el.rolle = neu("div", "news-rolle");
    el.rolle.addEventListener("click", beimAntippen);

    container.appendChild(kopf);
    container.appendChild(el.filter);
    container.appendChild(el.rolle);
    zeichne();
  }

  /** Wird von home.js bei jedem Öffnen der Startseite aufgerufen. */
  function zeige() {
    if (!el.wurzel) return;
    if (!geladenUm || Date.now() - geladenUm > K.neuLadenNachMinuten * 60000) lade();
    else zeichne();                           // Zeitangaben auffrischen
  }

  /** Holt die Datei – immer frisch, ohne Zwischenspeicher. */
  function lade() {
    const nummer = ++abruf;
    geladenUm = Date.now();
    if (!stand) {
      zustand = "laedt";
      zeichne();
    }
    // Der Zusatz ?t=… umgeht auch Zwischenspeicher vor dem Server
    fetch(K.datei + "?t=" + geladenUm, { cache: "no-store" })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("HTTP " + antwort.status);
        return antwort.json();
      })
      .then(function (roh) {
        if (nummer !== abruf) return;
        const p = NewsDaten.pruefeDaten(roh);
        if (!p.ok) throw new Error("Format");
        stand = p;
        zustand = "bereit";
        zeichne();
      })
      .catch(function () {
        if (nummer !== abruf) return;
        stand = null;
        zustand = "fehler";
        zeichne();
      });
  }

  /* ---------- Zeichnen ---------- */

  function zeichne() {
    const jetzt = new Date();
    zeichneStand(jetzt);
    zeichneFilter();
    el.rolle.textContent = "";
    el.rolle.scrollTop = 0;
    el.wurzel.setAttribute("aria-busy", zustand === "laedt" ? "true" : "false");

    if (zustand === "laedt") return zeichneLaden();
    if (zustand === "fehler") return zeichneHinweis(
      "Die News konnten nicht geladen werden.",
      location.protocol === "file:"
        ? "Direkt aus einem Ordner geöffnet darf der Browser " + K.datei + " nicht lesen – über einen Webserver klappt es."
        : "Die Datei " + K.datei + " fehlt oder ist fehlerhaft.");

    const liste = stand.meldungen.filter(function (m) { return !filter || m.region === filter; });
    if (!stand.meldungen.length) return zeichneHinweis("Zurzeit gibt es keine Meldungen.");
    if (!liste.length) return zeichneHinweis("Zu „" + filter + "“ gibt es gerade keine Meldungen.");

    el.rolle.appendChild(baueTop(liste[0], jetzt));
    if (liste.length > 1) {
      const ol = neu("ol", "news-liste");
      ol.start = 2;
      liste.slice(1).forEach(function (m, i) {
        const li = document.createElement("li");
        li.appendChild(baueEintrag(m, i + 2, jetzt));
        ol.appendChild(li);
      });
      el.rolle.appendChild(ol);
    }
  }

  /** Kopfzeile rechts: "Stand: 09:45", dazu bei alten Dateien dezent "nicht aktuell". */
  function zeichneStand(jetzt) {
    el.stand.textContent = "";
    if (zustand !== "bereit") return;
    el.stand.appendChild(document.createTextNode("Stand: "));
    const zeit = neu("time", "", NewsDaten.standText(stand.aktualisiert, jetzt));
    if (stand.aktualisiert) zeit.dateTime = stand.aktualisiert.toISOString();
    el.stand.appendChild(zeit);
    if (NewsDaten.istVeraltet(stand.aktualisiert, jetzt)) {
      el.stand.appendChild(neu("span", "news-veraltet", "nicht aktuell"));
    }
  }

  /** Filterleiste: "Alle" und nur die Regionen, die in der Datei vorkommen. */
  function zeichneFilter() {
    el.filter.textContent = "";
    const regionen = zustand === "bereit" ? NewsDaten.regionenIn(stand.meldungen) : [];
    if (regionen.indexOf(filter) < 0) filter = "";       // Region nicht mehr dabei
    el.filter.hidden = regionen.length === 0;
    [""].concat(regionen).forEach(function (r) {
      const knopf = neu("button", "news-filter-knopf", r || "Alle");
      knopf.type = "button";
      knopf.dataset.region = r;
      knopf.setAttribute("aria-pressed", r === filter ? "true" : "false");
      el.filter.appendChild(knopf);
    });
  }

  /** Ladeanzeige: ruhige Platzhalterzeilen. */
  function zeichneLaden() {
    const kasten = neu("div", "news-platzhalter");
    kasten.appendChild(neu("span", "nur-screenreader", "News werden geladen …"));
    for (let i = 0; i < K.platzhalter; i++) {
      const zeile = neu("div", "news-platzhalter-zeile");
      zeile.setAttribute("aria-hidden", "true");
      zeile.appendChild(neu("span", "news-platzhalter-balken"));
      zeile.appendChild(neu("span", "news-platzhalter-balken ist-kurz"));
      kasten.appendChild(zeile);
    }
    el.rolle.appendChild(kasten);
  }

  /** Kurzer Hinweis (Fehler, keine Treffer). */
  function zeichneHinweis(satz, zusatz) {
    const p = neu("p", "news-hinweis", satz);
    p.setAttribute("role", "status");
    if (zusatz) p.appendChild(neu("span", "news-hinweis-zusatz", zusatz));
    el.rolle.appendChild(p);
  }

  /** Link zum Originalartikel in einem neuen Tab. */
  function artikelLink(m, klasse) {
    const a = neu("a", klasse);
    a.href = m.url;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  /** Schlagzeile mit kleinem Pfeil (erscheint beim Hovern: öffnet in neuem Tab). */
  function schlagzeile(tag, klasse, m) {
    const h = neu(tag, klasse, m.titel);
    const pfeil = neu("span", "news-pfeil", " ↗");
    pfeil.setAttribute("aria-hidden", "true");
    h.appendChild(pfeil);
    h.appendChild(neu("span", "nur-screenreader", " (öffnet in neuem Tab)"));
    return h;
  }

  /** Mehrere Angaben in einer Zeile; leere fallen weg. Trennpunkte setzt das CSS. */
  function angaben(klasse, teile) {
    const p = neu("p", klasse);
    teile.filter(Boolean).forEach(function (t) { p.appendChild(neu("span", "", t)); });
    return p;
  }

  function quellenText(m) {
    return m.anzahlQuellen >= 2 ? m.anzahlQuellen + " Quellen berichten" : "";
  }

  /** Die Topmeldung: Region und Quelle, große Schlagzeile, Zusammenfassung, Zeit. */
  function baueTop(m, jetzt) {
    const a = artikelLink(m, "news-top");
    a.appendChild(angaben("news-top-ueber", [m.region, m.quelle]));
    a.appendChild(schlagzeile("h3", "news-top-titel", m));
    a.appendChild(neu("p", "news-top-text", m.zusammenfassung));
    const unten = angaben("news-top-unter", [NewsDaten.relativeZeit(m.veroeffentlicht, jetzt), quellenText(m)]);
    if (unten.childNodes.length) a.appendChild(unten);
    return a;
  }

  /** Ein Eintrag der Liste: Nummer, Schlagzeile, Angaben, ausklappbare Zusammenfassung. */
  function baueEintrag(m, nummer, jetzt) {
    const a = artikelLink(m, "news-eintrag");
    const nr = neu("span", "news-nummer", (nummer < 10 ? "0" : "") + nummer);
    nr.setAttribute("aria-hidden", "true");
    const rechts = neu("div", "news-eintrag-inhalt");
    rechts.appendChild(schlagzeile("h3", "news-eintrag-titel", m));
    // Zusammenfassung: klappt beim Hovern, mit Fokus oder nach Antippen auf (css/news.css)
    const klappe = neu("div", "news-klappe");
    klappe.appendChild(neu("p", "news-eintrag-text", m.zusammenfassung));
    rechts.appendChild(klappe);
    rechts.appendChild(angaben("news-eintrag-unter",
      [m.quelle, m.region, NewsDaten.relativeZeit(m.veroeffentlicht, jetzt), quellenText(m)]));
    a.appendChild(nr);
    a.appendChild(rechts);
    return a;
  }

  /**
   * Ohne Maus (Smartphone, Tablet): Das erste Antippen klappt die
   * Zusammenfassung auf, das zweite öffnet den Artikel.
   */
  function beimAntippen(event) {
    const eintrag = event.target.closest(".news-eintrag");
    if (!eintrag || !ohneHover.matches || eintrag.classList.contains("ist-offen")) return;
    event.preventDefault();
    el.rolle.querySelectorAll(".news-eintrag.ist-offen").forEach(function (e) { e.classList.remove("ist-offen"); });
    eintrag.classList.add("ist-offen");
  }

  return {
    init: init,
    zeige: zeige,
    lade: lade,
  };
})();

if (typeof module !== "undefined") module.exports = { NewsDaten: NewsDaten, NEWS_KONFIG: NEWS_KONFIG };
