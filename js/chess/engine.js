/* ==========================================================================
   chess/engine.js – Stockfish als WebAssembly in einem Web Worker
   Die Engine rechnet in einem eigenen Hintergrund-Thread; die Seite bleibt
   dabei bedienbar. Gesprochen wird das UCI-Protokoll (Textzeilen).
   Diese Datei macht daraus eine einfache Funktion:

     SchachEngine.suche({ fen, tiefe, zeit, linien, elo })
       → Promise<{ zug, linien: [{ zug, cp, matt, pv }] }>

   - Aufträge laufen streng nacheinander (eine Warteschlange).
   - Bewertungen gelten aus Sicht der Seite, die am Zug ist:
     cp = Hundertstel Bauern, matt = Matt in n Zügen (negativ: wird mattgesetzt).
   - elo gesetzt → Stockfish begrenzt seine Stärke selbst (UCI_LimitStrength).
   Ein Worker lässt sich nur starten, wenn die Seite über einen Webserver
   läuft (nicht per Doppelklick als file://) – dann schlägt starte() fehl
   und spiel.js zeigt einen Hinweis.
   Engine: js/chess/vendor/stockfish (GPL-3.0, siehe js/chess/LIZENZEN.md).
   ========================================================================== */

const SchachEngine = (function () {
  const K = SchachKonfig;

  let worker = null;
  let bereit = null;             // Promise: Engine geladen und startklar
  let schlange = Promise.resolve();
  let laufend = null;            // der Auftrag, der gerade rechnet
  let generation = 0;            // wird bei abbrechen() erhöht – ältere Aufträge verfallen

  function sende(befehl) {
    worker.postMessage(befehl);
  }

  /**
   * Lädt die Engine (nur beim ersten Aufruf). Schlägt fehl, wenn der Worker
   * nicht startet oder sich nicht rechtzeitig meldet.
   * @returns {Promise<void>}
   */
  function starte() {
    if (bereit) return bereit;
    bereit = new Promise(function (fertig, fehler) {
      const zuSpaet = setTimeout(function () { fehler(new Error("Engine antwortet nicht")); }, K.engineStartZeit);
      try {
        worker = new Worker(K.enginePfad);
      } catch (f) {
        clearTimeout(zuSpaet);
        fehler(f);
        return;
      }
      worker.onerror = function (ereignis) {
        clearTimeout(zuSpaet);
        fehler(new Error(ereignis.message || "Engine konnte nicht geladen werden"));
        if (laufend) laufend.fehler(new Error("Engine ausgefallen"));
      };
      worker.onmessage = function (ereignis) {
        const zeile = typeof ereignis.data === "string" ? ereignis.data : "";
        if (zeile === "uciok") {
          clearTimeout(zuSpaet);
          fertig();
        } else if (laufend) {
          laufend.zeile(zeile);
        }
      };
      sende("uci");
    });
    // Ein gescheiterter Start darf später erneut versucht werden
    bereit.catch(function () {
      if (worker) worker.terminate();
      worker = null;
      bereit = null;
    });
    return bereit;
  }

  /** Eine "info"-Zeile der Engine → { nr, zug, cp, matt, pv } oder null. */
  function liesInfo(zeile) {
    if (zeile.indexOf("info ") !== 0 || zeile.indexOf(" pv ") < 0 || /bound/.test(zeile)) return null;
    const wert = zeile.match(/ score (cp|mate) (-?\d+)/);
    if (!wert) return null;
    const nr = zeile.match(/ multipv (\d+)/);
    const pv = zeile.slice(zeile.indexOf(" pv ") + 4).trim().split(/\s+/);
    return {
      nr: nr ? Number(nr[1]) : 1,
      zug: pv[0],
      cp: wert[1] === "cp" ? Number(wert[2]) : 0,
      matt: wert[1] === "mate" ? Number(wert[2]) : 0,
      pv: pv.slice(0, 6),
    };
  }

  /** Führt einen Auftrag aus (läuft erst, wenn alle früheren fertig sind). */
  function rechne(auftrag, meineGeneration) {
    return new Promise(function (fertig, fehler) {
      if (meineGeneration !== generation) {
        fehler(new Error("abgebrochen"));
        return;
      }
      const linien = [];
      laufend = {
        fehler: fehler,
        zeile: function (zeile) {
          const info = liesInfo(zeile);
          if (info) linien[info.nr - 1] = info;      // die tiefste Angabe je Linie gewinnt
          if (zeile.indexOf("bestmove") !== 0) return;
          laufend = null;
          if (meineGeneration !== generation) {
            fehler(new Error("abgebrochen"));
            return;
          }
          const zug = zeile.split(" ")[1];
          fertig({ zug: zug && zug !== "(none)" ? zug : "", linien: linien.filter(Boolean) });
        },
      };
      const begrenzt = Boolean(auftrag.elo);
      sende("setoption name UCI_LimitStrength value " + (begrenzt ? "true" : "false"));
      if (begrenzt) sende("setoption name UCI_Elo value " + Math.round(auftrag.elo));
      sende("setoption name MultiPV value " + (auftrag.linien || 1));
      sende("position fen " + auftrag.fen);
      sende("go" + (auftrag.tiefe ? " depth " + auftrag.tiefe : "") + (auftrag.zeit ? " movetime " + Math.round(auftrag.zeit) : ""));
    });
  }

  /**
   * Lässt die Engine eine Stellung untersuchen.
   * @param {object} auftrag
   * @param {string} auftrag.fen – die Stellung
   * @param {number} [auftrag.tiefe] – Rechentiefe in Halbzügen
   * @param {number} [auftrag.zeit] – höchstens so viele Millisekunden
   * @param {number} [auftrag.linien] – so viele beste Züge mit Bewertung (MultiPV)
   * @param {number} [auftrag.elo] – Stärke begrenzen (ab 1320)
   * @returns {Promise<{zug: string, linien: Array}>} scheitert mit "abgebrochen" nach abbrechen()
   */
  function suche(auftrag) {
    const meineGeneration = generation;
    const ergebnis = schlange.then(function () {
      return starte().then(function () { return rechne(auftrag, meineGeneration); });
    });
    schlange = ergebnis.catch(function () {});      // die Schlange läuft auch nach einem Fehler weiter
    return ergebnis;
  }

  /** Verwirft alle wartenden Aufträge und stoppt die laufende Suche (neue Partie, Zug zurück). */
  function abbrechen() {
    generation++;
    if (worker && laufend) sende("stop");
  }

  /** Neue Partie: die Engine vergisst, was sie sich gemerkt hat. */
  function neuePartie() {
    abbrechen();
    schlange = schlange.then(function () { if (worker) sende("ucinewgame"); });
  }

  return {
    starte: starte,
    suche: suche,
    abbrechen: abbrechen,
    neuePartie: neuePartie,
  };
})();
