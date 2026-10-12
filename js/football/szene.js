/* ==========================================================================
   football/szene.js – die Pixel-Szene des Fußball-Duells (Canvas)
   Seitenansicht: dein Tor links, das gegnerische rechts, dazwischen die
   5 Zonen. Die Kamera folgt dem Ball. Gezeichnet wird in einer kleinen
   Auflösung (konfig.szene.breite × hoehe) – das CSS vergrößert den Canvas
   mit harten Pixelkanten.
   Ein Spielzug wird als Ablauf aus Stationen gespielt: Jede Figur und der
   Ball bekommen eine Spur ({ t, x, y, pose }, t von 0 bis 1). abkuerzen()
   springt sofort ans Ende.
   ========================================================================== */

const FootballSzene = (function () {

  function erstelle(canvas, optionen) {
    const K = optionen.konfig;
    const F = optionen.figuren;
    const A = optionen.arena;
    const S = K.szene;
    const ctx = canvas.getContext("2d");
    // Gezeichnet wird in einem Raster von S.breite × S.hoehe (Feld, Wand,
    // Decke). Ist die Bühne höher, zeigt die Szene oben mehr Wand (DY);
    // die Breite passt sich so an, dass jeder Szenen-Pixel genau gleich
    // viele Bildschirmpixel groß ist (passeGroesseAn).
    let BREITE = S.breite, HOEHE = S.hoehe, DY = 0;
    canvas.width = BREITE;
    canvas.height = HOEHE;

    const ZONEN = K.regeln.zonen.length;
    const WELT = S.rand * 2 + ZONEN * S.zonenBreite;      // Breite der Spielwelt
    const TOR_LINKS = S.rand, TOR_RECHTS = WELT - S.rand;
    const GRUND = S.hoehe;                                  // Höhe des Grundrasters (Feld unten)
    const RASEN_OBEN = 66;                                  // oberer Rand des Rasens

    // Alle sechs Figuren: Schlüssel "team-index" bzw. "team-k" (Torwart)
    const FIGUREN = [];
    K.teams.forEach(function (team, t) {
      team.spieler.forEach(function (id, i) { FIGUREN.push({ schluessel: t + "-" + i, id: id, team: t }); });
      FIGUREN.push({ schluessel: t + "-k", id: team.torwart, team: t, torwart: true });
    });

    let aktuell = {};          // schluessel → { x, y, pose, bild, richtung }
    let ball = { x: WELT / 2, y: S.boden - 2, bild: 0 };
    let kameraX = WELT / 2;
    let kameraZiel = WELT / 2;
    let netzWackeln = { rechts: 0, links: 0 };
    let ablauf = null;         // laufender Ablauf { spuren, ballSpur, dauer, start, fertig, ende }
    let laeuft = false;
    let zeit = 0;

    // ------------------------------------------------------------------
    // Aufstellung
    // ------------------------------------------------------------------

    function zonenMitte(z) { return S.rand + S.zonenBreite * (z + 0.5); }
    function begrenze(x) { return Math.max(TOR_LINKS + 16, Math.min(TOR_RECHTS - 16, x)); }

    /**
     * Wo stehen alle bei dieser Lage? Ballführer hinter dem Ball, sein
     * Mitspieler eine Zone weiter vorn, der Verteidiger stellt sich ihm
     * entgegen, der zweite Verteidiger deckt den Mitspieler.
     * @param {object} lage – { zone, ballTeam, traeger }
     */
    function aufstellung(lage) {
      const att = lage.ballTeam, def = 1 - att;
      const dir = att === 0 ? 1 : -1;
      const rel = att === 0 ? lage.zone : ZONEN - 1 - lage.zone;
      const vIndex = rel >= K.regeln.schussAbZone ? 1 : 0;
      const bx = zonenMitte(lage.zone);
      const p = {};
      const traegerX = bx - dir * 6;
      p[att + "-" + lage.traeger] = { x: traegerX, y: S.boden + 2, richtung: dir };
      const mitX = begrenze(bx + dir * S.zonenBreite * 0.85);
      p[att + "-" + (1 - lage.traeger)] = { x: mitX, y: S.boden - 1, richtung: dir };
      p[def + "-" + vIndex] = { x: traegerX + dir * 24, y: S.boden - 3, richtung: -dir };
      p[def + "-" + (1 - vIndex)] = { x: begrenze(mitX + dir * 14), y: S.boden - 4, richtung: -dir };
      p["0-k"] = { x: TOR_LINKS + 8, y: S.boden - 2, richtung: 1 };
      p["1-k"] = { x: TOR_RECHTS - 8, y: S.boden - 2, richtung: -1 };
      return {
        figuren: p,
        ball: { x: traegerX + dir * 7, y: S.boden + 2 - 2 },
        dir: dir,
        traeger: att + "-" + lage.traeger,
        verteidiger: def + "-" + vIndex,
        mitspieler: att + "-" + (1 - lage.traeger),
      };
    }

    /** Sofort in eine Lage springen (ohne Animation). */
    function setzeLage(lage) {
      ablauf = null;
      const auf = aufstellung(lage);
      aktuell = {};
      Object.keys(auf.figuren).forEach(function (k) {
        const f = auf.figuren[k];
        aktuell[k] = { x: f.x, y: f.y, richtung: f.richtung, pose: "stehen", bild: 0 };
      });
      ball = { x: auf.ball.x, y: auf.ball.y, bild: 0 };
      kameraZiel = kameraFuer(ball.x, auf.dir);
      kameraX = kameraZiel;
      zeichne();
    }

    function kameraFuer(x, dir) {
      const halb = BREITE / 2;
      return Math.max(halb, Math.min(WELT - halb, x + (dir || 0) * 22));
    }

    // ------------------------------------------------------------------
    // Spuren: Stationen je Figur und für den Ball
    // ------------------------------------------------------------------

    function neueSpuren(auf) {
      const spuren = {};
      Object.keys(auf.figuren).forEach(function (k) {
        const f = auf.figuren[k];
        spuren[k] = [{ t: 0, x: f.x, y: f.y, richtung: f.richtung, pose: "stehen", bild: 0 }];
      });
      return spuren;
    }

    /** Station anhängen: ab Zeitpunkt t gilt die Änderung (Position, Pose …). */
    function station(spuren, k, t, aenderung) {
      const liste = spuren[k];
      const letzte = liste[liste.length - 1];
      // erst die alte Lage bis t halten, dann (falls Bewegung) ab hier laufen
      liste.push(Object.assign({}, letzte, { t: t, weg: null }, aenderung || {}));
    }

    /** Bis t1 von der letzten Station zu (x, y) laufen (Pose unterwegs: weg). */
    function lauf(spuren, k, t0, t1, ziel, weg) {
      station(spuren, k, t0);
      station(spuren, k, t1, Object.assign({ pose: "stehen", bild: 0 }, ziel, { weg: weg || "laufen" }));
    }

    function wert(spur, t) {
      let i = 0;
      while (i < spur.length - 1 && spur[i + 1].t <= t) i++;
      const a = spur[i], b = spur[i + 1];
      if (!b) return Object.assign({}, a, { bewegt: false });
      const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      const w = 0.5 - Math.cos(Math.PI * u) / 2;        // weich anfahren und abbremsen
      const bewegt = Math.abs(b.x - a.x) > 0.5 || Math.abs((b.y || 0) - (a.y || 0)) > 0.5;
      return {
        x: a.x + (b.x - a.x) * (b.linear ? u : w),
        y: a.y + (b.y - a.y) * (b.linear ? u : w) - (b.bogen ? b.bogen * 4 * u * (1 - u) : 0),
        richtung: bewegt && b.weg ? b.richtung : a.richtung,
        // unterwegs: Laufen (bzw. die Pose der Station – Grätsche, Hechtsprung)
        pose: bewegt ? (b.weg || b.pose) : a.pose,
        bild: bewegt && !b.weg ? b.bild : a.bild,
        bewegt: bewegt,
      };
    }

    // ------------------------------------------------------------------
    // Abläufe der Spielzüge
    // ------------------------------------------------------------------

    /**
     * Den Ausgang eines Spielzugs abspielen.
     * @param {object} e – Ergebnis aus FootballRegeln.spieleZug
     * @param {number} dauer – Millisekunden
     * @returns {Promise}
     */
    function spieleZug(e, dauer) {
      const L0 = aufstellung(e.vorher);
      const L1 = aufstellung(e.nachher);
      const spuren = neueSpuren(L0);
      const dir = L0.dir;
      const tr = L0.traeger, mit = L0.mitspieler, ver = L0.verteidiger;
      const fussX = function (pos, r) { return pos.x + r * 7; };
      const b0 = { x: L0.ball.x, y: L0.ball.y };
      const ballSpur = [{ t: 0, x: b0.x, y: b0.y }];
      const ballZu = function (t, x, y, extra) { ballSpur.push(Object.assign({ t: t, x: x, y: y }, extra || {})); };
      const halteBall = function (t) { const l = ballSpur[ballSpur.length - 1]; ballZu(t, l.x, l.y); };
      let ziel = null;           // Station, in der alle am Ende in L1 stehen
      const p0 = L0.figuren;

      if (e.ausgang === "pass" || e.ausgang === "abgefangen") {
        // Ausholen, Pass – der Ball fliegt zum Mitspieler (bzw. zum Verteidiger)
        station(spuren, tr, 0.05, { pose: "passen", bild: 0 });
        station(spuren, tr, 0.2, { pose: "passen", bild: 1 });
        station(spuren, tr, 0.38, { pose: "stehen", bild: 0 });
        if (e.ausgang === "pass") {
          const empf = L1.traeger;            // der neue Ballführer
          const zielPos = L1.figuren[empf];
          lauf(spuren, mit, 0.0, 0.5, { x: zielPos.x, y: zielPos.y });
          halteBall(0.2);
          ballZu(0.55, fussX(zielPos, zielPos.richtung), zielPos.y - 2, { bogen: 9 });
          // Hat der Verteidiger auf den Pass getippt? Er springt – zu spät
          if (e.verteidigung === "passBlockieren") {
            const mitte = (p0[tr].x + zielPos.x) / 2;
            lauf(spuren, ver, 0.15, 0.4, { x: mitte, y: p0[ver].y }, "laufen");
            station(spuren, ver, 0.42, { pose: "zweikampf", bild: 0 });
            station(spuren, ver, 0.62, { pose: "stehen", bild: 0 });
          }
          ziel = 0.6;
        } else {
          // Abgefangen: der Verteidiger läuft in die Passbahn und nimmt den Ball
          const mitte = (p0[tr].x + p0[mit].x) / 2;
          lauf(spuren, ver, 0.1, 0.36, { x: mitte, y: p0[ver].y });
          station(spuren, ver, 0.38, { pose: "zweikampf", bild: 0 });
          station(spuren, ver, 0.58, { pose: "stehen", bild: 0 });
          halteBall(0.2);
          ballZu(0.42, mitte + dir * -2, p0[ver].y - 2, { bogen: 6 });
          halteBall(0.62);
          ziel = 0.62;
        }
      } else if (e.ausgang === "dribbling" || e.ausgang === "zweikampf") {
        const zielTr = L1.figuren[L1.traeger];
        if (e.ausgang === "dribbling") {
          // Der Ballführer läuft mit dem Ball eine Zone vor, der Verteidiger grätscht ins Leere
          lauf(spuren, tr, 0.05, 0.65, { x: zielTr.x, y: zielTr.y });
          ballSpur.length = 0;
          ballSpur.push({ t: 0, x: b0.x, y: b0.y });
          ballZu(0.65, fussX(zielTr, dir), zielTr.y - 2, { linear: true });
          const versuch = e.verteidigung === "zweikampf" ? "zweikampf" : "stehen";
          station(spuren, ver, 0.2, { pose: versuch, bild: 0, x: p0[ver].x - dir * 6 });
          station(spuren, ver, 0.5, { pose: "stehen", bild: 0 });
          ziel = 0.66;
        } else {
          // Zweikampf verloren: kurzer Antritt, Grätsche, der Ball springt zum Verteidiger
          lauf(spuren, tr, 0.02, 0.28, { x: p0[tr].x + dir * 8, y: p0[tr].y });
          ballZu(0.28, b0.x + dir * 8, b0.y, { linear: true });
          station(spuren, ver, 0.22, { pose: "zweikampf", bild: 0, x: p0[ver].x - dir * 10 });
          station(spuren, ver, 0.55, { pose: "stehen", bild: 0 });
          ballZu(0.45, p0[ver].x - dir * 16, p0[ver].y - 2, { bogen: 5 });
          station(spuren, tr, 0.4, { pose: "stehen", bild: 0 });
          halteBall(0.6);
          ziel = 0.6;
        }
      } else {
        // Schuss: Ausholen, Tritt, der Ball fliegt aufs Tor
        const torX = dir > 0 ? TOR_RECHTS : TOR_LINKS;
        const kSchl = (1 - e.angriffTeam) + "-k";
        const kPos = p0[kSchl];
        station(spuren, tr, 0.04, { pose: "schiessen", bild: 0 });
        station(spuren, tr, 0.22, { pose: "schiessen", bild: 1 });
        station(spuren, tr, 0.45, { pose: "stehen", bild: 0 });
        halteBall(0.22);
        if (e.ausgang === "geblockt") {
          // Der Verteidiger wirft sich in den Schuss
          const blockX = p0[ver].x - dir * 4;
          station(spuren, ver, 0.18, { pose: "zweikampf", bild: 0, x: blockX });
          station(spuren, ver, 0.6, { pose: "stehen", bild: 0 });
          ballZu(0.34, blockX - dir * 4, p0[ver].y - 10, { linear: true });
          ballZu(0.55, blockX - dir * 22, p0[ver].y - 2, { bogen: 10 });
          ziel = 0.62;
        } else {
          const torY = S.boden - 12;
          if (e.ausgang === "gehalten") {
            // Der Torwart hechtet und fängt den Ball
            const fangX = torX - dir * 12;
            station(spuren, kSchl, 0.32, { pose: "hechten", bild: 0, x: fangX, y: kPos.y + 2 });
            ballZu(0.44, fangX - dir * 2 + (dir > 0 ? 6 : -6), torY, { bogen: 6 });
            station(spuren, kSchl, 0.66, { pose: "stehen", bild: 0, x: kPos.x, y: kPos.y });
            ballZu(0.66, kPos.x + (dir > 0 ? -6 : 6), kPos.y - 10);
            ziel = 0.72;
          } else {
            // Tor! Der Torwart fliegt vergeblich, der Ball zappelt im Netz
            station(spuren, kSchl, 0.36, { pose: "hechten", bild: 0, x: torX - dir * 6, y: kPos.y + 6 });
            ballZu(0.46, torX + dir * 8, torY + 2, { bogen: 8 });
            ballZu(0.6, torX + dir * 10, S.boden - 2, {});
            station(spuren, kSchl, 0.75, { pose: "stehen", bild: 0, x: kPos.x, y: kPos.y });
            // Jubel des Schützen
            station(spuren, tr, 0.55, { pose: "jubel", bild: 0 });
            station(spuren, tr, 0.68, { pose: "jubel", bild: 1, y: p0[tr].y - 3 });
            station(spuren, tr, 0.8, { pose: "jubel", bild: 0, y: p0[tr].y });
            station(spuren, tr, 0.92, { pose: "jubel", bild: 1, y: p0[tr].y - 3 });
            station(spuren, tr, 1, { pose: "jubel", bild: 0, y: p0[tr].y });
            station(spuren, mit, 0.7, { pose: "jubel", bild: 1 });
            ziel = null;           // nach einem Tor: Anstoß kommt mit uebergang()
          }
        }
      }

      // Zum Schluss laufen alle auf ihre Plätze der neuen Lage
      if (ziel !== null) {
        Object.keys(L1.figuren).forEach(function (k) {
          const f = L1.figuren[k];
          lauf(spuren, k, ziel, 1, { x: f.x, y: f.y, richtung: f.richtung });
        });
        halteBall(ziel + 0.02);
        ballZu(1, L1.ball.x, L1.ball.y, {});
      } else {
        halteBall(1);
      }

      return spiele({ spuren: spuren, ballSpur: ballSpur, dauer: dauer, tor: e.tor ? (dir > 0 ? "rechts" : "links") : null,
        kameraDir: dir });
    }

    /** Nach einem Tor (bzw. vor dem Elfmeter): alle laufen in die neue Lage. */
    function uebergang(lage, dauer) {
      const L1 = aufstellung(lage);
      const spuren = {};
      Object.keys(aktuell).forEach(function (k) {
        const a = aktuell[k];
        spuren[k] = [{ t: 0, x: a.x, y: a.y, richtung: a.richtung, pose: "stehen", bild: 0 }];
        const f = L1.figuren[k];
        lauf(spuren, k, 0, 1, { x: f.x, y: f.y, richtung: f.richtung });
      });
      const ballSpur = [{ t: 0, x: ball.x, y: ball.y }, { t: 1, x: L1.ball.x, y: L1.ball.y, bogen: 6 }];
      return spiele({ spuren: spuren, ballSpur: ballSpur, dauer: dauer, kameraDir: L1.dir });
    }

    // ------------------------------------------------------------------
    // Elfmeter
    // ------------------------------------------------------------------

    // Seitenansicht: die Ecken liegen hintereinander – links = hinten (weiter
    // weg, höher im Bild), rechts = vorn (näher, tiefer im Bild)
    const TIEFE = { links: -10, mitte: -2, rechts: 7 };

    function elfmeterAufstellung(lage) {
      const team = lage.schuetzeTeam;
      const dir = team === 0 ? 1 : -1;
      const torX = dir > 0 ? TOR_RECHTS : TOR_LINKS;
      const punkt = torX - dir * 46;
      const p = {};
      // Schütze am Punkt, Torwart auf der Linie, der Rest wartet an der Mittellinie
      const schuetzeIndex = K.teams[team].spieler.indexOf(lage.schuetze);
      p[team + "-" + schuetzeIndex] = { x: punkt - dir * 10, y: S.boden + 2, richtung: dir };
      p[team + "-" + (1 - schuetzeIndex)] = { x: punkt - dir * 70, y: S.boden - 4, richtung: dir };
      p[(1 - team) + "-0"] = { x: punkt - dir * 82, y: S.boden - 5, richtung: dir };
      p[(1 - team) + "-1"] = { x: punkt - dir * 60, y: S.boden - 5, richtung: dir };
      p[(1 - team) + "-k"] = { x: torX - dir * 4, y: S.boden - 2, richtung: -dir };
      p[team + "-k"] = { x: dir > 0 ? TOR_LINKS + 8 : TOR_RECHTS - 8, y: S.boden - 2, richtung: dir };
      return { figuren: p, ball: { x: punkt, y: S.boden }, dir: dir, schuetze: team + "-" + schuetzeIndex,
        torwart: (1 - team) + "-k", torX: torX, punkt: punkt };
    }

    function setzeElfmeter(lage) {
      ablauf = null;
      const auf = elfmeterAufstellung(lage);
      aktuell = {};
      Object.keys(auf.figuren).forEach(function (k) {
        const f = auf.figuren[k];
        aktuell[k] = { x: f.x, y: f.y, richtung: f.richtung, pose: "stehen", bild: 0 };
      });
      ball = { x: auf.ball.x, y: auf.ball.y, bild: 0 };
      kameraZiel = kameraFuer(auf.torX - auf.dir * 50, 0);
      kameraX = kameraZiel;
      zeichne();
    }

    /** Einen Elfmeter abspielen (Ergebnis aus FootballRegeln.spieleElfmeter). */
    function spieleElfmeter(e, lage, dauer) {
      const auf = elfmeterAufstellung(lage);
      const spuren = neueSpuren(auf);
      const dir = auf.dir, s = auf.schuetze, k = auf.torwart;
      const kPos = auf.figuren[k];
      // Anlauf, Schuss
      lauf(spuren, s, 0.02, 0.28, { x: auf.punkt - dir * 6, y: auf.figuren[s].y });
      station(spuren, s, 0.3, { pose: "schiessen", bild: 0 });
      station(spuren, s, 0.38, { pose: "schiessen", bild: 1 });
      station(spuren, s, 0.6, { pose: "stehen", bild: 0 });
      // Der Torwart wirft sich in seine Ecke
      station(spuren, k, 0.4, { pose: "hechten", bild: 0, y: S.boden + TIEFE[e.torwartRichtung] + 2, x: kPos.x - dir * 2 });
      const ballSpur = [{ t: 0, x: auf.ball.x, y: auf.ball.y }, { t: 0.38, x: auf.ball.x, y: auf.ball.y }];
      const torY = S.boden - 8 + TIEFE[e.schussRichtung];
      if (e.tor) {
        ballSpur.push({ t: 0.56, x: auf.torX + dir * 7, y: torY, bogen: 6 });
        ballSpur.push({ t: 0.7, x: auf.torX + dir * 10, y: S.boden + TIEFE[e.schussRichtung] - 1 });
        station(spuren, s, 0.66, { pose: "jubel", bild: 0 });
        station(spuren, s, 0.8, { pose: "jubel", bild: 1 });
        station(spuren, s, 0.94, { pose: "jubel", bild: 0 });
      } else {
        ballSpur.push({ t: 0.54, x: kPos.x - dir * 6, y: torY + 2, bogen: 5 });
        ballSpur.push({ t: 0.8, x: kPos.x - dir * 16, y: S.boden, bogen: 8 });
        station(spuren, k, 0.75, { pose: "jubel", bild: 0, y: kPos.y, x: kPos.x });
        station(spuren, k, 0.9, { pose: "jubel", bild: 1 });
      }
      station(spuren, k, 1);
      ballSpur.push({ t: 1, x: ballSpur[ballSpur.length - 1].x, y: ballSpur[ballSpur.length - 1].y });
      return spiele({ spuren: spuren, ballSpur: ballSpur, dauer: dauer, tor: e.tor ? (dir > 0 ? "rechts" : "links") : null,
        kameraFest: kameraFuer(auf.torX - dir * 50, 0) });
    }

    // ------------------------------------------------------------------
    // Abspielen
    // ------------------------------------------------------------------

    function spiele(a) {
      return new Promise(function (fertig) {
        ablauf = Object.assign(a, { start: performance.now(), fertig: fertig, torGezeigt: false });
        if (a.dauer <= 0) abkuerzen();
        else starte();
      });
    }

    /** Den laufenden Ablauf sofort beenden (Endstand zeigen). */
    function abkuerzen() {
      if (!ablauf) return;
      ablauf.start = performance.now() - ablauf.dauer - 1;
      schritt(performance.now());
    }

    function anwenden(a, t) {
      Object.keys(a.spuren).forEach(function (k) {
        const w = wert(a.spuren[k], t);
        const laufBild = Math.floor(zeit / 90) % 4;
        aktuell[k] = { x: w.x, y: w.y, richtung: w.richtung, pose: w.pose,
          bild: w.pose === "laufen" ? laufBild : w.bild };
      });
      const b = wert(a.ballSpur, t);
      ball = { x: b.x, y: b.y, bild: b.bewegt ? Math.floor(zeit / 70) % 2 : ball.bild };
      if (a.tor && !a.torGezeigt && t >= 0.5) { netzWackeln[a.tor] = 1; a.torGezeigt = true; }
      kameraZiel = a.kameraFest !== undefined ? a.kameraFest : kameraFuer(ball.x, a.kameraDir);
    }

    function schritt(jetzt) {
      zeit = jetzt;
      if (ablauf) {
        const t = Math.min(1, (jetzt - ablauf.start) / ablauf.dauer);
        anwenden(ablauf, t);
        if (t >= 1) {
          const fertig = ablauf.fertig;
          if (ablauf.dauer <= 1 || jetzt - ablauf.start > ablauf.dauer) kameraX = kameraZiel;
          ablauf = null;
          fertig();
        }
      }
      kameraX += (kameraZiel - kameraX) * S.kameraTempo;
      if (Math.abs(kameraZiel - kameraX) < 0.3) kameraX = kameraZiel;
      netzWackeln.links = Math.max(0, netzWackeln.links - 0.02);
      netzWackeln.rechts = Math.max(0, netzWackeln.rechts - 0.02);
      zeichne();
    }

    function schleife(jetzt) {
      if (!laeuft) return;
      // Spiel nicht mehr sichtbar (andere Seite): Schleife anhalten,
      // ein laufender Ablauf springt ans Ende
      if (canvas.offsetParent === null) {
        laeuft = false;
        if (ablauf) { ablauf.start = -Infinity; schritt(jetzt); }
        return;
      }
      schritt(jetzt);
      requestAnimationFrame(schleife);
    }

    /** Animationsschleife an (solange das Spiel sichtbar ist). */
    function starte() {
      if (laeuft) return;
      laeuft = true;
      requestAnimationFrame(schleife);
    }

    function stoppe() {
      laeuft = false;
      if (ablauf) abkuerzen();
    }

    // ------------------------------------------------------------------
    // Zeichnen
    // ------------------------------------------------------------------

    function zeichne() {
      const links = Math.round(kameraX - BREITE / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BREITE, HOEHE);
      ctx.save();
      ctx.translate(0, DY);
      zeichneHalle(links);
      zeichneRasen(links);
      zeichneTor(links, TOR_LINKS, -1, netzWackeln.links);
      zeichneTor(links, TOR_RECHTS, 1, netzWackeln.rechts);
      // Figuren und Ball nach Tiefe (y) – hinten zuerst
      const dinge = FIGUREN.filter(function (f) { return aktuell[f.schluessel]; }).map(function (f) {
        return { y: aktuell[f.schluessel].y, f: f };
      });
      dinge.push({ y: ball.y + 2, ball: true });
      dinge.sort(function (a, b) { return a.y - b.y; });
      dinge.forEach(function (d) {
        if (d.ball) {
          schatten(ball.x - links, Math.max(ball.y + 2, Math.min(S.boden + 4, ball.y + 2)), 3);
          FootballSprites.zeichneBall(ctx, ball.x - links, ball.y, ball.bild);
          return;
        }
        const a = aktuell[d.f.schluessel];
        if (a.x - links < -20 || a.x - links > BREITE + 20) return;
        const boden = a.pose === "hechten" ? a.y + 4 : a.y;
        schatten(a.x - links, boden, 5);
        FootballSprites.zeichneFigur(ctx, d.f.id, F[d.f.id], a.pose, a.bild, a.x - links, a.y, a.richtung);
      });
      // Tor rechts vorn: Pfosten über den Figuren
      zeichnePfosten(links, TOR_LINKS, -1);
      zeichnePfosten(links, TOR_RECHTS, 1);
      ctx.restore();
    }

    /**
     * Größe an die Bühne anpassen: ganzzahliger Maßstab (harte, gleich
     * große Pixel), Breite etwa S.breite, Höhe so viel, wie Platz ist.
     */
    function passeGroesseAn(cssBreite, cssHoehe) {
      if (!(cssBreite > 0 && cssHoehe > 0)) return;
      let massstab = Math.max(1, Math.round(cssBreite / S.breite));
      // mindestens ~96 Pixel Höhe (Feld und Figuren müssen hineinpassen)
      while (massstab > 1 && cssHoehe / massstab < 96) massstab--;
      BREITE = Math.max(120, Math.floor(cssBreite / massstab));
      HOEHE = Math.max(96, Math.floor(cssHoehe / massstab));
      DY = HOEHE - GRUND;
      canvas.width = BREITE;
      canvas.height = HOEHE;
      canvas.style.width = BREITE * massstab + "px";
      canvas.style.height = HOEHE * massstab + "px";
      kameraZiel = kameraFuer(kameraZiel, 0);
      kameraX = kameraFuer(kameraX, 0);
      zeichne();
    }

    function schatten(x, y, breite) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(Math.round(x - breite), Math.round(y), breite * 2, 1);
    }

    function zeichneHalle(links) {
      const H = A.hintergrund;
      const versatz = Math.round(links * 0.6);     // die Wand bewegt sich langsamer (Tiefe)
      const oben = -DY;                            // oberster sichtbarer Punkt
      // Hohe Wand mit Plattenreihen (je 23 Pixel), so weit hinauf wie sichtbar
      ctx.fillStyle = H.wand;
      ctx.fillRect(0, oben, BREITE, 58 - oben);
      for (let y0 = 35; y0 + 21 > oben + 10; y0 -= 23) {
        for (let x = -((versatz) % 24) - 24; x < BREITE + 24; x += 24) {
          ctx.fillStyle = H.wandHell;
          ctx.fillRect(x + 1, y0, 22, 21);
          ctx.fillStyle = H.fuge;
          ctx.fillRect(x, y0 - 2, 1, 25);
        }
        ctx.fillStyle = H.fuge;
        ctx.fillRect(0, y0 - 2, BREITE, 2);
      }
      // Decke mit Leuchtbändern ganz oben
      ctx.fillStyle = H.decke;
      ctx.fillRect(0, oben, BREITE, 10);
      A.deko.forEach(function (d) {
        const x = Math.round(d.x - versatz);
        if (x < -40 || x > BREITE + 40) return;
        zeichneDeko(d, x);
      });
      // Bande mit Leuchtstreifen
      ctx.fillStyle = H.bande;
      ctx.fillRect(0, 58, BREITE, 8);
      ctx.fillStyle = H.bandeLicht;
      const lauf = Math.floor(zeit / 120);
      for (let x = -(links % 12) - 12; x < BREITE; x += 12) {
        ctx.globalAlpha = ((Math.floor((x + links) / 12) + lauf) % 6 === 0) ? 1 : 0.45;
        ctx.fillRect(x, 60, 8, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 63, BREITE, 3);
    }

    function zeichneDeko(d, x) {
      const H = A.hintergrund;
      const oben = -DY;
      if (d.art === "lampe") {
        ctx.fillStyle = H.licht;
        ctx.fillRect(x - 12, oben + 3, 24, 2);
        ctx.fillStyle = H.lichtSchein;
        ctx.fillRect(x - 16, oben + 5, 32, 6);
        ctx.fillRect(x - 20, oben + 10, 40, 10);
      } else if (d.art === "saeule") {
        ctx.fillStyle = H.fuge;
        ctx.fillRect(x - 5, oben + 10, 10, 48 - oben);
        ctx.fillStyle = H.wandHell;
        ctx.fillRect(x - 4, oben + 10, 2, 48 - oben);
        ctx.fillStyle = H.licht;
        ctx.fillRect(x - 1, oben + 14, 2, 40 - oben);
      } else if (d.art === "luke") {
        ctx.fillStyle = H.fuge;
        ctx.fillRect(x - 14, 22, 28, 36);
        ctx.fillStyle = H.bande;
        ctx.fillRect(x - 12, 24, 12, 34);
        ctx.fillRect(x + 1, 24, 11, 34);
        ctx.fillStyle = H.bildschirmWarn;
        for (let y = 24; y < 58; y += 6) ctx.fillRect(x - 13, y, 1, 3);
        ctx.fillStyle = H.licht;
        ctx.fillRect(x - 3, 20, 6, 1);
      } else if (d.art === "kamera") {
        ctx.fillStyle = H.fuge;
        ctx.fillRect(x - 3, oben + 11, 6, 4);
        ctx.fillRect(x, oben + 10, 1, 1);
        ctx.fillStyle = Math.floor(zeit / 600) % 2 ? "#ff4d5e" : "#7a2430";
        ctx.fillRect(x + 1, oben + 12, 1, 1);
      } else if (d.art === "bildschirm") {
        ctx.fillStyle = H.fuge;
        ctx.fillRect(x - 16, 17, 32, 21);
        ctx.fillStyle = H.bildschirm;
        ctx.fillRect(x - 15, 18, 30, 19);
        ctx.fillStyle = H.bildschirmText;
        const tick = Math.floor(zeit / 400);
        if (d.inhalt === "balken") {
          for (let i = 0; i < 6; i++) {
            const h = 3 + ((i * 7 + tick * 3) % 11);
            ctx.fillRect(x - 13 + i * 5, 35 - h, 3, h);
          }
        } else if (d.inhalt === "kurve") {
          for (let i = 0; i < 28; i++) {
            const y = 27 + Math.round(Math.sin((i + tick) * 0.6) * 5);
            ctx.fillRect(x - 14 + i, y, 1, 1);
          }
          ctx.fillStyle = H.bildschirmWarn;
          ctx.fillRect(x + 10, 20, 3, 2);
        } else {
          // Ziffern-Spalten wie auf einer Anzeigetafel
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 3; j++) {
              if ((i + j + tick) % 3 !== 0) ctx.fillRect(x - 12 + i * 7, 21 + j * 5, 5, 2);
            }
          }
          ctx.fillStyle = H.bildschirmWarn;
          ctx.fillRect(x - 12, 36, 24 * ((tick % 5) + 1) / 5, 1);
        }
      }
    }

    function zeichneRasen(links) {
      const R = A.rasen;
      ctx.fillStyle = R.dunkel;
      ctx.fillRect(0, RASEN_OBEN, BREITE, GRUND - RASEN_OBEN);
      // gemähte Streifen (je 22 Pixel der Welt)
      ctx.fillStyle = R.hell;
      for (let wx = Math.floor(links / 22) * 22; wx < links + BREITE; wx += 22) {
        if (Math.floor(wx / 22) % 2 === 0) ctx.fillRect(wx - links, RASEN_OBEN, 22, GRUND - RASEN_OBEN);
      }
      ctx.fillStyle = R.schatten;
      ctx.fillRect(0, RASEN_OBEN, BREITE, 2);
      // Linien: Seitenlinie hinten und vorn, Torlinien, Mittellinie, Strafräume
      ctx.fillStyle = A.linien;
      ctx.fillRect(TOR_LINKS - links, RASEN_OBEN + 4, TOR_RECHTS - TOR_LINKS, 1);
      ctx.fillRect(TOR_LINKS - links, GRUND - 4, TOR_RECHTS - TOR_LINKS, 1);
      const senkrecht = function (wx) { ctx.fillRect(Math.round(wx - links), RASEN_OBEN + 4, 1, GRUND - RASEN_OBEN - 7); };
      senkrecht(TOR_LINKS);
      senkrecht(TOR_RECHTS);
      senkrecht(WELT / 2);
      senkrecht(TOR_LINKS + S.zonenBreite);           // Strafraum vor deinem Tor
      senkrecht(TOR_RECHTS - S.zonenBreite);          // Strafraum vor dem gegnerischen Tor
      // Mittelkreis als flache Ellipse
      for (let i = 0; i < 40; i++) {
        const w = (i / 40) * Math.PI * 2;
        ctx.fillRect(Math.round(WELT / 2 - links + Math.cos(w) * 22), Math.round(RASEN_OBEN + 23 + Math.sin(w) * 9), 1, 1);
      }
      // Zonengrenzen ganz leicht angedeutet
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      for (let z = 1; z < ZONEN; z++) ctx.fillRect(Math.round(S.rand + z * S.zonenBreite - links), RASEN_OBEN + 6, 1, GRUND - RASEN_OBEN - 10);
    }

    /** Tor in Seitenansicht: Netz hinter der Linie (seite: −1 links, 1 rechts). */
    function zeichneTor(links, linieX, seite, wackeln) {
      const x = linieX - links;
      if (x < -30 || x > BREITE + 30) return;
      const tief = 14, hoch = 24, unten = S.boden + 2;
      const dx = Math.round(Math.sin(zeit / 40) * wackeln * 2);
      ctx.fillStyle = "rgba(230, 240, 255, 0.35)";
      for (let i = 0; i <= tief; i += 3) {
        ctx.fillRect(Math.round(x + seite * i + (i > 0 ? dx * seite : 0)), unten - hoch, 1, hoch);
      }
      for (let j = 0; j <= hoch; j += 3) {
        ctx.fillRect(Math.min(x, x + seite * tief) + (seite > 0 ? 0 : 0), unten - hoch + j, tief, 1);
      }
      ctx.fillStyle = "#d9e3ee";
      ctx.fillRect(Math.min(x, x + seite * tief), unten - hoch - 1, tief + 1, 1);   // Latte nach hinten
    }

    function zeichnePfosten(links, linieX, seite) {
      const x = linieX - links;
      if (x < -30 || x > BREITE + 30) return;
      const hoch = 24, unten = S.boden + 2;
      ctx.fillStyle = "#f4f8ff";
      ctx.fillRect(Math.round(x), unten - hoch - 1, 2, hoch + 1);
      ctx.fillStyle = "#9fb2c8";
      ctx.fillRect(Math.round(x) + (seite > 0 ? 1 : 0), unten - hoch, 1, hoch);
    }

    return {
      setzeLage: setzeLage,
      passeGroesseAn: passeGroesseAn,
      setzeElfmeter: setzeElfmeter,
      spieleZug: spieleZug,
      spieleElfmeter: spieleElfmeter,
      uebergang: uebergang,
      abkuerzen: abkuerzen,
      laeuftAblauf: function () { return Boolean(ablauf); },
      starte: starte,
      stoppe: stoppe,
      zeichne: zeichne,
      // Für Tests
      aufstellung: aufstellung,
      figurAuf: function (k) { return aktuell[k] ? Object.assign({}, aktuell[k]) : null; },
      ballAuf: function () { return Object.assign({}, ball); },
      kamera: function () { return kameraX; },
    };
  }

  return { erstelle: erstelle };
})();
