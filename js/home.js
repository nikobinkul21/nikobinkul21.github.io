/* ==========================================================================
   home.js – die Startseite
   Schlicht und ruhig: oben links klein Datum und Uhrzeit, darunter die
   Zeile "Als Nächstes" (laufende oder nächste Vorlesung bzw. nächster
   Termin – Daten aus EventsStore.naechstesVorkommen). Darunter zwei
   Spalten: links der News-Feed (js/news.js), rechts ein Raster aus gleich
   großen Karten für alle Abschnitte. Ganz unten die Schnellzugriffe.
   Auf dem Computer passt die Startseite ohne Scrollen auf den Bildschirm.
   Aussehen: css/home.css und css/news.css, Farben: css/style.css.
   ========================================================================== */

const STARTSEITE_KONFIG = {
  // Optionaler Name für die Begrüßung (nur für Screenreader), z. B. "Niko"
  name: "",

  // Die Abschnitte als Karten, Reihenfolge = Anzeige.
  // symbol = Schlüssel in SYMBOLE (weiter unten)
  karten: [
    { id: "kalender", href: "#kalender", name: "Kalender", symbol: "kalender" },
    { id: "stundenplan", href: "#schedule", name: "Stundenplan/Termine", symbol: "uhr" },
    { id: "todo", href: "#todo", name: "Zu erledigen", symbol: "haken" },
    { id: "pinnwand", href: "#pinnwand", name: "Pinnwand", symbol: "pinnwand" },
    { id: "prompts", href: "#prompts", name: "Prompts", symbol: "text" },
    { id: "projekte", href: "#projects", name: "Projekte/Ideen", symbol: "idee" },
    { id: "games", href: "#games", name: "Games", symbol: "wuerfel" },
  ],

  // Schnellzugriffe unten: Name und Adresse, Reihenfolge = Anzeige.
  schnellzugriffe: [
    { name: "Claude", url: "https://claude.ai" },
    { name: "Gemini", url: "https://gemini.google.com" },
    { name: "Moodle", url: "https://moodle.hm.edu/my/index.php" },
    { name: "ZPA", url: "https://zpa.cs.hm.edu/student/dashboard/" },
  ],

  // "Als Nächstes": so viele Tage im Voraus wird gesucht
  anstehend: { tage: 7 },

};


