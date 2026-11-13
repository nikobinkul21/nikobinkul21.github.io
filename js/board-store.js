/* ==========================================================================
   board-store.js – Speicher der Pinnwand (localStorage "ntb-pinnwand")
   Die Fläche (js/board.js) greift nie selbst auf localStorage zu, sondern
   nur über diese Datei. Teil der Datensicherung (js/settings.js:
   alsObjekt, pruefeDaten, ersetzen).

   Aufbau der Daten (Koordinaten in "Welt-Pixeln" der Fläche):
   {
     version: 1,
     zettel: [ { id, x, y, b, h, farbe, text, z } ],
       x/y = linke obere Ecke, b/h = Breite/Höhe, farbe = Schlüssel aus
       FARBEN, text = erste Zeile Titel, Rest Fließtext, z = Stapelfolge
     verbindungen: [ { id, von, nach, text } ]   ← von/nach = Zettel-IDs
     ansicht: { x, y, zoom }                     ← letzte Ansicht
     naechsteZ: 12                               ← nächster Stapelwert
   }
   Läuft auch in Node (für Tests).
   ========================================================================== */

const BoardStore = (function () {
  const SCHLUESSEL = "ntb-pinnwand";
  const VERSION = 1;

  // Werte, die auch die Fläche benutzt
  const K = {
    farben: ["creme", "grau", "sand", "salbei", "taube"],
    standardFarbe: "creme",
    groesse: { b: 210, h: 140 },             // neuer Zettel
    min: { b: 120, h: 64 },                  // kleinster Zettel
    max: { b: 720, h: 720 },                 // größter Zettel
    zoom: { min: 0.1, max: 3 },
    weltGrenze: 1e6,                         // Koordinaten außerhalb gelten als kaputt
    maxZettel: 5000,
    maxVerbindungen: 10000,
    maxText: 20000,
    maxBeschriftung: 120,
  };

  function leer() {
    return { version: VERSION, zettel: [], verbindungen: [], ansicht: { x: 0, y: 0, zoom: 1 }, naechsteZ: 1 };
  }

  const zahl = function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) <= K.weltGrenze; };
  const klemme = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  const gueltigeId = function (id) { return typeof id === "string" && id.length > 0 && id.length <= 64; };

  /**
   * Prüft gespeicherte oder importierte Daten und repariert Kleinigkeiten
   * (zu große Zettel, Verbindungen zu fehlenden Zetteln …).
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION || !Array.isArray(roh.zettel) || !Array.isArray(roh.verbindungen)) {
      return { ok: false, fehler: "Kein gültiger Stand der Pinnwand." };
    }
    if (roh.zettel.length > K.maxZettel || roh.verbindungen.length > K.maxVerbindungen) {
      return { ok: false, fehler: "Zu viele Zettel oder Verbindungen." };
    }
    const daten = leer();
    const ids = new Set();
    let hoechsteZ = 0;
    for (const z of roh.zettel) {
      if (!z || !gueltigeId(z.id) || ids.has(z.id) || !zahl(z.x) || !zahl(z.y) || !zahl(z.b) || !zahl(z.h)) {
        return { ok: false, fehler: "Ein Zettel ist beschädigt." };
      }
      ids.add(z.id);
      const zz = zahl(z.z) ? Math.max(0, Math.round(z.z)) : 0;
      hoechsteZ = Math.max(hoechsteZ, zz);
      daten.zettel.push({
        id: z.id, x: z.x, y: z.y,
        b: klemme(z.b, K.min.b, K.max.b), h: klemme(z.h, K.min.h, K.max.h),
        farbe: K.farben.indexOf(z.farbe) !== -1 ? z.farbe : K.standardFarbe,
        text: typeof z.text === "string" ? z.text.slice(0, K.maxText) : "",
        z: zz,
      });
    }
    const paare = new Set();
    const vIds = new Set();
    for (const v of roh.verbindungen) {
      // Verbindungen zu fehlenden Zetteln, doppelte und Schleifen fallen weg
      if (!v || !gueltigeId(v.id) || vIds.has(v.id) || !ids.has(v.von) || !ids.has(v.nach) || v.von === v.nach) continue;
      const paar = v.von + ">" + v.nach;
      if (paare.has(paar)) continue;
      paare.add(paar);
      vIds.add(v.id);
      daten.verbindungen.push({ id: v.id, von: v.von, nach: v.nach, text: typeof v.text === "string" ? v.text.slice(0, K.maxBeschriftung) : "" });
    }
    const a = roh.ansicht;
    if (a && zahl(a.x) && zahl(a.y) && zahl(a.zoom)) {
      daten.ansicht = { x: a.x, y: a.y, zoom: klemme(a.zoom, K.zoom.min, K.zoom.max) };
    }
    daten.naechsteZ = Math.max(hoechsteZ + 1, zahl(roh.naechsteZ) ? Math.round(roh.naechsteZ) : 1);
    return { ok: true, daten: daten };
  }

  function laden() {
    try {
      const text = localStorage.getItem(SCHLUESSEL);
      if (!text) return leer();
      const p = pruefeDaten(JSON.parse(text));
      return p.ok ? p.daten : leer();
    } catch (fehler) {
      return leer();
    }
  }

  /** @returns {boolean} false, wenn nicht gespeichert werden konnte (voll/gesperrt) */
  function speichern(daten) {
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
      return true;
    } catch (fehler) {
      return false;
    }
  }

  /** Für die Sicherung: der gespeicherte Stand oder null, wenn die Pinnwand nie benutzt wurde. */
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

  return { K: K, leer: leer, laden: laden, speichern: speichern, pruefeDaten: pruefeDaten, alsObjekt: alsObjekt, ersetzen: ersetzen };
})();

if (typeof module !== "undefined") module.exports = BoardStore;
