/* ==========================================================================
   chess/speicher.js – Spielstand des Schachspiels im localStorage
   Gespeichert werden: die Einstellungen, die laufende (oder zuletzt
   beendete) Partie – sie wird nach dem Neuladen fortgesetzt – und die
   Statistik über alle beendeten Partien.
   Teil der Datensicherung (js/settings.js: alsObjekt, pruefeDaten, ersetzen).

   Aufbau:
   {
     version: 1,
     einstellungen: {
       eloMin: 200, eloMax: 2800   Bereich, aus dem die Bot-Stärke gezogen wird
       eloZeigen: false            Stärke von Anfang an zeigen (sonst erst am Ende)
       farbe: "zufall"             meine Farbe: "w", "b" oder "zufall"
       hilfe: "idee"               Hilfestufe von Claudy (SchachKonfig.hilfen)
       automatisch: false          Hilfe ohne Klick auf "Tipp" zeigen
       zugbewertung: true          Claudy bewertet jeden meiner Züge
       zuruecknehmen: true         Züge zurücknehmen erlaubt
     },
     partie: null oder {
       id: "s1a2b3"                Kennung der Partie
       start: "2026-11-14T…"       Beginn (ISO)
       elo: 1450                   Spielstärke des Bots
       farbe: "w"                  meine Farbe
       startFen: null              Startstellung, falls nicht die Grundstellung
       zuege: ["e2e4", "e7e5"]     alle Halbzüge (Start- und Zielfeld, ggf. Umwandlung)
       bewertungen: { "0": {…} }   je eigenem Zug (Nummer des Halbzugs): siehe spiel.js
       zurueck: 0                  wie oft ein Zug zurückgenommen wurde
       gedreht: false              Brett von Hand gedreht
       ende: null oder { ergebnis: "sieg"|"remis"|"niederlage", grund: "matt"|… }
     },
     statistik: [ { datum, elo, ergebnis, grund, zuege, fehler, ungenau, zurueck }, … ]
   }
   Läuft auch in Node (für Tests).
   ========================================================================== */

