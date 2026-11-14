/* ==========================================================================
   chess/bot.js – der Gegner
   Wählt je nach Elo einen Zug:
   - ab SchachKonfig.grenzeStockfish (1350): Stockfish begrenzt seine Stärke
     selbst (UCI_LimitStrength und UCI_Elo).
   - darunter: eigene Abschwächung nach der Tabelle SchachKonfig.staerken –
     geringe Rechentiefe, Auswahl unter mehreren guten Zügen und eine
     Fehlerquote planloser Züge, die mit sinkender Elo steigt. So spielt ein
     Bot mit 200 Elo wie ein Anfänger: Er lässt Figuren stehen und übersieht
     Geschenke.
   Die Elo-Angaben unter 1350 sind Näherungen, keine gemessenen Wertungen.
   Die Auswahlfunktionen laufen auch in Node (für Tests).
   ========================================================================== */

const SchachBot = (function () {
  const K = typeof SchachKonfig !== "undefined" ? SchachKonfig : require("./konfig.js");

  /** Zieht eine Spielstärke aus dem Bereich (auf volle 10 gerundet). */
  function zieheElo(min, max) {
    const s = K.elo.schritt;
    return Math.round((min + Math.random() * (max - min)) / s) * s;
  }

  /** Bedenkzeit in Millisekunden: gleitend zwischen schwach (kurz) und stark (lang). */
  function denkzeit(elo) {
    const anteil = Math.max(0, Math.min(1, (elo - K.elo.min) / (K.elo.max - K.elo.min)));
    return Math.round(K.denkzeit.min + anteil * (K.denkzeit.max - K.denkzeit.min));
  }

  /**
   * Einstellungen für eine Elo unter der Stockfish-Grenze: zwischen den
   * beiden benachbarten Zeilen der Tabelle wird gleitend gemischt.
   * @returns {{tiefe, kandidaten, streuung, zufall}}
   */
  function einstellung(elo) {
    const t = K.staerken;
    if (elo <= t[0].elo) return t[0];
    for (let i = 1; i < t.length; i++) {
      if (elo > t[i].elo) continue;
      const a = t[i - 1], b = t[i], anteil = (elo - a.elo) / (b.elo - a.elo);
      const misch = function (feld) { return a[feld] + (b[feld] - a[feld]) * anteil; };
      return {
        tiefe: Math.round(misch("tiefe")),
        kandidaten: Math.round(misch("kandidaten")),
        streuung: misch("streuung"),
        zufall: misch("zufall"),
      };
    }
    return t[t.length - 1];
  }

  /**
   * Wählt unter den Linien der Engine: Nur Züge, die höchstens "streuung"
   * schlechter sind als der beste, und unter diesen bevorzugt die besseren.
   * @param {Array<{zug, wert}>} linien – wert in Hundertstel Bauern, beste zuerst
   * @param {number} streuung
   * @param {number} [wuerfel] – Zufallszahl 0–1 (für Tests)
   */
  function waehleKandidat(linien, streuung, wuerfel) {
    const bester = linien[0].wert;
    const moeglich = linien.filter(function (l) { return bester - l.wert <= streuung; });
    // Gewicht: 1 für den besten, fällt mit dem Abstand auf etwa ein Drittel am Rand
    const gewichte = moeglich.map(function (l) { return Math.exp(-(bester - l.wert) / Math.max(1, streuung)); });
    const summe = gewichte.reduce(function (a, b) { return a + b; }, 0);
    let r = (wuerfel === undefined ? Math.random() : wuerfel) * summe;
    for (let i = 0; i < moeglich.length; i++) {
      r -= gewichte[i];
      if (r <= 0) return moeglich[i].zug;
    }
    return moeglich[moeglich.length - 1].zug;
  }

  /**
   * Der Zug des Bots.
   * @param {string} fen – die Stellung
   * @param {string[]} erlaubt – alle erlaubten Züge ("e2e4" …)
   * @param {number} elo – Spielstärke
   * @returns {Promise<string>} der gewählte Zug
   */
  function waehleZug(fen, erlaubt, elo) {
    if (elo >= K.grenzeStockfish) {
      // Stockfish spielt selbst auf dieser Stärke; die Rechenzeit folgt der Bedenkzeit
      return SchachEngine.suche({ fen: fen, elo: elo, zeit: Math.min(1000, denkzeit(elo)) })
        .then(function (e) { return e.zug || erlaubt[0]; });
    }
    const e = einstellung(elo);
    // Fehlerquote: ein völlig planloser Zug
    if (Math.random() < e.zufall) {
      return Promise.resolve(erlaubt[Math.floor(Math.random() * erlaubt.length)]);
    }
    return SchachEngine.suche({ fen: fen, tiefe: e.tiefe, linien: e.kandidaten }).then(function (ergebnis) {
      const linien = ergebnis.linien.map(function (l) { return { zug: l.zug, wert: SchachMuster.cpVon(l) }; })
        .filter(function (l) { return erlaubt.indexOf(l.zug) >= 0; });
      return linien.length ? waehleKandidat(linien, e.streuung) : ergebnis.zug || erlaubt[0];
    });
  }

  return {
    zieheElo: zieheElo,
    denkzeit: denkzeit,
    einstellung: einstellung,
    waehleKandidat: waehleKandidat,
    waehleZug: waehleZug,
  };
})();

if (typeof module !== "undefined") module.exports = SchachBot;
