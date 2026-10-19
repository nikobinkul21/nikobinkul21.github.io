/* ==========================================================================
   climb/regeln.js – die Regeln des Kletterspiels (ohne Anzeige)
   Hier steht nur, WAS passiert. Die Oberfläche (climb/darstellung.js)
   meldet gedrückte und losgelassene Tasten und die Zeit; die Regeln melden
   Ereignisse zurück. Die Zeit kommt immer von außen (Millisekunden) – so
   lässt sich alles ohne Browser testen.

   EINE HAND, VIER FINGER
     Ein "Griff" sind die vier Tasten unter den Fingern, von links nach
     rechts (Position 0 bis 3). Jeder Versuch beginnt mit D, F, H, J.
     Ein Griffwechsel bewegt genau EINEN Finger auf eine benachbarte Taste
     (climb/keyboard.js) – die anderen drei bleiben liegen. Erlaubt ist er nur,
     wenn danach gilt:
       - die Tasten liegen weiter von links nach rechts (kein Finger
         überholt seinen Nachbarn, nie zwei auf derselben Taste oder in
         derselben Spalte),
       - zwischen zwei benachbarten Fingern höchstens maxAbstandNachbarn
         Spalten Abstand, außen insgesamt höchstens maxAbstandGesamt,
       - nur erlaubte Reihen (die Zahlenreihe ab zahlenreiheAb Metern).
     Bei der Auswahl außerdem: nie öfter als maxGleicherFinger hintereinander
     derselbe Finger; ist die Hand mehr als maxWandern Spalten von der
     Startmitte weg, bevorzugt Wechsel, die zurückführen.
     Welcher Finger (Zeige, Mittel …) auf welcher Position liegt, hängt nur
     von der gewählten Hand ab – das ist reine Beschriftung (darstellung.js).

   ABLAUF
     "start"    – Sind GENAU die vier Starttasten gedrückt, beginnt der Aufstieg.
     "klettern" – ein Wechsel nach dem anderen: "los" loslassen, "neu"
                  greifen (Reihenfolge egal). Fertig ist er, wenn "los"
                  oben und "neu" unten ist.
     "pause"    – Fenster ohne Fokus oder anderer Tab: Der Browser meldet
                  dann alle Tasten als losgelassen. Das Spiel ruht; weiter
                  geht es, sobald die vier Tasten wieder gedrückt sind.
     "absturz"  – vorbei. Gründe: "losgelassen" (eine der drei bleibenden
                  Tasten ist oben), "falscheTaste" (eine nicht geforderte
                  Taste gedrückt), "zeit" (Zeit für den Wechsel abgelaufen).

   EREIGNISSE (spiel.an(name, fn)):
     "start"   { griff }
     "wechsel" { los, neu, finger, zeitMs }        – ein neuer Wechsel ist gefordert
     "griff"   { los, neu, finger, griffe, hoehe } – Wechsel gelungen
     "zone"    { zone, vorher } · "pause" { restMs } · "weiter" { restMs }
     "absturz" { grund, taste, hoehe, griffe }
   ========================================================================== */

