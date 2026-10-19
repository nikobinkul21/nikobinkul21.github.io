/* ==========================================================================
   climb/speicher.js – Rekord und Einstellungen des Kletterspiels (localStorage)
   Aufbau: {
     version: 1,
     rekord: Meter,
     hand: "rechts" | "links",                 ← mit welcher Hand gespielt wird
     tastaturTest: null | "ok" | "probleme",   ← Ergebnis des letzten Tests
     testFortschritt: { alle: n, zahlen: n },  ← so viele Schritte des großen Tests geschafft
     testFehler: [ [code, code, code, code] ]  ← Griffe, die die Tastatur nicht erkannt hat
   }
   Ältere Stände (nur rekord und tastaturTest) laden ohne Fehler.
   Teil der Datensicherung (js/settings.js: alsObjekt, pruefeDaten, ersetzen).
   ========================================================================== */

const KletterSpeicher = (function () {
  const K = typeof KletterKonfig !== "undefined" ? KletterKonfig : require("./konfig.js");
  const VERSION = 1;

  function leer() {
    return { version: VERSION, rekord: 0, hand: K.hand.standard, tastaturTest: null,
      testFortschritt: { alle: 0, zahlen: 0 }, testFehler: [] };
  }

  const istCode = function (c) { return typeof c === "string" && /^(Key[A-Z]|Digit[0-9])$/.test(c); };

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
    const hand = roh.hand === "links" || roh.hand === "rechts" ? roh.hand : K.hand.standard;
    const f = roh.testFortschritt && typeof roh.testFortschritt === "object" ? roh.testFortschritt : {};
    const schritt = function (n) { return Number.isInteger(n) && n >= 0 && n < 1e6 ? n : 0; };
    const fehler = Array.isArray(roh.testFehler) ? roh.testFehler.filter(function (g) {
      return Array.isArray(g) && g.length === 4 && g.every(istCode);
    }).slice(0, 5000) : [];
    return { ok: true, daten: { version: VERSION, rekord: roh.rekord, hand: hand, tastaturTest: test,
      testFortschritt: { alle: schritt(f.alle), zahlen: schritt(f.zahlen) }, testFehler: fehler } };
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

  /** Ändert einzelne Werte (z. B. { hand: "links" }) und speichert. */
  function setze(werte) {
    const d = Object.assign(laden(), werte);
    speichern(d);
    return d;
  }

  function setzeTastaturTest(ergebnis) {
    setze({ tastaturTest: ergebnis });
  }

  /** Tastaturtest: ein nicht erkannter Griff (doppelte werden nur einmal gemerkt). */
  function merkeTestFehler(griff) {
    const d = laden();
    if (!d.testFehler.some(function (g) { return g.join() === griff.join(); })) d.testFehler.push(griff.slice());
    speichern(d);
    return d.testFehler;
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
    setze: setze,
    setzeTastaturTest: setzeTastaturTest,
    merkeTestFehler: merkeTestFehler,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

if (typeof module !== "undefined") module.exports = KletterSpeicher;
