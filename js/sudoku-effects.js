/* ==========================================================================
   sudoku-effects.js – Erfolgsanimationen für das Sudoku
   Wird eine Zeile, Spalte oder ein 3×3-Block durch eine Eingabe fertig,
   leuchten die Felder als Welle auf. Beim gelösten Rätsel läuft eine große
   Welle über das ganze Gitter.

   Arbeitsteilung:
     - JavaScript (diese Datei) entscheidet, WELCHE Felder leuchten und mit
       wie vielen "Schritten" Verzögerung. Dafür setzt es pro Feld nur die
       CSS-Variable --welle-schritte und eine Klasse.
     - CSS (css/sudoku.css, Abschnitt "ERFOLGSANIMATIONEN") entscheidet, WIE
       es aussieht: Farbe, Dauer, Tempo der Welle, Vergrößerung.
   ========================================================================== */

// Hauptschalter: false = keine Effekte (das Spiel funktioniert genauso).
// Später kann daraus ein Schalter in den Einstellungen werden.
const SUDOKU_EFFEKTE_AN = true;


const SudokuEffekte = (function () {

  // Zählt die Animationsläufe durch. So weiß das Aufräumen, ob ein Feld
  // inzwischen schon von einem NEUEREN Lauf benutzt wird.
  let laufNummer = 0;


  /* ------------------------------------------------------------------------
     WELCHE EINHEITEN SIND GERADE FERTIG GEWORDEN?
     ------------------------------------------------------------------------ */

  /** Die 9 Feldnummern einer Einheit, zu der Feld i gehört. */
  function felderDerEinheit(art, i) {
    const zeile = Math.floor(i / 9);
    const spalte = i % 9;
    const felder = [];
    for (let k = 0; k < 9; k++) {
      if (art === "zeile") {
        felder.push(zeile * 9 + k);
      } else if (art === "spalte") {
        felder.push(k * 9 + spalte);
      } else {
        // Block: linke obere Ecke des Blocks + Position innerhalb des Blocks
        const startZeile = zeile - (zeile % 3);
        const startSpalte = spalte - (spalte % 3);
        felder.push((startZeile + Math.floor(k / 3)) * 9 + startSpalte + (k % 3));
      }
    }
    return felder;
  }

  /** Ist die Einheit vollständig UND stimmt sie mit der Lösung überein? */
  function istKomplett(gitter, loesung, felder) {
    return felder.every(function (f) { return gitter[f] === loesung[f]; });
  }

  /**
   * Findet die Einheiten, die durch die Eingabe in Feld "index" GERADE EBEN
   * fertig geworden sind (vorher nicht komplett, nachher schon).
   * Einheiten, die schon vorher voll waren, zählen damit nicht.
   *
   * @param {number[]} vorher  – Gitter vor der Eingabe (81 Zahlen)
   * @param {number[]} nachher – Gitter nach der Eingabe
   * @param {number[]} loesung – die Lösung
   * @param {number} index     – das Feld, in das eingetragen wurde
   * @returns {string[]} z. B. ["zeile", "block"]
   */
  function fertigeEinheiten(vorher, nachher, loesung, index) {
    return ["zeile", "spalte", "block"].filter(function (art) {
      const felder = felderDerEinheit(art, index);
      return !istKomplett(vorher, loesung, felder) && istKomplett(nachher, loesung, felder);
    });
  }


  /* ------------------------------------------------------------------------
     ABSTÄNDE = VERZÖGERUNG
     Jedes Feld bekommt einen Abstand ("Schritte") zum gesetzten Feld.
     CSS rechnet daraus: Verzögerung = Schritte × --sudoku-effekt-schritt
     ------------------------------------------------------------------------ */

  /** Schritte von Feld "start" zu Feld "ziel" für eine Animationsart. */
  function schritte(art, start, ziel) {
    const dz = Math.abs(Math.floor(ziel / 9) - Math.floor(start / 9)); // Zeilen-Abstand
    const ds = Math.abs((ziel % 9) - (start % 9));                     // Spalten-Abstand
    if (art === "zeile") return ds;                  // nach links und rechts
    if (art === "spalte") return dz;                 // nach oben und unten
    if (art === "block") return Math.max(dz, ds);    // Ring um Ring nach außen
    return Math.hypot(dz, ds);                       // "sieg": runde Welle übers Gitter
  }


  /* ------------------------------------------------------------------------
     ABSPIELEN
     ------------------------------------------------------------------------ */

  /** Wandelt eine CSS-Zeitangabe ("0.45s" oder "450ms") in Millisekunden um. */
  function inMs(text) {
    const zahl = parseFloat(text) || 0;
    return text.trim().endsWith("ms") ? zahl : zahl * 1000;
  }

  /**
   * Lässt Felder aufleuchten.
   * @param {HTMLElement[]} felder – alle 81 Feld-Buttons
   * @param {Map<number, number>} verzoegerung – Feldnummer → Schritte
   * @param {string} klasse – "leuchtet" oder "leuchtet-stark"
   * @returns {Promise} – erfüllt, sobald die Animation komplett vorbei ist
   */
  function abspielen(felder, verzoegerung, klasse) {
    const lauf = ++laufNummer;
    const betroffen = Array.from(verzoegerung.keys()).map(function (i) { return felder[i]; });

    // Leuchtet ein Feld noch von vorhin, Animation zurücksetzen,
    // damit sie von vorn startet
    betroffen.forEach(function (feld) {
      feld.classList.remove("leuchtet", "leuchtet-stark");
    });
    void document.body.offsetWidth; // zwingt den Browser, die Entfernung zu "bemerken"

    // Pro Feld: Schritte als CSS-Variable + Klasse setzen
    let spaetestesFeld = betroffen[0];
    let meisteSchritte = -1;
    verzoegerung.forEach(function (anzahl, i) {
      const feld = felder[i];
      feld.style.setProperty("--welle-schritte", anzahl);
      feld.dataset.effektLauf = lauf;
      feld.classList.add(klasse);
      if (anzahl > meisteSchritte) {
        meisteSchritte = anzahl;
        spaetestesFeld = feld;
      }
    });

    // Wie lange dauert alles? Verzögerung + Dauer des spätesten Felds –
    // direkt aus dem CSS gelesen, damit die Werte nur dort stehen.
    // (Animiert wird die Ziffer darin, deshalb lesen wir dort ab.)
    const stil = getComputedStyle(spaetestesFeld.querySelector(".sudoku-ziffer"));
    const gesamtMs = inMs(stil.animationDelay) + inMs(stil.animationDuration);

    return new Promise(function (fertig) {
      setTimeout(function () {
        // Aufräumen – aber nur Felder, die nicht inzwischen neu gestartet wurden
        betroffen.forEach(function (feld) {
          if (feld.dataset.effektLauf === String(lauf)) {
            feld.classList.remove(klasse);
            feld.style.removeProperty("--welle-schritte");
            delete feld.dataset.effektLauf;
          }
        });
        fertig();
      }, gesamtMs + 30);
    });
  }

  /**
   * Animation für fertig gewordene Einheiten.
   * Gehört ein Feld zu mehreren Einheiten, zählt die KÜRZESTE Verzögerung –
   * es leuchtet also nur einmal.
   *
   * @param {HTMLElement[]} felder – alle 81 Feld-Buttons
   * @param {number} index – das gerade gesetzte Feld (Ausgangspunkt der Welle)
   * @param {string[]} einheiten – z. B. ["zeile", "block"]
   */
  function spieleEinheiten(felder, index, einheiten) {
    if (!SUDOKU_EFFEKTE_AN || einheiten.length === 0) {
      return Promise.resolve();
    }
    const verzoegerung = new Map();
    einheiten.forEach(function (art) {
      felderDerEinheit(art, index).forEach(function (f) {
        const s = schritte(art, index, f);
        if (!verzoegerung.has(f) || s < verzoegerung.get(f)) {
          verzoegerung.set(f, s);
        }
      });
    });
    return abspielen(felder, verzoegerung, "leuchtet");
  }

  /**
   * Große Welle über das ganze Gitter, wenn das Rätsel gelöst ist.
   * @returns {Promise} – erfüllt, wenn die Welle vorbei ist
   *                      (danach zeigt die Oberfläche die Erfolgsmeldung)
   */
  function spieleSieg(felder, index) {
    if (!SUDOKU_EFFEKTE_AN) {
      return Promise.resolve();
    }
    const verzoegerung = new Map();
    for (let f = 0; f < 81; f++) {
      verzoegerung.set(f, schritte("sieg", index, f));
    }
    return abspielen(felder, verzoegerung, "leuchtet-stark");
  }


  return {
    fertigeEinheiten: fertigeEinheiten,
    spieleEinheiten: spieleEinheiten,
    spieleSieg: spieleSieg,
  };
})();
