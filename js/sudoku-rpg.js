/* ==========================================================================
   sudoku-rpg.js – Regeln und Spielstand des Sudoku-Abenteuers
   KEIN Zugriff auf die Seite (kein document, kein DOM). Darstellung:
   js/sudoku-battle-ui.js und js/sudoku-ui.js.

   Grundidee:
     - Jede richtige Zahl wirft einen Würfel – so viele HP verliert der Boss.
       Vervollständigt die Zahl eine Zeile, Spalte oder einen Block, zählt
       der Wurf doppelt.
     - Jede falsche Zahl kostet ein Leben. Bei 0 Leben ist der Kampf
       verloren, der Boss beginnt mit vollen HP von vorn.
     - Richtige Zahlen und fertige Einheiten bringen Münzen.
     - Power-up-Felder im Sudoku lösen beim richtigen Ausfüllen eine
       Wirkung aus (Leben, Gift, Münzen …).

   Die Regeln MELDEN, was passiert (Ereignisse), statt selbst etwas
   anzuzeigen. Die Oberfläche hört zu und spielt Animationen ab:
     "richtig"        – richtige Zahl: Wurf, Schaden, Gift, Münzen, Power-up …
                        (alles, was diese eine Zahl bewirkt, in EINEM Ereignis)
     "powerup"        – ein Power-up-Feld wurde ausgelöst
     "fehler"         – falsche Zahl, ein Leben weniger
     "bossBesiegt"    – HP auf 0
     "neuerBoss"      – der nächste Boss steht bereit
     "sudokuGeloest"  – alle Felder richtig
     "niederlage"     – keine Leben mehr
     "zurueckgesetzt" – Abenteuer von vorn

   ERWEITERN (Items, Erfahrungspunkte, Fähigkeiten …) ohne die Grundregeln
   umzuschreiben:
     1. Auf Ereignisse hören:   spiel.an("bossBesiegt", function (e) { … })
     2. Den Schaden verändern:  spiel.erweitere({
                                  schaden: function (schaden, kontext) { return schaden + 2; }
                                })
        (wirkt auf den Würfelwurf, VOR einer Verdopplung)
     3. Neue Power-up-Typen:    ein weiterer Eintrag in powerupTypen (unten)
     4. Eigene Daten im Spielstand: zustand.extras.meinItem = …
        ("extras" wird mitgespeichert und bleibt sonst unangetastet)
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Zahlenwerte an EINER Stelle
   -------------------------------------------------------------------------- */
