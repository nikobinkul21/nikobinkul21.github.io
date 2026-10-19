/* ==========================================================================
   climb/keyboard.js – die Tastatur als Raster mit Koordinaten
   Deutsches Layout (QWERTZ), nur Buchstaben und Zahlen der Haupttastatur.
   Gezählt wird event.code – also die POSITION der Taste, egal welches
   Layout eingestellt ist. "label" ist die Beschriftung auf QWERTZ.

   Jede Taste hat:
     reihe  – 0 Zahlenreihe, 1 QWERTZ-Reihe, 2 Grundreihe, 3 untere Reihe (Y bis M)
     spalte – Tastenspalte (1-Q-A-Y = 0, 2-W-S-X = 1, 3-E-D-C = 2 …)
     x      – waagerechte Lage in Tastenbreiten, mit dem echten Versatz der
              Reihen (Tab-Taste 1,5 breit, Feststelltaste 1,75, links
              neben Y sitzt auf deutschen Tastaturen noch "<")
     y      – gleich reihe

   Daraus lassen sich berechnen:
     Nachbarn    – eine Taste links/rechts in derselben Reihe oder eine
                   schräg darüber/darunter liegende (die sich in der Breite
                   mit ihr überschneidet, z. B. über D liegen E und R)
     Reihenfolge – Spalte und Lage x wachsen von links nach rechts
     Spannweite  – Abstand in Spalten
   Die Touch-Steuerung nutzt dasselbe Raster als Griff-Felder.
   ========================================================================== */

const KletterTastatur = (function () {

  const REIHEN = [
    { reihe: 0, x0: 1, codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"],
      labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
    { reihe: 1, x0: 1.5, codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
      labels: ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P"] },
    { reihe: 2, x0: 1.75, codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
      labels: ["A", "S", "D", "F", "G", "H", "J", "K", "L"] },
    { reihe: 3, x0: 2.25, codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"],
      labels: ["Y", "X", "C", "V", "B", "N", "M"] },
  ];

  const TASTEN = [];
  REIHEN.forEach(function (r) {
    r.codes.forEach(function (code, i) {
      TASTEN.push({ code: code, label: r.labels[i], reihe: r.reihe, spalte: i, x: r.x0 + i, y: r.reihe });
    });
  });
  const NACH_CODE = {};
  TASTEN.forEach(function (t) { NACH_CODE[t.code] = t; });

  /** Die Taste zu einem event.code (oder undefined). */
  function taste(code) {
    return NACH_CODE[code];
  }

  /**
   * Sind a und b benachbart? Eine Taste links oder rechts in derselben
   * Reihe – oder in der Reihe darüber bzw. darunter eine Taste, die sich
   * in der Breite mit ihr überschneidet (|Δx| < 1).
   */
  function istNachbar(a, b) {
    const ta = NACH_CODE[a], tb = NACH_CODE[b];
    if (!ta || !tb || a === b) return false;
    if (ta.reihe === tb.reihe) return Math.abs(ta.spalte - tb.spalte) === 1;
    return Math.abs(ta.reihe - tb.reihe) === 1 && Math.abs(ta.x - tb.x) < 1;
  }

  /**
   * Alle Nachbarn einer Taste – nur in den erlaubten Reihen.
   * @param {number[]} [reihen] – erlaubte Reihen (Standard: alle)
   */
  function nachbarn(code, reihen) {
    return TASTEN.filter(function (t) {
      return (!reihen || reihen.indexOf(t.reihe) !== -1) && istNachbar(code, t.code);
    }).map(function (t) { return t.code; });
  }

  /** Spalten von a nach b (positiv = b liegt rechts von a). */
  function spaltenAbstand(a, b) {
    return NACH_CODE[b].spalte - NACH_CODE[a].spalte;
  }

  /**
   * Liegen die Tasten (in Fingerreihenfolge) wirklich von links nach rechts?
   * Spalte UND Lage x müssen wachsen – so überholt kein Finger seinen
   * Nachbarn, und zwei Finger liegen nie auf derselben Taste oder
   * übereinander in derselben Spalte.
   */
  function vonLinksNachRechts(codes) {
    for (let i = 1; i < codes.length; i++) {
      const a = NACH_CODE[codes[i - 1]], b = NACH_CODE[codes[i]];
      if (!(b.spalte > a.spalte && b.x > a.x)) return false;
    }
    return true;
  }

  return {
    REIHEN: REIHEN,
    TASTEN: TASTEN,
    taste: taste,
    istNachbar: istNachbar,
    nachbarn: nachbarn,
    spaltenAbstand: spaltenAbstand,
    vonLinksNachRechts: vonLinksNachRechts,
  };
})();

if (typeof module !== "undefined") module.exports = KletterTastatur;
