/* ==========================================================================
   football/regeln.js – die Regeln des Fußball-Duells (ohne DOM)
   2 gegen 2 in Seitenansicht, das Feld ist in 5 Zonen geteilt (siehe
   konfig.regeln.zonen). Jeder Spielzug ist ein Duell: Der ballführende
   Spieler wählt eine Angriffsaktion, der Verteidiger gleichzeitig eine
   Verteidigungsaktion.
   - Passt die Verteidigung (richtig geraten), entscheidet ein
     Wertevergleich: Wert + Würfel gegen Wert + Würfel. Gewinnt der
     Verteidiger, wechselt der Ball (bei Tor blockieren: Schuss geblockt).
     Gewinnt der Angreifer, gelingt die Aktion trotzdem.
   - Passt sie nicht, gelingt die Aktion. Ein Schuss muss dann noch am
     Torwart vorbei (Schießen + Würfel + Zonenzuschlag gegen Tor
     blockieren des Torwarts + Würfel).
   Die Wahl des Computers entsteht, BEVOR deine Wahl ausgewertet wird –
   sie kennt nur den Spielstand und deine bisherigen Züge.
   Bis 3 Tore oder 20 Spielzüge, bei Gleichstand Elfmeterduell.
   Fähigkeiten (football/abilities.js) hängen sich über benannte Haken
   ein (haken(…, "wertBonus") usw.) – im Elfmeterduell gelten sie nicht.
   Zufall von außen (zufall: () => 0…1) – so sind die Regeln testbar.
   ========================================================================== */