const SchachSpeicher = (function () {
  const K = typeof SchachKonfig !== "undefined" ? SchachKonfig : require("./konfig.js");
  const VERSION = 1;
  const ERGEBNISSE = ["sieg", "remis", "niederlage"];
  const GRENZEN = { zuege: 1200, text: 40 };

  const ganz = function (n, min, max) { return Number.isInteger(n) && n >= min && n <= max; };
  const istZug = function (z) { return typeof z === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(z); };
  const kurz = function (t) { return typeof t === "string" ? t.slice(0, GRENZEN.text) : ""; };
  const zahl = function (n, ersatz) { return typeof n === "number" && isFinite(n) ? n : ersatz; };

  function standardEinstellungen() {
    return {
      eloMin: K.elo.min, eloMax: K.elo.max, eloZeigen: false, farbe: "zufall",
      hilfe: "idee", automatisch: false, zugbewertung: true, zuruecknehmen: true,
    };
  }

  function leereDaten() {
    return { version: VERSION, einstellungen: standardEinstellungen(), partie: null, statistik: [] };
  }

  /** Einstellungen prüfen; Unbekanntes fällt auf die Vorgabe zurück. */
  function pruefeEinstellungen(roh) {
    const e = standardEinstellungen();
    if (!roh || typeof roh !== "object") return e;
    if (ganz(roh.eloMin, K.elo.min, K.elo.max) && ganz(roh.eloMax, K.elo.min, K.elo.max) &&
        roh.eloMax - roh.eloMin >= K.elo.mindestBreite) {
      e.eloMin = roh.eloMin;
      e.eloMax = roh.eloMax;
    }
    e.eloZeigen = roh.eloZeigen === true;
    if (["w", "b", "zufall"].indexOf(roh.farbe) >= 0) e.farbe = roh.farbe;
    if (K.hilfen.some(function (h) { return h.id === roh.hilfe; })) e.hilfe = roh.hilfe;
    e.automatisch = roh.automatisch === true;
    e.zugbewertung = roh.zugbewertung !== false;
    e.zuruecknehmen = roh.zuruecknehmen !== false;
    return e;
  }

  /** Die Bewertung eines meiner Züge (Felder siehe spiel.js: bewerte). */
  function pruefeBewertung(roh) {
    if (!roh || typeof roh !== "object" || !K.klassen.some(function (k) { return k.id === roh.klasse; })) return null;
    return {
      klasse: roh.klasse,
      verlust: Math.max(0, Math.min(100, zahl(roh.verlust, 0))),
      cp: zahl(roh.cp, 0),
      cpDanach: zahl(roh.cpDanach, 0),
      matt: zahl(roh.matt, 0),
      bester: istZug(roh.bester) ? roh.bester : "",
      antwort: istZug(roh.antwort) ? roh.antwort : "",
    };
  }

  function pruefeEnde(roh) {
    if (!roh || typeof roh !== "object" || ERGEBNISSE.indexOf(roh.ergebnis) < 0) return null;
    return { ergebnis: roh.ergebnis, grund: kurz(roh.grund) };
  }

  /** Die laufende Partie; bei Unstimmigkeiten null (dann beginnt eine neue). */
  function pruefePartie(roh) {
    if (!roh || typeof roh !== "object") return null;
    if (!ganz(roh.elo, K.elo.min, K.elo.max) || (roh.farbe !== "w" && roh.farbe !== "b")) return null;
    if (!Array.isArray(roh.zuege) || roh.zuege.length > GRENZEN.zuege || !roh.zuege.every(istZug)) return null;
    const bewertungen = {};
    if (roh.bewertungen && typeof roh.bewertungen === "object") {
      Object.keys(roh.bewertungen).forEach(function (nr) {
        const b = pruefeBewertung(roh.bewertungen[nr]);
        if (b && /^\d+$/.test(nr) && Number(nr) < roh.zuege.length) bewertungen[nr] = b;
      });
    }
    return {
      id: typeof roh.id === "string" && roh.id ? roh.id.slice(0, 24) : "s" + Date.now().toString(36),
      start: typeof roh.start === "string" && !isNaN(Date.parse(roh.start)) ? roh.start : new Date().toISOString(),
      elo: roh.elo,
      farbe: roh.farbe,
      startFen: typeof roh.startFen === "string" && roh.startFen.length < 100 ? roh.startFen : null,
      zuege: roh.zuege.slice(),
      bewertungen: bewertungen,
      zurueck: ganz(roh.zurueck, 0, 9999) ? roh.zurueck : 0,
      gedreht: roh.gedreht === true,
      ende: pruefeEnde(roh.ende),
    };
  }

  function pruefeEintrag(roh) {
    if (!roh || typeof roh !== "object" || ERGEBNISSE.indexOf(roh.ergebnis) < 0 || !ganz(roh.elo, K.elo.min, K.elo.max)) return null;
    return {
      datum: typeof roh.datum === "string" && !isNaN(Date.parse(roh.datum)) ? roh.datum : new Date().toISOString(),
      elo: roh.elo,
      ergebnis: roh.ergebnis,
      grund: kurz(roh.grund),
      zuege: ganz(roh.zuege, 0, GRENZEN.zuege) ? roh.zuege : 0,
      fehler: ganz(roh.fehler, 0, GRENZEN.zuege) ? roh.fehler : 0,
      ungenau: ganz(roh.ungenau, 0, GRENZEN.zuege) ? roh.ungenau : 0,
      zurueck: ganz(roh.zurueck, 0, 9999) ? roh.zurueck : 0,
    };
  }

  /**
   * Prüft gespeicherte oder importierte Daten und repariert Kleinigkeiten.
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION) {
      return { ok: false, fehler: "Kein gültiger Spielstand des Schachspiels." };
    }
    const daten = leereDaten();
    daten.einstellungen = pruefeEinstellungen(roh.einstellungen);
    daten.partie = pruefePartie(roh.partie);
    if (Array.isArray(roh.statistik)) {
      daten.statistik = roh.statistik.map(pruefeEintrag).filter(Boolean).slice(-K.statistik.hoechstens);
    }
    return { ok: true, daten: daten };
  }

  function laden() {
    try {
      const text = localStorage.getItem(K.speicherSchluessel);
      if (text) {
        const p = pruefeDaten(JSON.parse(text));
        if (p.ok) return p.daten;
      }
    } catch (fehler) {
      // kaputte Daten oder kein Zugriff → frisch beginnen
    }
    return leereDaten();
  }

  function speichern(daten) {
    try {
      localStorage.setItem(K.speicherSchluessel, JSON.stringify(daten));
      return true;
    } catch (fehler) {
      return false;
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

  /**
   * Statistik in Zahlen: Siege, Remis, Niederlagen je Elo-Bereich.
   * @returns {Array<{von, bis, sieg, remis, niederlage}>}
   */
  function nachBereichen(statistik) {
    const zeilen = [];
    for (let i = 0; i < K.bereiche.length - 1; i++) {
      zeilen.push({ von: K.bereiche[i], bis: K.bereiche[i + 1], sieg: 0, remis: 0, niederlage: 0 });
    }
    statistik.forEach(function (e) {
      const z = zeilen.find(function (b) { return e.elo >= b.von && e.elo < b.bis; });
      if (z) z[e.ergebnis]++;
    });
    return zeilen;
  }

  return {
    standardEinstellungen: standardEinstellungen,
    leereDaten: leereDaten,
    pruefeDaten: pruefeDaten,
    laden: laden,
    speichern: speichern,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
    nachBereichen: nachBereichen,
  };
})();

if (typeof module !== "undefined") module.exports = SchachSpeicher;
