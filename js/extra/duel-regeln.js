/* ==========================================================================
   extra/duel-regeln.js – Regeln und Physik des Duells (ohne Darstellung)
   Welt in Pixeln einer 960 × 540 großen Bühne, y zeigt nach OBEN
   (0 = Boden). Zwei Kämpfer, je ein waagerechter Stab auf Hüfthöhe.
   Match bis K.siegeNoetig Rundensiege; nach jeder Runde wählt der
   Verlierer ein Power-up (K.powerups). Geschosse sind ein eigenes System
   (K.geschoss, K.geschossEffekte), das Power-ups verändern können.
   Läuft auch in Node (für Tests).
   ========================================================================== */

const DuellRegeln = (function () {

  const K = {
    links: 50, rechts: 910,          // Bühnenrand
    schwerkraft: 2400,
    sprung: 860,
    tempo: 280,
    breite: 26,                      // Körperbreite (Trefferfläche)
    hoehe: 118,                      // stehend
    hoeheGeduckt: 48,                // geduckt: hohe Stöße gehen darüber
    huefte: 58,                      // Höhe des Stabs, stehend
    huefteGeduckt: 26,               // geduckt: tiefer Stoß
    griff: 6,                        // Stab beginnt so weit vor der Körpermitte
    stab: 52,
    stoss: { vor: 0.09, halten: 0.07, zurueck: 0.14, weite: 44, pause: 0.2 },
    schaden: [11, 17],
    rueckstoss: { vx: 760, vy: 420, starre: 0.42 },
    ko: { vx: 980, vy: 680 },
    prall: { vx: 520, vy: 260, starre: 0.3 },
    leben: 100,
    siegeNoetig: 5,
    startZeit: 1.1,                  // "Runde 1 – Los!"
    rundenPause: 2.1,                // nach einem K.o.
    startX: { gruen: 300, blau: 660 },
    // Raum für Geschosse: Wände links/rechts, Boden 0, Decke
    raum: { links: 20, rechts: 940, decke: 360 },

    // Grundwerte eines Geschosses. Power-ups ändern eine Kopie davon.
    geschoss: {
      tempo: 620,                    // Pixel pro Sekunde
      radius: 7,
      schaden: 8,
      abpraller: 1,                  // so oft prallt es ab, beim nächsten Aufprall verschwindet es
      anzahl: 1,                     // Kugeln pro Schuss
      streuung: 10,                  // Grad zwischen mehreren Kugeln
      abklingen: 1.5,                // Sekunden bis zum nächsten Schuss
      lebensdauer: 6,                // Sicherheitsgrenze in Sekunden
      spur: 9,                       // Länge der Leuchtspur (Punkte)
      winkel: { stehend: 0, geduckt: 18, luft: -22 },  // Grad gegen die Waagerechte
      effekte: ["rueckstoss"],       // was beim Treffer passiert (K.geschossEffekte)
    },
    geschossEffekte: {
      rueckstoss: { vx: 380, vy: 220, starre: 0.25, drehTempo: 8 },
    },

    // Auswahl nach einer Runde (Spielautomat)
    auswahl: { slots: 3, walzeStart: 0.9, walzeVersatz: 0.45, walzeKarten: 14, kiBedenkzeit: 0.8 },

    // Power-ups: ein neues ist nur ein weiterer Eintrag.
    //   wirkung(w, stufe) verändert die Werte w eines Kämpfers
    //   (w.stab, w.tempo, w.sprung, w.geschoss = Kopie von K.geschoss oder null)
    powerups: [
      {
        id: "grower", name: "Grower not Shower", symbol: "📏", max: 3,
        beschreibung: "Dein Strich wird um 50 % länger – mehr Reichweite beim Stoß.",
        wirkung: function (w, stufe) { w.stab += stufe * 0.5 * K.stab; },
      },
      {
        id: "querschlaeger", name: "Querschläger", symbol: "🎱", max: 5,
        beschreibung: "Schieß eine Kugel aus der Spitze (Grün G, Blau K). Prallt pro Stufe einmal ab.",
        wirkung: function (w, stufe) {
          w.geschoss = Object.assign({}, K.geschoss, { abpraller: stufe });
        },
      },
      {
        id: "turbo", name: "Turbo", symbol: "⚡", max: 3,
        beschreibung: "50 % mehr Lauftempo. Die Sprunghöhe bleibt gleich.",
        wirkung: function (w, stufe) { w.tempo *= 1 + 0.5 * stufe; },
      },
    ],
  };

  function powerup(id) {
    return K.powerups.find(function (p) { return p.id === id; });
  }

  /** Die aktuellen Werte eines Kämpfers: Grundwerte plus alle Power-ups. */
  function werte(f) {
    const w = { stab: K.stab, tempo: K.tempo, sprung: K.sprung, geschoss: null };
    K.powerups.forEach(function (p) {
      const stufe = f.powerups[p.id] || 0;
      if (stufe > 0) p.wirkung(w, stufe);
    });
    return w;
  }

  function kaempfer(id) {
    return {
      id: id, x: K.startX[id], y: 0, vx: 0, vy: 0, blick: id === "gruen" ? 1 : -1,
      leben: K.leben, geduckt: false, stoss: null, pause: 0, starre: 0,
      drehung: 0, drehTempo: 0, ko: false, laufPhase: 0, siege: 0,
      powerups: {}, schussPause: 0,
      vorher: { angriff: false, springen: false, schuss: false }, ki: null,
    };
  }

  /**
   * Neues Spiel.
   * @param {object} [opt] – { zufall: () => [0,1) }
   */
  function erstelle(opt) {
    const zufall = (opt && opt.zufall) || Math.random;
    const z = {
      phase: "start", zeit: 0, runde: 1, rundenSieger: null, sieger: null,
      gruen: kaempfer("gruen"), blau: kaempfer("blau"), ereignisse: [], uhr: 0,
      geschosse: [], auswahl: null,
    };

    /** Volle Lebenspunkte, Startpositionen – Siege und Power-ups bleiben. */
    function neueRunde() {
      ["gruen", "blau"].forEach(function (id) {
        const alt = z[id];
        z[id] = kaempfer(id);
        z[id].siege = alt.siege;
        z[id].powerups = alt.powerups;
      });
      z.geschosse = [];
      z.auswahl = null;
      z.phase = "start";
      z.zeit = 0;
      z.rundenSieger = null;
    }

    /**
     * Angebote für die Auswahl: K.auswahl.slots Power-ups, die noch nicht
     * ausgereizt sind. Reichen die verschiedenen nicht, kommen welche doppelt.
     */
    function angebote(f) {
      const offen = K.powerups.filter(function (p) { return (f.powerups[p.id] || 0) < p.max; });
      if (!offen.length) return [];
      const topf = offen.slice();
      const liste = [];
      for (let i = 0; i < K.auswahl.slots; i++) {
        if (!topf.length) topf.push.apply(topf, offen);
        liste.push(topf.splice(Math.floor(zufall() * topf.length), 1)[0].id);
      }
      return liste;
    }

    /** Der Verlierer wählt Angebot Nummer i (0 …). Danach beginnt die nächste Runde. */
    function waehle(i) {
      const a = z.auswahl;
      if (z.phase !== "auswahl" || !a || !a.angebote[i]) return false;
      const f = z[a.wer];
      const id = a.angebote[i];
      f.powerups[id] = Math.min(powerup(id).max, (f.powerups[id] || 0) + 1);
      z.ereignisse.push({ art: "powerup", wer: a.wer, id: id, stufe: f.powerups[id] });
      z.runde++;
      neueRunde();
      return true;
    }

    /** Ein Zeitschritt. eingaben: { gruen: {...}, blau: {...} } (links, rechts, springen, ducken, angriff). */
    function schritt(dt, eingaben) {
      z.ereignisse = [];
      z.uhr += dt;
      z.zeit += dt;
      const leer = {};
      eingaben = eingaben || {};
      const eg = z.phase === "kampf" ? eingaben.gruen || leer : leer;
      const eb = z.phase === "kampf" ? eingaben.blau || leer : leer;

      if (z.phase === "start" && z.zeit >= K.startZeit) { z.phase = "kampf"; z.zeit = 0; }

      steuere(z.gruen, z.blau, eg, dt);
      steuere(z.blau, z.gruen, eb, dt);
      bewege(z.gruen, dt);
      bewege(z.blau, dt);
      schiebeAuseinander(z.gruen, z.blau);
      bewegeGeschosse(dt);
      if (z.phase === "kampf") {
        if (!pruefeZusammenprall()) {
          pruefeTreffer(z.gruen, z.blau);
          pruefeTreffer(z.blau, z.gruen);
        }
        rundeVorbei();
      }

      if (z.phase === "rundeEnde" && z.zeit >= K.rundenPause) {
        if (z.gruen.siege >= K.siegeNoetig || z.blau.siege >= K.siegeNoetig) {
          z.phase = "ende";
          z.zeit = 0;
          z.sieger = z.gruen.siege > z.blau.siege ? "gruen" : "blau";
        } else {
          // Der Verlierer der Runde wählt ein Power-up (bei Unentschieden keiner)
          const verlierer = z.rundenSieger ? (z.rundenSieger === "gruen" ? "blau" : "gruen") : null;
          const liste = verlierer ? angebote(z[verlierer]) : [];
          if (liste.length) {
            z.phase = "auswahl";
            z.zeit = 0;
            z.auswahl = { wer: verlierer, angebote: liste };
          } else {
            z.runde++;
            neueRunde();
          }
        }
      }
      return z;
    }

    function rundeVorbei() {
      const gKo = z.gruen.leben <= 0, bKo = z.blau.leben <= 0;
      if (!gKo && !bKo) return;
      z.phase = "rundeEnde";
      z.zeit = 0;
      if (gKo && bKo) z.rundenSieger = null;               // beide gleichzeitig: Unentschieden
      else {
        z.rundenSieger = gKo ? "blau" : "gruen";
        z[z.rundenSieger].siege++;
      }
      z.ereignisse.push({ art: "ko" });
    }

    /** Eingaben in Bewegung umsetzen. */
    function steuere(f, gegner, e, dt) {
      const amBoden = f.y <= 0;
      if (f.pause > 0) f.pause -= dt;
      if (f.starre > 0) f.starre -= dt;

      if (f.stoss) {
        f.stoss.t += dt;
        if (f.stoss.t >= K.stoss.vor + K.stoss.halten + K.stoss.zurueck) {
          f.stoss = null;
          f.pause = K.stoss.pause;
        }
      }

      if (f.schussPause > 0) f.schussPause -= dt;
      const steuerbar = !f.ko && f.starre <= 0;
      if (steuerbar && !f.stoss) f.blick = gegner.x >= f.x ? 1 : -1;

      if (steuerbar) {
        const w = werte(f);
        f.geduckt = Boolean(e.ducken) && amBoden;
        const richtung = (e.rechts ? 1 : 0) - (e.links ? 1 : 0);
        const tempo = f.geduckt ? 0 : (f.stoss ? 0.35 : 1) * w.tempo;
        if (amBoden || richtung !== 0) f.vx = richtung * tempo;
        if (e.springen && !f.vorher.springen && amBoden && !f.geduckt) f.vy = w.sprung;
        if (e.angriff && !f.vorher.angriff && !f.stoss && f.pause <= 0) {
          f.stoss = { t: 0, tief: f.geduckt, getroffen: false };
        }
        if (e.schuss && !f.vorher.schuss && w.geschoss && f.schussPause <= 0 && !f.stoss) {
          schiesse(f, w.geschoss);
        }
      } else if (amBoden && !f.ko) {
        f.geduckt = false;
      }
      f.vorher.angriff = Boolean(e.angriff);
      f.vorher.springen = Boolean(e.springen);
      f.vorher.schuss = Boolean(e.schuss);
      if (f.vx !== 0 && amBoden && !f.geduckt) f.laufPhase += dt * 14;
    }

    function bewege(f, dt) {
      f.vy -= K.schwerkraft * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        // Gelandet: Drehung auslaufen lassen (K.o.: bleibt liegen)
        if (f.ko) {
          f.drehung = f.drehung >= 0 ? Math.PI / 2 : -Math.PI / 2;
          f.drehTempo = 0;
          f.vx *= Math.exp(-5 * dt);
        } else {
          f.drehTempo = 0;
          f.drehung *= Math.exp(-14 * dt);
          if (f.starre > 0) f.vx *= Math.exp(-7 * dt);
        }
      } else {
        f.drehung += f.drehTempo * dt;
      }
      // Bühnenrand: wer hineinfliegt, prallt ab
      if (f.x < K.links) { f.x = K.links; f.vx = Math.abs(f.vx) * 0.35; }
      if (f.x > K.rechts) { f.x = K.rechts; f.vx = -Math.abs(f.vx) * 0.35; }
    }

    /** Am Boden stehen zwei Körper nicht ineinander – wer springt, kommt darüber. */
    function schiebeAuseinander(a, b) {
      if (a.ko || b.ko) return;
      const dx = b.x - a.x;
      const abstand = K.breite + 6;
      if (Math.abs(dx) >= abstand) return;
      const ueber = Math.max(a.y, b.y) > K.hoehe * 0.55;
      if (ueber) return;
      const r = dx === 0 ? (a.blick || 1) : Math.sign(dx);
      const zuViel = (abstand - Math.abs(dx)) / 2;
      a.x -= r * zuViel;
      b.x += r * zuViel;
    }

    /** Wie weit ist der Stab gerade ausgefahren (0 … 1)? */
    function ausfahrt(f) {
      if (!f.stoss) return 0;
      const t = f.stoss.t, S = K.stoss;
      if (t < S.vor) return t / S.vor;
      if (t < S.vor + S.halten) return 1;
      return Math.max(0, 1 - (t - S.vor - S.halten) / S.zurueck);
    }

    function spitze(f) {
      const e = ausfahrt(f);
      return {
        x: f.x + f.blick * (K.griff + werte(f).stab + e * K.stoss.weite),
        y: f.y + (f.stoss && f.stoss.tief ? K.huefteGeduckt : f.geduckt ? K.huefteGeduckt : K.huefte),
        e: e,
      };
    }

    /** Treffen sich beide Stäbe gleichzeitig, prallen beide zurück. */
    function pruefeZusammenprall() {
      const a = z.gruen, b = z.blau;
      if (!a.stoss || !b.stoss || a.blick === b.blick || a.stoss.getroffen || b.stoss.getroffen) return false;
      const sa = spitze(a), sb = spitze(b);
      if (sa.e < 0.5 || sb.e < 0.5) return false;
      // Spitzen haben sich erreicht (oder gekreuzt) und sind etwa auf gleicher Höhe
      const gekreuzt = (sa.x - sb.x) * a.blick >= -6;
      if (!gekreuzt || Math.abs(sa.y - sb.y) > 22) return false;
      [a, b].forEach(function (f) {
        f.stoss = null;
        f.pause = K.stoss.pause;
        f.starre = K.prall.starre;
        f.vx = -f.blick * K.prall.vx;
        f.vy = K.prall.vy;
      });
      z.ereignisse.push({ art: "prall", x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 });
      return true;
    }

    /** Trifft die Spitze von a den Körper von b? */
    function pruefeTreffer(a, b) {
      if (!a.stoss || a.stoss.getroffen || b.ko || b.starre > 0) return;
      const s = spitze(a);
      if (s.e < 0.6) return;
      const h = b.geduckt ? K.hoeheGeduckt : K.hoehe;
      // Der ausgefahrene Stab (vom Griff bis zur Spitze) kreuzt den Körper –
      // so trifft er auch, wenn der Gegner sehr dicht steht
      const griff = a.x + a.blick * K.griff;
      const vorn = Math.min(griff, s.x), hinten = Math.max(griff, s.x);
      const halb = K.breite / 2 + 4;
      const imKoerper = hinten >= b.x - halb && vorn <= b.x + halb && s.y >= b.y && s.y <= b.y + h;
      if (!imKoerper) return;
      a.stoss.getroffen = true;
      const schaden = Math.round(K.schaden[0] + zufall() * (K.schaden[1] - K.schaden[0]));
      b.leben = Math.max(0, b.leben - schaden);
      b.stoss = null;
      b.geduckt = false;
      const ko = b.leben <= 0;
      const w = ko ? K.ko : K.rueckstoss;
      b.vx = a.blick * w.vx;
      b.vy = w.vy;
      b.starre = K.rueckstoss.starre;
      b.drehTempo = a.blick * (ko ? 11 : 15);
      b.ko = ko;
      z.ereignisse.push({ art: "treffer", x: s.x, y: s.y, schaden: schaden, wer: b.id, ko: ko });
    }

    /* ---------- Geschosse ---------- */

    /** Feuert aus der Spitze des Stabs (mehrere Kugeln: gefächert). */
    function schiesse(f, g) {
      const s = spitze(f);
      const amBoden = f.y <= 0;
      const grund = !amBoden ? g.winkel.luft : f.geduckt ? g.winkel.geduckt : g.winkel.stehend;
      for (let i = 0; i < g.anzahl; i++) {
        const grad = grund + (i - (g.anzahl - 1) / 2) * g.streuung;
        const w = grad * Math.PI / 180;
        z.geschosse.push({
          von: f.id, x: s.x, y: s.y,
          vx: Math.cos(w) * g.tempo * f.blick, vy: Math.sin(w) * g.tempo,
          radius: g.radius, schaden: g.schaden, abpraller: g.abpraller,
          effekte: g.effekte.slice(), alter: 0, lebensdauer: g.lebensdauer,
          spur: [], spurLaenge: g.spur, abgeprallt: 0,
        });
      }
      f.schussPause = g.abklingen;
      z.ereignisse.push({ art: "schuss", wer: f.id });
    }

    /** Geradeaus fliegen, an Wänden, Boden und Decke abprallen, Gegner treffen. */
    function bewegeGeschosse(dt) {
      const raum = K.raum;
      z.geschosse = z.geschosse.filter(function (k) {
        k.alter += dt;
        k.spur.push({ x: k.x, y: k.y });
        if (k.spur.length > k.spurLaenge) k.spur.shift();
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        let aufprall = false;
        if (k.x - k.radius < raum.links) { k.x = raum.links + k.radius; k.vx = Math.abs(k.vx); aufprall = true; }
        if (k.x + k.radius > raum.rechts) { k.x = raum.rechts - k.radius; k.vx = -Math.abs(k.vx); aufprall = true; }
        if (k.y - k.radius < 0) { k.y = k.radius; k.vy = Math.abs(k.vy); aufprall = true; }
        if (k.y + k.radius > raum.decke) { k.y = raum.decke - k.radius; k.vy = -Math.abs(k.vy); aufprall = true; }
        if (aufprall) {
          if (k.abpraller <= 0) {
            z.ereignisse.push({ art: "kugelWeg", x: k.x, y: k.y });
            return false;
          }
          k.abpraller--;
          k.abgeprallt++;
          z.ereignisse.push({ art: "abpraller", x: k.x, y: k.y, von: k.von });
        }
        if (k.alter > k.lebensdauer) return false;
        // Nur der Gegner wird getroffen – nie der Schütze selbst
        if (z.phase === "kampf") {
          const b = z[k.von === "gruen" ? "blau" : "gruen"];
          if (kugelTrifft(k, b)) {
            trefferDurchKugel(k, b);
            return false;
          }
        }
        return true;
      });
    }

    function kugelTrifft(k, b) {
      if (b.ko || b.starre > 0) return false;
      const h = b.geduckt ? K.hoeheGeduckt : K.hoehe;
      const nx = Math.max(b.x - K.breite / 2, Math.min(k.x, b.x + K.breite / 2));
      const ny = Math.max(b.y, Math.min(k.y, b.y + h));
      return (k.x - nx) * (k.x - nx) + (k.y - ny) * (k.y - ny) <= k.radius * k.radius;
    }

    function trefferDurchKugel(k, b) {
      b.leben = Math.max(0, b.leben - k.schaden);
      b.stoss = null;
      const ko = b.leben <= 0;
      const richtung = k.vx >= 0 ? 1 : -1;
      k.effekte.forEach(function (name) {
        const e = K.geschossEffekte[name];
        if (!e) return;
        b.vx = richtung * e.vx;
        b.vy = e.vy;
        b.starre = e.starre;
        b.drehTempo = richtung * e.drehTempo;
      });
      if (ko) {
        b.ko = true;
        b.vx = richtung * K.ko.vx;
        b.vy = K.ko.vy;
        b.drehTempo = richtung * 11;
      }
      z.ereignisse.push({ art: "treffer", x: k.x, y: k.y, schaden: k.schaden, wer: b.id, ko: ko, kugel: true });
    }

    return {
      zustand: z,
      schritt: schritt,
      spitze: spitze,
      ausfahrt: ausfahrt,
      werte: werte,
      angebote: angebote,
      waehle: waehle,
      revanche: function () {
        ["gruen", "blau"].forEach(function (id) { z[id].siege = 0; z[id].powerups = {}; });
        z.runde = 1;
        z.sieger = null;
        neueRunde();
      },
    };
  }

  /** Welches Angebot nimmt der Computer? Neues zuerst, sonst das mit der niedrigsten Stufe. */
  function kiWahl(spiel, zufall) {
    zufall = zufall || Math.random;
    const a = spiel.zustand.auswahl;
    if (!a) return 0;
    const f = spiel.zustand[a.wer];
    const vorliebe = { querschlaeger: 3, grower: 2, turbo: 1.5 };
    let beste = 0, punkte = -Infinity;
    a.angebote.forEach(function (id, i) {
      const p = (vorliebe[id] || 1) / (1 + (f.powerups[id] || 0)) + zufall() * 0.3;
      if (p > punkte) { punkte = p; beste = i; }
    });
    return beste;
  }


  /* ------------------------------------------------------------------------
     Computergegner: einfache Regeln mit Reaktionszeit und etwas Zufall
     ------------------------------------------------------------------------ */

  /**
   * @returns {object} Eingabe für den Kämpfer "ich"
   */
  function ki(spiel, ichId, dt, zufall) {
    zufall = zufall || Math.random;
    const z = spiel.zustand;
    const ich = z[ichId], er = z[ichId === "gruen" ? "blau" : "gruen"];
    const m = ich.ki || (ich.ki = { warte: 0, plan: "stehen", dauer: 0, stoss: false, schuss: false });
    const kannSchiessen = Boolean(spiel.werte(ich).geschoss) && ich.schussPause <= 0;
    m.warte -= dt;
    m.dauer -= dt;

    if (m.warte <= 0) {
      m.warte = 0.16 + zufall() * 0.16;            // Reaktionszeit
      const abstand = Math.abs(er.x - ich.x);
      const erStoesst = er.stoss && er.stoss.t < K.stoss.vor + K.stoss.halten;
      if (erStoesst && abstand < 150 && zufall() < 0.5) {
        m.plan = er.stoss.tief ? "springen" : "ducken";
        m.dauer = 0.35;
      } else if (kannSchiessen && abstand > 160 && zufall() < 0.45) {
        m.plan = "stehen";
        m.schuss = true;
        m.dauer = 0.15;
      } else if (abstand > 108 + (spiel.werte(ich).stab - K.stab)) {
        m.plan = zufall() < 0.07 ? "springen" : "ran";
        m.dauer = 0.25 + zufall() * 0.2;
      } else if (ich.pause <= 0 && !ich.stoss && zufall() < 0.75) {
        m.plan = er.geduckt && zufall() < 0.7 ? "tiefStoss" : "stoss";
        m.stoss = true;
        m.dauer = 0.2;
      } else if (zufall() < 0.35) {
        m.plan = "weg";
        m.dauer = 0.25;
      } else {
        m.plan = "stehen";
        m.dauer = 0.2;
      }
    }
    if (m.dauer <= 0 && m.plan !== "stehen") m.plan = "stehen";

    const zuIhm = er.x >= ich.x ? "rechts" : "links";
    const vonIhm = zuIhm === "rechts" ? "links" : "rechts";
    const e = {};
    if (m.plan === "ran") e[zuIhm] = true;
    if (m.plan === "weg") e[vonIhm] = true;
    if (m.plan === "ducken" || m.plan === "tiefStoss") e.ducken = true;
    if (m.plan === "springen") { e.springen = true; e[zuIhm] = true; }
    // Ein Stoß ist ein einzelner Tastendruck
    if (m.stoss) {
      e.angriff = true;
      m.stoss = false;
    }
    if (m.schuss) {
      e.schuss = true;
      m.schuss = false;
    }
    return e;
  }

  return { K: K, erstelle: erstelle, ki: ki, kiWahl: kiWahl, werte: werte, powerup: powerup };
})();

if (typeof module !== "undefined") module.exports = DuellRegeln;
