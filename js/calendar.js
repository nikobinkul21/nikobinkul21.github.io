/* ==========================================================================
   calendar.js – Kalender mit Jahresübersicht
   Zeigt zwölf Monate eines Jahres. Vergangene Tage sind rot, der heutige
   Tag hat einen grünen Glas-Effekt (Aussehen: css/calendar.css).

   Jeder Tag ist ein eigenes Element mit seinem Datum, z. B.
     <div class="kalender-tag" data-datum="2026-10-10">…</div>

   Verbindung zum Stundenplan (Daten aus js/events-store.js):
     - Tage mit einem Eintrag der Art "Termin" bekommen einen blauen
       Glas-Kreis (Klasse "hat-termin"). Vorlesungen werden hier nicht
       markiert – sonst wäre fast jeder Tag blau.
     - Hover, Tastaturfokus oder Antippen eines markierten Tages zeigt ein
       kleines Glas-Panel mit den Einträgen des Tages.
     - Ein Klick auf einen Tag öffnet den Stundenplan mit dieser Woche.
   ========================================================================== */

const KalenderAnsicht = (function () {

  const MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  // Die Woche beginnt am Montag
  const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const WOCHENTAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  // Ab dieser Breite stehen mehrere Monate nebeneinander. Darunter (Smartphone)
  // steht ein Monat pro Zeile – dann wird zum aktuellen Monat gescrollt.
  // Muss zur Grenze in css/calendar.css passen.
  const EINSPALTIG = window.matchMedia("(max-width: 599px)");

  let angezeigtesJahr = new Date().getFullYear();
  let mitternachtTimer = null;

  // Einträge des angezeigten Jahres: { "2026-10-12": [eintrag, …], … }
  let eintraegeImJahr = {};

  // Vorschau-Panel: für welchen Tag es gerade offen ist, und ob per Antippen
  let vorschauFuer = null;
  let letzteZeigerArt = "mouse";        // "mouse", "touch" oder "pen"

  // Elemente (werden in init gefüllt)
  const el = {};


  /* ------------------------------------------------------------------------
     DATUMS-HELFER
     Alle Berechnungen nutzen das eingebaute Date-Objekt von JavaScript.
     Das kennt Schaltjahre und Wochentage für jedes Jahr.
     Achtung: Bei Date zählen Monate ab 0 (0 = Januar, 11 = Dezember).
     ------------------------------------------------------------------------ */

  /** Wie viele Tage hat der Monat? (Tag 0 des Folgemonats = letzter Tag dieses Monats) */
  function tageImMonat(jahr, monat) {
    return new Date(jahr, monat + 1, 0).getDate();
  }

  /**
   * Auf welchen Wochentag fällt der 1. des Monats?
   * Ergebnis: 0 = Montag … 6 = Sonntag.
   * (getDay() liefert 0 = Sonntag … 6 = Samstag – "+ 6) % 7" verschiebt
   *  das so, dass die Woche am Montag beginnt.)
   */
  function ersterWochentag(jahr, monat) {
    return (new Date(jahr, monat, 1).getDay() + 6) % 7;
  }

  /** Datum als Text "JJJJ-MM-TT", z. B. "2026-03-07". */
  function datumText(jahr, monat, tag) {
    return jahr + "-" + String(monat + 1).padStart(2, "0") + "-" + String(tag).padStart(2, "0");
  }

  /** Das heutige Datum als "JJJJ-MM-TT" (nach der Uhr des Geräts). */
  function heuteText() {
    const jetzt = new Date();
    return datumText(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  }


  /* ------------------------------------------------------------------------
     AUFBAU
     ------------------------------------------------------------------------ */

  /**
   * Baut den Kalender auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="calendar-root">
   */
  function init(container) {
    container.innerHTML =
      '<div class="kalender-kopf">' +
        '<button type="button" class="icon-button kalender-pfeil" data-aktion="zurueck" aria-label="Voriges Jahr">‹</button>' +
        // aria-live: Screenreader sagen die neue Jahreszahl beim Blättern an
        '<h2 class="kalender-jahreszahl" aria-live="polite"></h2>' +
        '<button type="button" class="icon-button kalender-pfeil" data-aktion="vor" aria-label="Nächstes Jahr">›</button>' +
        '<button type="button" class="kalender-heute-knopf" data-aktion="heute">Heute</button>' +
      "</div>" +
      '<div class="kalender-jahr"></div>';

    el.jahreszahl = container.querySelector(".kalender-jahreszahl");
    el.jahr = container.querySelector(".kalender-jahr");

    container.querySelector(".kalender-kopf").addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      if (knopf.dataset.aktion === "zurueck") zeigeJahr(angezeigtesJahr - 1);
      if (knopf.dataset.aktion === "vor") zeigeJahr(angezeigtesJahr + 1);
      if (knopf.dataset.aktion === "heute") {
        zeigeJahr(new Date().getFullYear());
        zumAktuellenMonatScrollen();
      }
    });

    // Das Vorschau-Panel hängt direkt am <body>, damit es über allem liegt
    el.vorschau = document.createElement("div");
    el.vorschau.className = "kalender-vorschau";
    el.vorschau.id = "kalender-vorschau";
    el.vorschau.setAttribute("role", "tooltip");
    el.vorschau.hidden = true;
    document.body.appendChild(el.vorschau);

    richteTagEreignisseEin();

    zeigeJahr(angezeigtesJahr);
    mitternachtPlanen();

    // War der Tab lange im Hintergrund (oder der Computer im Ruhezustand),
    // beim Zurückkommen die Markierungen sicherheitshalber prüfen
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        markiereTage();
        mitternachtPlanen();
      }
    });
  }

  /**
   * Wird von app.js bei JEDEM Öffnen der Kalender-Ansicht aufgerufen.
   * Auf dem Smartphone wird zum aktuellen Monat gescrollt.
   */
  function zeige() {
    markiereTage();                 // Einträge könnten sich inzwischen geändert haben
    zumAktuellenMonatScrollen();
    return null;                    // Fokus wie üblich auf die Überschrift "Kalender"
  }

  /** Zeichnet alle zwölf Monate eines Jahres. */
  function zeigeJahr(jahr) {
    angezeigtesJahr = jahr;
    el.jahreszahl.textContent = jahr;
    el.jahr.innerHTML = "";
    for (let monat = 0; monat < 12; monat++) {
      el.jahr.appendChild(baueMonat(jahr, monat));
    }
    markiereTage();
  }

  /** Baut das Raster für einen Monat. */
  function baueMonat(jahr, monat) {
    const bereich = document.createElement("section");
    bereich.className = "kalender-monat";
    bereich.dataset.monat = datumText(jahr, monat, 1).slice(0, 7);   // z. B. "2026-03"

    const titel = document.createElement("h3");
    titel.className = "kalender-monatsname";
    titel.textContent = MONATE[monat];
    bereich.appendChild(titel);

    const raster = document.createElement("div");
    raster.className = "kalender-raster";

    // Kopfzeile: Mo Di Mi Do Fr Sa So
    WOCHENTAGE_KURZ.forEach(function (kurz, i) {
      const kopf = document.createElement("abbr");
      kopf.className = "kalender-wochentag";
      kopf.title = WOCHENTAGE_LANG[i];
      kopf.textContent = kurz;
      raster.appendChild(kopf);
    });

    // Leere Felder vor dem 1., damit er unter dem richtigen Wochentag steht
    const versatz = ersterWochentag(jahr, monat);
    for (let i = 0; i < versatz; i++) {
      const leer = document.createElement("div");
      leer.className = "kalender-leer";
      raster.appendChild(leer);
    }

    // Die Tage
    const anzahl = tageImMonat(jahr, monat);
    for (let tag = 1; tag <= anzahl; tag++) {
      const feld = document.createElement("div");
      feld.className = "kalender-tag";
      feld.dataset.datum = datumText(jahr, monat, tag);
      // Für Screenreader das volle Datum, z. B. "10. Oktober 2026"
      feld.setAttribute("aria-label", vollesDatum(feld.dataset.datum));

      const zahl = document.createElement("span");
      zahl.className = "kalender-zahl";
      zahl.textContent = tag;
      zahl.setAttribute("aria-hidden", "true");   // steht schon im aria-label
      feld.appendChild(zahl);

      raster.appendChild(feld);
    }

    bereich.appendChild(raster);
    return bereich;
  }


  /* ------------------------------------------------------------------------
     MARKIERUNGEN: vergangen / heute
     ------------------------------------------------------------------------ */

  /**
   * Färbt alle Tage passend zum heutigen Datum.
   * Trick: Datumstexte im Format "JJJJ-MM-TT" lassen sich wie Wörter
   * vergleichen – "2026-03-07" < "2026-10-10" stimmt auch alphabetisch.
   * Damit sind in vergangenen Jahren automatisch alle Tage rot und in
   * zukünftigen keiner.
   */
  function markiereTage() {
    if (!el.jahr) return;
    const heute = heuteText();
    eintraegeImJahr = EventsStore.eintraegeImZeitraum(angezeigtesJahr + "-01-01", angezeigtesJahr + "-12-31");

    el.jahr.querySelectorAll(".kalender-tag").forEach(function (feld) {
      const datum = feld.dataset.datum;
      const amTag = eintraegeImJahr[datum] || [];
      const hatTermin = amTag.some(function (e) { return e.art === "termin"; });

      feld.classList.toggle("ist-vergangen", datum < heute);
      feld.classList.toggle("ist-heute", datum === heute);
      feld.classList.toggle("hat-termin", hatTermin);
      if (datum === heute) {
        feld.setAttribute("aria-current", "date");
      } else {
        feld.removeAttribute("aria-current");
      }

      // Per Tastatur erreichbar: Tage mit Termin und heute
      if (hatTermin || datum === heute) {
        feld.tabIndex = 0;
      } else {
        feld.removeAttribute("tabindex");
      }
      feld.setAttribute("aria-label", vollesDatum(datum) +
        (hatTermin ? ", " + amTag.length + (amTag.length === 1 ? " Eintrag" : " Einträge") : ""));
      if (hatTermin) {
        feld.setAttribute("aria-describedby", "kalender-vorschau");
      } else {
        feld.removeAttribute("aria-describedby");
      }
    });
  }

  /**
   * Stellt einen Wecker auf kurz nach Mitternacht. Dann werden die
   * Markierungen neu gesetzt und der Wecker für die nächste Nacht gestellt.
   * So stimmt der Kalender auch, wenn die Seite über Nacht offen bleibt.
   */
  function mitternachtPlanen() {
    clearTimeout(mitternachtTimer);
    const jetzt = new Date();
    const naechsteMitternacht = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1);
    const wartezeit = naechsteMitternacht - jetzt + 1000;   // 1 Sekunde Puffer
    mitternachtTimer = setTimeout(function () {
      markiereTage();
      mitternachtPlanen();
    }, wartezeit);
  }


  /** "2026-10-10" → "Samstag, 10. Oktober 2026" */
  function vollesDatum(text) {
    const d = EventsStore.alsDatum(text);
    return WOCHENTAGE_LANG[(d.getDay() + 6) % 7] + ", " + d.getDate() + ". " + MONATE[d.getMonth()] + " " + d.getFullYear();
  }


  /* ------------------------------------------------------------------------
     TAGE ANKLICKEN UND VORSCHAU-PANEL
     ------------------------------------------------------------------------ */

  function richteTagEreignisseEin() {
    // Merken, ob mit Maus oder Finger geklickt wird
    el.jahr.addEventListener("pointerdown", function (event) {
      letzteZeigerArt = event.pointerType;
    });

    // Maus: Panel beim Darüberfahren zeigen, beim Verlassen verstecken
    el.jahr.addEventListener("mouseover", function (event) {
      const feld = event.target.closest(".kalender-tag.hat-termin");
      if (feld && feld !== vorschauFuer) zeigeVorschau(feld, false);
    });
    el.jahr.addEventListener("mouseout", function (event) {
      const feld = event.target.closest(".kalender-tag");
      if (feld && feld === vorschauFuer && !feld.contains(event.relatedTarget) &&
          !el.vorschau.classList.contains("ist-angetippt")) {
        versteckeVorschau();
      }
    });

    // Tastatur: Panel bei Fokus zeigen
    el.jahr.addEventListener("focusin", function (event) {
      const feld = event.target.closest(".kalender-tag.hat-termin");
      if (feld) zeigeVorschau(feld, false);
    });
    el.jahr.addEventListener("focusout", function (event) {
      if (!el.vorschau.contains(event.relatedTarget)) versteckeVorschau();
    });

    // Klick / Antippen
    el.jahr.addEventListener("click", function (event) {
      const feld = event.target.closest(".kalender-tag");
      if (!feld) return;
      // Smartphone: erstes Antippen eines markierten Tages zeigt nur das Panel
      // (Hovern gibt es dort nicht). Im Panel geht es dann weiter zum Stundenplan.
      if (letzteZeigerArt === "touch" && feld.classList.contains("hat-termin") &&
          !(vorschauFuer === feld && el.vorschau.classList.contains("ist-angetippt"))) {
        zeigeVorschau(feld, true);
        return;
      }
      oeffneStundenplan(feld.dataset.datum);
    });

    // Enter oder Leertaste auf einem Tag (Tastatur) = Klick
    el.jahr.addEventListener("keydown", function (event) {
      const feld = event.target.closest(".kalender-tag");
      if (feld && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        oeffneStundenplan(feld.dataset.datum);
      }
    });

    // Panel schließen: Escape, Antippen daneben, Scrollen, Ansicht wechseln
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") versteckeVorschau();
    });
    document.addEventListener("click", function (event) {
      if (vorschauFuer && !el.vorschau.contains(event.target) && !event.target.closest(".kalender-tag.hat-termin")) {
        versteckeVorschau();
      }
    });
    window.addEventListener("scroll", versteckeVorschau, { passive: true });
    window.addEventListener("resize", versteckeVorschau);
    window.addEventListener("hashchange", versteckeVorschau);
  }

  function oeffneStundenplan(datum) {
    versteckeVorschau();
    window.location.hash = "#schedule/" + datum;
  }

  /**
   * Zeigt das Panel mit den Einträgen eines Tages neben dem Tag.
   * @param {boolean} angetippt – true: per Finger geöffnet (Panel ist dann
   *                              anklickbar und enthält einen Link)
   */
  function zeigeVorschau(feld, angetippt) {
    const datum = feld.dataset.datum;
    const eintraege = eintraegeImJahr[datum] || [];
    const panel = el.vorschau;
    panel.innerHTML = "";

    const kopf = document.createElement("div");
    kopf.className = "kalender-vorschau-datum";
    kopf.textContent = vollesDatum(datum);
    panel.appendChild(kopf);

    const liste = document.createElement("ul");
    liste.className = "kalender-vorschau-liste";
    eintraege.forEach(function (e) {
      const li = document.createElement("li");
      li.className = "kalender-vorschau-eintrag art-" + e.art;
      // Texte immer per textContent – nie als HTML einsetzen
      zeile(li, "kalender-vorschau-titel", e.titel);
      zeile(li, "kalender-vorschau-zeit",
        (e.ganztaegig ? "ganztägig" : e.start + "–" + e.ende) +
        (e.art === "vorlesung" ? " · Vorlesung" : ""));
      if (e.ort) zeile(li, "kalender-vorschau-ort", "📍 " + e.ort);
      if (e.notiz) zeile(li, "kalender-vorschau-notiz", e.notiz);
      liste.appendChild(li);
    });
    panel.appendChild(liste);

    if (angetippt) {
      const link = document.createElement("a");
      link.className = "kalender-vorschau-link";
      link.href = "#schedule/" + datum;
      link.textContent = "Im Stundenplan öffnen →";
      panel.appendChild(link);
    }

    panel.classList.toggle("ist-angetippt", angetippt);
    panel.hidden = false;
    vorschauFuer = feld;
    positioniereVorschau(feld);
  }

  function zeile(eltern, klasse, text) {
    const div = document.createElement("div");
    div.className = klasse;
    div.textContent = text;
    eltern.appendChild(div);
  }

  /**
   * Setzt das Panel unter (oder, wenn dort kein Platz ist, über) den Tag –
   * und schiebt es so, dass es nie aus dem Bildschirm ragt.
   */
  function positioniereVorschau(feld) {
    const panel = el.vorschau;
    const rand = 8;                                   // Mindestabstand zum Bildschirmrand
    const tag = feld.getBoundingClientRect();
    const breite = panel.offsetWidth;
    const hoehe = panel.offsetHeight;

    let links = tag.left + tag.width / 2 - breite / 2;  // mittig unter dem Tag
    links = Math.max(rand, Math.min(links, window.innerWidth - breite - rand));

    let oben = tag.bottom + rand;                        // bevorzugt darunter …
    if (oben + hoehe > window.innerHeight - rand) {
      oben = tag.top - hoehe - rand;                     // … sonst darüber
    }
    oben = Math.max(rand, Math.min(oben, window.innerHeight - hoehe - rand));

    panel.style.left = links + "px";
    panel.style.top = oben + "px";
  }

  function versteckeVorschau() {
    if (!vorschauFuer) return;
    el.vorschau.hidden = true;
    el.vorschau.classList.remove("ist-angetippt");
    vorschauFuer = null;
  }


  /* ------------------------------------------------------------------------
     SCROLLEN (nur Smartphone)
     ------------------------------------------------------------------------ */

  /** Scrollt zum aktuellen Monat – nur wenn ein Monat pro Zeile steht. */
  function zumAktuellenMonatScrollen() {
    if (!EINSPALTIG.matches || angezeigtesJahr !== new Date().getFullYear()) {
      return;
    }
    const monat = el.jahr.querySelector('[data-monat="' + heuteText().slice(0, 7) + '"]');
    // requestAnimationFrame: erst scrollen, nachdem app.js den Fokus auf
    // die Überschrift gesetzt hat (das würde sonst wieder nach oben springen)
    requestAnimationFrame(function () {
      monat.scrollIntoView({ block: "start" });
    });
  }


  return {
    init: init,
    zeige: zeige,
  };
})();
