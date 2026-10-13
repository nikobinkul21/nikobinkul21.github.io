/* ==========================================================================
   todo-store.js – Speicherung für "Zu erledigen"
   ALLE Lese- und Schreibzugriffe auf die Aufgaben laufen über diese Datei
   (localStorage). Soll die Speicherung später woanders hin, muss nur
   diese Datei geändert werden.

   So sieht eine Aufgabe aus:
   {
     id:           "lq3x9a…"            eindeutige Kennung
     titel:        "Software Engineering"   Pflicht
     beschreibung: "Blatt 3 abgeben"    optional ("" = keine)
     faelligkeit:  { art: "abgabe", datum: "2026-10-20", zeit: "14:00" }
                   { art: "woechentlich", wochentag: 4, zeit: "" }
                   – zeit optional ("" = 23:59), wochentag 0 = Montag … 6 = Sonntag
     erledigt:     false
     erledigtAm:   "2026-10-13T09:12:00.000Z" oder null
     erstellt:     "2026-10-12T18:00:00.000Z"
   }

   Wöchentliche Aufgaben gelten nur für die laufende Woche als erledigt:
   Beim Laden (und regelmäßig, siehe todo.js) setzt wochenwechsel() jede
   wöchentliche Aufgabe, die VOR dem letzten Montag 0 Uhr erledigt wurde,
   wieder auf "Noch offen" – auch wenn die Seite dazwischen geschlossen war.
   ========================================================================== */

