/* ==========================================================================
   sudoku-rpg.js – Regeln und Spielstand des Sudoku-Abenteuers
   KEIN Zugriff auf die Seite (kein document, kein DOM). Darstellung:
   js/sudoku-battle-ui.js und js/sudoku-ui.js.

   Grundidee:
     - Jede richtige Zahl wirft einen Würfel – so viele HP verliert der Boss.
     - Jede falsche Zahl ist ein Fehler. Zu viele Fehler beim selben Boss
       = Niederlage, der Boss beginnt mit vollen HP von vorn.
     - Besiegte Bosse werden durch den nächsten (stärkeren) ersetzt.

   Die Regeln MELDEN, was passiert (Ereignisse), statt selbst etwas
   anzuzeigen. Die Oberfläche hört zu und spielt Animationen ab:
     "richtig"        – richtige Zahl, Würfelwurf, Schaden
     "fehler"         – falsche Zahl
     "bossBesiegt"    – HP auf 0
     "neuerBoss"      – der nächste Boss steht bereit
     "sudokuGeloest"  – alle Felder richtig
     "niederlage"     – zu viele Fehler beim selben Boss
     "zurueckgesetzt" – Abenteuer von vorn

   ERWEITERN (Items, Erfahrungspunkte, Fähigkeiten …) ohne die Grundregeln
   umzuschreiben:
     1. Auf Ereignisse hören:   spiel.an("bossBesiegt", function (e) { … })
     2. Den Schaden verändern:  spiel.erweitere({
                                  schaden: function (schaden, kontext) { return schaden + 2; }
                                })
        (kontext enthält z. B. den Würfelwurf, den Boss und den Spielstand)
     3. Eigene Daten im Spielstand: zustand.extras.meinItem = …
        ("extras" wird mitgespeichert und bleibt sonst unangetastet)
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Zahlenwerte an EINER Stelle
   -------------------------------------------------------------------------- */
const SUDOKU_RPG_KONFIG = {
  startHp: 80,          // HP des ersten Bosses
  hpZuwachs: 20,        // jeder weitere Boss hat so viel mehr
  wuerfelSeiten: 20,    // Würfel bei richtiger Zahl: 1 bis 20 Schaden
  maxFehler: 3,         // so viele Fehler beim selben Boss = Niederlage

  // Die Bosse in ihrer Reihenfolge. Nach dem letzten geht es mit dem
  // ersten weiter – mit anderer Farbpalette und höherer Nummer.
  // "sprite" verweist auf eine Figur in js/sudoku-sprites.js.
  bosse: [
    { name: "Schleimkönig", sprite: "schleim" },
    { name: "Knochenfürst", sprite: "knochen" },
    { name: "Giftpilz", sprite: "pilz" },
    { name: "Steingolem", sprite: "golem" },
    { name: "Schattendrache", sprite: "drache" },
  ],

  // Gewichte für die Auslosung der Schwierigkeit (id aus der Liste in
  // sudoku-engine.js). Höheres Gewicht = wird öfter gezogen.
  // Ein Grad, der hier fehlt, hat Gewicht 1.
  gradGewichte: {
    einfach: 1,
    mittel: 1,
    schwer: 1,
    special: 1,
  },
};


