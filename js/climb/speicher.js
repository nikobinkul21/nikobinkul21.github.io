/* ==========================================================================
   climb/speicher.js – Rekord des Kletterspiels (localStorage)
   Aufbau: { version: 1, rekord: Meter, tastaturTest: null | "ok" | "probleme" }
   Teil der Datensicherung (js/settings.js: alsObjekt, pruefeDaten, ersetzen).
   ========================================================================== */

const KletterSpeicher = (function () {
  const K = typeof KletterKonfig !== "undefined" ? KletterKonfig : require("./konfig.js");
  const VERSION = 1;

  function leer() {
    return { version: VERSION, rekord: 0, tastaturTest: null };
  }

  /**
   * Prüft gespeicherte oder importierte Daten.
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION) {
      return { ok: false, fehler: "Kein gültiger Spielstand des Kletterspiels." };
    }
    if (!Number.isInteger(roh.rekord) || roh.rekord < 0 || roh.rekord > 1e7) {
      return { ok: false, fehler: "Kletterspiel: ungültiger Rekord." };
    }
    const test = roh.tastaturTest === "ok" || roh.tastaturTest === "probleme" ? roh.tastaturTest : null;
    return { ok: true, daten: { version: VERSION, rekord: roh.rekord, tastaturTest: test } };
  }

  function laden() {
    try {
      const text = localStorage.getItem(K.speicherSchluessel);
      if (!text) return leer();
      const geprueft = pruefeDaten(JSON.parse(text));
      return geprueft.ok ? geprueft.daten : leer();
    } catch (fehler) {
      return leer();
    }
  }

  function speichern(daten) {
    try { localStorage.setItem(K.speicherSchluessel, JSON.stringify(daten)); } catch (fehler) { /* voll oder gesperrt */ }
  }

  /**
   * Neue Höhe eintragen. @returns {{rekord, neu: boolean}} – neu = neuer Rekord
   */
  function eintragen(meter) {
    const d = laden();
    const neu = meter > d.rekord;
    if (neu) {
      d.rekord = meter;
      speichern(d);
    }
    return { rekord: d.rekord, neu: neu };
  }

  function setzeTastaturTest(ergebnis) {
    const d = laden();
    d.tastaturTest = ergebnis;
    speichern(d);
  }

  /** Für die Sicherung: der gespeicherte Stand oder null, wenn noch nie gespielt. */
  function alsObjekt() {
    try {
      if (!localStorage.getItem(K.speicherSchluessel)) return null;
    } catch (fehler) { return null; }
    return laden();
  }

  /** Import: Stand ersetzen (null = löschen). */
  function ersetzen(daten) {
    if (daten) {
      speichern(daten);
    } else {
      try { localStorage.removeItem(K.speicherSchluessel); } catch (fehler) { /* egal */ }
    }
  }

  return {
    laden: laden,
    eintragen: eintragen,
    setzeTastaturTest: setzeTastaturTest,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

if (typeof module !== "undefined") module.exports = KletterSpeicher;
