/* ==========================================================================
   climb/regeln.js – die Regeln des Kletterspiels (ohne Anzeige)
   Hier steht nur, WAS passiert. Die Oberfläche (climb/darstellung.js)
   meldet gedrückte und losgelassene Tasten und die Zeit; die Regeln melden
   Ereignisse zurück. Die Zeit kommt immer von außen (Millisekunden) – so
   lässt sich alles ohne Browser testen.

   ABLAUF
     "start"    – vier Tasten werden angezeigt. Sind GENAU diese vier
                  gedrückt, beginnt der Aufstieg.
     "klettern" – ein Griffwechsel nach dem anderen: Eine gehaltene Taste
                  ist "los" (loslassen), eine neue "neu" (greifen). Die
                  übrigen drei bleiben gedrückt. Die Reihenfolge ist egal
                  (erst loslassen oder erst greifen) – fertig ist der
                  Wechsel, wenn "los" oben und "neu" unten ist.
     "pause"    – Fenster ohne Fokus oder anderer Tab: Der Browser meldet
                  dann alle Tasten als losgelassen. Statt eines Absturzes
                  ruht das Spiel; weiter geht es, sobald die vier
                  gehaltenen Tasten wieder gedrückt sind (mit der Restzeit).
     "absturz"  – vorbei. Gründe:
                    "losgelassen" – eine der drei bleibenden Tasten ist oben
                    "falscheTaste" – eine Taste gedrückt, die nicht gefordert ist
                    "zeit"        – die Zeit für den Wechsel ist abgelaufen

   EREIGNISSE (spiel.an(name, fn)):
     "start"   { gehalten, glieder }
     "wechsel" { los, neu, zeitMs, glied }       – ein neuer Wechsel ist gefordert
     "griff"   { los, neu, glied, griffe, hoehe } – Wechsel gelungen
     "zone"    { zone, vorher }                  – eine neue Zone ist erreicht
     "pause"   { restMs } · "weiter" { restMs }
     "absturz" { grund, taste, hoehe, griffe }
   ========================================================================== */

