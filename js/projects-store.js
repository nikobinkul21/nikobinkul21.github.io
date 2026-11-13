/* ==========================================================================
   projects-store.js – Speicher für "Projekte/Ideen" (localStorage "ntb-projekte")
   ALLE Lese- und Schreibzugriffe laufen über diese Datei; die Darstellung
   (js/projects.js) greift nie selbst auf localStorage zu. Teil der
   Datensicherung (js/settings.js: alsObjekt, pruefeDaten, ersetzen).

   So sieht ein Projekt aus:
   {
     id:        "p1a2b3…"                  eindeutige Kennung
     titel:     "Lernplan-App"             Pflicht
     idee:      "Eine App, die …"          optional, mehrzeilig
     erstellt:  "2026-11-09T18:20:00.000Z" Zeitpunkt des Anlegens (ISO)
     geaendert: "2026-11-09T18:25:00.000Z" letzte Änderung (ISO)
     schritte:  []                         künftige Dokumentationsschritte –
                                           vorerst leer; neue Felder pro
                                           Schritt lassen sich später ohne
                                           Umbau ergänzen
   }
   Läuft auch in Node (für Tests).
   ========================================================================== */

const ProjekteStore = (function () {
  const SCHLUESSEL = "ntb-projekte";
  const VERSION = 1;
  const GRENZEN = { titel: 200, idee: 10000, projekte: 2000 };

  function leereDaten() {
    return { version: VERSION, projekte: [] };
  }

  const istZeitpunkt = function (t) { return typeof t === "string" && !isNaN(Date.parse(t)); };

  /** Prüft ein Projekt aus Speicher oder Sicherung. @returns {object|null} */
  function pruefeProjekt(roh) {
    if (!roh || typeof roh !== "object" || typeof roh.id !== "string" || !roh.id || roh.id.length > 64) return null;
    const titel = typeof roh.titel === "string" ? roh.titel.trim().slice(0, GRENZEN.titel) : "";
    if (!titel || !istZeitpunkt(roh.erstellt)) return null;
    return {
      id: roh.id,
      titel: titel,
      idee: typeof roh.idee === "string" ? roh.idee.slice(0, GRENZEN.idee) : "",
      erstellt: roh.erstellt,
      geaendert: istZeitpunkt(roh.geaendert) ? roh.geaendert : roh.erstellt,
      // Schritte: vorerst nur Objekte übernehmen – ihr Aufbau kommt mit der Dokumentation
      schritte: Array.isArray(roh.schritte) ? roh.schritte.filter(function (s) { return s && typeof s === "object"; }) : [],
    };
  }

  /** Prüft komplette Daten (beim Laden und beim Import). */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION || !Array.isArray(roh.projekte)) {
      return { ok: false, fehler: "Keine gültigen Daten für Projekte/Ideen." };
    }
    if (roh.projekte.length > GRENZEN.projekte) return { ok: false, fehler: "Zu viele Projekte." };
    const daten = leereDaten();
    const ids = new Set();
    for (const p of roh.projekte) {
      const g = pruefeProjekt(p);
      if (!g || ids.has(g.id)) return { ok: false, fehler: "Ein Projekt ist beschädigt." };
      ids.add(g.id);
      daten.projekte.push(g);
    }
    return { ok: true, daten: daten };
  }

  function laden() {
    try {
      const text = localStorage.getItem(SCHLUESSEL);
      if (text) {
        const p = pruefeDaten(JSON.parse(text));
        if (p.ok) return p.daten;
      }
    } catch (fehler) {
      // kaputte Daten oder kein Zugriff → leer weitermachen
    }
    return leereDaten();
  }

  function speichern(daten) {
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
      return true;
    } catch (fehler) {
      return false;
    }
  }

  function neueId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Alle Projekte, neueste oben (nach dem Anlegen sortiert). */
  function liste() {
    // Gleich alt (selbe Millisekunde): das später angelegte zuerst
    return laden().projekte.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      return a.p.erstellt < b.p.erstellt ? 1 : a.p.erstellt > b.p.erstellt ? -1 : b.i - a.i;
    }).map(function (x) { return x.p; });
  }

  function hole(id) {
    return laden().projekte.find(function (p) { return p.id === id; }) || null;
  }

  /**
   * Neues Projekt / neue Idee.
   * @param {{titel: string, idee?: string}} roh
   * @returns {{ok: true, projekt} | {ok: false, fehler, feld}}
   */
  function anlegen(roh) {
    const titel = typeof roh.titel === "string" ? roh.titel.trim() : "";
    if (!titel) return { ok: false, fehler: "Bitte einen Titel eingeben.", feld: "titel" };
    const jetzt = new Date().toISOString();
    const projekt = {
      id: neueId(),
      titel: titel.slice(0, GRENZEN.titel),
      idee: typeof roh.idee === "string" ? roh.idee.trim().slice(0, GRENZEN.idee) : "",
      erstellt: jetzt,
      geaendert: jetzt,
      schritte: [],
    };
    const daten = laden();
    daten.projekte.push(projekt);
    if (!speichern(daten)) return { ok: false, fehler: "Speichern nicht möglich (Speicher voll oder gesperrt).", feld: "titel" };
    return { ok: true, projekt: projekt };
  }

  /**
   * Titel und/oder Idee ändern.
   * @param {string} id
   * @param {{titel?: string, idee?: string}} aenderung
   * @returns {{ok: true, projekt} | {ok: false, fehler, feld}}
   */
  function aendern(id, aenderung) {
    const daten = laden();
    const p = daten.projekte.find(function (x) { return x.id === id; });
    if (!p) return { ok: false, fehler: "Projekt nicht gefunden.", feld: "titel" };
    if ("titel" in aenderung) {
      const titel = String(aenderung.titel).trim();
      if (!titel) return { ok: false, fehler: "Der Titel darf nicht leer sein.", feld: "titel" };
      p.titel = titel.slice(0, GRENZEN.titel);
    }
    if ("idee" in aenderung) p.idee = String(aenderung.idee).replace(/\s+$/, "").slice(0, GRENZEN.idee);
    p.geaendert = new Date().toISOString();
    speichern(daten);
    return { ok: true, projekt: p };
  }

  function loeschen(id) {
    const daten = laden();
    const vorher = daten.projekte.length;
    daten.projekte = daten.projekte.filter(function (p) { return p.id !== id; });
    speichern(daten);
    return daten.projekte.length < vorher;
  }

  /** Für die Sicherung: der gespeicherte Stand oder null, wenn noch nie benutzt. */
  function alsObjekt() {
    try {
      if (!localStorage.getItem(SCHLUESSEL)) return null;
    } catch (fehler) {
      return null;
    }
    return laden();
  }

  /** Import: Stand ersetzen (null = löschen). */
  function ersetzen(daten) {
    if (daten) {
      speichern(daten);
    } else {
      try { localStorage.removeItem(SCHLUESSEL); } catch (fehler) { /* egal */ }
    }
  }

  return {
    liste: liste,
    hole: hole,
    anlegen: anlegen,
    aendern: aendern,
    loeschen: loeschen,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

if (typeof module !== "undefined") module.exports = ProjekteStore;
