/* ==========================================================================
   events-store.js – Speicherung für Stundenplan und Termine
   ALLE Lese- und Schreibzugriffe auf die Einträge laufen über diese Datei.
   Stundenplan (schedule.js) und Kalender (calendar.js) benutzen beide
   diesen Store. Soll die Speicherung später woanders hin, muss nur diese
   Datei geändert werden.

   So sieht ein Eintrag aus:
   {
     id:               "lq3x9a…"        eindeutige Kennung
     titel:            "Mathe I"        Pflicht
     art:              "vorlesung"      "termin" oder "vorlesung"
     datum:            "2026-10-12"     erster (bzw. einziger) Tag
     ganztaegig:       false
     start:            "10:00"          nur wenn nicht ganztägig
     ende:             "11:30"          nur wenn nicht ganztägig
     ort:              "HS 1"           optional ("" = keiner)
     notiz:            ""               optional
     wiederholung:     "woechentlich"   "keine" oder "woechentlich"
     wiederholungBis:  "2027-02-05"     optional, letzter möglicher Tag der Serie
   }

   Alle Datumsangaben sind Texte im Format "JJJJ-MM-TT", Uhrzeiten "HH:MM".
   ========================================================================== */

const EventsStore = (function () {

  const SPEICHER_SCHLUESSEL = "ntb-termine";
  const VERSION = 1;

  // Die Arten von Einträgen. Neue Art? Hier ergänzen und in schedule.css
  // eine Farbe dafür festlegen (Klasse .art-<id>).
  const ARTEN = [
    { id: "termin", name: "Termin" },
    { id: "vorlesung", name: "Vorlesung" },
  ];

  const WIEDERHOLUNGEN = [
    { id: "keine", name: "Keine" },
    { id: "woechentlich", name: "Wöchentlich" },
  ];


  /* ------------------------------------------------------------------------
     DATUMS-HELFER (werden auch von schedule.js und calendar.js benutzt)
     ------------------------------------------------------------------------ */

  /** Date-Objekt → "JJJJ-MM-TT" (in Ortszeit). */
  function datumText(datum) {
    return datum.getFullYear() + "-" +
      String(datum.getMonth() + 1).padStart(2, "0") + "-" +
      String(datum.getDate()).padStart(2, "0");
  }

  /** "JJJJ-MM-TT" → Date-Objekt (Mitternacht, Ortszeit). */
  function alsDatum(text) {
    const teile = text.split("-").map(Number);
    return new Date(teile[0], teile[1] - 1, teile[2]);
  }

  /** Verschiebt ein "JJJJ-MM-TT" um n Tage. */
  function plusTage(text, n) {
    const d = alsDatum(text);
    d.setDate(d.getDate() + n);
    return datumText(d);
  }

  /** Wochentag eines Datums: 0 = Montag … 6 = Sonntag. */
  function wochentag(text) {
    return (alsDatum(text).getDay() + 6) % 7;
  }

  /**
   * Kalenderwoche nach ISO 8601 (wie in Deutschland üblich):
   * Woche 1 ist die Woche mit dem ersten Donnerstag des Jahres.
   * @param {string} text – irgendein Tag der Woche, "JJJJ-MM-TT"
   * @returns {{kw: number, jahr: number}} – jahr = Jahr, zu dem die Woche zählt
   */
  function kalenderwoche(text) {
    const montag = plusTage(text, -wochentag(text));
    const donnerstag = alsDatum(plusTage(montag, 3));
    const jahr = donnerstag.getFullYear();
    const vierterJanuar = jahr + "-01-04";                   // liegt immer in Woche 1
    const montagWoche1 = alsDatum(plusTage(vierterJanuar, -wochentag(vierterJanuar)));
    const wochen = Math.round((alsDatum(montag) - montagWoche1) / (7 * 24 * 60 * 60 * 1000));
    return { kw: wochen + 1, jahr: jahr };
  }

  /** "10:30" → 630 (Minuten seit Mitternacht). */
  function inMinuten(zeit) {
    const teile = zeit.split(":").map(Number);
    return teile[0] * 60 + teile[1];
  }

  /** Ist das ein echtes Datum im Format JJJJ-MM-TT (z. B. kein 31. Februar)? */
  function istDatum(text) {
    if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    return datumText(alsDatum(text)) === text;
  }

  /** Ist das eine Uhrzeit im Format HH:MM? */
  function istZeit(text) {
    return typeof text === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
  }


  /* ------------------------------------------------------------------------
     LADEN / SPEICHERN
     ------------------------------------------------------------------------ */

  function leereDaten() {
    return { version: VERSION, eintraege: [] };
  }

  function laden() {
    try {
      const text = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (text) {
        const geprueft = pruefeDaten(JSON.parse(text));
        if (geprueft.ok) return geprueft.daten;
      }
    } catch (fehler) {
      // kaputte Daten oder kein Zugriff → leer weitermachen
    }
    return leereDaten();
  }

  function speichern(daten) {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    } catch (fehler) {
      // Speichern nicht möglich (z. B. privater Modus)
    }
  }

  function neueId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }


  /* ------------------------------------------------------------------------
     PRÜFEN
     ------------------------------------------------------------------------ */

  /**
   * Prüft einen Eintrag und bringt ihn in eine saubere Form.
   * @returns {{ok: true, eintrag} | {ok: false, fehler: string, feld: string}}
   *   feld = welches Eingabefeld schuld ist (für die Markierung im Formular)
   */
  function pruefeEintrag(roh) {
    if (!roh || typeof roh !== "object") {
      return { ok: false, fehler: "Ungültiger Eintrag.", feld: "titel" };
    }
    const titel = typeof roh.titel === "string" ? roh.titel.trim() : "";
    if (titel === "") {
      return { ok: false, fehler: "Bitte einen Titel eingeben.", feld: "titel" };
    }
    if (!ARTEN.some(function (a) { return a.id === roh.art; })) {
      return { ok: false, fehler: "Bitte eine Art wählen.", feld: "art" };
    }
    if (!istDatum(roh.datum)) {
      return { ok: false, fehler: "Bitte ein gültiges Datum wählen.", feld: "datum" };
    }
    const ganztaegig = roh.ganztaegig === true;
    if (!ganztaegig) {
      if (!istZeit(roh.start)) {
        return { ok: false, fehler: "Bitte eine Startzeit eingeben.", feld: "start" };
      }
      if (!istZeit(roh.ende)) {
        return { ok: false, fehler: "Bitte eine Endzeit eingeben.", feld: "ende" };
      }
      if (inMinuten(roh.ende) <= inMinuten(roh.start)) {
        return { ok: false, fehler: "Die Endzeit muss nach der Startzeit liegen.", feld: "ende" };
      }
    }
    const wiederholung = roh.wiederholung === "woechentlich" ? "woechentlich" : "keine";
    const bis = wiederholung === "woechentlich" && roh.wiederholungBis ? roh.wiederholungBis : "";
    if (bis !== "" && !istDatum(bis)) {
      return { ok: false, fehler: "Das Enddatum der Wiederholung ist ungültig.", feld: "wiederholungBis" };
    }
    if (bis !== "" && bis < roh.datum) {
      return { ok: false, fehler: "Das Enddatum der Wiederholung liegt vor dem Startdatum.", feld: "wiederholungBis" };
    }

    return {
      ok: true,
      eintrag: {
        id: typeof roh.id === "string" && roh.id ? roh.id : neueId(),
        titel: titel,
        art: roh.art,
        datum: roh.datum,
        ganztaegig: ganztaegig,
        start: ganztaegig ? "" : roh.start,
        ende: ganztaegig ? "" : roh.ende,
        ort: typeof roh.ort === "string" ? roh.ort.trim() : "",
        notiz: typeof roh.notiz === "string" ? roh.notiz.trim() : "",
        wiederholung: wiederholung,
        wiederholungBis: bis,
      },
    };
  }

  /** Prüft komplette Daten (beim Laden und beim Import). */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || !Array.isArray(roh.eintraege)) {
      return { ok: false, fehler: "Keine gültigen Termin-Daten." };
    }
    if (roh.version !== VERSION) {
      return { ok: false, fehler: "Unbekannte Version der Termin-Daten (" + roh.version + ")." };
    }
    const daten = leereDaten();
    for (const roherEintrag of roh.eintraege) {
      const ergebnis = pruefeEintrag(roherEintrag);
      if (!ergebnis.ok) {
        const name = roherEintrag && roherEintrag.titel ? "„" + roherEintrag.titel + "“: " : "";
        return { ok: false, fehler: "Termin " + name + ergebnis.fehler };
      }
      daten.eintraege.push(ergebnis.eintrag);
    }
    return { ok: true, daten: daten };
  }


  /* ------------------------------------------------------------------------
     ABFRAGEN
     ------------------------------------------------------------------------ */

  /** Findet statt an diesem Tag (einmalig oder als Teil einer Serie)? */
  function findetStattAm(eintrag, tag) {
    if (eintrag.wiederholung === "keine") {
      return eintrag.datum === tag;
    }
    // Wöchentlich: ab dem Startdatum, bis zum Enddatum, gleicher Wochentag
    return eintrag.datum <= tag &&
      (eintrag.wiederholungBis === "" || tag <= eintrag.wiederholungBis) &&
      wochentag(eintrag.datum) === wochentag(tag);
  }

  /** Sortierung innerhalb eines Tages: ganztägig zuerst, dann nach Startzeit. */
  function nachZeit(a, b) {
    if (a.ganztaegig !== b.ganztaegig) return a.ganztaegig ? -1 : 1;
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.titel.localeCompare(b.titel, "de");
  }

  /**
   * Alle Einträge in einem Zeitraum, nach Tagen sortiert.
   * Wöchentliche Serien werden dabei in die einzelnen Tage "aufgelöst".
   * @param {string} von – erster Tag "JJJJ-MM-TT"
   * @param {string} bis – letzter Tag (einschließlich)
   * @returns {Object<string, object[]>} z. B. { "2026-10-12": [eintrag, …], … }
   *   Jeder Eintrag ist eine Kopie mit zusätzlichem Feld "tag" (das Datum dieses Vorkommens).
   */
  function eintraegeImZeitraum(von, bis) {
    const alle = laden().eintraege;
    const ergebnis = {};
    for (let tag = von; tag <= bis; tag = plusTage(tag, 1)) {
      const amTag = alle
        .filter(function (e) { return findetStattAm(e, tag); })
        .map(function (e) { return Object.assign({ tag: tag }, e); })
        .sort(nachZeit);
      if (amTag.length > 0) {
        ergebnis[tag] = amTag;
      }
    }
    return ergebnis;
  }

  /** Einträge eines einzelnen Tages (sortiert). */
  function eintraegeAm(tag) {
    return eintraegeImZeitraum(tag, tag)[tag] || [];
  }

  /** Einen Eintrag (bzw. eine Serie) über seine id holen – als Kopie. */
  function hole(id) {
    const eintrag = laden().eintraege.find(function (e) { return e.id === id; });
    return eintrag ? Object.assign({}, eintrag) : null;
  }


  /* ------------------------------------------------------------------------
     ÄNDERN
     Alle geben zurück: { ok: true, eintrag } oder { ok: false, fehler, feld }
     Bei Serien wirkt Ändern und Löschen immer auf die GANZE Serie.
     ------------------------------------------------------------------------ */

  function hinzufuegen(roh) {
    const ergebnis = pruefeEintrag(Object.assign({}, roh, { id: "" }));
    if (!ergebnis.ok) return ergebnis;
    const daten = laden();
    daten.eintraege.push(ergebnis.eintrag);
    speichern(daten);
    return ergebnis;
  }

  function aendern(id, roh) {
    const daten = laden();
    const position = daten.eintraege.findIndex(function (e) { return e.id === id; });
    if (position === -1) return { ok: false, fehler: "Eintrag nicht gefunden.", feld: "titel" };
    const ergebnis = pruefeEintrag(Object.assign({}, roh, { id: id }));
    if (!ergebnis.ok) return ergebnis;
    daten.eintraege[position] = ergebnis.eintrag;
    speichern(daten);
    return ergebnis;
  }

  function loeschen(id) {
    const daten = laden();
    const vorher = daten.eintraege.length;
    daten.eintraege = daten.eintraege.filter(function (e) { return e.id !== id; });
    speichern(daten);
    return { ok: daten.eintraege.length < vorher };
  }


  /* ------------------------------------------------------------------------
     SICHERUNG (wird von settings.js benutzt)
     ------------------------------------------------------------------------ */

  /** Alle Daten als Objekt (für die Gesamtsicherung). */
  function alsObjekt() {
    return laden();
  }

  /** Ersetzt alle Einträge durch geprüfte Daten. */
  function ersetzen(gepruefteDaten) {
    speichern(gepruefteDaten);
  }


  return {
    ARTEN: ARTEN,
    WIEDERHOLUNGEN: WIEDERHOLUNGEN,
    // Datums-Helfer
    datumText: datumText,
    alsDatum: alsDatum,
    plusTage: plusTage,
    wochentag: wochentag,
    kalenderwoche: kalenderwoche,
    inMinuten: inMinuten,
    // Abfragen
    eintraegeImZeitraum: eintraegeImZeitraum,
    eintraegeAm: eintraegeAm,
    hole: hole,
    // Ändern
    hinzufuegen: hinzufuegen,
    aendern: aendern,
    loeschen: loeschen,
    // Sicherung
    alsObjekt: alsObjekt,
    pruefeDaten: pruefeDaten,
    ersetzen: ersetzen,
  };
})();

// Damit der Store auch außerhalb des Browsers getestet werden kann (Node.js)
if (typeof module !== "undefined") {
  module.exports = EventsStore;
}