const FootballRegeln = (function () {

  // Im Browser liegen Konfiguration und Figuren schon global vor,
  // in Node.js werden sie hier nachgeladen
  const STANDARD_KONFIG = typeof FootballKonfig !== "undefined" ? FootballKonfig : require("./konfig.js");
  const STANDARD_FIGUREN = typeof FootballFiguren !== "undefined" ? FootballFiguren : require("./figuren.js");
  const STANDARD_KADER = typeof FootballKader !== "undefined" ? FootballKader : require("./players.js");
  const FAEHIGKEITEN = typeof FootballFaehigkeiten !== "undefined" ? FootballFaehigkeiten : require("./abilities.js");

  /** Gewichtete Auswahl: { a: 3, b: 1 } → "a" in 3 von 4 Fällen. */
  function waehle(gewichte, zufall) {
    const eintraege = Object.keys(gewichte).filter(function (k) { return gewichte[k] > 0; });
    const summe = eintraege.reduce(function (s, k) { return s + gewichte[k]; }, 0);
    let r = zufall() * summe;
    for (let i = 0; i < eintraege.length; i++) {
      r -= gewichte[eintraege[i]];
      if (r < 0) return eintraege[i];
    }
    return eintraege[eintraege.length - 1];
  }

  /**
   * Auslosung: dir werden proTeam verschiedene Spieler aus dem Kader
   * zugelost (in dieser Reihenfolge, für die Slot-Anzeige), der Gegner
   * bekommt proTeam aus dem Rest. In jedem Team spielt der Spieler mit
   * den höheren Abwehrwerten hinten (Index 1).
   * @returns {object} { teams: [{ name, spieler, torwart }, …], gezogen: [[ids in Zugreihenfolge], […]] }
   */
  function auslosen(optionen) {
    optionen = optionen || {};
    const K = optionen.konfig || STANDARD_KONFIG;
    const kader = optionen.kader || STANDARD_KADER;
    const zufall = optionen.zufall || function () { return Math.random(); };
    const topf = Object.keys(kader);
    const ziehe = function () { return topf.splice(Math.floor(zufall() * topf.length), 1)[0]; };
    const gezogen = [[], []];
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < K.kader.proTeam; i++) gezogen[t].push(ziehe());
    }
    const abwehr = function (id) {
      return K.kader.hintenWerte.reduce(function (s, w) { return s + kader[id].werte[w]; }, 0);
    };
    const teams = gezogen.map(function (ids, t) {
      // vorne der Offensivere, hinten der mit mehr Abwehr (bei Gleichstand: Reihenfolge der Ziehung)
      const spieler = ids.slice().sort(function (a, b) { return abwehr(a) - abwehr(b); });
      return { name: K.teams[t].name, spieler: spieler, torwart: K.kader.torwarte[t] };
    });
    return { teams: teams, gezogen: gezogen };
  }

  /**
   * Ein neues Match.
   * @param {object} [optionen] – { zufall, konfig, figuren, kader, teams }
   *   teams:   [{ name, spieler: [id, id], torwart }, …] fest vorgeben –
   *            sonst werden die Teams aus dem Kader gelost (siehe auslosen)
   */
  function erstelle(optionen) {
    optionen = optionen || {};
    const K = optionen.konfig || STANDARD_KONFIG;
    const KADER = optionen.kader || STANDARD_KADER;
    // Alle Figuren: Torhüter (und ältere Figuren) aus figuren.js, dazu der Kader
    const F = Object.assign({}, optionen.figuren || STANDARD_FIGUREN, KADER);
    // ohne Vorgabe: Math.random (bei jedem Wurf neu gelesen)
    const zufall = optionen.zufall || function () { return Math.random(); };
    const auslosung = optionen.teams ? null : auslosen({ konfig: K, kader: KADER, zufall: zufall });
    const teams = optionen.teams || auslosung.teams;
    const R = K.regeln;
    const LETZTE = R.zonen.length - 1;          // 4: Strafraum

    const zustand = {
      tore: [0, 0],
      zug: 0,                    // gespielte Spielzüge
      zone: R.anstossZone,       // Zone des Balls (aus deiner Sicht)
      ballTeam: R.anstossTeam,   // 0 = du, 1 = Computer
      traeger: 0,                // Index im Team (spieler[0] oder spieler[1])
      phase: "spiel",            // "spiel" | "elfmeter" | "ende"
      elfmeter: null,            // { schuetzeTeam, schuesse: [[…], […]] } (true = Tor)
      ende: null,                // { sieger: 0 | 1, grund: "tore" | "zuege" | "elfmeter" }
      traumannahme: null,        // Figur, deren Traumannahme gerade aktiv ist (Fähigkeit)
      vorlieben: [],             // deine letzten Angriffsaktionen (für die KI)
      elfmeterVorlieben: [],     // deine bisherigen Schussrichtungen im Elfmeter
    };

    // ---------------------------------------------------------------
    // Hilfen
    // ---------------------------------------------------------------

    /** Zone aus Sicht eines Teams (0 eigenes Tor … 4 Strafraum vor dem gegnerischen Tor). */
    function relZone(team, zone) {
      const z = zone === undefined ? zustand.zone : zone;
      return team === 0 ? z : LETZTE - z;
    }

    /** Zone aus Sicht eines Teams → Zone der Leiste (deine Sicht). */
    function absZone(team, rel) {
      return team === 0 ? rel : LETZTE - rel;
    }

    function figur(id) {
      const f = F[id];
      if (!f) throw new Error("Fußball: unbekannte Figur " + id);
      return f;
    }

    // ---------------------------------------------------------------
    // Fähigkeiten: die benannten Haken (siehe football/abilities.js)
    // ---------------------------------------------------------------

    function faehigkeitVon(id) {
      const f = F[id];
      return f && f.faehigkeit ? FAEHIGKEITEN.holen(f.faehigkeit) : null;
    }

    /** Haken einer Figur aufrufen; ohne passende Fähigkeit: null. */
    function haken(id, name, kontext) {
      const fa = faehigkeitVon(id);
      if (!fa || !fa.wirkung[name]) return null;
      const k = Object.assign({ konfig: K, zufall: zufall, figurId: id, zustand: zustand }, kontext || {});
      return { faehigkeit: fa, aufruf: function () {
        const args = Array.prototype.slice.call(arguments);
        return fa.wirkung[name].apply(null, args.concat([k]));
      } };
    }

    /** Wert einer Figur für eine Aktion – mit Zuschlag der Fähigkeit (außer mitFaehigkeit = false). */
    function wert(id, name, mitFaehigkeit) {
      const basis = figur(id).werte[name];
      if (mitFaehigkeit === false) return basis;
      const h = haken(id, "wertBonus");
      return basis + (h ? h.aufruf(name) : 0);
    }

    /** Ab welcher Zone (Sicht des Schützen) darf diese Figur schießen? */
    function schussAb(id) {
      const h = haken(id, "schussAbZone");
      return h ? h.aufruf(R.schussAbZone) : R.schussAbZone;
    }

    /** Ausgelöste Fähigkeit für das Ergebnis festhalten. */
    function ausgeloest(e, id, team, extra) {
      const fa = faehigkeitVon(id);
      e.faehigkeiten.push(Object.assign({ id: fa.id, name: fa.name, symbol: fa.symbol, figur: id, team: team }, extra || {}));
    }

    /** Wer verteidigt? Im eigenen Drittel (Angreifer ab Zone 3) der hintere Spieler, sonst der vordere. */
    function verteidigerIndex(angreiferRel) {
      return angreiferRel >= R.schussAbZone ? 1 : 0;
    }

    function wuerfle() {
      return 1 + Math.floor(zufall() * R.wuerfel);
    }

    function aktion(art, id) {
      return K.aktionen[art].find(function (a) { return a.id === id; });
    }

    /** Darf der Ballführende von hier schießen? (Akrobatik: schon ab der Mitte) */
    function schussErlaubt(team) {
      return relZone(team) >= schussAb(teams[team].spieler[zustand.traeger]);
    }

    /** Welche Aktionen hat ein Team in seiner Lage? (erlaubt / Grund) */
    function aktionenFuer(team) {
      const angriff = zustand.ballTeam === team;
      const schuss = schussErlaubt(zustand.ballTeam);
      if (angriff) {
        return K.aktionen.angriff.map(function (a) {
          const erlaubt = a.id !== "schiessen" || schuss;
          return { id: a.id, name: a.name, taste: a.taste, erlaubt: erlaubt,
            grund: erlaubt ? "" : schussAb(teams[team].spieler[zustand.traeger]) < R.schussAbZone
              ? "Schießen geht erst ab der Mitte" : "Schießen geht erst ab der gegnerischen Hälfte" };
        });
      }
      return K.aktionen.verteidigung.map(function (a) {
        const erlaubt = a.id !== "torBlockieren" || schuss;
        return { id: a.id, name: a.name, taste: a.taste, erlaubt: erlaubt,
          grund: erlaubt ? "" : "Von hier kann der Gegner nicht schießen" };
      });
    }

    // ---------------------------------------------------------------
    // Computer-Steuerung
    // ---------------------------------------------------------------

    /** Angriffsaktion des Computers – gewichtet nach seiner Zone. */
    function kiAngriff() {
      const g = Object.assign({}, K.ki.angriff[relZone(1)]);
      if (!schussErlaubt(1)) g.schiessen = 0;
      else if (!(g.schiessen > 0)) g.schiessen = K.ki.schussOhneGewicht;    // Akrobat in der Mitte
      return waehle(g, zufall);
    }

    /**
     * Gewichte der Verteidigung des Computers: Grundgewichte nach der
     * Zone deines Angriffs, ein Teil davon nach deinen letzten
     * Angriffsaktionen verteilt (so lohnt es nicht, immer dasselbe zu wählen).
     */
    function kiVerteidigungsGewichte() {
      const basis = Object.assign({}, K.ki.verteidigung[relZone(0)]);
      const schuss = schussErlaubt(0);
      if (!schuss) basis.torBlockieren = 0;
      else if (!(basis.torBlockieren > 0)) basis.torBlockieren = K.ki.schussOhneGewicht;
      const erlaubteAngriffe = K.aktionen.angriff.filter(function (a) { return a.id !== "schiessen" || schuss; })
        .map(function (a) { return a.id; });
      const letzte = zustand.vorlieben.slice(-K.ki.gedaechtnis).filter(function (id) { return erlaubteAngriffe.indexOf(id) >= 0; });
      if (letzte.length === 0 || K.ki.anpassung <= 0) return basis;
      const summe = Object.keys(basis).reduce(function (s, k) { return s + basis[k]; }, 0);
      const g = {};
      K.aktionen.verteidigung.forEach(function (v) {
        if (v.id === "torBlockieren" && !schuss) { g[v.id] = 0; return; }
        const anteil = letzte.filter(function (id) { return id === v.konter; }).length / letzte.length;
        g[v.id] = (basis[v.id] || 0) * (1 - K.ki.anpassung) + K.ki.anpassung * summe * anteil;
      });
      return g;
    }

    function kiVerteidigung() {
      return waehle(kiVerteidigungsGewichte(), zufall);
    }

    // ---------------------------------------------------------------
    // Ein Spielzug
    // ---------------------------------------------------------------

    /**
     * Ein Duell spielen.
     * @param {string} meineAktion – Angriffs- oder Verteidigungsaktion (je nach Ballbesitz)
     * @param {object} [test] – { gegner: Aktion des Computers erzwingen } (nur für Tests)
     * @returns {object} das Ergebnis (siehe unten) – alles, was die Darstellung braucht
     */
    function spieleZug(meineAktion, test) {
      if (zustand.phase !== "spiel") throw new Error("Fußball: kein Spielzug möglich (Phase " + zustand.phase + ")");
      const angriffTeam = zustand.ballTeam;
      const verteidigungTeam = 1 - angriffTeam;
      const meine = aktionenFuer(0).find(function (a) { return a.id === meineAktion; });
      if (!meine || !meine.erlaubt) throw new Error("Fußball: Aktion nicht möglich: " + meineAktion);

      // Die Wahl des Computers entsteht unabhängig von deiner
      const gegnerAktion = (test && test.gegner) || (angriffTeam === 1 ? kiAngriff() : kiVerteidigung());
      const angriffId = angriffTeam === 0 ? meineAktion : gegnerAktion;
      const verteidigungId = angriffTeam === 0 ? gegnerAktion : meineAktion;
      if (angriffTeam === 0) zustand.vorlieben.push(meineAktion);

      const rel = relZone(angriffTeam);
      const angreiferId = teams[angriffTeam].spieler[zustand.traeger];
      const vIndex = verteidigerIndex(rel);
      const verteidigerId = teams[verteidigungTeam].spieler[vIndex];
      const torwartId = teams[verteidigungTeam].torwart;
      const a = aktion("angriff", angriffId);
      const v = aktion("verteidigung", verteidigungId);
      const passt = v.konter === a.id;
      const vorher = { zone: zustand.zone, ballTeam: zustand.ballTeam, traeger: zustand.traeger };

      const e = {
        art: "zug",
        angriffTeam: angriffTeam,
        angreifer: angreiferId,
        mitspieler: teams[angriffTeam].spieler[1 - zustand.traeger],
        verteidiger: verteidigerId,
        torwart: torwartId,
        angriff: a.id,
        verteidigung: v.id,
        passt: passt,
        vergleich: null,
        torwartDuell: null,
        ausgang: null,          // "pass" | "dribbling" | "tor" | "abgefangen" | "zweikampf" | "geblockt" | "gehalten"
        ballgewinn: false,      // die Verteidigung hat den Ball erobert (Vergleich gewonnen oder Mauer)
        tor: false,
        zonen: 0,               // um wie viele Zonen der Ball vorgerückt ist
        sologang: false,
        schussArt: null,        // Akrobatik: "Fallrückzieher" …
        faehigkeiten: [],       // ausgelöste Fähigkeiten in ihrer Reihenfolge
        vorher: vorher,
      };
      const traumVorher = zustand.traumannahme;

      // Haken "vorDuell": Sologang – die Verteidigung spielt keine Rolle
      const solo = haken(angreiferId, "vorDuell", { aktion: a.id });
      const sonder = solo ? solo.aufruf() : null;
      if (sonder && sonder.art === "sologang") {
        ausgeloest(e, angreiferId, angriffTeam);
        e.sologang = true;
        e.tor = true;
        e.ausgang = "tor";
        e.zonen = LETZTE - rel;
        zustand.tore[angriffTeam]++;
        zustand.ballTeam = verteidigungTeam;
        zustand.zone = R.anstossZone;
        zustand.traeger = 0;
        zustand.traumannahme = null;
        return abschluss(e);
      }

      // 1. Passt die Verteidigung? Dann Wertevergleich (mit Wertezuschlägen der Fähigkeiten)
      let gelingt = true;
      if (passt) {
        const wa = wert(angreiferId, a.wert), wv = wert(verteidigerId, v.wert);
        const ra = wuerfle(), rv = wuerfle();
        const angriffGewinnt = R.gleichstandFuer === "verteidiger" ? wa + ra > wv + rv : wa + ra >= wv + rv;
        e.vergleich = {
          angriff: { wert: wa, wurf: ra, summe: wa + ra },
          verteidigung: { wert: wv, wurf: rv, summe: wv + rv },
          sieger: angriffGewinnt ? "angriff" : "verteidigung",
        };
        gelingt = angriffGewinnt;
      } else {
        // Haken "falschGeraten": Mauer – trotzdem eine kleine Chance auf den Ball
        const mauer = haken(verteidigerId, "falschGeraten", { aktion: a.id });
        if (mauer && mauer.aufruf()) {
          ausgeloest(e, verteidigerId, verteidigungTeam);
          gelingt = false;
        }
      }

      // 2. Ausgang
      if (!gelingt) {
        e.ballgewinn = true;
        zustand.traumannahme = null;            // Ballverlust: eine Traumannahme verfällt
        if (a.id === "schiessen") {
          // Schuss geblockt: Ball für die Verteidiger in ihrer eigenen Hälfte
          e.ausgang = "geblockt";
          zustand.ballTeam = verteidigungTeam;
          zustand.zone = absZone(verteidigungTeam, R.nachParadeZone);
          zustand.traeger = 1;
        } else {
          // Pass abgefangen bzw. Zweikampf verloren: der Verteidiger hat den Ball, gleiche Zone
          e.ausgang = a.id === "passen" ? "abgefangen" : "zweikampf";
          zustand.ballTeam = verteidigungTeam;
          zustand.traeger = vIndex;
        }
      } else if (a.id === "passen" || a.id === "dribbeln") {
        // Haken "vorruecken": eine Zone vor (Übersicht, Ballzauber: zwei).
        // Im Strafraum bleibt der Ball im Strafraum.
        const vor = haken(angreiferId, "vorruecken", { aktion: a.id, passt: passt, gewonnen: true });
        let zonen = 1;
        if (vor) {
          zonen = vor.aufruf(1);
          if (zonen > 1 && rel < LETZTE - 1) ausgeloest(e, angreiferId, angriffTeam, { zonen: zonen });
        }
        const neu = Math.min(LETZTE, rel + zonen);
        e.zonen = neu - rel;
        zustand.zone = absZone(angriffTeam, neu);
        if (a.id === "passen") {
          // abgegeben: eine Traumannahme des Passgebers verfällt
          if (zustand.traumannahme === angreiferId) zustand.traumannahme = null;
          zustand.traeger = 1 - zustand.traeger;
          const empfaenger = teams[angriffTeam].spieler[zustand.traeger];
          // Haken "passAngenommen": Traumannahme
          const annahme = haken(empfaenger, "passAngenommen", { aktion: a.id });
          if (annahme && annahme.aufruf()) {
            zustand.traumannahme = empfaenger;
            ausgeloest(e, empfaenger, angriffTeam);
          }
        }
        e.ausgang = a.id === "passen" ? "pass" : "dribbling";
      } else {
        // Schuss aufs Tor: noch am Torwart vorbei?
        // Haken "schussArt" (Akrobatik), "schussZuschlag" (Kanone, Akrobatik),
        // "torwartWert" (Traumannahme)
        const art = haken(angreiferId, "schussArt");
        if (art) {
          e.schussArt = art.aufruf();
          ausgeloest(e, angreiferId, angriffTeam, { schussArt: e.schussArt });
        }
        const ws = wert(angreiferId, "schiessen");
        const zuschlag = haken(angreiferId, "schussZuschlag");
        const standard = R.schussZone[rel] || 0;
        const bonus = zuschlag ? zuschlag.aufruf(rel, standard) : standard;
        if (zuschlag && bonus > standard && !art) ausgeloest(e, angreiferId, angriffTeam);
        let wt = wert(torwartId, "torBlockieren");
        const traum = haken(angreiferId, "torwartWert");
        if (traum && zustand.traumannahme === angreiferId) {
          wt = traum.aufruf(wt);
          ausgeloest(e, angreiferId, angriffTeam, { torwartHalbiert: true });
        }
        zustand.traumannahme = null;            // der Schuss verbraucht sie
        const rs = wuerfle(), rt = wuerfle();
        const tor = R.gleichstandFuer === "verteidiger" ? ws + bonus + rs > wt + rt : ws + bonus + rs >= wt + rt;
        e.torwartDuell = {
          schuss: { wert: ws, zone: bonus, wurf: rs, summe: ws + bonus + rs },
          torwart: { wert: wt, wurf: rt, summe: wt + rt },
          gehalten: !tor,
        };
        if (tor) {
          e.tor = true;
          e.ausgang = "tor";
          zustand.tore[angriffTeam]++;
          // Anstoß für das Team, das das Tor kassiert hat
          zustand.ballTeam = verteidigungTeam;
          zustand.zone = R.anstossZone;
          zustand.traeger = 0;
        } else {
          e.ausgang = "gehalten";
          zustand.ballTeam = verteidigungTeam;
          zustand.zone = absZone(verteidigungTeam, R.nachParadeZone);
          zustand.traeger = 1;
        }
      }
      if (e.ausgang === "pass") e.empfaenger = teams[angriffTeam].spieler[zustand.traeger];
      e.traumannahmeVerfallen = Boolean(traumVorher) && !zustand.traumannahme && !e.faehigkeiten.some(function (f) { return f.torwartHalbiert; });
      return abschluss(e);
    }

    /** Gemeinsamer Abschluss jedes Spielzugs: Zähler, Texte, Ende. */
    function abschluss(e) {
      zustand.zug++;
      e.zug = zustand.zug;
      e.nachher = { zone: zustand.zone, ballTeam: zustand.ballTeam, traeger: zustand.traeger };
      e.tore = zustand.tore.slice();
      e.traumannahme = zustand.traumannahme;
      e.text = zugText(e);
      e.detail = detailText(e);

      // 3. Ende? 3 Tore oder 20 Spielzüge – bei Gleichstand Elfmeter
      if (Math.max(zustand.tore[0], zustand.tore[1]) >= R.siegTore) {
        beende(zustand.tore[0] > zustand.tore[1] ? 0 : 1, "tore");
      } else if (zustand.zug >= R.maxZuege) {
        if (zustand.tore[0] === zustand.tore[1]) starteElfmeter();
        else beende(zustand.tore[0] > zustand.tore[1] ? 0 : 1, "zuege");
      }
      e.phase = zustand.phase;
      e.ende = zustand.ende;
      return e;
    }

    /** "Dribbling gegen Zweikampf: gewonnen!" – immer aus deiner Sicht (deine Aktion zuerst). */
    function zugText(e) {
      const ich = e.angriffTeam === 0;
      const a = aktion("angriff", e.angriff).nomen, v = aktion("verteidigung", e.verteidigung).nomen;
      const anfang = ich ? a + " gegen " + v : v + " gegen " + a;
      if (e.sologang) {
        return (ich ? "Sologang von " : "Sologang des Gegners – ") + F[e.angreifer].name + (ich ? ": Tor!" : ": Gegentor!");
      }
      let ende;
      if (ich) {
        if (e.ausgang === "tor") ende = "Tor!";
        else if (e.ausgang === "gehalten") ende = e.passt ? "durch, aber der Torwart hält!" : "der Torwart hält!";
        else if (e.ausgang === "geblockt") ende = "geblockt!";
        else if (e.ballgewinn) ende = "verloren!";
        else ende = e.passt ? "gewonnen!" : "frei durch!";
      } else {
        if (e.ausgang === "tor") ende = e.passt ? "verloren – Gegentor!" : "falsch geraten – Gegentor!";
        else if (e.ausgang === "gehalten") ende = "dein Torwart hält!";
        else if (e.ausgang === "geblockt") ende = "Schuss geblockt!";
        else if (e.ballgewinn) ende = "Ball erobert!";
        else ende = e.passt ? "verloren!" : "falsch geraten!";
      }
      return anfang + ": " + ende;
    }

    /** "6 + 4 = 10 gegen 5 + 2 = 7" (Vergleich) und/oder "Schuss 8 + 3 + 5 = 16 gegen Torwart 6 + 2 = 8". */
    function detailText(e) {
      const teile = [];
      if (e.vergleich) {
        const x = e.vergleich;
        teile.push(x.angriff.wert + " + " + x.angriff.wurf + " = " + x.angriff.summe + " gegen " +
          x.verteidigung.wert + " + " + x.verteidigung.wurf + " = " + x.verteidigung.summe);
      }
      if (e.torwartDuell) {
        const t = e.torwartDuell;
        teile.push("Schuss " + t.schuss.wert + (t.schuss.zone ? " + " + t.schuss.zone : "") + " + " + t.schuss.wurf + " = " + t.schuss.summe +
          " gegen Torwart " + t.torwart.wert + " + " + t.torwart.wurf + " = " + t.torwart.summe);
      }
      return teile.join(" · ");
    }

    function beende(sieger, grund) {
      zustand.phase = "ende";
      zustand.ende = { sieger: sieger, grund: grund };
    }

    // ---------------------------------------------------------------
    // Elfmeterduell
    // ---------------------------------------------------------------

    function starteElfmeter() {
      zustand.phase = "elfmeter";
      zustand.elfmeter = { schuetzeTeam: R.anstossTeam, schuesse: [[], []] };
    }

    /** Wer schießt als Nächstes, wer hält? */
    function elfmeterLage() {
      const el = zustand.elfmeter;
      if (!el) return null;
      const team = el.schuetzeTeam;
      const nr = el.schuesse[team].length;
      return {
        schuetzeTeam: team,
        schuetze: teams[team].spieler[nr % teams[team].spieler.length],
        torwart: teams[1 - team].torwart,
        nummer: nr + 1,
        tore: [treffer(0), treffer(1)],
        schuesse: [el.schuesse[0].slice(), el.schuesse[1].slice()],
      };
    }

    function treffer(team) {
      return zustand.elfmeter.schuesse[team].filter(Boolean).length;
    }

    /** Richtung des Computers als Torwart: reagiert leicht auf deine bisherigen Ecken. */
    function kiTorwartRichtung() {
      const g = {};
      R.elfmeter.richtungen.forEach(function (r) { g[r] = 1; });
      const n = zustand.elfmeterVorlieben.length;
      if (n > 0 && K.ki.elfmeterAnpassung > 0) {
        R.elfmeter.richtungen.forEach(function (r) {
          const anteil = zustand.elfmeterVorlieben.filter(function (x) { return x === r; }).length / n;
          g[r] = (1 - K.ki.elfmeterAnpassung) + K.ki.elfmeterAnpassung * R.elfmeter.richtungen.length * anteil;
        });
      }
      return waehle(g, zufall);
    }

    /**
     * Ein Elfmeter. Schießt du, ist richtung deine Schussrichtung; hältst
     * du, ist es die Ecke deines Torwarts.
     * @param {string} richtung – "links" | "mitte" | "rechts"
     * @param {object} [test] – { gegner: Richtung des Computers erzwingen }
     */
    function spieleElfmeter(richtung, test) {
      if (zustand.phase !== "elfmeter") throw new Error("Fußball: kein Elfmeter");
      if (R.elfmeter.richtungen.indexOf(richtung) < 0) throw new Error("Fußball: unbekannte Richtung " + richtung);
      const lage = elfmeterLage();
      const ichSchiesse = lage.schuetzeTeam === 0;
      const gegner = (test && test.gegner) || (ichSchiesse ? kiTorwartRichtung() : waehle(K.ki.elfmeterSchuss, zufall));
      const schussRichtung = ichSchiesse ? richtung : gegner;
      const torwartRichtung = ichSchiesse ? gegner : richtung;
      if (ichSchiesse) zustand.elfmeterVorlieben.push(richtung);

      // Richtige Ecke: Wertevergleich. Falsche Ecke: Tor.
      let vergleich = null, tor = true;
      if (schussRichtung === torwartRichtung) {
        // Im Elfmeterduell gelten nur die Grundwerte – keine Fähigkeiten
        const ws = wert(lage.schuetze, "schiessen", false), wt = wert(lage.torwart, "torBlockieren", false);
        const rs = wuerfle(), rt = wuerfle();
        tor = R.gleichstandFuer === "verteidiger" ? ws + rs > wt + rt : ws + rs >= wt + rt;
        vergleich = { schuss: { wert: ws, wurf: rs, summe: ws + rs }, torwart: { wert: wt, wurf: rt, summe: wt + rt } };
      }
      zustand.elfmeter.schuesse[lage.schuetzeTeam].push(tor);
      zustand.elfmeter.schuetzeTeam = 1 - lage.schuetzeTeam;

      const e = {
        art: "elfmeter",
        schuetzeTeam: lage.schuetzeTeam, schuetze: lage.schuetze, torwart: lage.torwart, nummer: lage.nummer,
        schussRichtung: schussRichtung, torwartRichtung: torwartRichtung, vergleich: vergleich, tor: tor,
      };
      const sieger = elfmeterSieger();
      if (sieger !== null) beende(sieger, "elfmeter");
      e.stand = [treffer(0), treffer(1)];
      e.schuesse = [zustand.elfmeter.schuesse[0].slice(), zustand.elfmeter.schuesse[1].slice()];
      e.text = elfmeterText(e);
      e.detail = vergleich ? "Schuss " + vergleich.schuss.wert + " + " + vergleich.schuss.wurf + " = " + vergleich.schuss.summe +
        " gegen Torwart " + vergleich.torwart.wert + " + " + vergleich.torwart.wurf + " = " + vergleich.torwart.summe : "";
      e.phase = zustand.phase;
      e.ende = zustand.ende;
      return e;
    }

    function elfmeterText(e) {
      const ecke = { links: "links", mitte: "Mitte", rechts: "rechts" };
      if (e.schuetzeTeam === 0) {
        return "Elfmeter " + ecke[e.schussRichtung] + ", Torwart " + ecke[e.torwartRichtung] + ": " +
          (e.tor ? "Tor!" : "gehalten!");
      }
      return "Du hechtest " + ecke[e.torwartRichtung] + ", Schuss " + ecke[e.schussRichtung] + ": " +
        (e.tor ? "Gegentor!" : "gehalten!");
    }

    /** null, solange das Elfmeterduell offen ist; sonst 0 oder 1. */
    function elfmeterSieger() {
      const s = zustand.elfmeter.schuesse, n = R.elfmeter.runden;
      const t0 = treffer(0), t1 = treffer(1);
      if (s[0].length <= n && s[1].length <= n) {
        // Reguläre Runden: Kann einer nicht mehr aufholen?
        const rest0 = n - s[0].length, rest1 = n - s[1].length;
        if (t0 + rest0 < t1) return 1;
        if (t1 + rest1 < t0) return 0;
        if (s[0].length === n && s[1].length === n && t0 !== t1) return t0 > t1 ? 0 : 1;
        return null;
      }
      // Sudden Death: nach jedem Paar
      if (s[0].length === s[1].length && t0 !== t1) return t0 > t1 ? 0 : 1;
      return null;
    }

    // ---------------------------------------------------------------

    return {
      zustand: zustand,
      konfig: K,
      figuren: F,
      teams: teams,                 // die beiden Teams dieses Matches
      auslosung: auslosung,         // { teams, gezogen } – wenn die Teams gelost wurden
      wert: wert,                   // Wert einer Figur mit Fähigkeit (für Teamkarten)
      faehigkeitVon: faehigkeitVon,
      relZone: relZone,
      aktionenFuer: aktionenFuer,
      // Was du gerade wählen kannst: { art, aktionen } – art: "angriff" |
      // "verteidigung" | "elfmeterSchuss" | "elfmeterHalten" | null (Ende)
      meineWahl: function () {
        if (zustand.phase === "spiel") {
          return { art: zustand.ballTeam === 0 ? "angriff" : "verteidigung", aktionen: aktionenFuer(0) };
        }
        if (zustand.phase === "elfmeter") {
          const lage = elfmeterLage();
          return {
            art: lage.schuetzeTeam === 0 ? "elfmeterSchuss" : "elfmeterHalten",
            aktionen: R.elfmeter.richtungen.map(function (r, i) {
              return { id: r, name: { links: "Links", mitte: "Mitte", rechts: "Rechts" }[r], taste: String(i + 1), erlaubt: true, grund: "" };
            }),
          };
        }
        return { art: null, aktionen: [] };
      },
      spieleZug: spieleZug,
      spieleElfmeter: spieleElfmeter,
      elfmeterLage: elfmeterLage,
      // Wer gerade den Ball hat / wer verteidigt (Figur-IDs) – für die Darstellung
      ballfuehrer: function () { return teams[zustand.ballTeam].spieler[zustand.traeger]; },
      verteidigerFuer: function () {
        const t = zustand.ballTeam;
        return teams[1 - t].spieler[verteidigerIndex(relZone(t))];
      },
      // Für Tests und die Simulation
      kiAngriff: kiAngriff,
      kiVerteidigung: kiVerteidigung,
      kiVerteidigungsGewichte: kiVerteidigungsGewichte,
    };
  }

  return { erstelle: erstelle, auslosen: auslosen, waehle: waehle };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballRegeln;
}
