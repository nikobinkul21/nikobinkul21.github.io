/* ==========================================================================
   sudoku-engine.js – die reine Sudoku-Logik
   Hier gibt es KEINEN Zugriff auf die Seite (kein document, kein DOM).
   Die Datei kümmert sich nur um Zahlen: Rätsel erzeugen, lösen, prüfen.

   So wird ein Gitter gespeichert:
     Ein Array mit 81 Zahlen, Zeile für Zeile von links oben nach rechts unten.
     0 bedeutet "leeres Feld", 1–9 sind die Ziffern.
     Feld Nummer i liegt in Zeile Math.floor(i / 9) und Spalte i % 9.
   ========================================================================== */

const SudokuEngine = (function () {

  /* ------------------------------------------------------------------------
     SCHWIERIGKEITSGRADE
     Die EINZIGE Stelle, an der sie festgelegt sind. Die Auswahl in der
     Oberfläche wird aus dieser Liste erzeugt.
     Neuer Grad? Einfach einen weiteren Eintrag hinzufügen.
       id        – interner Name (wird auch gespeichert)
       name      – so steht es in der Auswahl
       vorgaben  – wie viele Zahlen am Anfang schon eingetragen sind
                   (weniger Vorgaben = schwerer)
     ------------------------------------------------------------------------ */
  const SCHWIERIGKEITSGRADE = [
    { id: "einfach", name: "Einfach", vorgaben: 42 },
    { id: "mittel", name: "Mittel", vorgaben: 34 },
    { id: "schwer", name: "Schwer", vorgaben: 28 },
    { id: "special", name: "Special Grade", vorgaben: 24 },
  ];

  // So lange darf die Erzeugung eines Rätsels höchstens dauern (Millisekunden)
  const ZEITLIMIT_MS = 2000;

  // Alle 9 Ziffern als Bitmaske: Bit 1 steht für die 1, Bit 2 für die 2 … Bit 9 für die 9
  // (0b1111111110 = Bits 1 bis 9 gesetzt)
  const ALLE_ZIFFERN = 0b1111111110;


  /* ------------------------------------------------------------------------
     KLEINE HELFER
     ------------------------------------------------------------------------ */

  /** In welchem 3×3-Block (0–8) liegt das Feld i? */
  function blockVon(i) {
    const zeile = Math.floor(i / 9);
    const spalte = i % 9;
    return Math.floor(zeile / 3) * 3 + Math.floor(spalte / 3);
  }

  /** Mischt ein Array zufällig (Fisher-Yates) und gibt es zurück. */
  function mischen(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = liste[i];
      liste[i] = liste[j];
      liste[j] = tmp;
    }
    return liste;
  }

  /** Zählt die gesetzten Bits einer Zahl = Anzahl möglicher Ziffern. */
  function anzahlBits(maske) {
    let anzahl = 0;
    while (maske) {
      maske &= maske - 1;           // löscht das unterste gesetzte Bit
      anzahl++;
    }
    return anzahl;
  }

  /** Macht aus einer Bitmaske eine Liste von Ziffern, z. B. 0b1010 → [1, 3]. */
  function zifferListe(maske) {
    const liste = [];
    for (let ziffer = 1; ziffer <= 9; ziffer++) {
      if (maske & (1 << ziffer)) {
        liste.push(ziffer);
      }
    }
    return liste;
  }


  /* ------------------------------------------------------------------------
     DER LÖSER (Backtracking)
     Idee: Nimm ein leeres Feld, probiere jede erlaubte Ziffer aus und mach
     mit dem nächsten Feld weiter. Geht es nicht weiter, Ziffer zurücknehmen
     und die nächste probieren ("Backtracking").

     Zwei Tricks machen ihn schnell:
       1. Für jede Zeile, Spalte und jeden Block merken wir uns die schon
          benutzten Ziffern als Bitmaske. So ist "Ist die 5 hier erlaubt?"
          eine einzige Rechenoperation.
       2. Wir nehmen immer das leere Feld mit den WENIGSTEN Möglichkeiten.
          Dadurch gibt es viel weniger Sackgassen.
     ------------------------------------------------------------------------ */

  /**
   * Durchsucht ein Gitter nach Lösungen.
   * @param {number[]} gitter – 81 Zahlen (wird nicht verändert)
   * @param {object} optionen
   *   grenze  – nach so vielen gefundenen Lösungen aufhören (Standard 1)
   *   zufall  – true: Ziffern in zufälliger Reihenfolge probieren
   * @returns {{anzahl: number, loesung: number[]|null}}
   *   anzahl  – gefundene Lösungen (höchstens "grenze")
   *   loesung – die erste gefundene Lösung oder null
   */
  function suche(gitter, optionen) {
    const grenze = optionen.grenze || 1;
    const zufall = optionen.zufall || false;

    const feld = gitter.slice();    // Kopie, damit das Original unverändert bleibt
    const zeilen = new Array(9).fill(0);
    const spalten = new Array(9).fill(0);
    const bloecke = new Array(9).fill(0);
    const leer = [];                // Nummern aller leeren Felder

    // Bitmasken mit den schon vorhandenen Ziffern füllen
    for (let i = 0; i < 81; i++) {
      const ziffer = feld[i];
      if (ziffer === 0) {
        leer.push(i);
        continue;
      }
      const bit = 1 << ziffer;
      const z = Math.floor(i / 9);
      const s = i % 9;
      const b = blockVon(i);
      // Ziffer kommt doppelt vor → das Gitter hat keine Lösung
      if ((zeilen[z] | spalten[s] | bloecke[b]) & bit) {
        return { anzahl: 0, loesung: null };
      }
      zeilen[z] |= bit;
      spalten[s] |= bit;
      bloecke[b] |= bit;
    }

    let anzahl = 0;
    let ersteLoesung = null;

    // Rekursive Suche. "rest" = wie viele leere Felder noch offen sind.
    function versuche(rest) {
      if (rest === 0) {
        // Alles ausgefüllt → Lösung gefunden
        anzahl++;
        if (!ersteLoesung) {
          ersteLoesung = feld.slice();
        }
        return anzahl >= grenze;    // true = genug gefunden, Suche beenden
      }

      // Das leere Feld mit den wenigsten Möglichkeiten suchen
      let besterPlatz = -1;
      let besteMaske = 0;
      let wenigste = 10;
      for (let k = 0; k < rest; k++) {
        const i = leer[k];
        const maske = ALLE_ZIFFERN & ~(zeilen[Math.floor(i / 9)] | spalten[i % 9] | bloecke[blockVon(i)]);
        const moeglich = anzahlBits(maske);
        if (moeglich < wenigste) {
          wenigste = moeglich;
          besterPlatz = k;
          besteMaske = maske;
          if (moeglich <= 1) break; // besser wird es nicht
        }
      }
      if (wenigste === 0) {
        return false;               // Sackgasse: hier passt keine Ziffer
      }

      // Das gewählte Feld ans Ende der offenen Liste tauschen und "abhaken"
      const i = leer[besterPlatz];
      leer[besterPlatz] = leer[rest - 1];
      leer[rest - 1] = i;

      const z = Math.floor(i / 9);
      const s = i % 9;
      const b = blockVon(i);
      let ziffern = zifferListe(besteMaske);
      if (zufall) {
        ziffern = mischen(ziffern);
      }

      for (const ziffer of ziffern) {
        const bit = 1 << ziffer;
        // Ziffer setzen …
        feld[i] = ziffer;
        zeilen[z] |= bit;
        spalten[s] |= bit;
        bloecke[b] |= bit;

        if (versuche(rest - 1)) {
          return true;
        }

        // … und wieder zurücknehmen (Backtracking)
        feld[i] = 0;
        zeilen[z] &= ~bit;
        spalten[s] &= ~bit;
        bloecke[b] &= ~bit;
      }

      // Feld wieder in die Liste zurücktauschen
      leer[rest - 1] = leer[besterPlatz];
      leer[besterPlatz] = i;
      return false;
    }

    versuche(leer.length);
    return { anzahl: anzahl, loesung: ersteLoesung };
  }

  /**
   * Zählt die Lösungen eines Gitters, hört aber beim zweiten Fund auf.
   * Mehr müssen wir nicht wissen: 0 = unlösbar, 1 = eindeutig, 2 = mehrdeutig.
   */
  function zaehleLoesungen(gitter) {
    return suche(gitter, { grenze: 2 }).anzahl;
  }

  /** Löst ein Gitter und gibt die Lösung zurück (oder null). */
  function loese(gitter) {
    return suche(gitter, { grenze: 1 }).loesung;
  }


  /* ------------------------------------------------------------------------
     RÄTSEL ERZEUGEN
     ------------------------------------------------------------------------ */

  /** Erzeugt ein zufälliges, vollständig ausgefülltes Gitter. */
  function erzeugeLoesung() {
    const leeresGitter = new Array(81).fill(0);
    return suche(leeresGitter, { grenze: 1, zufall: true }).loesung;
  }

  /**
   * EIN Versuch: neues gelöstes Gitter, dann Zahlen in zufälliger
   * Reihenfolge entfernen. Nach jedem Entfernen prüfen, ob das Rätsel
   * noch genau eine Lösung hat – sonst die Zahl zurücksetzen.
   * Hört auf, sobald nur noch "zielVorgaben" Zahlen übrig sind.
   * @returns {{raetsel: number[], loesung: number[], vorgaben: number}}
   */
  function einVersuch(zielVorgaben) {
    const loesung = erzeugeLoesung();
    const raetsel = loesung.slice();
    let vorgaben = 81;

    // Alle 81 Felder in zufälliger Reihenfolge
    const reihenfolge = mischen(Array.from({ length: 81 }, function (_, i) { return i; }));

    for (const i of reihenfolge) {
      if (vorgaben <= zielVorgaben) {
        break;                      // Ziel erreicht
      }
      const alterWert = raetsel[i];
      raetsel[i] = 0;
      if (zaehleLoesungen(raetsel) === 1) {
        vorgaben--;                 // weiterhin eindeutig → Zahl bleibt weg
      } else {
        raetsel[i] = alterWert;     // nicht mehr eindeutig → zurücksetzen
      }
    }

    return { raetsel: raetsel, loesung: loesung, vorgaben: vorgaben };
  }

  /**
   * Erzeugt ein Rätsel mit (möglichst) "zielVorgaben" vorgegebenen Zahlen.
   * Klappt es im ersten Versuch nicht, wird mit einem neuen Gitter
   * erneut versucht – insgesamt höchstens ZEITLIMIT_MS lang. Danach wird
   * das beste bisherige Ergebnis (mit den wenigsten Vorgaben) genommen.
   *
   * Zwischen den Versuchen gibt die Funktion per setTimeout kurz an den
   * Browser ab. So friert die Seite nicht ein, während sie rechnet.
   *
   * @returns {Promise<{raetsel, loesung, vorgaben, versuche, dauerMs}>}
   */
  function erzeugeRaetsel(zielVorgaben) {
    return new Promise(function (fertig) {
      const start = Date.now();
      let bestes = null;
      let versuche = 0;

      function naechsterVersuch() {
        const ergebnis = einVersuch(zielVorgaben);
        versuche++;
        if (!bestes || ergebnis.vorgaben < bestes.vorgaben) {
          bestes = ergebnis;
        }

        const dauer = Date.now() - start;
        if (bestes.vorgaben <= zielVorgaben || dauer >= ZEITLIMIT_MS) {
          bestes.versuche = versuche;
          bestes.dauerMs = dauer;
          fertig(bestes);
        } else {
          setTimeout(naechsterVersuch, 0); // kurz Pause für den Browser
        }
      }

      setTimeout(naechsterVersuch, 0);
    });
  }


  /* ------------------------------------------------------------------------
     PRÜFEN
     ------------------------------------------------------------------------ */

  /** Ist das Gitter vollständig und stimmt überall mit der Lösung überein? */
  function istGeloest(gitter, loesung) {
    for (let i = 0; i < 81; i++) {
      if (gitter[i] !== loesung[i]) {
        return false;
      }
    }
    return true;
  }

  /** Sucht einen Schwierigkeitsgrad über seine id (oder undefined). */
  function gradMitId(id) {
    return SCHWIERIGKEITSGRADE.find(function (grad) { return grad.id === id; });
  }


  // Nur diese Dinge sind von außen sichtbar
  return {
    SCHWIERIGKEITSGRADE: SCHWIERIGKEITSGRADE,
    ZEITLIMIT_MS: ZEITLIMIT_MS,
    erzeugeRaetsel: erzeugeRaetsel,
    einVersuch: einVersuch,
    zaehleLoesungen: zaehleLoesungen,
    loese: loese,
    istGeloest: istGeloest,
    gradMitId: gradMitId,
    blockVon: blockVon,
  };
})();

// Damit die Engine auch außerhalb des Browsers getestet werden kann (Node.js).
// Im Browser gibt es "module" nicht, dort passiert hier nichts.
if (typeof module !== "undefined") {
  module.exports = SudokuEngine;
}
