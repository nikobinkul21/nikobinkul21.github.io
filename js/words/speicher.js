/* ==========================================================================
   words/speicher.js – Spielstand des Worträtsels im localStorage
   Gespeichert werden: gewählte Sprache, Farbenblind-Modus, das laufende
   Wort mit allen Versuchen (wird nach dem Neuladen fortgesetzt), Streaks,
   Statistik und die Reihenfolge der noch offenen Lösungswörter je Sprache.
   Aufbau: siehe js/words/regeln.js (oben).
   Teil der Datensicherung (js/settings.js: alsObjekt, pruefeDaten, ersetzen).
   ========================================================================== */

const WoerterSpeicher = (function () {
  const K = typeof WoerterKonfig !== "undefined" ? WoerterKonfig : require("./konfig.js");
  const R = typeof WoerterRegeln !== "undefined" ? WoerterRegeln : require("./regeln.js");
  const VERSION = 1;

  const ganz = function (n) { return Number.isInteger(n) && n >= 0 && n < 1e7; };

  /**
   * Prüft gespeicherte oder importierte Daten und repariert Kleinigkeiten.
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION || !roh.stats || typeof roh.stats !== "object") {
      return { ok: false, fehler: "Kein gültiger Spielstand des Worträtsels." };
    }
    const daten = R.leereDaten();
    if (K.sprachen[roh.sprache]) daten.sprache = roh.sprache;
    daten.farbenblind = roh.farbenblind === true;

    for (const s in K.sprachen) {
      const st = roh.stats[s];
      if (!st) continue;
      const ziel = daten.stats[s];
      ["streak", "bester", "gespielt", "gewonnen"].forEach(function (f) {
        if (!ganz(st[f])) brichAb();
        ziel[f] = st[f];
      });
      if (!Array.isArray(st.verteilung) || st.verteilung.length !== K.versuche || !st.verteilung.every(ganz)) brichAb();
      ziel.verteilung = st.verteilung.slice();
      if (ziel.gewonnen > ziel.gespielt || ziel.streak > ziel.bester) brichAb();
      // Ältere Stände ohne rekordVorSerie: so tun, als begänne die Serie mit dem Rekord
      ziel.rekordVorSerie = ganz(st.rekordVorSerie) && st.rekordVorSerie <= ziel.bester ? st.rekordVorSerie : ziel.bester;
      ziel.beutel = Array.isArray(st.beutel)
        ? st.beutel.filter(function (w) { return typeof w === "string" && R.istWortform(w, s); }).slice(0, 10000)
        : [];
    }

    const l = roh.laufend;
    if (l && typeof l === "object" && K.sprachen[l.sprache] && typeof l.loesung === "string" &&
        R.istWortform(l.loesung, l.sprache) && Array.isArray(l.versuche) && l.versuche.length <= K.versuche &&
        l.versuche.every(function (w) { return typeof w === "string" && R.istWortform(w, l.sprache); })) {
      const ende = l.ende === "gewonnen" || l.ende === "verloren" ? l.ende : null;
      daten.laufend = { sprache: l.sprache, loesung: R.normalisiere(l.loesung), versuche: l.versuche.map(R.normalisiere), ende: ende };
    }
    return { ok: true, daten: daten };
  }

  // Ungültige Zahlen brechen die Prüfung ab – pruefe() fängt das auf
  function brichAb() { throw new Error("ungueltig"); }

  function pruefe(roh) {
    try {
      return pruefeDaten(roh);
    } catch (fehler) {
      return { ok: false, fehler: "Worträtsel: ungültige Statistik." };
    }
  }

  function laden() {
    try {
      const text = localStorage.getItem(K.speicherSchluessel);
      if (!text) return R.leereDaten();
      const geprueft = pruefe(JSON.parse(text));
      return geprueft.ok ? geprueft.daten : R.leereDaten();
    } catch (fehler) {
      return R.leereDaten();
    }
  }

  function speichern(daten) {
    try {
      localStorage.setItem(K.speicherSchluessel, JSON.stringify(daten));
    } catch (fehler) {
      // voll oder gesperrt – dann gilt der Stand nur bis zum Neuladen
    }
  }

  /** Für die Sicherung: der gespeicherte Stand oder null, wenn noch nie gespielt. */
  function alsObjekt() {
    try {
      if (!localStorage.getItem(K.speicherSchluessel)) return null;
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
      try { localStorage.removeItem(K.speicherSchluessel); } catch (fehler) { /* egal */ }
    }
  }

  return {
    laden: laden,
    speichern: speichern,
    pruefeDaten: pruefe,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

if (typeof module !== "undefined") module.exports = WoerterSpeicher;
