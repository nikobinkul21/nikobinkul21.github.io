/* ==========================================================================
   words/regeln.js – die Regeln des Worträtsels (ohne Darstellung)
   - bewerte(): färbt einen Versuch – auch bei doppelten Buchstaben richtig
   - Streak, bester Streak und Statistik je Sprache
   - Reihenfolge der Lösungswörter: ein "Beutel" je Sprache – ein Wort kommt
     erst wieder, wenn alle anderen einmal dran waren
   Alle Funktionen arbeiten auf dem Datenobjekt aus js/words/speicher.js:
   {
     version: 1, sprache: "de" | "en", farbenblind: false,
     laufend: null | { sprache, loesung, versuche: ["haben", …], ende: null | "gewonnen" | "verloren" },
     stats: { de: { streak, bester, rekordVorSerie, gespielt, gewonnen,
                    verteilung: [6 Zahlen], beutel: [Wörter] }, en: { … } }
   rekordVorSerie: der beste Streak zu Beginn der laufenden Serie – damit ein
   neuer Rekord nur einmal gefeiert wird (im Moment, in dem er fällt)
   }
   Läuft auch in Node (für Tests).
   ========================================================================== */

const WoerterRegeln = (function () {
  const K = typeof WoerterKonfig !== "undefined" ? WoerterKonfig : require("./konfig.js");

  // Ergebnis je Feld
  const RICHTIG = "richtig";       // grün: richtiger Buchstabe an richtiger Stelle
  const VORHANDEN = "vorhanden";   // gelb: kommt vor, aber an anderer Stelle
  const FEHLT = "fehlt";           // grau: kommt nicht (mehr) vor
  const RANG = { fehlt: 1, vorhanden: 2, richtig: 3 };

  /** Kleinbuchstaben, Umlaute als je EIN Zeichen (NFC: "ü" statt "u" + Punkte). */
  function normalisiere(text) {
    return String(text).normalize("NFC").toLowerCase();
  }

  /** Die Buchstaben eines Worts als Liste (Umlaute zählen als ein Zeichen). */
  function zeichen(wort) {
    return Array.from(normalisiere(wort));
  }

  /** Wortliste aus dem langen Text der Listendateien. */
  function listeAus(text) {
    return normalisiere(text).split(/\s+/).filter(Boolean);
  }

  /**
   * Färbt einen Versuch.
   * Doppelte Buchstaben: Ein Buchstabe wird höchstens so oft grün oder gelb,
   * wie er in der Lösung vorkommt – grün hat Vorrang:
   *   1. Durchgang: alle Treffer an der richtigen Stelle (grün), die übrigen
   *      Buchstaben der Lösung werden gezählt.
   *   2. Durchgang: von links nach rechts gelb, solange von diesem Buchstaben
   *      noch ungenutzte übrig sind – sonst grau.
   * Beispiel: Lösung ESSEN, Versuch SEESE → gelb, gelb, gelb, gelb, grau
   * (ESSEN hat zwei E und zwei S – das dritte E von SEESE bleibt grau).
   * @returns {string[]} – je Feld "richtig", "vorhanden" oder "fehlt"
   */
  function bewerte(versuch, loesung) {
    const v = zeichen(versuch);
    const l = zeichen(loesung);
    const ergebnis = v.map(function () { return FEHLT; });
    const uebrig = {};
    v.forEach(function (b, i) {
      if (b === l[i]) ergebnis[i] = RICHTIG;
      else uebrig[l[i]] = (uebrig[l[i]] || 0) + 1;
    });
    v.forEach(function (b, i) {
      if (ergebnis[i] !== RICHTIG && uebrig[b] > 0) {
        ergebnis[i] = VORHANDEN;
        uebrig[b]--;
      }
    });
    return ergebnis;
  }

  /**
   * Bestes bisheriges Ergebnis je Buchstabe (für die Bildschirmtastatur):
   * grün schlägt gelb, gelb schlägt grau.
   * @returns {object} – z. B. { e: "richtig", s: "vorhanden", n: "fehlt" }
   */
  function tastenStand(versuche, loesung) {
    const stand = {};
    versuche.forEach(function (versuch) {
      const farben = bewerte(versuch, loesung);
      zeichen(versuch).forEach(function (b, i) {
        if (!stand[b] || RANG[farben[i]] > RANG[stand[b]]) stand[b] = farben[i];
      });
    });
    return stand;
  }

  /** Passt eine Eingabe zur Sprache (nur erlaubte Buchstaben, genau 5)? */
  function istWortform(wort, sprache) {
    const erlaubt = K.sprachen[sprache].buchstaben;
    const z = zeichen(wort);
    return z.length === K.laenge && z.every(function (b) { return erlaubt.indexOf(b) !== -1; });
  }


  /* --------------------------------------------------------------------------
     Daten
     -------------------------------------------------------------------------- */

  function leereStats() {
    const verteilung = [];
    for (let i = 0; i < K.versuche; i++) verteilung.push(0);
    return { streak: 0, bester: 0, rekordVorSerie: 0, gespielt: 0, gewonnen: 0, verteilung: verteilung, beutel: [] };
  }

  function leereDaten() {
    const stats = {};
    Object.keys(K.sprachen).forEach(function (s) { stats[s] = leereStats(); });
    return { version: 1, sprache: K.standardSprache, farbenblind: false, laufend: null, stats: stats };
  }

  /** Mischt eine Liste (Fisher-Yates) mit der Zufallsfunktion zufall() ∈ [0, 1). */
  function mische(liste, zufall) {
    const l = liste.slice();
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      const t = l[i]; l[i] = l[j]; l[j] = t;
    }
    return l;
  }

  /**
   * Zieht das nächste Lösungswort aus dem Beutel der Sprache. Ist er leer,
   * wird er mit allen Lösungswörtern neu gefüllt und gemischt – das gerade
   * gespielte Wort kommt dabei nicht sofort wieder.
   * Wörter, die nicht (mehr) in der Liste stehen, fallen heraus.
   */
  function zieheWort(stats, loesungen, zufall, zuletzt) {
    const gueltig = new Set(loesungen);
    stats.beutel = stats.beutel.filter(function (w) { return gueltig.has(w); });
    if (stats.beutel.length === 0) {
      stats.beutel = mische(loesungen, zufall);
      // Das letzte Wort ans Ende der Ziehung legen (gezogen wird von hinten)
      const i = stats.beutel.indexOf(zuletzt);
      if (i > 0 && stats.beutel.length > 1) {
        stats.beutel.splice(i, 1);
        stats.beutel.unshift(zuletzt);
      }
    }
    return stats.beutel.pop();
  }

  /** Beginnt ein neues Wort in der gewählten Sprache. */
  function neuesWort(daten, loesungen, zufall) {
    const sprache = daten.sprache;
    const zuletzt = daten.laufend && daten.laufend.sprache === sprache ? daten.laufend.loesung : null;
    const loesung = zieheWort(daten.stats[sprache], loesungen, zufall || Math.random, zuletzt);
    daten.laufend = { sprache: sprache, loesung: loesung, versuche: [], ende: null };
    return daten.laufend;
  }

  /** Läuft gerade ein angefangenes Wort (mindestens ein Versuch, noch nicht entschieden)? */
  function istAngefangen(daten) {
    const l = daten.laufend;
    return Boolean(l && !l.ende && l.versuche.length > 0);
  }

  /**
   * Ein Versuch.
   * @param {string} eingabe – das getippte Wort
   * @param {Set} erlaubt – alle erlaubten Wörter der Sprache
   * @returns {{ok: false, grund: "zuKurz"|"ungueltig"|"keinWort"}
   *         | {ok: true, farben, ende, nummer, streak, bester, neuerRekord}}
   *   Ein ungültiger Versuch zählt nicht (nichts wird verändert).
   */
  function rate(daten, eingabe, erlaubt) {
    const l = daten.laufend;
    if (!l || l.ende) return { ok: false, grund: "keinWort" };
    const wort = normalisiere(eingabe);
    if (zeichen(wort).length !== K.laenge) return { ok: false, grund: "zuKurz" };
    if (!istWortform(wort, l.sprache) || !erlaubt.has(wort)) return { ok: false, grund: "ungueltig" };

    l.versuche.push(wort);
    const st = daten.stats[l.sprache];
    const farben = bewerte(wort, l.loesung);
    let neuerRekord = false;
    if (wort === l.loesung) {
      l.ende = "gewonnen";
      st.gespielt++;
      st.gewonnen++;
      st.verteilung[l.versuche.length - 1]++;
      if (st.streak === 0) st.rekordVorSerie = st.bester;   // neue Serie beginnt
      st.streak++;
      if (st.streak > st.bester) st.bester = st.streak;
      // Gefeiert wird im Moment, in dem der Rekord vom Beginn der Serie
      // übertroffen wird – einmal je Serie; der allererste Sieg zählt nicht
      neuerRekord = st.rekordVorSerie > 0 && st.streak === st.rekordVorSerie + 1;
    } else if (l.versuche.length >= K.versuche) {
      l.ende = "verloren";
      st.gespielt++;
      st.streak = 0;
    }
    return {
      ok: true, farben: farben, ende: l.ende, nummer: l.versuche.length,
      streak: st.streak, bester: st.bester, neuerRekord: neuerRekord,
    };
  }

  /**
   * Sprache wechseln. Ein laufendes Wort endet OHNE Wertung: Streak und
   * Statistik bleiben unverändert, das Wort kommt zurück in den Beutel
   * (ganz nach unten – es kommt also erst später wieder).
   * Danach braucht es ein neuesWort() in der neuen Sprache.
   * @returns {boolean} – true, wenn ein Wort abgebrochen wurde
   */
  function wechsleSprache(daten, sprache) {
    if (!K.sprachen[sprache]) return false;
    const l = daten.laufend;
    let abgebrochen = false;
    if (l && !l.ende) {
      daten.stats[l.sprache].beutel.unshift(l.loesung);
      abgebrochen = l.versuche.length > 0;
    }
    daten.laufend = null;
    daten.sprache = sprache;
    return abgebrochen;
  }

  /** Kennzahlen für die Statistik einer Sprache. */
  function statistik(daten, sprache) {
    const st = daten.stats[sprache];
    return {
      gespielt: st.gespielt,
      quote: st.gespielt ? Math.round(st.gewonnen / st.gespielt * 100) : 0,
      streak: st.streak,
      bester: st.bester,
      verteilung: st.verteilung.slice(),
    };
  }

  return {
    RICHTIG: RICHTIG, VORHANDEN: VORHANDEN, FEHLT: FEHLT,
    normalisiere: normalisiere,
    zeichen: zeichen,
    listeAus: listeAus,
    bewerte: bewerte,
    tastenStand: tastenStand,
    istWortform: istWortform,
    leereDaten: leereDaten,
    leereStats: leereStats,
    mische: mische,
    zieheWort: zieheWort,
    neuesWort: neuesWort,
    istAngefangen: istAngefangen,
    rate: rate,
    wechsleSprache: wechsleSprache,
    statistik: statistik,
  };
})();

if (typeof module !== "undefined") module.exports = WoerterRegeln;