const SUDOKU_RPG_KONFIG = {
  // Bosse
  startHp: 80,          // HP des ersten Bosses
  hpZuwachs: 20,        // jeder weitere Boss hat so viel mehr

  // Würfel und Schaden
  wuerfelSeiten: 20,    // Würfel bei richtiger Zahl: 1 bis 20 Schaden
  doppelschadenFaktor: 2, // Zeile/Spalte/Block vervollständigt → Schaden × 2
                          // (mehrere Einheiten gleichzeitig: trotzdem nur × 2)

  // Leben
  startLeben: 3,        // so viele Leben zu Beginn (und nach einer Niederlage)
  maxLeben: 5,          // mehr geht nicht (z. B. durch rote Power-ups)
  lebenNachBoss: 3,     // nach einem besiegten Boss wird darauf aufgefüllt
                        // (wer mehr hat, behält sie)

  // Münzen
  muenzen: {
    proZahl: 1,         // jede richtige Zahl
    proZeileOderSpalte: 3, // je vervollständigte Zeile bzw. Spalte
    proBlock: 5,        // je vervollständigter 3×3-Block
  },

  // Power-up-Felder: so viele leere Felder pro Sudoku werden zu Power-ups
  powerupAnzahl: 5,

  // Die Power-up-Typen. Jeder Typ wird pro Feld nach "gewicht" ausgelost.
  // Neuer Typ? Einfach einen weiteren Eintrag – Farbe und Symbol nutzt die
  // Oberfläche (Symbole: "muenze", "tropfen", "herz", "stern", "blitz").
  // wirkung(effekt) verändert das Effekt-Objekt dieser Zahl:
  //   effekt.leben      – zusätzliche Leben
  //   effekt.muenzen    – zusätzliche Münzen
  //   effekt.giftAnteil – Anteil des Schadens, der zusätzlich als Gift trifft
  powerupTypen: [
    {
      id: "gold", name: "Gold", farbe: "#e6b422", symbol: "muenze", gewicht: 50,
      beschreibung: "+10 Münzen",
      wirkung: function (effekt) { effekt.muenzen += 10; },
    },
    {
      id: "gruen", name: "Grün", farbe: "#2fb35a", symbol: "tropfen", gewicht: 30,
      beschreibung: "Gift: die Hälfte des Schadens extra",
      wirkung: function (effekt) { effekt.giftAnteil += 0.5; },
    },
    {
      id: "rot", name: "Rot", farbe: "#e2364a", symbol: "herz", gewicht: 20,
      beschreibung: "+1 Leben",
      wirkung: function (effekt) { effekt.leben += 1; },
    },
  ],

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
  const VERSION = 2;    // Version 1 kannte noch keine Leben, Münzen, Power-ups


  /* ------------------------------------------------------------------------
     BOSSE, POWER-UPS, EINHEITEN
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

  /** Power-up-Typ über seine id (oder undefined). */
  function powerupTyp(id) {
    return K.powerupTypen.find(function (t) { return t.id === id; });
  }

  /** Zieht nach Gewicht einen Eintrag aus einer Liste ({ gewicht }). */
  function ziehe(liste, gewichtVon, zufall) {
    const gewichte = liste.map(gewichtVon);
    const summe = gewichte.reduce(function (a, b) { return a + b; }, 0);
    let wert = zufall() * summe;
    for (let i = 0; i < liste.length; i++) {
      wert -= gewichte[i];
      if (wert < 0) return liste[i];
    }
    return liste[liste.length - 1];
  }

  /**
   * Welche Einheiten (Zeile, Spalte, Block) des Felds sind komplett gefüllt?
   * Im Abenteuer stehen nur richtige Zahlen im Gitter – gefüllt heißt also richtig.
   */
  function fertigeEinheiten(r, index) {
    const zeile = Math.floor(index / 9);
    const spalte = index % 9;
    const startZ = zeile - (zeile % 3);
    const startS = spalte - (spalte % 3);
    const gefuellt = function (i) { return r.vorgaben[i] !== 0 || r.eingaben[i] !== 0; };
    let z = true, s = true, b = true;
    for (let k = 0; k < 9; k++) {
      if (!gefuellt(zeile * 9 + k)) z = false;
      if (!gefuellt(k * 9 + spalte)) s = false;
      if (!gefuellt((startZ + Math.floor(k / 3)) * 9 + startS + (k % 3))) b = false;
    }
    return { zeile: z, spalte: s, block: b };
  }


  /* ------------------------------------------------------------------------
     SPIELSTAND
     {
       version, bossNummer, bossHp, leben, muenzen, rekord,
       raetsel: null | { grad, vorgaben, loesung, eingaben, geloest,
                         powerups: [ { index, typ } ] },
       extras: {}          ← frei für spätere Erweiterungen
     }
     raetsel = null bedeutet: Es muss ein neues Sudoku ausgelost werden.
     ------------------------------------------------------------------------ */

  function neuerZustand() {
    return {
      version: VERSION,
      bossNummer: 1,
      bossHp: maxHp(1),
      leben: K.startLeben,
      muenzen: 0,
      rekord: 0,            // höchster besiegter Boss
      raetsel: null,
      extras: {},
    };
  }

  function istGanzzahl(wert, min, max) {
    return Number.isInteger(wert) && wert >= min && wert <= max;
  }

  /**
   * Prüft einen Spielstand (beim Laden und beim Import) und ergänzt ältere
   * Stände (Version 1: noch "fehler" statt Leben, keine Münzen/Power-ups).
   * @returns {{ok: true, daten, ohnePowerups: boolean} | {ok: false, fehler}}
   *   ohnePowerups = true: das laufende Sudoku stammt aus Version 1 und
   *   hat hier gerade seine Power-up-Felder bekommen
   * @param {function} [zufall] – für das Auslosen dieser Felder (Standard: Math.random)
   */
  function pruefeDaten(roh, zufall) {
    if (!roh || typeof roh !== "object" || (roh.version !== 1 && roh.version !== VERSION)) {
      return { ok: false, fehler: "Kein gültiger Abenteuer-Spielstand." };
    }
    const alt = roh.version === 1;

    // Leben: in Version 1 aus den Fehlern berechnen (3 − Fehler)
    let leben = roh.leben;
    if (alt) {
      if (!istGanzzahl(roh.fehler, 0, 2)) return { ok: false, fehler: "Abenteuer: ungültige Fehlerzahl." };
      leben = Math.max(1, K.startLeben - roh.fehler);
    }
    const muenzen = alt && roh.muenzen === undefined ? 0 : roh.muenzen;

    if (!istGanzzahl(roh.bossNummer, 1, 1e6) ||
        !istGanzzahl(roh.bossHp, 1, maxHp(roh.bossNummer)) ||
        !istGanzzahl(leben, 1, K.maxLeben) ||
        !istGanzzahl(muenzen, 0, 1e9) ||
        !istGanzzahl(roh.rekord, 0, 1e6)) {
      return { ok: false, fehler: "Abenteuer: ungültige Werte für Boss, HP, Leben, Münzen oder Rekord." };
    }

    let raetsel = null;
    let ohnePowerups = false;
    if (roh.raetsel) {
      const r = roh.raetsel;
      const istGitter = function (liste) {
        return Array.isArray(liste) && liste.length === 81 &&
          liste.every(function (z) { return istGanzzahl(z, 0, 9); });
      };
      if (!Engine.gradMitId(r.grad) || !istGitter(r.vorgaben) || !istGitter(r.loesung) || !istGitter(r.eingaben)) {
        return { ok: false, fehler: "Abenteuer: das gespeicherte Sudoku ist beschädigt." };
      }
      let powerups = [];
      if (Array.isArray(r.powerups)) {
        const gueltig = r.powerups.every(function (p) {
          return p && istGanzzahl(p.index, 0, 80) && powerupTyp(p.typ) && r.vorgaben[p.index] === 0;
        });
        if (!gueltig) return { ok: false, fehler: "Abenteuer: ungültige Power-up-Felder." };
        powerups = r.powerups.map(function (p) { return { index: p.index, typ: p.typ }; });
      } else {
        ohnePowerups = true;        // älterer Stand → Power-ups werden unten ergänzt
      }
      raetsel = { grad: r.grad, vorgaben: r.vorgaben.slice(), loesung: r.loesung.slice(),
        eingaben: r.eingaben.slice(), geloest: r.geloest === true, powerups: powerups };
      // Gilt auch beim Import einer alten Sicherung (settings.js)
      if (ohnePowerups && !raetsel.geloest) raetsel.powerups = lostPowerups(raetsel, zufall || Math.random);
    }
    return {
      ok: true,
      ohnePowerups: ohnePowerups,
      daten: {
        version: VERSION,
        bossNummer: roh.bossNummer,
        bossHp: roh.bossHp,
        leben: leben,
        muenzen: muenzen,
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

  /**
   * Wählt Power-up-Felder: zufällige LEERE Felder, Typ je Feld nach Gewicht.
   * @returns {{index, typ}[]}
   */
  function lostPowerups(r, zufall) {
    const leer = [];
    for (let i = 0; i < 81; i++) {
      if (r.vorgaben[i] === 0 && r.eingaben[i] === 0) leer.push(i);
    }
    // Leere Felder mischen (Fisher-Yates) und die ersten nehmen
    for (let i = leer.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      const tmp = leer[i]; leer[i] = leer[j]; leer[j] = tmp;
    }
    return leer.slice(0, K.powerupAnzahl).sort(function (a, b) { return a - b; }).map(function (index) {
      return { index: index, typ: ziehe(K.powerupTypen, function (t) { return t.gewicht; }, zufall).id };
    });
  }


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

    // Ein älterer Stand wird dabei ergänzt (Leben, Münzen, Power-up-Felder)
    const geladen = pruefeDaten(speicher.laden(), zufall);
    let zustand = geladen.ok ? geladen.daten : neuerZustand();
    if (geladen.ok && geladen.daten !== null) {
      speicher.speichern(zustand);          // ergänzte Werte gleich festhalten
    }

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
      return ziehe(Engine.SCHWIERIGKEITSGRADE, function (g) {
        return K.gradGewichte[g.id] !== undefined ? K.gradGewichte[g.id] : 1;
      }, zufall);
    }

    /** Ein neues Sudoku übernehmen (nachdem die Oberfläche es erzeugt hat) – mit Power-up-Feldern. */
    function starteRaetsel(gradId, vorgaben, loesung) {
      zustand.raetsel = {
        grad: gradId,
        vorgaben: vorgaben.slice(),
        loesung: loesung.slice(),
        eingaben: new Array(81).fill(0),
        geloest: false,
        powerups: [],
      };
      zustand.raetsel.powerups = lostPowerups(zustand.raetsel, zufall);
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

      // ---- Falsche Zahl → ein Leben weniger (Zahl und Power-up bleiben, wie sie sind)
      if (ziffer !== r.loesung[index]) {
        zustand.leben--;
        const ereignis = {
          index: index, ziffer: ziffer, leben: zustand.leben, startLeben: K.startLeben,
          boss: bossInfo(zustand.bossNummer),
        };
        if (zustand.leben <= 0) {
          // Niederlage: gleicher Boss mit vollen HP, Leben wieder auf Start,
          // neues Sudoku nötig. Münzen bleiben!
          const boss = bossInfo(zustand.bossNummer);
          const niederlage = {
            boss: boss, schadenGemacht: boss.maxHp - zustand.bossHp, rekord: zustand.rekord,
            muenzen: zustand.muenzen,
          };
          zustand.bossHp = boss.maxHp;
          zustand.leben = K.startLeben;
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

      // ---- Richtige Zahl → eintragen (gesperrt)
      r.eingaben[index] = ziffer;
      const bossVorher = bossInfo(zustand.bossNummer);
      const hpVorher = zustand.bossHp;

      // 1. Fertige Einheiten → Doppelschaden und Münzen
      const einheiten = fertigeEinheiten(r, index);
      const doppelt = einheiten.zeile || einheiten.spalte || einheiten.block;

      // 2. Power-up auf diesem Feld?
      const effekt = { leben: 0, muenzen: 0, giftAnteil: 0 };
      const pIndex = r.powerups.findIndex(function (p) { return p.index === index; });
      let powerup = null;
      if (pIndex !== -1) {
        const typ = powerupTyp(r.powerups[pIndex].typ);
        r.powerups.splice(pIndex, 1);       // ausgelöst → Markierung weg
        typ.wirkung(effekt, { zustand: zustand, boss: bossVorher });
        powerup = { index: index, typ: typ.id, name: typ.name };
      }

      // 3. Schaden: Wurf (→ Erweiterungen) → ggf. verdoppeln → ggf. Gift obendrauf
      const wurf = wuerfle();
      const grundSchaden = berechneSchaden(wurf);
      const schaden = doppelt ? grundSchaden * K.doppelschadenFaktor : grundSchaden;
      const gift = effekt.giftAnteil > 0 ? Math.ceil(schaden * effekt.giftAnteil) : 0;
      const hpNachSchaden = Math.max(0, hpVorher - schaden);
      const hpNachher = Math.max(0, hpNachSchaden - gift);
      zustand.bossHp = hpNachher;

      // 4. Münzen: je Zahl + je fertige Zeile/Spalte + je fertiger Block + Power-up
      const muenzenPlus = K.muenzen.proZahl +
        (einheiten.zeile ? K.muenzen.proZeileOderSpalte : 0) +
        (einheiten.spalte ? K.muenzen.proZeileOderSpalte : 0) +
        (einheiten.block ? K.muenzen.proBlock : 0) +
        effekt.muenzen;
      zustand.muenzen += muenzenPlus;

      // 5. Leben (Power-up), höchstens bis zur Obergrenze
      const lebenVorher = zustand.leben;
      zustand.leben = Math.min(K.maxLeben, zustand.leben + effekt.leben);
      const lebenPlus = zustand.leben - lebenVorher;

      // 6. Boss besiegt? → Rekord, nächster Boss, Leben auf mindestens lebenNachBoss
      const besiegt = hpNachher === 0;
      let neuerBoss = null;
      if (besiegt) {
        zustand.rekord = Math.max(zustand.rekord, bossVorher.nummer);
        zustand.bossNummer++;
        neuerBoss = bossInfo(zustand.bossNummer);
        zustand.bossHp = neuerBoss.maxHp;
        zustand.leben = Math.max(zustand.leben, K.lebenNachBoss);
      }

      // 7. Sudoku komplett?
      const geloest = r.vorgaben.every(function (v, i) { return (v || r.eingaben[i]) === r.loesung[i]; });
      if (geloest) {
        r.geloest = true;
      }
      speichern();

      // Alles, was diese Zahl bewirkt hat, in EINEM Ereignis
      const treffer = {
        index: index, ziffer: ziffer, boss: bossVorher,
        wurf: wurf, grundSchaden: grundSchaden, doppelt: doppelt, einheiten: einheiten,
        schaden: schaden, gift: gift,
        hpVorher: hpVorher, hpNachSchaden: hpNachSchaden, hpNachher: hpNachher,
        powerup: powerup,
        muenzenPlus: muenzenPlus, muenzen: zustand.muenzen,
        lebenGewuenscht: effekt.leben, lebenPlus: lebenPlus,
        leben: besiegt ? lebenVorher + lebenPlus : zustand.leben, maxLeben: K.maxLeben,
      };
      melde("richtig", treffer);
      if (powerup) {
        melde("powerup", { index: index, typ: powerup.typ, effekt: effekt, treffer: treffer });
      }
      if (besiegt) {
        melde("bossBesiegt", { boss: bossVorher, rekord: zustand.rekord });
        melde("neuerBoss", { boss: neuerBoss, hp: neuerBoss.maxHp, leben: zustand.leben, rekord: zustand.rekord });
      }
      if (geloest) {
        // Neues Sudoku nötig – Boss (HP) und Leben bleiben, wie sie sind.
        // Das Rätsel bleibt bis zum nächsten starteRaetsel() zum Anschauen stehen.
        melde("sudokuGeloest", { grad: r.grad, boss: bossInfo(zustand.bossNummer), hp: zustand.bossHp });
      }
      return {
        art: "richtig", wurf: wurf, schaden: schaden, gift: gift, doppelt: doppelt,
        powerup: powerup, muenzenPlus: muenzenPlus, lebenPlus: lebenPlus,
        besiegt: besiegt, geloest: geloest,
      };
    }

    /** Muss vor dem Weiterspielen ein neues Sudoku ausgelost werden? */
    function brauchtRaetsel() {
      return !zustand.raetsel || zustand.raetsel.geloest;
    }

    /** Alles auf Anfang (Boss 1, Startleben, 0 Münzen). Der Rekord wird ebenfalls gelöscht. */
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
    powerupTyp: powerupTyp,
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