const SudokuRPG = (function () {

  // Die Engine liefert die Liste der Schwierigkeitsgrade. Im Browser ist sie
  // schon geladen, in Node.js (für Tests) wird sie hier nachgeladen.
  const Engine = typeof SudokuEngine !== "undefined" ? SudokuEngine : require("./sudoku-engine.js");

  const K = SUDOKU_RPG_KONFIG;
  const SPEICHER_SCHLUESSEL = "ntb-sudoku-abenteuer";
  const VERSION = 1;


  /* ------------------------------------------------------------------------
     BOSSE
     ------------------------------------------------------------------------ */

  /** Höchste HP des Bosses mit dieser Nummer (1, 2, 3 …). */
  function maxHp(nummer) {
    return K.startHp + (nummer - 1) * K.hpZuwachs;
  }

  /**
   * Alles über den Boss mit dieser Nummer.
   * Nach dem 5. Boss beginnt eine neue "Runde": gleiche Figuren,
   * andere Farbe (runde = 1, 2 … → die Oberfläche färbt um).
   */
  function bossInfo(nummer) {
    const index = (nummer - 1) % K.bosse.length;
    return {
      nummer: nummer,
      name: K.bosse[index].name,
      sprite: K.bosse[index].sprite,
      runde: Math.floor((nummer - 1) / K.bosse.length),
      maxHp: maxHp(nummer),
    };
  }


  /* ------------------------------------------------------------------------
     SPIELSTAND
     {
       version, bossNummer, bossHp, fehler, rekord,
       raetsel: null | { grad, vorgaben, loesung, eingaben, geloest },
       extras: {}          ← frei für spätere Erweiterungen
     }
     raetsel = null bedeutet: Es muss ein neues Sudoku ausgelost werden.
     ------------------------------------------------------------------------ */

  function neuerZustand() {
    return {
      version: VERSION,
      bossNummer: 1,
      bossHp: maxHp(1),
      fehler: 0,
      rekord: 0,            // höchster besiegter Boss
      raetsel: null,
      extras: {},
    };
  }

  function istGanzzahl(wert, min, max) {
    return Number.isInteger(wert) && wert >= min && wert <= max;
  }

  /**
   * Prüft einen Spielstand (beim Laden und beim Import).
   * @returns {{ok: true, daten} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    if (!roh || typeof roh !== "object" || roh.version !== VERSION) {
      return { ok: false, fehler: "Kein gültiger Abenteuer-Spielstand." };
    }
    if (!istGanzzahl(roh.bossNummer, 1, 1e6) ||
        !istGanzzahl(roh.bossHp, 1, maxHp(roh.bossNummer)) ||
        !istGanzzahl(roh.fehler, 0, K.maxFehler - 1) ||
        !istGanzzahl(roh.rekord, 0, 1e6)) {
      return { ok: false, fehler: "Abenteuer: ungültige Werte für Boss, HP, Fehler oder Rekord." };
    }
    let raetsel = null;
    if (roh.raetsel) {
      const r = roh.raetsel;
      const istGitter = function (liste) {
        return Array.isArray(liste) && liste.length === 81 &&
          liste.every(function (z) { return istGanzzahl(z, 0, 9); });
      };
      if (!Engine.gradMitId(r.grad) || !istGitter(r.vorgaben) || !istGitter(r.loesung) || !istGitter(r.eingaben)) {
        return { ok: false, fehler: "Abenteuer: das gespeicherte Sudoku ist beschädigt." };
      }
      raetsel = { grad: r.grad, vorgaben: r.vorgaben.slice(), loesung: r.loesung.slice(),
        eingaben: r.eingaben.slice(), geloest: r.geloest === true };
    }
    return {
      ok: true,
      daten: {
        version: VERSION,
        bossNummer: roh.bossNummer,
        bossHp: roh.bossHp,
        fehler: roh.fehler,
        rekord: roh.rekord,
        raetsel: raetsel,
        extras: roh.extras && typeof roh.extras === "object" ? roh.extras : {},
      },
    };
  }

  /** Speicher im Browser (localStorage). Für Tests lässt sich ein anderer übergeben. */
  const BROWSER_SPEICHER = {
    laden: function () {
      try {
        return JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL));
      } catch (fehler) {
        return null;
      }
    },
    speichern: function (daten) {
      try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
      } catch (fehler) {
        // Speichern nicht möglich (z. B. privater Modus)
      }
    },
  };


  /* ------------------------------------------------------------------------
     EIN ABENTEUER
     ------------------------------------------------------------------------ */

  /**
   * Erzeugt ein Abenteuer – mit dem gespeicherten Stand oder von vorn.
   * @param {object} [optionen]
   *   speicher – { laden(), speichern(daten) }   (Standard: localStorage)
   *   zufall   – Funktion, die eine Zahl in [0, 1) liefert (Standard: Math.random)
   */
  function erstelle(optionen) {
    optionen = optionen || {};
    const speicher = optionen.speicher || BROWSER_SPEICHER;
    const zufall = optionen.zufall || Math.random;

    const geladen = pruefeDaten(speicher.laden());
    let zustand = geladen.ok ? geladen.daten : neuerZustand();

    const hoerer = {};          // Ereignisname → Liste von Funktionen
    const erweiterungen = [];   // eingehängte Zusatzregeln

    function speichern() {
      speicher.speichern(zustand);
    }

    /** Meldet ein Ereignis an alle Zuhörer. */
    function melde(name, daten) {
      (hoerer[name] || []).forEach(function (fn) { fn(daten); });
    }

    /** Würfelt: 1 bis K.wuerfelSeiten */
    function wuerfle() {
      return 1 + Math.floor(zufall() * K.wuerfelSeiten);
    }

    /** Schaden aus dem Wurf – Erweiterungen dürfen ihn verändern. */
    function berechneSchaden(wurf) {
      const kontext = { wurf: wurf, boss: bossInfo(zustand.bossNummer), zustand: zustand };
      return erweiterungen.reduce(function (schaden, erw) {
        return typeof erw.schaden === "function" ? Math.max(0, Math.round(erw.schaden(schaden, kontext))) : schaden;
      }, wurf);
    }

    /** Lost einen Schwierigkeitsgrad nach Gewicht aus (Objekt aus der Engine-Liste). */
    function loseGrad() {
      const grade = Engine.SCHWIERIGKEITSGRADE;
      const gewichte = grade.map(function (g) {
        return K.gradGewichte[g.id] !== undefined ? K.gradGewichte[g.id] : 1;
      });
      const summe = gewichte.reduce(function (a, b) { return a + b; }, 0);
      let wert = zufall() * summe;
      for (let i = 0; i < grade.length; i++) {
        wert -= gewichte[i];
        if (wert < 0) return grade[i];
      }
      return grade[grade.length - 1];
    }

    /** Ein neues Sudoku übernehmen (nachdem die Oberfläche es erzeugt hat). */
    function starteRaetsel(gradId, vorgaben, loesung) {
      zustand.raetsel = {
        grad: gradId,
        vorgaben: vorgaben.slice(),
        loesung: loesung.slice(),
        eingaben: new Array(81).fill(0),
        geloest: false,
      };
      speichern();
    }

    /**
     * DIE KERNREGEL: Eine Zahl in ein Feld setzen.
     * Der Spielstand ist danach SOFORT aktuell und gespeichert – die
     * Ereignisse werden währenddessen gemeldet.
     * @returns {object} { art: "richtig" | "fehler" | "gesperrt" | "kein-raetsel", … }
     */
    function setzeZahl(index, ziffer) {
      const r = zustand.raetsel;
      if (!r || r.geloest) return { art: "kein-raetsel" };
      // Vorgaben und schon richtig gesetzte Zahlen sind gesperrt
      if (r.vorgaben[index] !== 0 || r.eingaben[index] !== 0) return { art: "gesperrt" };
      if (!istGanzzahl(ziffer, 1, 9)) return { art: "gesperrt" };

      // ---- Falsche Zahl → Fehler (die Zahl wird NICHT gespeichert)
      if (ziffer !== r.loesung[index]) {
        zustand.fehler++;
        const ereignis = {
          index: index, ziffer: ziffer, fehler: zustand.fehler, maxFehler: K.maxFehler,
          boss: bossInfo(zustand.bossNummer),
        };
        if (zustand.fehler >= K.maxFehler) {
          // Niederlage: gleicher Boss, volle HP, Fehler auf 0, neues Sudoku nötig
          const boss = bossInfo(zustand.bossNummer);
          const niederlage = {
            boss: boss, schadenGemacht: boss.maxHp - zustand.bossHp, rekord: zustand.rekord,
          };
          zustand.bossHp = boss.maxHp;
          zustand.fehler = 0;
          zustand.raetsel = null;
          speichern();
          melde("fehler", ereignis);
          melde("niederlage", niederlage);
          return { art: "fehler", niederlage: true };
        }
        speichern();
        melde("fehler", ereignis);
        return { art: "fehler", niederlage: false };
      }

      // ---- Richtige Zahl → eintragen (gesperrt), würfeln, Schaden
      r.eingaben[index] = ziffer;
      const wurf = wuerfle();
      const schaden = berechneSchaden(wurf);
      const hpVorher = zustand.bossHp;
      const bossVorher = bossInfo(zustand.bossNummer);
      zustand.bossHp = Math.max(0, hpVorher - schaden);
      const besiegt = zustand.bossHp === 0;

      let neuerBoss = null;
      if (besiegt) {
        // Rekord merken, nächster Boss mit vollen HP, Fehler auf 0
        zustand.rekord = Math.max(zustand.rekord, bossVorher.nummer);
        zustand.bossNummer++;
        neuerBoss = bossInfo(zustand.bossNummer);
        zustand.bossHp = neuerBoss.maxHp;
        zustand.fehler = 0;
      }

      // Sudoku komplett?
      const geloest = r.vorgaben.every(function (v, i) { return (v || r.eingaben[i]) === r.loesung[i]; });
      if (geloest) {
        r.geloest = true;
      }
      speichern();

      melde("richtig", {
        index: index, ziffer: ziffer, wurf: wurf, schaden: schaden,
        boss: bossVorher, hpVorher: hpVorher, hpNachher: Math.max(0, hpVorher - schaden),
      });
      if (besiegt) {
        melde("bossBesiegt", { boss: bossVorher, rekord: zustand.rekord });
        melde("neuerBoss", { boss: neuerBoss, hp: neuerBoss.maxHp });
      }
      if (geloest) {
        // Neues Sudoku nötig – Boss (HP) und Fehlerstand bleiben, wie sie sind.
        // Das Rätsel bleibt bis zum nächsten starteRaetsel() zum Anschauen stehen.
        melde("sudokuGeloest", { grad: r.grad, boss: bossInfo(zustand.bossNummer), hp: zustand.bossHp });
      }
      return { art: "richtig", wurf: wurf, schaden: schaden, besiegt: besiegt, geloest: geloest };
    }

    /** Muss vor dem Weiterspielen ein neues Sudoku ausgelost werden? */
    function brauchtRaetsel() {
      return !zustand.raetsel || zustand.raetsel.geloest;
    }

    /** Alles auf Anfang (Boss 1). Der Rekord bleibt NICHT erhalten. */
    function zuruecksetzen() {
      zustand = neuerZustand();
      speichern();
      melde("zurueckgesetzt", { boss: bossInfo(1) });
    }

    return {
      /** Der aktuelle Spielstand (nur lesen!) */
      get zustand() { return zustand; },
      boss: function () { return bossInfo(zustand.bossNummer); },
      an: function (name, fn) { (hoerer[name] = hoerer[name] || []).push(fn); },
      erweitere: function (erweiterung) { erweiterungen.push(erweiterung); },
      loseGrad: loseGrad,
      starteRaetsel: starteRaetsel,
      setzeZahl: setzeZahl,
      brauchtRaetsel: brauchtRaetsel,
      zuruecksetzen: zuruecksetzen,
    };
  }


  /* ------------------------------------------------------------------------
     SICHERUNG (für settings.js – Export/Import aller Daten)
     ------------------------------------------------------------------------ */

  /** Gespeicherter Stand als Objekt oder null, wenn noch keiner existiert. */
  function alsObjekt() {
    const geprueft = pruefeDaten(BROWSER_SPEICHER.laden());
    return geprueft.ok ? geprueft.daten : null;
  }

  /** Ersetzt den Spielstand (geprüfte Daten) – oder löscht ihn bei null. */
  function ersetzen(daten) {
    if (daten) {
      BROWSER_SPEICHER.speichern(daten);
    } else {
      try { localStorage.removeItem(SPEICHER_SCHLUESSEL); } catch (fehler) { /* egal */ }
    }
  }


  return {
    KONFIG: K,
    bossInfo: bossInfo,
    maxHp: maxHp,
    erstelle: erstelle,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = SudokuRPG;
}