const TodoStore = (function () {

  const SPEICHER_SCHLUESSEL = "ntb-todo";
  const VERSION = 1;

  const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];


  /* ------------------------------------------------------------------------
     HELFER
     ------------------------------------------------------------------------ */

  function istDatum(text) {
    if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const t = text.split("-").map(Number);
    const d = new Date(t[0], t[1] - 1, t[2]);
    return d.getFullYear() === t[0] && d.getMonth() === t[1] - 1 && d.getDate() === t[2];
  }

  function istZeit(text) {
    return typeof text === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
  }

  function istZeitpunkt(text) {
    return typeof text === "string" && !isNaN(new Date(text).getTime());
  }

  /** Montag 0 Uhr der Woche, in der "jetzt" liegt (Ortszeit). */
  function wochenStart(jetzt) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function neueId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }


  /* ------------------------------------------------------------------------
     LADEN UND SPEICHERN
     ------------------------------------------------------------------------ */

  function leereDaten() {
    return { version: VERSION, aufgaben: [] };
  }

  function laden() {
    let roh = null;
    try {
      roh = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL));
    } catch (fehler) {
      return leereDaten();             // gesperrt oder kaputt – mit leerer Liste weiter
    }
    const geprueft = pruefeDaten(roh);
    return geprueft.ok ? geprueft.daten : leereDaten();
  }

  function speichern(daten) {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
      return true;
    } catch (fehler) {
      return false;                    // z. B. privater Modus – die Änderung gilt dann nur bis zum Neuladen
    }
  }


  /* ------------------------------------------------------------------------
     PRÜFEN
     ------------------------------------------------------------------------ */

  /**
   * Prüft eine Aufgabe aus dem Formular (oder aus einer Sicherung).
   * @returns {{ok: true, aufgabe} | {ok: false, fehler, feld}}
   *          feld: welches Formularfeld den Fehler hat
   */
  function pruefeAufgabe(roh) {
    if (!roh || typeof roh !== "object") return { ok: false, fehler: "Ungültige Aufgabe.", feld: "titel" };
    const titel = typeof roh.titel === "string" ? roh.titel.trim() : "";
    if (!titel) return { ok: false, fehler: "Bitte einen Titel eingeben.", feld: "titel" };
    const f = roh.faelligkeit;
    if (!f || (f.art !== "abgabe" && f.art !== "woechentlich")) {
      return { ok: false, fehler: "Bitte eine Fälligkeit wählen: Abgabe oder wöchentlich.", feld: "art" };
    }
    const zeit = typeof f.zeit === "string" ? f.zeit : "";
    if (zeit && !istZeit(zeit)) return { ok: false, fehler: "Die Uhrzeit ist ungültig.", feld: "zeit" };
    let faelligkeit;
    if (f.art === "abgabe") {
      if (!istDatum(f.datum)) return { ok: false, fehler: "Bitte ein Abgabedatum wählen.", feld: "datum" };
      faelligkeit = { art: "abgabe", datum: f.datum, zeit: zeit };
    } else {
      const tag = Number(f.wochentag);
      if (!Number.isInteger(tag) || tag < 0 || tag > 6 || f.wochentag === "" || f.wochentag === null) {
        return { ok: false, fehler: "Bitte einen Wochentag wählen.", feld: "wochentag" };
      }
      faelligkeit = { art: "woechentlich", wochentag: tag, zeit: zeit };
    }
    return {
      ok: true,
      aufgabe: {
        titel: titel,
        beschreibung: typeof roh.beschreibung === "string" ? roh.beschreibung.trim() : "",
        faelligkeit: faelligkeit,
      },
    };
  }

  /**
   * Prüft die gesamten Daten (localStorage oder Sicherungsdatei).
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || !Array.isArray(roh.aufgaben)) {
      return { ok: false, fehler: "Keine gültigen Aufgaben-Daten." };
    }
    if (roh.version !== VERSION) {
      return { ok: false, fehler: "Unbekannte Version der Aufgaben-Daten (" + roh.version + ")." };
    }
    const daten = leereDaten();
    for (let i = 0; i < roh.aufgaben.length; i++) {
      const a = roh.aufgaben[i];
      const ergebnis = pruefeAufgabe(a);
      if (!ergebnis.ok) {
        return { ok: false, fehler: "Aufgabe " + (i + 1) + ": " + ergebnis.fehler };
      }
      daten.aufgaben.push(Object.assign(ergebnis.aufgabe, {
        id: typeof a.id === "string" && a.id ? a.id : neueId(),
        erledigt: a.erledigt === true,
        erledigtAm: a.erledigt === true && istZeitpunkt(a.erledigtAm) ? a.erledigtAm : (a.erledigt === true ? new Date().toISOString() : null),
        erstellt: istZeitpunkt(a.erstellt) ? a.erstellt : new Date().toISOString(),
      }));
    }
    return { ok: true, daten: daten };
  }


  /* ------------------------------------------------------------------------
     LESEN UND ÄNDERN
     ------------------------------------------------------------------------ */

  /** Alle Aufgaben (Kopien). Vorher werden wöchentliche Aufgaben ggf. zurückgesetzt. */
  function alle(jetzt) {
    wochenwechsel(jetzt);
    return laden().aufgaben.map(function (a) { return JSON.parse(JSON.stringify(a)); });
  }

  function hole(id) {
    const a = laden().aufgaben.find(function (x) { return x.id === id; });
    return a ? JSON.parse(JSON.stringify(a)) : null;
  }

  /** Neue Aufgabe. @returns {{ok, aufgabe} | {ok: false, fehler, feld}} */
  function hinzufuegen(roh, jetzt) {
    const ergebnis = pruefeAufgabe(roh);
    if (!ergebnis.ok) return ergebnis;
    const daten = laden();
    const aufgabe = Object.assign(ergebnis.aufgabe, {
      id: neueId(), erledigt: false, erledigtAm: null, erstellt: (jetzt || new Date()).toISOString(),
    });
    daten.aufgaben.push(aufgabe);
    speichern(daten);
    return { ok: true, aufgabe: aufgabe };
  }

  /** Titel, Beschreibung und Fälligkeit ändern (der Erledigt-Zustand bleibt). */
  function aendern(id, roh) {
    const ergebnis = pruefeAufgabe(roh);
    if (!ergebnis.ok) return ergebnis;
    const daten = laden();
    const a = daten.aufgaben.find(function (x) { return x.id === id; });
    if (!a) return { ok: false, fehler: "Aufgabe nicht gefunden.", feld: "titel" };
    Object.assign(a, ergebnis.aufgabe);
    speichern(daten);
    return { ok: true, aufgabe: a };
  }

  function loeschen(id) {
    const daten = laden();
    const vorher = daten.aufgaben.length;
    daten.aufgaben = daten.aufgaben.filter(function (x) { return x.id !== id; });
    speichern(daten);
    return daten.aufgaben.length < vorher;
  }

  /** "Erledigt" (true) oder "Noch offen" (false). */
  function setzeErledigt(id, erledigt, jetzt) {
    const daten = laden();
    const a = daten.aufgaben.find(function (x) { return x.id === id; });
    if (!a) return false;
    a.erledigt = Boolean(erledigt);
    a.erledigtAm = a.erledigt ? (jetzt || new Date()).toISOString() : null;
    speichern(daten);
    return true;
  }

  /**
   * "Erledigte leeren": löscht alle erledigten EINMALIGEN Aufgaben.
   * Wöchentliche bleiben – sie kommen am Montag von selbst zurück.
   * @returns {number} Anzahl der gelöschten Aufgaben
   */
  function erledigteLeeren() {
    const daten = laden();
    const vorher = daten.aufgaben.length;
    daten.aufgaben = daten.aufgaben.filter(function (a) { return !(a.erledigt && a.faelligkeit.art === "abgabe"); });
    speichern(daten);
    return vorher - daten.aufgaben.length;
  }

  /**
   * Montag 0 Uhr: wöchentliche Aufgaben, die vor Beginn der laufenden Woche
   * erledigt wurden, sind wieder offen. Funktioniert auch nach Tagen ohne
   * geöffnete Seite, denn es zählt nur der Zeitpunkt "erledigtAm".
   * @returns {number} wie viele Aufgaben zurückgesetzt wurden
   */
  function wochenwechsel(jetzt) {
    const grenze = wochenStart(jetzt || new Date()).getTime();
    const daten = laden();
    let anzahl = 0;
    daten.aufgaben.forEach(function (a) {
      if (a.faelligkeit.art === "woechentlich" && a.erledigt && new Date(a.erledigtAm).getTime() < grenze) {
        a.erledigt = false;
        a.erledigtAm = null;
        anzahl++;
      }
    });
    if (anzahl > 0) speichern(daten);
    return anzahl;
  }


  /* ------------------------------------------------------------------------
     DATENSICHERUNG (Einstellungen)
     ------------------------------------------------------------------------ */

  /** Alle Daten für die Sicherungsdatei. */
  function alsObjekt() {
    return laden();
  }

  /** Daten aus einer (geprüften) Sicherung übernehmen. */
  function ersetzen(daten) {
    speichern(daten);
  }


  return {
    WOCHENTAGE: WOCHENTAGE,
    alle: alle,
    hole: hole,
    hinzufuegen: hinzufuegen,
    aendern: aendern,
    loeschen: loeschen,
    setzeErledigt: setzeErledigt,
    erledigteLeeren: erledigteLeeren,
    wochenwechsel: wochenwechsel,
    wochenStart: wochenStart,
    pruefeAufgabe: pruefeAufgabe,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = TodoStore;
}
