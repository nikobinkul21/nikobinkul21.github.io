/* ==========================================================================
   schedule.js – Stundenplan/Termine (Wochenansicht)
   Die Daten kommen ausschließlich aus js/events-store.js (EventsStore).
   Aussehen: css/schedule.css

   Adressen (URL-Hash):
     #schedule              → aktuelle Woche (Smartphone: heutiger Tag)
     #schedule/2026-12-24   → Woche, in der dieses Datum liegt (Smartphone: dieser Tag)
   ========================================================================== */

const StundenplanAnsicht = (function () {

  // Normaler Zeitbereich. Einträge davor oder danach erweitern ihn.
  const STANDARD_START = 7;     // 7:00 Uhr
  const STANDARD_ENDE = 22;     // 22:00 Uhr

  // Ein Klick ins Raster legt einen Eintrag zu dieser Zeit an – auf
  // halbe Stunden abgerundet und mit dieser Dauer (Minuten)
  const RASTER_MINUTEN = 30;
  const STANDARD_DAUER = 60;

  // Darunter wird nur ein Tag auf einmal gezeigt (wie in css/schedule.css)
  const EIN_TAG = window.matchMedia("(max-width: 599px)");

  const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const WOCHENTAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
    "August", "September", "Oktober", "November", "Dezember"];

  const zustand = {
    wocheStart: "",         // Montag der angezeigten Woche, "JJJJ-MM-TT"
    gewaehlterTag: 0,       // Smartphone: welcher Wochentag gezeigt wird (0 = Mo)
    bereich: { start: STANDARD_START, ende: STANDARD_ENDE }, // angezeigte Stunden
    gezeichnetAm: "",       // an welchem Tag zuletzt gezeichnet (für Mitternacht)
    bearbeiteId: null,      // id des Eintrags im Formular (null = neuer Eintrag)
  };

  const el = {};


  /* ==========================================================================
     DATUMS-HELFER
     ========================================================================== */

  const D = EventsStore;   // Kurzname für die Datums-Helfer aus dem Store

  function heute() {
    return D.datumText(new Date());
  }

  /** Montag der Woche, in der ein Datum liegt. */
  function montagVon(tag) {
    return D.plusTage(tag, -D.wochentag(tag));
  }

  /** "5.–11. Oktober 2026" / "28. September – 4. Oktober 2026" / über den Jahreswechsel. */
  function bereichText(von, bis) {
    const a = D.alsDatum(von);
    const b = D.alsDatum(bis);
    if (a.getFullYear() !== b.getFullYear()) {
      return a.getDate() + ". " + MONATE[a.getMonth()] + " " + a.getFullYear() +
        " – " + b.getDate() + ". " + MONATE[b.getMonth()] + " " + b.getFullYear();
    }
    if (a.getMonth() !== b.getMonth()) {
      return a.getDate() + ". " + MONATE[a.getMonth()] + " – " +
        b.getDate() + ". " + MONATE[b.getMonth()] + " " + b.getFullYear();
    }
    return a.getDate() + ".–" + b.getDate() + ". " + MONATE[b.getMonth()] + " " + b.getFullYear();
  }

  /** 630 → "10:30" */
  function alsZeit(minuten) {
    return String(Math.floor(minuten / 60)).padStart(2, "0") + ":" + String(minuten % 60).padStart(2, "0");
  }

  /** "10:00–11:30" oder "ganztägig" */
  function zeitText(eintrag) {
    return eintrag.ganztaegig ? "ganztägig" : eintrag.start + "–" + eintrag.ende;
  }

  function artName(id) {
    return EventsStore.ARTEN.find(function (a) { return a.id === id; }).name;
  }


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  /**
   * Baut die Ansicht auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="schedule-root">
   */
  function init(container) {
    container.innerHTML =
      '<div class="sp-kopf">' +
        '<div class="sp-navigation">' +
          '<button type="button" class="icon-button" data-aktion="zurueck" aria-label="Vorige Woche">‹</button>' +
          '<div class="sp-titel" aria-live="polite">' +
            '<span class="sp-kw"></span>' +
            '<span class="sp-zeitraum"></span>' +
          "</div>" +
          '<button type="button" class="icon-button" data-aktion="vor" aria-label="Nächste Woche">›</button>' +
          '<button type="button" class="sp-knopf" data-aktion="heute">Heute</button>' +
        "</div>" +
        '<button type="button" class="sp-knopf sp-knopf--haupt" data-aktion="neu">+ Neuer Eintrag</button>' +
      "</div>" +
      // Smartphone: Leiste zum Wechseln der Wochentage
      '<div class="sp-tagwahl" role="group" aria-label="Wochentag wählen"></div>' +
      '<div class="sp-woche"></div>' +
      baueDialogHtml();

    el.kw = container.querySelector(".sp-kw");
    el.zeitraum = container.querySelector(".sp-zeitraum");
    el.tagwahl = container.querySelector(".sp-tagwahl");
    el.woche = container.querySelector(".sp-woche");
    el.dialog = container.querySelector(".sp-dialog");
    el.formular = container.querySelector(".sp-formular");
    el.fehler = container.querySelector(".sp-fehler");

    container.querySelector(".sp-kopf").addEventListener("click", klickImKopf);
    el.tagwahl.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-tag]");
      if (knopf) waehleTag(Number(knopf.dataset.tag));
    });
    el.woche.addEventListener("click", klickInWoche);
    el.formular.addEventListener("submit", speichern);
    el.formular.addEventListener("change", passeFormularAn);
    el.formular.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      if (knopf.dataset.aktion === "abbrechen") el.dialog.close();
      if (knopf.dataset.aktion === "loeschen") loeschen();
    });

    // Jede halbe Minute: Zeitlinie weiterschieben – und nach Mitternacht
    // alles neu zeichnen (neuer "heute"-Tag)
    setInterval(aktualisiereJetzt, 30 * 1000);
  }

  /**
   * Wird von app.js bei JEDEM Öffnen aufgerufen.
   * @param {string} unterseite – "" (aktuelle Woche) oder ein Datum "JJJJ-MM-TT"
   */
  function zeige(unterseite) {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(unterseite) ? unterseite : heute();
    zustand.wocheStart = montagVon(tag);
    zustand.gewaehlterTag = D.wochentag(tag);
    zeichne();
    return null;
  }


  /* ==========================================================================
     ZEICHNEN
     ========================================================================== */

  function zeichne() {
    const von = zustand.wocheStart;
    const bis = D.plusTage(von, 6);
    const tage = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return D.plusTage(von, i); });
    const eintraege = EventsStore.eintraegeImZeitraum(von, bis);
    const heuteTag = heute();
    zustand.gezeichnetAm = heuteTag;

    // Kopf: "KW 41" und "5.–11. Oktober 2026"
    const kw = D.kalenderwoche(von);   // Kalenderwoche nach ISO 8601 (aus events-store.js)
    el.kw.textContent = "KW " + kw.kw;
    el.zeitraum.textContent = bereichText(von, bis);

    // Zeitbereich: Standard 7–22 Uhr, erweitert durch frühere/spätere Einträge
    let start = STANDARD_START * 60;
    let ende = STANDARD_ENDE * 60;
    Object.values(eintraege).flat().forEach(function (e) {
      if (e.ganztaegig) return;
      start = Math.min(start, D.inMinuten(e.start));
      ende = Math.max(ende, D.inMinuten(e.ende));
    });
    zustand.bereich = { start: Math.floor(start / 60), ende: Math.ceil(ende / 60) };
    const stunden = zustand.bereich.ende - zustand.bereich.start;
    el.woche.style.setProperty("--sp-stunden", stunden);

    // Smartphone-Leiste
    el.tagwahl.innerHTML = "";
    tage.forEach(function (tag, i) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "sp-tagwahl-knopf";
      knopf.dataset.tag = i;
      knopf.innerHTML = "<span></span><strong></strong>";
      knopf.firstChild.textContent = WOCHENTAGE_KURZ[i];
      knopf.lastChild.textContent = D.alsDatum(tag).getDate();
      knopf.setAttribute("aria-label", WOCHENTAGE_LANG[i] + ", " + datumKurz(tag));
      knopf.classList.toggle("ist-heute", tag === heuteTag);
      if (eintraege[tag]) knopf.classList.add("hat-eintraege");
      el.tagwahl.appendChild(knopf);
    });

    // Das Wochenraster: Kopfzeile, Ganztags-Zeile, Stunden
    el.woche.innerHTML = "";

    const kopfzeile = div("sp-zeile sp-kopfzeile");
    kopfzeile.appendChild(div("sp-ecke"));
    const ganztag = div("sp-zeile sp-ganztag-zeile");
    ganztag.appendChild(div("sp-ganztag-label", "ganztägig"));
    const koerper = div("sp-zeile sp-koerper");
    koerper.appendChild(baueZeitachse());

    tage.forEach(function (tag, i) {
      const istHeute = tag === heuteTag;
      const amTag = eintraege[tag] || [];

      // Kopf: "Mo" + "5.10."
      const kopf = div("sp-tagkopf");
      kopf.appendChild(div("sp-tagkopf-name", WOCHENTAGE_KURZ[i]));
      kopf.appendChild(div("sp-tagkopf-datum", datumKurz(tag)));
      kopfzeile.appendChild(markiere(kopf, i, tag, istHeute));

      // Ganztägige Einträge
      const zelle = div("sp-ganztag-zelle");
      amTag.filter(function (e) { return e.ganztaegig; }).forEach(function (e) {
        zelle.appendChild(baueBlock(e));
      });
      ganztag.appendChild(markiere(zelle, i, tag, istHeute));

      // Einträge mit Uhrzeit
      const spalte = div("sp-tagspalte");
      legeAus(amTag.filter(function (e) { return !e.ganztaegig; })).forEach(function (teil) {
        spalte.appendChild(baueBlock(teil.eintrag, teil));
      });
      if (istHeute) {
        const linie = div("sp-jetzt");
        linie.setAttribute("aria-hidden", "true");
        spalte.appendChild(linie);
      }
      koerper.appendChild(markiere(spalte, i, tag, istHeute));
    });

    el.woche.appendChild(kopfzeile);
    el.woche.appendChild(ganztag);
    el.woche.appendChild(koerper);

    waehleTag(zustand.gewaehlterTag);
    aktualisiereJetzt();
  }

  /** Gemeinsame Kennzeichen jeder Tageszelle: Datum, Wochentag-Nummer, heute. */
  function markiere(element, i, tag, istHeute) {
    element.dataset.tag = i;
    element.dataset.datum = tag;
    element.classList.toggle("ist-heute", istHeute);
    return element;
  }

  /** Linke Spalte mit den Uhrzeiten. */
  function baueZeitachse() {
    const achse = div("sp-zeitachse");
    achse.setAttribute("aria-hidden", "true");
    for (let h = zustand.bereich.start; h < zustand.bereich.ende; h++) {
      achse.appendChild(div("sp-stunde", String(h).padStart(2, "0") + ":00"));
    }
    return achse;
  }

  /**
   * Ordnet überlappende Einträge nebeneinander an.
   * Idee: Einträge, die sich (auch über Ecken) überschneiden, bilden eine
   * "Gruppe". In der Gruppe bekommt jeder die erste freie "Spur" (Spalte).
   * Alle in der Gruppe teilen sich die Breite durch die Anzahl der Spuren.
   * @returns {{eintrag, spur, spuren}[]}
   */
  function legeAus(eintraege) {
    const sortiert = eintraege.slice().sort(function (a, b) {
      return D.inMinuten(a.start) - D.inMinuten(b.start) || D.inMinuten(b.ende) - D.inMinuten(a.ende);
    });
    const ergebnis = [];
    let gruppe = [];
    let spurEnden = [];       // pro Spur: wann der letzte Eintrag darin endet
    let gruppeEnde = -1;

    function gruppeAbschliessen() {
      gruppe.forEach(function (teil) { teil.spuren = spurEnden.length; });
      gruppe = [];
      spurEnden = [];
    }

    sortiert.forEach(function (e) {
      const s = D.inMinuten(e.start);
      const en = D.inMinuten(e.ende);
      if (s >= gruppeEnde) {
        gruppeAbschliessen();          // keine Überschneidung → neue Gruppe
        gruppeEnde = en;
      }
      let spur = spurEnden.findIndex(function (ende) { return ende <= s; });
      if (spur === -1) {
        spur = spurEnden.length;
        spurEnden.push(en);
      } else {
        spurEnden[spur] = en;
      }
      gruppeEnde = Math.max(gruppeEnde, en);
      const teil = { eintrag: e, spur: spur, spuren: 1 };
      gruppe.push(teil);
      ergebnis.push(teil);
    });
    gruppeAbschliessen();
    return ergebnis;
  }

  /**
   * Ein Eintrag als Button-Block.
   * @param {object} lage – nur bei Einträgen mit Uhrzeit: { spur, spuren }
   */
  function baueBlock(e, lage) {
    const block = document.createElement("button");
    block.type = "button";
    block.className = "sp-eintrag art-" + e.art;
    block.dataset.id = e.id;

    block.appendChild(span("sp-eintrag-titel", (e.wiederholung === "woechentlich" ? "↻ " : "") + e.titel));
    if (!e.ganztaegig) block.appendChild(span("sp-eintrag-zeit", zeitText(e)));
    if (e.ort) block.appendChild(span("sp-eintrag-ort", e.ort));

    // Beschreibung für Screenreader
    block.setAttribute("aria-label",
      artName(e.art) + ": " + e.titel + ", " + WOCHENTAGE_LANG[D.wochentag(e.tag)] + " " + datumKurz(e.tag) +
      ", " + (e.ganztaegig ? "ganztägig" : e.start + " bis " + e.ende) +
      (e.ort ? ", " + e.ort : "") + (e.wiederholung === "woechentlich" ? ", wöchentlich" : ""));

    if (lage) {
      // Position und Höhe in Prozent der Spalte – aus Start- und Endzeit
      const gesamt = (zustand.bereich.ende - zustand.bereich.start) * 60;
      const oben = D.inMinuten(e.start) - zustand.bereich.start * 60;
      const dauer = D.inMinuten(e.ende) - D.inMinuten(e.start);
      block.style.top = (oben / gesamt * 100) + "%";
      block.style.height = (dauer / gesamt * 100) + "%";
      block.style.left = (lage.spur / lage.spuren * 100) + "%";
      block.style.width = (100 / lage.spuren) + "%";
      block.classList.toggle("ist-kurz", dauer < 45);
    }
    return block;
  }

  /** Die rote Linie für die aktuelle Uhrzeit (nur in der Spalte von heute). */
  function aktualisiereJetzt() {
    if (!el.woche || !el.woche.isConnected) return;
    if (zustand.gezeichnetAm && zustand.gezeichnetAm !== heute()) {
      zeichne();                       // Mitternacht ist vorbei → neu zeichnen
      return;
    }
    const linie = el.woche.querySelector(".sp-jetzt");
    if (!linie) return;
    const jetzt = new Date();
    const minuten = jetzt.getHours() * 60 + jetzt.getMinutes();
    const start = zustand.bereich.start * 60;
    const gesamt = (zustand.bereich.ende - zustand.bereich.start) * 60;
    const imBereich = minuten >= start && minuten <= start + gesamt;
    linie.hidden = !imBereich;
    linie.style.top = ((minuten - start) / gesamt * 100) + "%";
  }

  /** Smartphone: welcher Wochentag ist sichtbar? (Am Computer ohne Wirkung) */
  function waehleTag(i) {
    zustand.gewaehlterTag = i;
    el.woche.querySelectorAll("[data-tag]").forEach(function (zelle) {
      zelle.classList.toggle("ist-gewaehlt", Number(zelle.dataset.tag) === i);
    });
    el.tagwahl.querySelectorAll("[data-tag]").forEach(function (knopf) {
      knopf.setAttribute("aria-pressed", String(Number(knopf.dataset.tag) === i));
    });
  }


  /* ==========================================================================
     BEDIENUNG
     ========================================================================== */

  function klickImKopf(event) {
    const knopf = event.target.closest("[data-aktion]");
    if (!knopf) return;
    switch (knopf.dataset.aktion) {
      case "zurueck":
        zustand.wocheStart = D.plusTage(zustand.wocheStart, -7);
        zeichne();
        break;
      case "vor":
        zustand.wocheStart = D.plusTage(zustand.wocheStart, 7);
        zeichne();
        break;
      case "heute":
        zustand.wocheStart = montagVon(heute());
        zustand.gewaehlterTag = D.wochentag(heute());
        zeichne();
        break;
      case "neu": {
        // Vorschlag: der gerade gezeigte Tag (Smartphone) bzw. heute / Montag
        const tag = EIN_TAG.matches || !istInWoche(heute())
          ? D.plusTage(zustand.wocheStart, zustand.gewaehlterTag)
          : heute();
        oeffneFormular(null, { datum: tag, start: "10:00", ende: "11:00", ganztaegig: false });
        break;
      }
    }
  }

  function istInWoche(tag) {
    return tag >= zustand.wocheStart && tag <= D.plusTage(zustand.wocheStart, 6);
  }

  /** Klick ins Wochenraster: auf einen Eintrag oder eine freie Stelle. */
  function klickInWoche(event) {
    const block = event.target.closest(".sp-eintrag");
    if (block) {
      oeffneFormular(block.dataset.id);
      return;
    }

    // Freie Stelle in der Ganztags-Zeile → neuer ganztägiger Eintrag
    const zelle = event.target.closest(".sp-ganztag-zelle");
    if (zelle) {
      oeffneFormular(null, { datum: zelle.dataset.datum, ganztaegig: true, start: "10:00", ende: "11:00" });
      return;
    }

    // Freie Stelle in einer Tagesspalte → Uhrzeit aus der Klickhöhe berechnen
    const spalte = event.target.closest(".sp-tagspalte");
    if (spalte) {
      const rechteck = spalte.getBoundingClientRect();
      const anteil = (event.clientY - rechteck.top) / rechteck.height;
      const gesamt = (zustand.bereich.ende - zustand.bereich.start) * 60;
      let start = zustand.bereich.start * 60 + anteil * gesamt;
      start = Math.floor(start / RASTER_MINUTEN) * RASTER_MINUTEN;   // auf halbe Stunden abrunden
      start = Math.min(start, 23 * 60);
      const ende = Math.min(start + STANDARD_DAUER, 23 * 60 + 59);
      oeffneFormular(null, { datum: spalte.dataset.datum, start: alsZeit(start), ende: alsZeit(ende), ganztaegig: false });
    }
  }


  /* ==========================================================================
     FORMULAR (Dialog)
     ========================================================================== */

  function baueDialogHtml() {
    let arten = "";
    EventsStore.ARTEN.forEach(function (a, i) {
      arten +=
        '<label class="sp-art-wahl art-' + a.id + '">' +
          '<input type="radio" name="art" value="' + a.id + '"' + (i === 0 ? " checked" : "") + "> " + a.name +
        "</label>";
    });
    let wiederholungen = "";
    EventsStore.WIEDERHOLUNGEN.forEach(function (w) {
      wiederholungen += '<option value="' + w.id + '">' + w.name + "</option>";
    });

    // <dialog> ist ein eingebautes Fenster: Escape schließt es, der Rest
    // der Seite ist solange gesperrt
    return (
      '<dialog class="sp-dialog" aria-labelledby="sp-dialog-titel">' +
        '<form class="sp-formular" novalidate>' +
          '<h2 id="sp-dialog-titel" class="sp-dialog-titel">Neuer Eintrag</h2>' +
          '<p class="sp-serien-hinweis" hidden>↻ Wöchentliche Serie: Änderungen und Löschen gelten für alle Termine der Serie.</p>' +
          '<label class="sp-feld">Titel <input type="text" name="titel" autocomplete="off"></label>' +
          '<fieldset class="sp-feld sp-arten"><legend>Art</legend>' + arten + "</fieldset>" +
          '<label class="sp-feld">Datum <input type="date" name="datum"></label>' +
          '<label class="sp-haken"><input type="checkbox" name="ganztaegig"> Ganztägig</label>' +
          '<div class="sp-zeiten">' +
            '<label class="sp-feld">Beginn <input type="time" name="start" step="300"></label>' +
            '<label class="sp-feld">Ende <input type="time" name="ende" step="300"></label>' +
          "</div>" +
          '<label class="sp-feld">Ort/Raum <span class="sp-optional">(optional)</span> <input type="text" name="ort" autocomplete="off"></label>' +
          '<label class="sp-feld">Notiz <span class="sp-optional">(optional)</span> <textarea name="notiz" rows="2"></textarea></label>' +
          '<label class="sp-feld">Wiederholung <select name="wiederholung">' + wiederholungen + "</select></label>" +
          '<label class="sp-feld sp-bis">Wiederholen bis <span class="sp-optional">(optional)</span> <input type="date" name="wiederholungBis"></label>' +
          '<p class="sp-fehler" role="alert"></p>' +
          '<div class="sp-dialog-knoepfe">' +
            '<button type="button" class="sp-knopf sp-knopf--gefahr" data-aktion="loeschen">Löschen</button>' +
            '<span class="sp-platzhalter"></span>' +
            '<button type="button" class="sp-knopf" data-aktion="abbrechen">Abbrechen</button>' +
            '<button type="submit" class="sp-knopf sp-knopf--haupt">Speichern</button>' +
          "</div>" +
        "</form>" +
      "</dialog>"
    );
  }

  /**
   * Öffnet das Formular.
   * @param {string|null} id – vorhandener Eintrag (bzw. Serie) oder null für neu
   * @param {object} vorgabe – bei neuen Einträgen: vorausgefüllte Werte
   */
  function oeffneFormular(id, vorgabe) {
    const f = el.formular.elements;
    const eintrag = id ? EventsStore.hole(id) : null;
    const werte = eintrag || Object.assign({
      titel: "", art: "termin", ort: "", notiz: "", wiederholung: "keine", wiederholungBis: "",
    }, vorgabe);

    zustand.bearbeiteId = eintrag ? eintrag.id : null;
    el.formular.querySelector(".sp-dialog-titel").textContent = eintrag ? "Eintrag bearbeiten" : "Neuer Eintrag";
    el.formular.querySelector(".sp-serien-hinweis").hidden = !(eintrag && eintrag.wiederholung === "woechentlich");
    el.formular.querySelector('[data-aktion="loeschen"]').hidden = !eintrag;

    f.titel.value = werte.titel;
    f.art.value = werte.art;
    f.datum.value = werte.datum;
    f.ganztaegig.checked = werte.ganztaegig;
    f.start.value = werte.start || "10:00";
    f.ende.value = werte.ende || "11:00";
    f.ort.value = werte.ort;
    f.notiz.value = werte.notiz;
    f.wiederholung.value = werte.wiederholung;
    f.wiederholungBis.value = werte.wiederholungBis;

    zeigeFehler(null);
    passeFormularAn();
    el.dialog.showModal();
    f.titel.focus();
  }

  /** Zeit- und Bis-Felder nur zeigen, wenn sie gebraucht werden. */
  function passeFormularAn() {
    const f = el.formular.elements;
    el.formular.querySelector(".sp-zeiten").hidden = f.ganztaegig.checked;
    el.formular.querySelector(".sp-bis").hidden = f.wiederholung.value !== "woechentlich";
  }

  /** Liest alle Felder des Formulars aus. */
  function formularWerte() {
    const f = el.formular.elements;
    return {
      titel: f.titel.value,
      art: f.art.value,
      datum: f.datum.value,
      ganztaegig: f.ganztaegig.checked,
      start: f.start.value,
      ende: f.ende.value,
      ort: f.ort.value,
      notiz: f.notiz.value,
      wiederholung: f.wiederholung.value,
      wiederholungBis: f.wiederholungBis.value,
    };
  }

  function speichern(event) {
    event.preventDefault();
    const werte = formularWerte();
    const ergebnis = zustand.bearbeiteId
      ? EventsStore.aendern(zustand.bearbeiteId, werte)
      : EventsStore.hinzufuegen(werte);

    if (!ergebnis.ok) {
      zeigeFehler(ergebnis);
      return;
    }
    el.dialog.close();
    // Zur Woche des Eintrags springen, damit man ihn gleich sieht
    if (!istInWoche(ergebnis.eintrag.datum) && ergebnis.eintrag.wiederholung === "keine") {
      zustand.wocheStart = montagVon(ergebnis.eintrag.datum);
      zustand.gewaehlterTag = D.wochentag(ergebnis.eintrag.datum);
    }
    zeichne();
  }

  function loeschen() {
    const eintrag = EventsStore.hole(zustand.bearbeiteId);
    if (!eintrag) return;
    const frage = eintrag.wiederholung === "woechentlich"
      ? "Die ganze wöchentliche Serie „" + eintrag.titel + "“ löschen?"
      : "„" + eintrag.titel + "“ löschen?";
    if (!window.confirm(frage)) return;
    EventsStore.loeschen(eintrag.id);
    el.dialog.close();
    zeichne();
  }

  /** Zeigt eine Fehlermeldung im Formular und markiert das betroffene Feld. */
  function zeigeFehler(ergebnis) {
    el.formular.querySelectorAll("[aria-invalid]").forEach(function (feld) {
      feld.removeAttribute("aria-invalid");
    });
    el.fehler.textContent = ergebnis ? ergebnis.fehler : "";
    if (ergebnis && ergebnis.feld) {
      const feld = el.formular.elements[ergebnis.feld];
      if (feld && feld.focus) {
        feld.setAttribute("aria-invalid", "true");
        feld.focus();
      }
    }
  }


  /* ==========================================================================
     KLEINE HELFER
     ========================================================================== */

  function div(klasse, text) {
    const d = document.createElement("div");
    d.className = klasse;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  function span(klasse, text) {
    const s = document.createElement("span");
    s.className = klasse;
    s.textContent = text;
    return s;
  }

  /** "2026-10-05" → "5.10." */
  function datumKurz(tag) {
    const d = D.alsDatum(tag);
    return d.getDate() + "." + (d.getMonth() + 1) + ".";
  }


  return {
    init: init,
    zeige: zeige,
  };
})();