const StartseiteAnsicht = (function () {
  const K = STARTSEITE_KONFIG;

  const WOCHENTAGE = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

  // Schlichte Liniensymbole (24 × 24, Strichfarbe = Textfarbe)
  const SYMBOLE = {
    kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    haken: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
    uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    text: '<path d="M5 6.5h14M5 11h14M5 15.5h9"/><path d="M17 14v6"/>',
    wuerfel: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/>',
    pinnwand: '<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/><path d="M11 7.5c4 0 6 1.5 6 5.5"/>',
    idee: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z"/>',
  };

  const el = {};
  let taktTimer = null;            // weckt die Anzeige zur nächsten vollen Minute


  /* ---------- Aufbau ---------- */

  /**
   * Baut die Startseite auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="home-root">
   */
  function init(container) {
    container.innerHTML =
      '<div class="home">' +
        '<div class="home-kopf">' +
          '<p class="home-zeit"><time></time></p>' +
          '<a class="home-anstehend" href="#schedule"></a>' +
        "</div>" +
        '<div class="home-mitte">' +
          '<section class="news home-news"></section>' +
          '<nav class="home-raster" aria-label="Bereiche"></nav>' +
        "</div>" +
        '<nav class="home-links" aria-label="Schnellzugriffe"><ul class="home-links-liste"></ul></nav>' +
      "</div>";

    el.gruss = document.getElementById("titel-home");
    el.zeit = container.querySelector(".home-zeit time");
    el.anstehend = container.querySelector(".home-anstehend");
    el.raster = container.querySelector(".home-raster");
    // Die Überschrift (h1 aus index.html) bleibt für Screenreader im Kopf.
    // Sie behält ihre ID: app.js setzt Fokus und Seitentitel darüber.
    container.querySelector(".home-kopf").prepend(el.gruss);

    K.karten.forEach(function (k) {
      const link = document.createElement("a");
      link.className = "home-karte";
      link.href = k.href;
      link.dataset.karte = k.id;
      link.innerHTML =
        '<svg class="home-karte-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SYMBOLE[k.symbol] + "</svg>" +
        '<span class="home-karte-titel"></span>';
      setzeName(link.querySelector(".home-karte-titel"), k.name);
      el.raster.appendChild(link);
    });

    baueSchnellzugriffe(container.querySelector(".home-links-liste"));
    NewsFeed.init(container.querySelector(".home-news"));

    // Zurück im Tab: sofort aktualisieren (Zeitgeber laufen im Hintergrund oft verzögert)
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !document.getElementById("view-home").hidden) takt();
    });
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


  /* ---------- Öffnen und Aktualisieren ---------- */

  /** Wird von app.js bei JEDEM Öffnen der Startseite aufgerufen. */
  function zeige() {
    takt();
    NewsFeed.zeige();               // lädt die News neu, wenn der letzte Abruf länger her ist
    return null;
  }

  /**
   * Datum, Uhrzeit und "Als Nächstes" neu zeichnen und sich zur nächsten
   * vollen Minute wieder wecken. Beginn und Ende von Einträgen liegen immer
   * auf vollen Minuten – so springt die Anzeige genau dann auf den neuen
   * Stand. Ist die Startseite nicht mehr zu sehen, schläft der Zeitgeber ein.
   */
  function takt() {
    clearTimeout(taktTimer);
    if (document.getElementById("view-home").hidden) return;
    const jetzt = new Date();
    zeichneZeit(jetzt);
    zeichneAnstehend(jetzt);
    const bisMinute = 60000 - (jetzt.getSeconds() * 1000 + jetzt.getMilliseconds());
    taktTimer = setTimeout(takt, bisMinute + 20);
  }

  function zeichneZeit(jetzt) {
    jetzt = jetzt || new Date();
    const zwei = function (n) { return String(n).padStart(2, "0"); };
    el.gruss.textContent = begruessung(jetzt);
    el.zeit.textContent = WOCHENTAGE[jetzt.getDay()] + " " + zwei(jetzt.getDate()) + "." + zwei(jetzt.getMonth() + 1) + "." +
      jetzt.getFullYear() + "  ·  " + zwei(jetzt.getHours()) + ":" + zwei(jetzt.getMinutes());
    el.zeit.dateTime = jetzt.getFullYear() + "-" + zwei(jetzt.getMonth() + 1) + "-" + zwei(jetzt.getDate()) +
      "T" + zwei(jetzt.getHours()) + ":" + zwei(jetzt.getMinutes());
  }

  /* ---------- Als Nächstes ---------- */

  const TAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const zwei = function (n) { return String(n).padStart(2, "0"); };
  const uhrzeit = function (d) { return zwei(d.getHours()) + ":" + zwei(d.getMinutes()); };

  /** "in 45 Min", "in 2 Std 5 Min" bis zum Beginn. */
  function countdown(beginn, jetzt) {
    const min = Math.ceil((beginn - jetzt) / 60000);
    if (min < 60) return "in " + min + " Min";
    const std = Math.floor(min / 60), rest = min % 60;
    return "in " + std + " Std" + (rest ? " " + rest + " Min" : "");
  }

  /**
   * Wann? Heute: "14:00 · in 45 Min" (Countdown nur mit mitCountdown) bzw.
   * "Heute ganztägig"; morgen: "Morgen 08:15"; sonst "Do 14:00" bzw.
   * mit Datum "Do 12.11. ganztägig".
   */
  function wannText(v, jetzt, mitCountdown) {
    const heute = EventsStore.datumText(jetzt);
    const morgen = EventsStore.plusTage(heute, 1);
    const d = EventsStore.alsDatum(v.tag);
    if (v.ganztaegig) {
      if (v.tag === heute) return "Heute ganztägig";
      if (v.tag === morgen) return "Morgen ganztägig";
      return TAGE_KURZ[d.getDay()] + " " + zwei(d.getDate()) + "." + zwei(d.getMonth() + 1) + ". ganztägig";
    }
    if (v.tag === heute) return uhrzeit(v.beginn) + (mitCountdown ? " · " + countdown(v.beginn, jetzt) : "");
    if (v.tag === morgen) return "Morgen " + uhrzeit(v.beginn);
    return TAGE_KURZ[d.getDay()] + " " + uhrzeit(v.beginn);
  }

  function span(klasse, text) {
    const s = document.createElement("span");
    s.className = klasse;
    if (text !== undefined) s.textContent = text;
    return s;
  }

  /** Etikett für die Art: Vorlesung oder Termin (auf dem Smartphone abgekürzt). */
  function etikett(v) {
    const vorlesung = v.art === "vorlesung";
    const e = span("home-an-art" + (vorlesung ? " ist-vorlesung" : ""));
    e.appendChild(span("home-an-art-lang", vorlesung ? "Vorlesung" : "Termin"));
    e.appendChild(span("home-an-art-kurz", vorlesung ? "VL" : "Ter"));
    return e;
  }

  /** Eine Zeile: Etikett, Status, Titel (wird gekürzt), Raum und Zeit (bleiben immer sichtbar). */
  function zeile(klasse, v, status, wann) {
    const z = span("home-an-zeile " + klasse);
    if (v) z.appendChild(etikett(v));
    if (status) z.appendChild(span("home-an-status", status));
    if (v) z.appendChild(span("home-an-titel", v.titel));
    if (v && v.ort) z.appendChild(span("home-an-raum", v.ort));
    if (wann) z.appendChild(span("home-an-wann", wann));
    return z;
  }

  /**
   * "JETZT · Mathe I · HS 1 · bis 11:30", darunter klein der nächste Eintrag –
   * oder "ALS NÄCHSTES · Programmierung · R 204 · 14:00 · in 45 Min".
   * Klick öffnet den Stundenplan in der Woche des Eintrags.
   */
  function zeichneAnstehend(jetzt) {
    const r = EventsStore.naechstesVorkommen(jetzt, K.anstehend.tage);
    const a = el.anstehend;
    a.textContent = "";
    a.classList.toggle("ist-leer", !r.laeuft && !r.naechstes);
    if (!r.laeuft && !r.naechstes) {
      a.href = "#schedule";
      a.appendChild(zeile("", null, "Keine Termine in den nächsten " + K.anstehend.tage + " Tagen", ""));
      a.setAttribute("aria-label", "Keine Termine in den nächsten " + K.anstehend.tage + " Tagen. Stundenplan öffnen");
      return;
    }
    const v = r.laeuft || r.naechstes;
    const art = function (x) { return x.art === "vorlesung" ? "Vorlesung" : "Termin"; };
    const raum = function (x) { return x.ort ? ", Raum " + x.ort : ""; };
    a.href = "#schedule/" + v.tag;
    let vorlesen;
    if (r.laeuft) {
      a.appendChild(zeile("", v, "Jetzt", "bis " + uhrzeit(v.schluss)));
      vorlesen = "Jetzt: " + art(v) + " " + v.titel + raum(v) + ", bis " + uhrzeit(v.schluss) + ".";
      if (r.danach) {
        const w = wannText(r.danach, jetzt, false);
        a.appendChild(zeile("home-an-danach", r.danach, "Danach", w));
        vorlesen += " Danach: " + r.danach.titel + raum(r.danach) + ", " + w + ".";
      }
    } else {
      const w = wannText(v, jetzt, true);
      a.appendChild(zeile("", v, "Als Nächstes", w));
      vorlesen = "Als Nächstes: " + art(v) + " " + v.titel + raum(v) + ", " + w + ".";
    }
    a.setAttribute("aria-label", vorlesen + " Stundenplan dieser Woche öffnen");
  }

  /** "Guten Morgen" (5–10 Uhr), "Guten Tag" (11–17 Uhr), "Guten Abend" (sonst). */
  function begruessung(jetzt) {
    const stunde = jetzt.getHours();
    let gruss = "Guten Abend";
    if (stunde >= 5 && stunde < 11) gruss = "Guten Morgen";
    else if (stunde >= 11 && stunde < 18) gruss = "Guten Tag";
    return K.name ? gruss + ", " + K.name : gruss;
  }

  return {
    init: init,
    zeige: zeige,
  };
})();