const KletterRegeln = (function () {
  const K = typeof KletterKonfig !== "undefined" ? KletterKonfig : require("./konfig.js");
  const Z = typeof KletterZonen !== "undefined"
    ? { KletterZonen: KletterZonen, kletterZoneFuer: kletterZoneFuer }
    : require("./zonen.js");

  // Die vier Gliedmaßen – jede gehaltene Taste gehört zu einer davon
  const GLIEDER = ["handLinks", "handRechts", "fussLinks", "fussRechts"];


  /* ------------------------------------------------------------------------
     TASTENFELDER: Tastatur (QWERTZ, event.code) und Touch-Raster
     ------------------------------------------------------------------------ */

  /**
   * Alle Tasten eines Felds mit Lage und Spalte.
   * @param {string} art – "tastatur" oder "touch"
   * @returns {{art, tasten: object[], nachCode: object, geisterschutz, maxProReihe, spreizung, reihenAb}}
   */
  function tastenFeld(art) {
    const tasten = [];
    if (art === "touch") {
      const t = K.touch;
      for (let r = 0; r < t.reihen; r++) {
        for (let s = 0; s < t.spalten; s++) {
          tasten.push({ code: "Feld" + (r * t.spalten + s), label: "", reihe: r, spalte: s, x: s, y: r });
        }
      }
      return fertig({ art: art, tasten: tasten, geisterschutz: t.geisterschutz, maxProReihe: Infinity,
        spreizung: t.spreizung, reihenAb: null });
    }
    K.tastatur.reihen.forEach(function (r) {
      r.codes.forEach(function (code, i) {
        tasten.push({ code: code, label: r.labels[i], reihe: r.reihe, spalte: i, x: r.x0 + i, y: r.reihe });
      });
    });
    return fertig({ art: "tastatur", tasten: tasten, geisterschutz: K.tastatur.geisterschutz,
      maxProReihe: K.tastatur.maxProReihe, spreizung: K.spreizung, reihenAb: K.tastatur.reihenAb });
  }

  function fertig(feld) {
    feld.nachCode = {};
    feld.tasten.forEach(function (t) { feld.nachCode[t.code] = t; });
    return feld;
  }

  /** Abstand zweier Tasten (Tastenbreiten; eine Reihe zählt 1). */
  function abstand(feld, a, b) {
    const ta = feld.nachCode[a], tb = feld.nachCode[b];
    return Math.hypot(ta.x - tb.x, ta.y - tb.y);
  }

  /** Breite (x) einer Gruppe von Tasten. */
  function spanne(feld, codes) {
    const xs = codes.map(function (c) { return feld.nachCode[c].x; });
    return Math.max.apply(null, xs) - Math.min.apply(null, xs);
  }

  /**
   * Geisterschutz: Können diese Tasten GLEICHZEITIG gedrückt sicher erkannt
   * werden? Jede in einer eigenen Fingerspalte, höchstens maxProReihe je
   * Reihe (siehe climb/konfig.js). Touch-Felder sind immer sicher.
   */
  function geisterSicher(feld, codes) {
    if (!feld.geisterschutz) return true;
    const spalten = {}, reihen = {};
    for (const c of codes) {
      const t = feld.nachCode[c];
      if (spalten[t.spalte]) return false;
      spalten[t.spalte] = true;
      reihen[t.reihe] = (reihen[t.reihe] || 0) + 1;
      if (reihen[t.reihe] > feld.maxProReihe) return false;
    }
    return true;
  }


  /* ------------------------------------------------------------------------
     SCHWIERIGKEIT
     ------------------------------------------------------------------------ */

  /** 0 am Boden … 1 ab endeHoehe */
  function anteil(meter, ende) {
    return Math.max(0, Math.min(1, meter / ende));
  }

  /** Zeit für einen Wechsel in dieser Höhe (ms). */
  function zeitFuer(meter) {
    const z = K.zeit;
    return Math.round(z.startMs - (z.startMs - z.minMs) * Math.pow(anteil(meter, z.endeHoehe), z.kurve));
  }

  /** Spreizung in dieser Höhe: { abstandMin, abstandMax, spanneMax } */
  function spreizungFuer(feld, meter) {
    const s = feld.spreizung;
    const a = anteil(meter, s.endeHoehe);
    const wert = function (w) { return w.start + (w.ende - w.start) * a; };
    return { abstandMin: wert(s.abstandMin), abstandMax: wert(s.abstandMax), spanneMax: wert(s.spanneMax) };
  }

  /** Tasten, die in dieser Höhe vorkommen dürfen (Reihen kommen nach und nach dazu). */
  function erlaubteTasten(feld, meter) {
    if (!feld.reihenAb) return feld.tasten;
    const offen = feld.reihenAb.filter(function (r) { return meter >= r.ab; }).map(function (r) { return r.reihe; });
    return feld.tasten.filter(function (t) { return offen.indexOf(t.reihe) !== -1; });
  }

  function mische(liste, zufall) {
    const neu = liste.slice();
    for (let i = neu.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      const tmp = neu[i]; neu[i] = neu[j]; neu[j] = tmp;
    }
    return neu;
  }


  /* ------------------------------------------------------------------------
     GRIFFE AUSWÄHLEN
     ------------------------------------------------------------------------ */

  /** Die vier Tasten zu Beginn – nah beieinander wie eine aufgelegte Hand. */
  function startGriff(feld, zufall) {
    if (feld.art === "touch") {
      return K.touch.start.map(function (sr) { return "Feld" + (sr[1] * K.touch.spalten + sr[0]); });
    }
    const s = K.tastatur.startSpalten;
    const erste = s.von + Math.floor(zufall() * (s.bis - s.von + 1));
    const reihen = zufall() < 0.5 ? K.tastatur.startReihen : K.tastatur.startReihen.slice().reverse();
    const codes = [];
    for (let k = 0; k < 4; k++) {
      const reihe = reihen[k % 2];
      const t = feld.tasten.find(function (x) { return x.reihe === reihe && x.spalte === erste + k; });
      codes.push(t.code);
    }
    return codes;
  }

  /**
   * Gliedmaßen zuordnen: die beiden linken Tasten gehören zur linken
   * Körperseite, die beiden rechten zur rechten – jeweils die höhere
   * (kleinere Reihe) zur Hand, die tiefere zum Fuß.
   */
  function gliederZuordnen(feld, codes) {
    const sortiert = codes.slice().sort(function (a, b) { return feld.nachCode[a].x - feld.nachCode[b].x; });
    const glieder = {};
    [[sortiert[0], sortiert[1], "Links"], [sortiert[2], sortiert[3], "Rechts"]].forEach(function (paar) {
      const a = feld.nachCode[paar[0]], b = feld.nachCode[paar[1]];
      const oben = a.y < b.y || (a.y === b.y && a.x <= b.x) ? paar[0] : paar[1];
      glieder[paar[0]] = (paar[0] === oben ? "hand" : "fuss") + paar[2];
      glieder[paar[1]] = (paar[1] === oben ? "hand" : "fuss") + paar[2];
    });
    return glieder;
  }

  /**
   * Der nächste Griffwechsel: welche gehaltene Taste losgelassen und welche
   * neue gegriffen wird. Bedingungen (gelockert, falls nichts passt):
   *   - die neue Taste ist nicht gehalten und in dieser Höhe erlaubt,
   *   - alle fünf (vier gehaltene + neue) sind zusammen geistersicher,
   *   - Abstand zur losgelassenen Taste zwischen abstandMin und abstandMax,
   *   - die vier danach gehaltenen Tasten liegen höchstens spanneMax auseinander,
   *   - die Seiten bleiben erhalten: Greift eine linke Gliedmaße um, liegt
   *     die neue Taste links von allen Tasten der rechten Seite (und
   *     umgekehrt) – so passen "Hand links" & Co. zur Lage auf der Tastatur,
   *   - nicht zweimal hintereinander dieselbe Gliedmaße,
   *   - wie beim echten Klettern greift eher um, wer schon länger hält
   *     (alter: so viele Griffe hält die Taste schon; leicht zufällig).
   * @returns {{los, neu}}
   */
  function waehleWechsel(feld, gehalten, glieder, letztesGlied, meter, zufall, alter) {
    const sp = spreizungFuer(feld, meter);
    const erlaubt = erlaubteTasten(feld, meter).filter(function (t) { return gehalten.indexOf(t.code) === -1; });
    const stufen = [
      { min: sp.abstandMin, max: sp.abstandMax, spanne: sp.spanneMax, glied: true, seite: true },
      { min: 0, max: sp.abstandMax, spanne: sp.spanneMax, glied: true, seite: true },
      { min: 0, max: sp.abstandMax * 1.5, spanne: sp.spanneMax + 2, glied: false, seite: true },
      { min: 0, max: Infinity, spanne: Infinity, glied: false, seite: true },
      { min: 0, max: Infinity, spanne: Infinity, glied: false, seite: false },
    ];
    // Passt die neue Taste zur Seite der umgreifenden Gliedmaße?
    const seitePasst = function (los, x) {
      const links = /Links$/.test(glieder[los]);
      const gegenseite = gehalten.filter(function (c) { return c !== los && /Links$/.test(glieder[c]) !== links; })
        .map(function (c) { return feld.nachCode[c].x; });
      if (!gegenseite.length) return true;
      return links ? x < Math.min.apply(null, gegenseite) : x > Math.max.apply(null, gegenseite);
    };
    for (const st of stufen) {
      const kandidaten = gehalten.filter(function (c) { return !st.glied || glieder[c] !== letztesGlied; });
      // Ältere Griffe zuerst – mit etwas Zufall, damit es nicht starr reihum geht
      const gewicht = {};
      kandidaten.forEach(function (c) { gewicht[c] = ((alter && alter[c]) || 0) + zufall() * K.wechsel.alterZufall; });
      const losListe = kandidaten.sort(function (a, b) { return gewicht[b] - gewicht[a]; });
      for (const los of losListe) {
        const rest = gehalten.filter(function (c) { return c !== los; });
        const moeglich = erlaubt.filter(function (t) {
          const d = abstand(feld, los, t.code);
          return d >= st.min && d <= st.max &&
            (!st.seite || seitePasst(los, t.x)) &&
            geisterSicher(feld, gehalten.concat([t.code])) &&
            spanne(feld, rest.concat([t.code])) <= st.spanne;
        });
        if (moeglich.length) return { los: los, neu: moeglich[Math.floor(zufall() * moeglich.length)].code };
      }
    }
    // Kann eigentlich nicht passieren – zur Sicherheit wenigstens geistersicher
    for (const los of gehalten) {
      const t = erlaubt.find(function (x) { return geisterSicher(feld, gehalten.concat([x.code])); });
      if (t) return { los: los, neu: t.code };
    }
    return { los: gehalten[0], neu: erlaubt[0].code };
  }

  /**
   * Kombinationen für den Tastaturtest: je vier gehaltene Tasten plus die
   * neue – genau so, wie sie im Spiel in dieser Höhe vorkommen.
   * @returns {string[][]} – Listen aus fünf Codes
   */
  function testKombinationen(feld, anzahl, meter, zufall) {
    const liste = [];
    let gehalten = startGriff(feld, zufall);
    let glieder = gliederZuordnen(feld, gehalten);
    let letztes = null;
    // erst ein paar Wechsel "klettern", damit die Griffe verteilt sind
    for (let k = 0; liste.length < anzahl && k < 200; k++) {
      const w = waehleWechsel(feld, gehalten, glieder, letztes, meter, zufall, null);
      if (k >= 4 && k % 3 === 1) liste.push(gehalten.concat([w.neu]));
      glieder[w.neu] = glieder[w.los]; delete glieder[w.los];
      letztes = glieder[w.neu];
      gehalten = gehalten.filter(function (c) { return c !== w.los; }).concat([w.neu]);
    }
    return liste;
  }


  /* ------------------------------------------------------------------------
     EIN SPIEL
     ------------------------------------------------------------------------ */

  /**
   * @param {object} optionen
   *   art    – "tastatur" (Standard) oder "touch"
   *   zufall – Zufallszahl 0 bis unter 1 (Standard: Math.random)
   */
  function erstelle(optionen) {
    optionen = optionen || {};
    const zufall = optionen.zufall || Math.random;
    const hoerer = {};
    let feld = tastenFeld(optionen.art || "tastatur");
    let z;                       // Zustand des laufenden Versuchs
    const gedrueckt = new Set(); // gerade gedrückte Tasten (Codes)

    function melde(name, daten) {
      (hoerer[name] || []).forEach(function (fn) { fn(daten); });
    }

    /** Neuer Versuch: vier Starttasten, warten, bis sie gehalten werden. */
    function neu() {
      const gehalten = startGriff(feld, zufall);
      z = {
        phase: "start",
        gehalten: gehalten,
        glieder: gliederZuordnen(feld, gehalten),
        letztesGlied: null,
        seit: {},            // Code → bei welchem Griff die Taste gegriffen wurde
        wechsel: null,
        griffe: 0,
        zone: Z.KletterZonen[0],
        absturz: null,
        restMs: 0,
      };
      return stand(0);
    }

    function hoehe() { return z.griffe * K.meterProGriff; }

    /** Einen neuen Wechsel fordern (die Zeit läuft ab jetzt). */
    function neuerWechsel(jetzt) {
      const alter = {};
      z.gehalten.forEach(function (c) { alter[c] = z.griffe - (z.seit[c] || 0); });
      const w = waehleWechsel(feld, z.gehalten, z.glieder, z.letztesGlied, hoehe(), zufall, alter);
      const zeitMs = zeitFuer(hoehe());
      z.wechsel = { los: w.los, neu: w.neu, zeitMs: zeitMs, ende: jetzt + zeitMs };
      melde("wechsel", { los: w.los, neu: w.neu, zeitMs: zeitMs, glied: z.glieder[w.los] });
    }

    function abstuerzen(grund, taste) {
      z.phase = "absturz";
      z.absturz = { grund: grund, taste: taste || null, hoehe: hoehe(), griffe: z.griffe };
      melde("absturz", z.absturz);
    }

    /** Nach jeder Änderung: Was bedeutet die Lage jetzt? */
    function pruefe(jetzt) {
      if (z.phase === "start") {
        // Genau die vier Starttasten – dann geht es los
        if (gedrueckt.size === 4 && z.gehalten.every(function (c) { return gedrueckt.has(c); })) {
          z.phase = "klettern";
          melde("start", { gehalten: z.gehalten.slice(), glieder: Object.assign({}, z.glieder) });
          neuerWechsel(jetzt);
        }
        return;
      }
      if (z.phase === "pause") {
        // Weiter, sobald die vier gehaltenen Tasten wieder unten sind (nur sie)
        if (z.gehalten.every(function (c) { return gedrueckt.has(c); }) && gedrueckt.size === 4) {
          z.phase = "klettern";
          z.wechsel.ende = jetzt + z.restMs;
          melde("weiter", { restMs: z.restMs });
        }
        return;
      }
      if (z.phase !== "klettern") return;
      const w = z.wechsel;
      // 1. Eine der drei bleibenden Tasten losgelassen?
      const fehlt = z.gehalten.find(function (c) { return c !== w.los && !gedrueckt.has(c); });
      if (fehlt) { abstuerzen("losgelassen", fehlt); return; }
      // 2. Eine Taste gedrückt, die nicht gefordert ist?
      for (const c of gedrueckt) {
        if (z.gehalten.indexOf(c) === -1 && c !== w.neu) { abstuerzen("falscheTaste", c); return; }
      }
      // 3. Wechsel fertig: alte Taste oben, neue unten
      if (gedrueckt.has(w.neu) && !gedrueckt.has(w.los)) {
        const glied = z.glieder[w.los];
        z.gehalten = z.gehalten.filter(function (c) { return c !== w.los; }).concat([w.neu]);
        delete z.glieder[w.los];
        z.glieder[w.neu] = glied;
        z.letztesGlied = glied;
        z.griffe++;
        delete z.seit[w.los];
        z.seit[w.neu] = z.griffe;
        melde("griff", { los: w.los, neu: w.neu, glied: glied, griffe: z.griffe, hoehe: hoehe() });
        const zone = Z.kletterZoneFuer(hoehe());
        if (zone !== z.zone) {
          const vorher = z.zone;
          z.zone = zone;
          melde("zone", { zone: zone, vorher: vorher });
        }
        neuerWechsel(jetzt);
      }
    }

    /** Eine Taste wurde gedrückt (Wiederholungen beim Gedrückthalten zählen nicht). */
    function druecke(code, jetzt) {
      if (!feld.nachCode[code] || gedrueckt.has(code)) return;
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
        gehalten: z.gehalten.slice(),
        glieder: Object.assign({}, z.glieder),
        wechsel: w ? { los: w.los, neu: w.neu, zeitMs: w.zeitMs, restMs: restMs } : null,
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
      get feld() { return feld; },
      /** Tastatur oder Touch – beginnt einen neuen Versuch. */
      setzeArt: function (art) { feld = tastenFeld(art); gedrueckt.clear(); return neu(); },
    };
  }

  return {
    GLIEDER: GLIEDER,
    tastenFeld: tastenFeld,
    abstand: abstand,
    spanne: spanne,
    geisterSicher: geisterSicher,
    zeitFuer: zeitFuer,
    spreizungFuer: spreizungFuer,
    erlaubteTasten: erlaubteTasten,
    startGriff: startGriff,
    gliederZuordnen: gliederZuordnen,
    waehleWechsel: waehleWechsel,
    testKombinationen: testKombinationen,
    erstelle: erstelle,
  };
})();

if (typeof module !== "undefined") module.exports = KletterRegeln;