const KletterRegeln = (function () {
  const K = typeof KletterKonfig !== "undefined" ? KletterKonfig : require("./konfig.js");
  const T = typeof KletterTastatur !== "undefined" ? KletterTastatur : require("./keyboard.js");
  const Z = typeof KletterZonen !== "undefined"
    ? { KletterZonen: KletterZonen, kletterZoneFuer: kletterZoneFuer }
    : require("./zonen.js");
  const H = K.hand;


  /* ------------------------------------------------------------------------
     GRIFFE UND WECHSEL
     ------------------------------------------------------------------------ */

  /** Erlaubte Reihen in dieser Höhe (die Zahlenreihe erst ab zahlenreiheAb). */
  function erlaubteReihen(meter) {
    return meter >= H.zahlenreiheAb ? [0].concat(H.reihen) : H.reihen.slice();
  }

  /** Zeit für einen Wechsel in dieser Höhe (ms) – die einzige andere Steigerung. */
  function zeitFuer(meter) {
    const z = K.zeit;
    const anteil = Math.max(0, Math.min(1, meter / z.endeHoehe));
    return Math.round(z.startMs - (z.startMs - z.minMs) * Math.pow(anteil, z.kurve));
  }

  /**
   * Ist das ein gültiger Griff? (vier Tasten in Fingerreihenfolge)
   * @param {string[]} griff – vier event.codes von links nach rechts
   * @param {number[]} [reihen] – erlaubte Reihen (Standard: alle)
   */
  function griffGueltig(griff, reihen) {
    if (griff.length !== 4 || new Set(griff).size !== 4) return false;
    if (!griff.every(function (c) { return T.taste(c) && (!reihen || reihen.indexOf(T.taste(c).reihe) !== -1); })) return false;
    if (!T.vonLinksNachRechts(griff)) return false;
    for (let i = 1; i < 4; i++) {
      if (T.spaltenAbstand(griff[i - 1], griff[i]) > H.maxAbstandNachbarn) return false;
    }
    return T.spaltenAbstand(griff[0], griff[3]) <= H.maxAbstandGesamt;
  }

  /**
   * Alle erlaubten Wechsel aus einem Griff: je Finger jede Nachbartaste,
   * nach der der Griff gültig bleibt.
   * @returns {{finger, los, neu, griff}[]} – griff = der Griff danach
   */
  function moeglicheWechsel(griff, reihen) {
    const liste = [];
    griff.forEach(function (los, finger) {
      T.nachbarn(los, reihen).forEach(function (neu) {
        const danach = griff.slice();
        danach[finger] = neu;
        if (griffGueltig(danach, reihen)) liste.push({ finger: finger, los: los, neu: neu, griff: danach });
      });
    });
    return liste;
  }

  /** Mitte der Hand in Spalten (Durchschnitt der vier Spalten). */
  function handMitte(griff) {
    return griff.reduce(function (s, c) { return s + T.taste(c).spalte; }, 0) / 4;
  }

  /** So weit liegt die Hand neben der Startposition (Spalten, immer ≥ 0). */
  function abweichung(griff) {
    return Math.abs(handMitte(griff) - handMitte(H.start));
  }

  /**
   * Der nächste Wechsel.
   * @param {string[]} griff – aktueller Griff
   * @param {number} meter – Höhe (für die erlaubten Reihen)
   * @param {number[]} verlauf – Positionen der zuletzt bewegten Finger (neueste zuletzt)
   * @param {function} zufall
   */
  function waehleWechsel(griff, meter, verlauf, zufall) {
    let liste = moeglicheWechsel(griff, erlaubteReihen(meter));
    // Nie öfter als maxGleicherFinger hintereinander derselbe Finger
    const n = H.maxGleicherFinger;
    const letzte = verlauf.slice(-n);
    if (letzte.length === n && letzte.every(function (f) { return f === letzte[0]; })) {
      const andere = liste.filter(function (w) { return w.finger !== letzte[0]; });
      if (andere.length) liste = andere;
    }
    // Zu weit gewandert? Dann bevorzugt Wechsel, die zurückführen
    const jetzt = abweichung(griff);
    if (jetzt > H.maxWandern) {
      const zurueck = liste.filter(function (w) { return abweichung(w.griff) < jetzt; });
      if (zurueck.length) liste = zurueck;
    }
    return liste[Math.floor(zufall() * liste.length)];
  }

  /**
   * Alle Griffe, die von der Startposition aus erreichbar sind (Breitensuche).
   * @returns {string[][]}
   */
  function alleGriffe(reihen) {
    const gesehen = new Set([H.start.join()]);
    const liste = [H.start.slice()];
    for (let i = 0; i < liste.length; i++) {
      moeglicheWechsel(liste[i], reihen).forEach(function (w) {
        const k = w.griff.join();
        if (!gesehen.has(k)) { gesehen.add(k); liste.push(w.griff); }
      });
    }
    return liste;
  }

  /**
   * Ein Kletterweg für den Tastaturtest, der jeden Griff aus "ziele"
   * mindestens einmal besucht. Jeder Schritt ist ein erlaubter Wechsel
   * (ein Finger auf eine Nachbartaste) – so testet man, wie man spielt.
   * Ablauf: immer zum nächsten noch nicht besuchten Griff (kürzester Weg).
   * @param {string[][]} ziele – zu besuchende Griffe
   * @param {number[]} reihen – erlaubte Reihen für den Weg
   * @param {number} [anzahl] – höchstens so viele Ziele (Schnelltest)
   * @returns {string[][]} – der Weg (erster Eintrag = Startgriff)
   */
  function testWeg(ziele, reihen, anzahl) {
    const offen = new Set(ziele.map(function (g) { return g.join(); }));
    let jetzt = H.start.slice();
    const weg = [jetzt];
    offen.delete(jetzt.join());
    let besucht = 1;
    const genug = anzahl || Infinity;
    while (offen.size && besucht < genug) {
      // Breitensuche bis zum nächsten offenen Griff
      const vorher = new Map([[jetzt.join(), null]]);
      const schlange = [jetzt];
      let ziel = null;
      for (let i = 0; i < schlange.length && !ziel; i++) {
        const wechsel = moeglicheWechsel(schlange[i], reihen);
        for (const w of wechsel) {
          const k = w.griff.join();
          if (vorher.has(k)) continue;
          vorher.set(k, schlange[i]);
          if (offen.has(k)) { ziel = w.griff; break; }
          schlange.push(w.griff);
        }
      }
      if (!ziel) break;                     // nichts mehr erreichbar
      const stueck = [];
      for (let g = ziel; g && g.join() !== jetzt.join(); g = vorher.get(g.join())) stueck.unshift(g);
      stueck.forEach(function (g) {
        weg.push(g);
        if (offen.delete(g.join())) besucht++;
      });
      jetzt = ziel;
    }
    return weg;
  }

  /**
   * Schnelltest: ein Weg über "anzahl" verschiedene Griffe, quer über die
   * Tastatur verteilt (jeder zweite zufällig gewählte Griff als Ziel, auch
   * mit Zahlenreihe).
   */
  function schnellWeg(anzahl, zufall) {
    const reihen = [0].concat(H.reihen);
    const alle = alleGriffe(reihen);
    const ziele = [];
    for (let k = 0; k < anzahl; k++) ziele.push(alle[Math.floor(zufall() * alle.length)]);
    return testWeg(ziele, reihen, anzahl);
  }


  /* ------------------------------------------------------------------------
     EIN SPIEL
     ------------------------------------------------------------------------ */

  /**
   * @param {object} [optionen] – { zufall } (Standard: Math.random)
   */
  function erstelle(optionen) {
    optionen = optionen || {};
    const zufall = optionen.zufall || Math.random;
    const hoerer = {};
    let z;                       // Zustand des laufenden Versuchs
    const gedrueckt = new Set(); // gerade gedrückte Tasten (Codes)

    function melde(name, daten) {
      (hoerer[name] || []).forEach(function (fn) { fn(daten); });
    }

    /** Neuer Versuch: Startgriff D F H J, warten, bis er gehalten wird. */
    function neu() {
      z = {
        phase: "start",
        griff: H.start.slice(),
        verlauf: [],            // Positionen der bewegten Finger
        wechsel: null,
        griffe: 0,
        zone: Z.KletterZonen[0],
        absturz: null,
        restMs: 0,
      };
      return stand(0);
    }

    function hoehe() { return z.griffe * K.meterProGriff; }

    function neuerWechsel(jetzt) {
      const w = waehleWechsel(z.griff, hoehe(), z.verlauf, zufall);
      const zeitMs = zeitFuer(hoehe());
      z.wechsel = { finger: w.finger, los: w.los, neu: w.neu, zeitMs: zeitMs, ende: jetzt + zeitMs };
      melde("wechsel", { finger: w.finger, los: w.los, neu: w.neu, zeitMs: zeitMs });
    }

    function abstuerzen(grund, taste) {
      z.phase = "absturz";
      z.absturz = { grund: grund, taste: taste || null, hoehe: hoehe(), griffe: z.griffe };
      melde("absturz", z.absturz);
    }

    /** Sind genau die vier Tasten des Griffs gedrückt (und keine andere)? */
    function genauGriff() {
      return gedrueckt.size === 4 && z.griff.every(function (c) { return gedrueckt.has(c); });
    }

    /** Nach jeder Änderung: Was bedeutet die Lage jetzt? */
    function pruefe(jetzt) {
      if (z.phase === "start") {
        if (genauGriff()) {
          z.phase = "klettern";
          melde("start", { griff: z.griff.slice() });
          neuerWechsel(jetzt);
        }
        return;
      }
      if (z.phase === "pause") {
        if (genauGriff()) {
          z.phase = "klettern";
          z.wechsel.ende = jetzt + z.restMs;
          melde("weiter", { restMs: z.restMs });
        }
        return;
      }
      if (z.phase !== "klettern") return;
      const w = z.wechsel;
      // 1. Eine der drei bleibenden Tasten losgelassen?
      const fehlt = z.griff.find(function (c) { return c !== w.los && !gedrueckt.has(c); });
      if (fehlt) { abstuerzen("losgelassen", fehlt); return; }
      // 2. Eine Taste gedrückt, die nicht gefordert ist?
      for (const c of gedrueckt) {
        if (z.griff.indexOf(c) === -1 && c !== w.neu) { abstuerzen("falscheTaste", c); return; }
      }
      // 3. Wechsel fertig: alte Taste oben, neue unten
      if (gedrueckt.has(w.neu) && !gedrueckt.has(w.los)) {
        z.griff[w.finger] = w.neu;
        z.verlauf.push(w.finger);
        if (z.verlauf.length > 10) z.verlauf.shift();
        z.griffe++;
        melde("griff", { los: w.los, neu: w.neu, finger: w.finger, griffe: z.griffe, hoehe: hoehe() });
        const zone = Z.kletterZoneFuer(hoehe());
        if (zone !== z.zone) {
          const vorher = z.zone;
          z.zone = zone;
          melde("zone", { zone: zone, vorher: vorher });
        }
        neuerWechsel(jetzt);
      }
    }

    /** Eine Taste wurde gedrückt (nur Buchstaben und Zahlen des Rasters zählen). */
    function druecke(code, jetzt) {
      if (!T.taste(code) || gedrueckt.has(code)) return;
      gedrueckt.add(code);
      if (z) pruefe(jetzt);
    }

    function lasseLos(code, jetzt) {
      if (!gedrueckt.has(code)) return;
      gedrueckt.delete(code);
      if (z) pruefe(jetzt);
    }

    /** Die Zeit vergeht – läuft sie ab, stürzt die Figur. */
    function tick(jetzt) {
      if (z && z.phase === "klettern" && jetzt >= z.wechsel.ende) abstuerzen("zeit", z.wechsel.neu);
    }

    /**
     * Fenster ohne Fokus oder anderer Tab: Alle Tasten gelten als
     * losgelassen. Klettert man gerade, ruht das Spiel (kein Absturz).
     */
    function pausiere(jetzt) {
      gedrueckt.clear();
      if (z && z.phase === "klettern") {
        z.phase = "pause";
        z.restMs = Math.max(0, z.wechsel.ende - jetzt);
        melde("pause", { restMs: z.restMs });
      }
    }

    /** Alles, was die Anzeige braucht (nur lesen). */
    function stand(jetzt) {
      const w = z.wechsel;
      let restMs = 0;
      if (w) restMs = z.phase === "pause" ? z.restMs : z.phase === "klettern" ? Math.max(0, w.ende - jetzt) : 0;
      return {
        phase: z.phase,
        griff: z.griff.slice(),            // vier Tasten, von links nach rechts (Position = Finger)
        wechsel: w ? { finger: w.finger, los: w.los, neu: w.neu, zeitMs: w.zeitMs, restMs: restMs } : null,
        gedrueckt: Array.from(gedrueckt),
        griffe: z.griffe,
        hoehe: hoehe(),
        zone: z.zone,
        absturz: z.absturz,
      };
    }

    neu();

    return {
      an: function (name, fn) { (hoerer[name] = hoerer[name] || []).push(fn); },
      neu: neu,
      druecke: druecke,
      lasseLos: lasseLos,
      tick: tick,
      pausiere: pausiere,
      stand: stand,
      /** Alle gedrückten Tasten vergessen (z. B. beim Wechsel Tastatur ↔ Touch). */
      vergiss: function () { gedrueckt.clear(); },
    };
  }

  return {
    erlaubteReihen: erlaubteReihen,
    zeitFuer: zeitFuer,
    griffGueltig: griffGueltig,
    moeglicheWechsel: moeglicheWechsel,
    handMitte: handMitte,
    abweichung: abweichung,
    waehleWechsel: waehleWechsel,
    alleGriffe: alleGriffe,
    testWeg: testWeg,
    schnellWeg: schnellWeg,
    erstelle: erstelle,
  };
})();

if (typeof module !== "undefined") module.exports = KletterRegeln;
