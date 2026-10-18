/* ==========================================================================
   seitenwechsel.js – Übergänge zwischen den Ansichten

   1. Karte → Abschnitt (Startseite → z. B. "Zu erledigen"):
      Die Kamera fliegt in die angeklickte Karte hinein und durch sie
      hindurch. Drei Phasen, eine durchgehende Bewegung:
        a) Kamerafahrt – der GANZE 3D-Raum des Tunnels wird verschoben und
           gedreht, sodass die Kamera auf die Karte zufliegt. Die Karte
           bleibt an ihrem Platz in der Reihe; der Raum dreht sich nur so
           weit, dass sie zunehmend frontal vor einem liegt. Die übrigen
           Karten ziehen seitlich am Bildrand vorbei hinaus. Die Karte
           wächst, bis sie den Bildschirm füllt und über ihn hinausgeht.
           Die Fahrt beschleunigt bis zum Durchgang.
        b) Durchgang – im Moment, in dem die Karte den Bildschirm füllt,
           wird sie durchsichtig, der Titel verblasst, ein kurzer heller
           Schimmer in der Farbe ihres Glows markiert den Übergang.
        c) Die Seite erscheint dahinter – sie blendet ruhig ein und kommt
           dabei leicht aus der Tiefe nach vorn (etwas kleiner → normal).
   2. Abschnitt → Startseite (Logo, Zurück-Button, Navigation): rückwärts.
      Die Seite weicht in die Tiefe zurück und blendet aus, man tritt
      rückwärts durch die Karte hinaus, die Kamera fährt aus dem Tunnel
      zurück, die übrigen Karten gleiten wieder an ihren Platz.
   3. Abschnitt → Abschnitt: kurze, ruhige Überblendung.
   4. "Bewegung reduzieren": immer nur eine kurze Überblendung.

   Technik: Die Kamerafahrt läuft in einer festen Ebene über der Seite, in
   einem stillstehenden Abbild der Startseite (gleiche Lage, gleiche
   Perspektive). Ziel-Verschiebung und -Drehung werden aus der Lage der
   Karte im Raum berechnet. Die Zielseite wird darunter schon vollständig
   aufgebaut, bevor der Durchgang stattfindet – nichts lädt nach oder
   blitzt auf. Animiert werden nur transform und opacity (Web Animations
   API, läuft auf der Grafikkarte). Neuladen und direkte Links: ohne
   Animation (app.js).

   Dauer der Phasen und Kurven: CSS-Variablen --uebergang-… in css/style.css.
   ========================================================================== */

const Seitenwechsel = (function () {

  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  // So viele Stützpunkte hat die berechnete Kamerafahrt (dazwischen
  // interpoliert der Browser – bei so vielen Punkten unsichtbar)
  const STUETZPUNKTE = 36;
  // Die Seite weicht auf dem Rückweg in diesem Anteil der Erscheinen-Dauer
  // zurück (rückwärts soll es nicht länger dauern als hin)
  const ZURUECK_ANTEIL = 0.65;
  // Die angeklickte Karte wird für die Fahrt in so viel höherer Auflösung
  // gezeichnet, wie sie wächst – höchstens aber so viel (Speicher)
  const SCHAERFE_MAX = 8;
  // Ab so viel Vergrößerung verblasst der Titel (bis zur zweiten Zahl ganz),
  // spätestens aber im Durchgang – noch größer würde die Schrift grob.
  // Am Computer füllt die Karte den Schirm schon bei etwa 3,7-fach; am
  // Smartphone (flache Karten) erst bei etwa 12-fach.
  const TITEL_ZOOM = [4, 6];

  let laeuft = false;          // gerade ein Übergang aktiv?
  let aktiv = null;            // { ende() } des laufenden Übergangs
  let sperre = null;           // durchsichtige Fläche, die Klicks abfängt
  let geklickt = null;         // Zustand der Karte im Moment des Klicks


  /* ==========================================================================
     KONFIGURATION (aus den CSS-Variablen)
     ========================================================================== */

  function konfig() {
    const s = getComputedStyle(document.documentElement);
    const zahl = function (name, ersatz) {
      const z = parseFloat(s.getPropertyValue(name));
      return isNaN(z) ? ersatz : z;
    };
    const text = function (name, ersatz) { return s.getPropertyValue(name).trim() || ersatz; };
    return {
      fahrt: zahl("--uebergang-fahrt-dauer", 440),           // 1. Kamerafahrt
      fahrtKurve: kurve(text("--uebergang-fahrt-kurve", "ease-in")),
      durchgang: zahl("--uebergang-durchgang-dauer", 170),   // 2. Durchgang
      erscheinen: zahl("--uebergang-erscheinen-dauer", 460), // 3. Seite erscheint
      erscheinenKurve: text("--uebergang-erscheinen-kurve", "ease-out"),
      skala: zahl("--uebergang-erscheinen-skala", 0.93),
      ueberfuellenMax: Math.max(1, zahl("--uebergang-ueberfuellen-max", 2)),
      schimmer: zahl("--uebergang-schimmer", 0.8),
      wechselDauer: zahl("--uebergang-wechsel-dauer", 220),  // Abschnitt ↔ Abschnitt
      ruhigDauer: zahl("--uebergang-ruhig-dauer", 160),      // "Bewegung reduzieren"
    };
  }


  /* ==========================================================================
     ÖFFENTLICH
     ========================================================================== */

  /**
   * Klick auf eine Karte der Startseite. Sperrt sofort (Doppelklicks lösen
   * keinen zweiten Übergang aus) und setzt den Hash wie bisher; den
   * eigentlichen Übergang startet dann wechsle() beim hashchange.
   * Merkt sich, wie die Karte gerade aussieht (angehoben durch Hover oder
   * Tastaturfokus?) – so bleibt sie während der Fahrt genau so.
   * @returns {boolean} true, wenn der Klick übernommen wurde
   */
  function karteGeklickt(href, karte) {
    if (laeuft) return true;            // gesperrt: Klick verschlucken
    geklickt = karte ? {
      el: karte,
      gewaehlt: karte.matches(":hover") || karte.matches(":focus-visible"),
      transform: getComputedStyle(karte).transform,
    } : null;
    sperren();
    window.location.hash = href;
    return true;
  }

  /**
   * Wird von app.js bei jedem hashchange aufgerufen.
   * @param {string} von  – bisher sichtbare Ansicht (z. B. "home")
   * @param {{name, unterseite}} ziel
   * @param {function} zeige – blendet die Zielansicht ein (zeigeAnsicht)
   */
  function wechsle(von, ziel, zeige) {
    // Läuft noch ein Übergang (z. B. Zurück-Button mitten in der Bewegung)?
    // Dann den alten sofort an sein Ende setzen und den neuen starten.
    if (aktiv) aktiv.ende();

    // Gleiche Ansicht (z. B. #games → #games/sudoku): ohne Übergang
    if (von === ziel.name) {
      zeige();
      entsperren();
      return;
    }

    const c = konfig();
    if (ruhigAbfrage.matches) {
      ueberblenden(zeige, c.ruhigDauer);
      return;
    }

    if (von === "home" && karteZu(ziel.name)) {
      karteZurSeite(karteZu(ziel.name), ziel, zeige, c);
    } else if (ziel.name === "home" && karteZu(von)) {
      seiteZurKarte(von, zeige, c);
    } else {
      ueberblenden(zeige, c.wechselDauer);
    }
  }

  function istAktiv() {
    return laeuft;
  }


  /* ==========================================================================
     SPERRE: während des Übergangs keine weiteren Klicks / Tasten
     ========================================================================== */

  function sperren() {
    laeuft = true;
    if (!sperre) {
      sperre = document.createElement("div");
      sperre.className = "seitenwechsel-sperre";
      document.body.appendChild(sperre);
    }
    document.documentElement.classList.add("im-seitenwechsel");
  }

  function entsperren() {
    laeuft = false;
    aktiv = null;
    if (sperre) sperre.remove();
    sperre = null;
    document.documentElement.classList.remove("im-seitenwechsel");
  }

  // Enter/Leertaste auf Links und Knöpfen während des Übergangs abfangen
  document.addEventListener("keydown", function (event) {
    if (laeuft && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);


  /* ==========================================================================
     1. KARTE → ABSCHNITT: in die Karte hinein und durch sie hindurch
     ========================================================================== */

  function karteZurSeite(karte, ziel, zeige, c) {
    sperren();
    const info = geklickt && geklickt.el === karte ? geklickt :
      { gewaehlt: false, transform: getComputedStyle(karte).transform };
    geklickt = null;

    // Ebene: Seitengrund (deckt ab) – Abbild der Startseite – Schimmer
    const home = document.querySelector("#view-home .home");
    const ebene = baueEbene();
    const grund = schicht(ebene, "seitenwechsel-grund");
    const szene = abbildDerStartseite(home, karte, info, ebene, null);
    const schimmer = schicht(ebene, "seitenwechsel-schimmer");
    const fahrt = berechneFahrt(szene, c, true);

    // Zielseite schon jetzt vollständig aufbauen – unter dem Seitengrund
    zeige();
    window.scrollTo(0, 0);
    const section = document.getElementById("view-" + ziel.name);
    const ursprung = setzeUrsprung(section);
    // Abschnitte dürfen nach dem Anzeigen noch scrollen (Kalender am
    // Smartphone springt zum aktuellen Monat): Mitte dann nachführen
    requestAnimationFrame(function () { requestAnimationFrame(function () { ursprung.nachfuehren(); }); });

    const f = fahrt.f;
    const zeit = { duration: fahrt.dauer, easing: "linear", fill: "both" };
    const animationen = szenenAnimationen(szene, fahrt, zeit, true);
    // Seitengrund deckt, bis die Karte den Bildschirm füllt – ab dann liegt
    // die neue Seite direkt hinter der Karte (unsichtbarer Wechsel)
    animationen.push(grund.animate([
      { opacity: 1, offset: 0 }, { opacity: 1, offset: f },
      { opacity: 0, offset: Math.min(1, f + 0.001) }, { opacity: 0, offset: 1 },
    ], zeit));
    const schein = schimmern(schimmer, c, c.fahrt, false);

    // Die Seite erscheint mit dem Durchgang: ruhig, leicht aus der Tiefe
    const erscheinen = section.animate([
      { opacity: 0, transform: "scale(" + c.skala + ")" },
      { opacity: 1, transform: "none" },
    ], { duration: c.erscheinen, delay: c.fahrt, easing: c.erscheinenKurve, fill: "backwards" });

    let erledigt = false;
    function fertig() {
      if (erledigt) return;
      erledigt = true;
      ebene.remove();
      ursprung.zuruecksetzen();
      entsperren();
    }
    aktiv = {
      ende: function () {
        animationen.concat([schein, erscheinen]).forEach(function (a) { a.cancel(); });
        fertig();
      },
    };
    // Karte durchschritten → Ebene weg; Seite ganz da → fertig
    alleFertig(animationen.concat([schein])).then(function () { if (!erledigt) ebene.remove(); }, function () {});
    erscheinen.finished.then(fertig, function () {});
  }


  /* ==========================================================================
     2. ABSCHNITT → STARTSEITE (rückwärts durch die Karte hinaus)
     ========================================================================== */

  function seiteZurKarte(von, zeige, c) {
    sperren();
    geklickt = null;
    const section = document.getElementById("view-" + von);
    const karte = karteZu(von);

    // Ebene: Kartenfläche (blendet ein, wenn die Seite fort ist) – Schimmer
    const ebene = baueEbene();
    const flaeche = schicht(ebene, "seitenwechsel-flaeche");
    flaeche.style.background = getComputedStyle(karte).backgroundColor || "var(--farbe-flaeche)";
    const schimmer = schicht(ebene, "seitenwechsel-schimmer");

    // a) Die Seite weicht in die Tiefe zurück und blendet aus; zum Ende
    //    hin schiebt sich die Kartenfläche davor (rückwärts in die Karte)
    const zurueck = c.erscheinen * ZURUECK_ANTEIL;
    const ursprung = setzeUrsprung(section);
    const weg = section.animate([
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(" + c.skala + ")" },
    ], { duration: zurueck, easing: c.fahrtKurve.css, fill: "forwards" });
    const durch = Math.min(c.durchgang, zurueck);
    const flaecheEin = flaeche.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: durch, delay: zurueck - durch, easing: "linear", fill: "both" });
    const schein = schimmern(schimmer, c, zurueck, true);

    let abgebrochen = false;
    let animationen = [];
    aktiv = {
      ende: function () {
        abgebrochen = true;
        [weg, flaecheEin, schein].concat(animationen).forEach(function (a) { a.cancel(); });
        ursprung.zuruecksetzen();
        if (document.getElementById("view-home").hidden) zeige();   // noch nicht getauscht
        ebene.remove();
        entsperren();
      },
    };

    // b) Die Kartenfläche deckt alles: jetzt unsichtbar zur Startseite
    //    wechseln und das Abbild genau im Inneren der Karte einsetzen
    weg.finished.then(function () {
      if (abgebrochen) return;
      StartseiteAnsicht.ohneAufbau();     // kein Aufbau von hinten – die Karten kommen mit der Fahrt
      zeige();
      weg.cancel();
      ursprung.zuruecksetzen();
      window.scrollTo(0, 0);
      // Liegt die Karte unter dem unteren Rand (kleine Smartphones)? Dann so
      // weit scrollen, dass man auf ihr ankommt
      const r = karte.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 16) window.scrollTo(0, r.bottom - window.innerHeight + 24);

      const home = document.querySelector("#view-home .home");
      schicht(ebene, "seitenwechsel-grund", flaeche);   // deckt die echte Startseite bis zum Schluss ab
      const szene = abbildDerStartseite(home, karte,
        { gewaehlt: false, transform: getComputedStyle(karte).transform }, ebene, flaeche);
      // (ab dem Moment, in dem die Karte den Bildschirm gerade füllt – das
      // Stück "über den Bildschirm hinaus" läge ganz unter der Kartenfläche)
      const fahrt = berechneFahrt(szene, c, false);

      // c) Dieselbe Fahrt rückwärts: aus der Karte zurück, aus dem Tunnel
      //    heraus, die übrigen Karten gleiten an ihren Platz
      const zeit = { duration: fahrt.dauer, easing: "linear", fill: "both", direction: "reverse" };
      animationen = szenenAnimationen(szene, fahrt, zeit, false);
      flaeche.remove();                   // die Karte deckt jetzt selbst alles ab

      alleFertig(animationen).then(function () {
        if (abgebrochen) return;
        ebene.remove();
        entsperren();
      }, function () {});
    }, function () {});
  }


  /* ==========================================================================
     3. ÜBERBLENDUNG (Abschnitt ↔ Abschnitt, "Bewegung reduzieren")
     ========================================================================== */

  function ueberblenden(zeige, dauer) {
    sperren();
    geklickt = null;
    const haupt = document.getElementById("main");
    const aus = haupt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dauer / 2, easing: "ease-in", fill: "forwards" });
    let ein = null;
    let erledigt = false;
    function fertig() {
      if (erledigt) return;
      erledigt = true;
      aus.cancel();
      if (ein) ein.cancel();
      entsperren();
    }
    aktiv = { ende: function () { if (!ein) zeige(); fertig(); } };
    aus.finished.then(function () {
      if (erledigt) return;
      zeige();
      window.scrollTo(0, 0);
      ein = haupt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dauer / 2, easing: "ease-out" });
      aus.cancel();
      ein.finished.then(fertig, function () {});
    }, function () {});
  }


  /* ==========================================================================
     DIE KAMERAFAHRT
     ========================================================================== */

  /**
   * Berechnet die Fahrt der Kamera in die Karte hinein – als Bewegung des
   * ganzen 3D-Raums (.tunnel-welt) im Koordinatensystem des Tunnels
   * (x nach rechts, y nach unten, z zum Betrachter; die Kamera steht im
   * Abstand "perspective" vor dem Fluchtpunkt).
   *
   *   Fahrt(s) = verschiebe(Weg(s)) · drehe(Achse, Winkel · s) · verschiebe(−Kartenmitte)
   *
   * s = 0: alles an seinem Platz. s = 1: die Karte liegt frontal, mittig im
   * Bild und füllt es gerade ganz aus. s > 1 (Durchgang): die Kamera fliegt
   * mit derselben Geschwindigkeit weiter, die Karte wächst über den
   * Bildschirm hinaus. Die Drehung ist genau die Gegendrehung der Karte –
   * nur so weit, dass sie frontal vor einem liegt.
   *
   * mitDurchgang = false: nur bis s = 1 (Rückweg beginnt dort).
   * @returns {{keyframes, f, dauer, titelVon, titelBis}} f = Anteil der
   *          Zeit, an dem die Karte den Bildschirm füllt (Beginn des
   *          Durchgangs); titelVon/-Bis = da verblasst der Titel
   */
  function berechneFahrt(szene, c, mitDurchgang) {
    const tunnel = szene.tunnel;
    const welt = szene.welt;
    const karte = szene.karte;
    const ts = getComputedStyle(tunnel);
    const P = parseFloat(ts.perspective);
    const fo = ts.perspectiveOrigin.split(" ").map(parseFloat);
    const ox = fo[0], oy = fo[1];
    const tr = tunnel.getBoundingClientRect();

    // Die Welt liegt im Tunnel (Smartphone: mit Innenabstand). Drehpunkt
    // ihrer Bewegung = Ursprung des Tunnels → die Fahrt wirkt in Tunnel-Koordinaten.
    welt.style.transformOrigin = (-welt.offsetLeft) + "px " + (-welt.offsetTop) + "px 0";

    // Lage der Karte im Raum
    const M = matrixBis(karte, tunnel);
    const w = karte.offsetWidth;
    const h = karte.offsetHeight;
    const nullpunkt = punkt(M, 0, 0);
    const mitte = punkt(M, w / 2, h / 2);
    const ax = einheit(minus(punkt(M, 1, 0), nullpunkt));
    const ay = einheit(minus(punkt(M, 0, 1), nullpunkt));
    const az = kreuz(ax, ay);

    // Gegendrehung: dreht die Kartenachsen auf die Bildachsen (Zeilen = Kartenachsen)
    const drehung = achseUndWinkel([ax, ay, az]);

    // Ziel: Karte frontal in der Mitte des Inhaltsbereichs (unter der
    // Navigation), so groß, dass sie ihn samt Rundung ganz bedeckt
    const breite = document.documentElement.clientWidth;
    const oben = navUnterkante();
    const hoehe = window.innerHeight - oben;
    const zielX = breite / 2 - tr.left;
    const zielY = oben + hoehe / 2 - tr.top;
    const kFuellt = fuellFaktor(karte);
    const zFuellt = P - P / kFuellt;
    const Q = { x: ox + (zielX - ox) / kFuellt, y: oy + (zielY - oy) / kFuellt, z: zFuellt };

    // Ort der Kartenmitte für s: bis s = 1 geradlinig zum Ziel, danach auf
    // der Sichtlinie weiter nach vorn (bleibt mittig im Bild)
    function ort(s) {
      const z = mitte.z + (Q.z - mitte.z) * s;
      if (s <= 1) return { x: mitte.x + (Q.x - mitte.x) * s, y: mitte.y + (Q.y - mitte.y) * s, z: z };
      const k = P / (P - z);
      return { x: ox + (zielX - ox) / k, y: oy + (zielY - oy) / k, z: z };
    }
    function matrix(s) {
      const o = ort(s);
      return new DOMMatrix()
        .translate(o.x, o.y, o.z)
        .multiply(drehMatrix(drehung.achse, drehung.winkel * Math.min(1, s)))
        .translate(-mitte.x, -mitte.y, -mitte.z);
    }

    // Zeit: Fahrt (beschleunigend, Kurve) → Durchgang (gleich schnell weiter)
    const T1 = Math.max(1, c.fahrt);
    const T2 = mitDurchgang ? Math.max(0, c.durchgang) : 0;
    const dauer = T1 + T2;
    const f = T1 / dauer;
    const steigung = c.fahrtKurve.steigungEnde;          // ds/dx am Ende der Fahrt
    // Höchstens so weit über den Bildschirm hinaus (und nie bis an die Kamera)
    const zMax = P - P / (kFuellt * c.ueberfuellenMax);
    const sMax = Math.abs(Q.z - mitte.z) > 1e-6 ? (zMax - mitte.z) / (Q.z - mitte.z) : 1;
    function s(u) {
      if (u <= f) return c.fahrtKurve.bei(u / f);
      return Math.min(sMax, 1 + steigung * (u - f) / f);
    }

    const zeiten = [];
    for (let i = 0; i <= STUETZPUNKTE; i++) zeiten.push(i / STUETZPUNKTE);
    zeiten.push(f);
    zeiten.sort(function (a, b) { return a - b; });
    const keyframes = zeiten.filter(function (u, i) { return i === 0 || u - zeiten[i - 1] > 1e-6; })
      .map(function (u) { return { offset: u, transform: matrix(s(u)).toString() }; });

    // Wann der Titel verblasst: kurz vor dem Füllen bis kurz nach Beginn
    // des Durchgangs – früher, wenn die Karte schon vorher sehr groß wird
    function ab(zoom) {
      for (let i = 0; i <= 200; i++) {
        const u = i / 200;
        if (P / (P - ort(s(u)).z) >= zoom) return u;
      }
      return 1;
    }
    const titelVon = Math.min(f * 0.95, ab(TITEL_ZOOM[0]));
    const titelBis = Math.max(titelVon + 0.04, Math.min(f + (1 - f) * 0.3, ab(TITEL_ZOOM[1])));

    return { keyframes: keyframes, f: f, dauer: dauer, titelVon: titelVon, titelBis: Math.min(1, titelBis) };
  }

  /**
   * Animationen im Abbild: Fahrt des Raums, Durchgang durch die Karte,
   * übrige Karten, Begrüßung und Schnellzugriffe. Für den Rückweg dieselben
   * Keyframes rückwärts – nur die Karte selbst bleibt deckend (die
   * Kartenfläche davor hat sie schon ersetzt).
   */
  function szenenAnimationen(szene, fahrt, zeit, hinweg) {
    const f = fahrt.f;
    const a = [];
    a.push(szene.welt.animate(fahrt.keyframes, zeit));
    // Durchgang: die Karte wird durchsichtig, der Titel verblasst etwas früher
    if (hinweg) {
      a.push(szene.karte.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: f }, { opacity: 0, offset: 1 }], zeit));
    }
    // (ist verblasst, bevor die Karte so nah ist, dass ihre Schrift grob
    // würde – siehe TITEL_ZOOM; auf dem Rückweg taucht er entsprechend auf)
    a.push(szene.titel.animate([
      { opacity: 1, offset: 0 }, { opacity: 1, offset: fahrt.titelVon },
      { opacity: 0, offset: fahrt.titelBis }, { opacity: 0, offset: 1 },
    ], zeit));
    // Die übrigen Karten ziehen seitlich hinaus und verblassen dabei –
    // spätestens bevor die Kamera sie erreicht
    szene.andere.forEach(function (k) {
      a.push(k.animate([
        { opacity: 1, offset: 0 }, { opacity: 1, offset: f * 0.45 },
        { opacity: 0, offset: f * 0.9 }, { opacity: 0, offset: 1 },
      ], zeit));
    });
    // Begrüßung und Schnellzugriffe treten zuerst zurück
    szene.umgebung.forEach(function (e) {
      a.push(e.animate([{ opacity: 1, offset: 0 }, { opacity: 0, offset: f * 0.4 }, { opacity: 0, offset: 1 }], zeit));
    });
    return a;
  }

  /**
   * Kurzer, heller Schimmer im Durchgang (Hinweg: beginnt, sobald die Karte
   * den Bildschirm füllt; Rückweg gespiegelt, endet beim Wechsel).
   */
  function schimmern(el, c, durchgangBeginn, rueckwaerts) {
    const lang = Math.max(1, c.durchgang * 1.4);
    const spitze = rueckwaerts ? 0.65 : 0.35;
    const start = rueckwaerts ? durchgangBeginn - lang : durchgangBeginn;
    return el.animate([
      { opacity: 0, easing: "ease-out" },
      { opacity: c.schimmer, offset: spitze, easing: "ease-in-out" },
      { opacity: 0 },
    ], { duration: lang, delay: Math.max(0, start), fill: "both" });
  }



  /* ==========================================================================
     MESSEN
     ========================================================================== */

  /**
   * Gesamte Abbildung eines Elements in das Koordinatensystem von "bis":
   * je Ebene Versatz + transform um transform-origin. Ergebnis wirkt auf
   * die linke obere Ecke des Elements.
   */
  function matrixBis(el, bis) {
    let m = new DOMMatrix();
    let e = el;
    while (e && e !== bis) {
      const eltern = e.offsetParent;
      const s = getComputedStyle(e);
      const t = s.transform === "none" ? new DOMMatrix() : new DOMMatrix(s.transform);
      const o = s.transformOrigin.split(" ").map(parseFloat);
      const ox = o[0] || 0, oy = o[1] || 0, oz = o[2] || 0;
      // Versatz zum Elternteil (+ dessen Rahmen)
      const dx = e.offsetLeft + (eltern ? eltern.clientLeft : 0);
      const dy = e.offsetTop + (eltern ? eltern.clientTop : 0);
      const lokal = new DOMMatrix()
        .translate(dx + ox, dy + oy, oz)
        .multiply(t)
        .translate(-ox, -oy, -oz);
      m = lokal.multiply(m);
      e = eltern;
    }
    return m;
  }

  /**
   * transform-origin des Abschnitts auf die Mitte des sichtbaren
   * Inhaltsbereichs: dort "kommt die Seite aus der Tiefe".
   */
  function setzeUrsprung(section) {
    const r = section.getBoundingClientRect();
    const scroll0 = window.scrollY;
    const x = document.documentElement.clientWidth / 2 - r.left;
    const y0 = (navUnterkante() + window.innerHeight) / 2 - r.top;
    function setze(y) { section.style.transformOrigin = x.toFixed(1) + "px " + y.toFixed(1) + "px"; }
    setze(y0);
    return {
      nachfuehren: function () { if (section.style.transformOrigin) setze(y0 + window.scrollY - scroll0); },
      zuruecksetzen: function () { section.style.transformOrigin = ""; },
    };
  }

  /**
   * So viel größer muss die Karte (frontal) werden, um den Inhaltsbereich
   * unter der Navigation samt ihrer Rundung ganz zu bedecken.
   */
  function fuellFaktor(karte) {
    const w = karte.offsetWidth;
    const h = karte.offsetHeight;
    const rund = parseFloat(getComputedStyle(karte).borderTopLeftRadius) || 0;
    const breite = document.documentElement.clientWidth;
    const hoehe = window.innerHeight - navUnterkante();
    return Math.max(breite / Math.max(1, w - rund), hoehe / Math.max(1, h - rund));
  }

  function navUnterkante() {
    const leiste = document.querySelector(".leiste");
    return leiste ? Math.max(0, leiste.getBoundingClientRect().bottom) : 0;
  }

  /** Die Karte der Startseite, die zu einer Ansicht führt (oder null). */
  function karteZu(name) {
    return [...document.querySelectorAll("#view-home .tunnel-karte")].find(function (k) {
      return k.getAttribute("href").slice(1).split("/")[0] === name;
    }) || null;
  }

  function alleFertig(animationen) {
    return Promise.all(animationen.map(function (a) { return a.finished; }));
  }


  /* ==========================================================================
     BAUEN: Ebene und Abbild der Startseite
     ========================================================================== */

  /** Feste Ebene unter der Navigation. */
  function baueEbene() {
    const ebene = document.createElement("div");
    ebene.className = "seitenwechsel-ebene";
    ebene.setAttribute("aria-hidden", "true");
    ebene.style.top = navUnterkante() + "px";
    document.body.appendChild(ebene);
    return ebene;
  }

  /** Eine Schicht in der Ebene (vor "vor" eingefügt, sonst obenauf). */
  function schicht(ebene, klasse, vor) {
    const e = document.createElement("div");
    e.className = klasse;
    ebene.insertBefore(e, vor || null);
    return e;
  }

  /**
   * Stillstehendes Abbild der Startseite in der Ebene – genau über der
   * echten, mit derselben Perspektive. Ohne IDs und ohne Aufbau-Animation.
   * Die angeklickte Karte behält ihre Lage im Moment des Klicks.
   */
  function abbildDerStartseite(home, karte, info, ebene, vor) {
    const rect = home.getBoundingClientRect();
    const oben = navUnterkante();
    const kopie = home.cloneNode(true);
    kopie.querySelectorAll("[id]").forEach(function (e) { e.removeAttribute("id"); });
    kopie.querySelectorAll(".tunnel").forEach(function (t) { t.classList.remove("baut-auf"); });
    const index = [...home.querySelectorAll(".tunnel-karte")].indexOf(karte);
    const karten = [...kopie.querySelectorAll(".tunnel-karte")];
    const k = karten[index];
    if (info.transform && info.transform !== "none") k.style.transform = info.transform;
    if (info.gewaehlt) k.classList.add("ist-gewaehlt");
    const riese = scharfeKarte(k, karte, Math.min(SCHAERFE_MAX, Math.max(2, Math.ceil(fuellFaktor(karte)))));
    kopie.classList.add("seitenwechsel-abbild");
    kopie.style.left = rect.left + "px";
    kopie.style.top = (rect.top - oben) + "px";
    kopie.style.width = rect.width + "px";
    const tunnel = kopie.querySelector(".tunnel");
    tunnel.style.overflow = "visible";      // die Karte wächst über den Tunnel hinaus
    ebene.insertBefore(kopie, vor || null);
    return {
      tunnel: tunnel,
      welt: kopie.querySelector(".tunnel-welt"),
      karte: k,
      titel: riese.querySelector(".tunnel-karte-name"),
      andere: karten.filter(function (x) { return x !== k; }),
      umgebung: [kopie.querySelector(".tunnel-ziel"), kopie.querySelector(".home-links")],
    };
  }


  /**
   * Scharf auch ganz nah: Die Karte wird im Abbild in SCHAERFE-facher Größe
   * gezeichnet (Fläche, Rand, Glow, Titel) und auf ihre eigene Größe
   * herunterskaliert – als eigene Grafik-Ebene. So hat der Browser beim
   * Heranfliegen genug Auflösung, der Titel bleibt bis zum Durchgang scharf.
   * Die ursprüngliche Karte bleibt als unsichtbare Hülle an ihrem Platz.
   */
  function scharfeKarte(k, echt, F) {
    const s = getComputedStyle(echt);
    const name = echt.querySelector(".tunnel-karte-name");
    const g = k.cloneNode(true);
    g.removeAttribute("href");
    g.classList.add("seitenwechsel-riese");
    g.style.transform = "scale(" + (1 / F) + ")";
    g.style.left = g.style.top = (-parseFloat(s.borderTopWidth) || 0) + "px";
    g.style.width = echt.offsetWidth * F + "px";
    g.style.height = echt.offsetHeight * F + "px";
    g.style.padding = "0 " + (parseFloat(s.paddingLeft) || 0) * F + "px";
    g.style.borderRadius = (parseFloat(s.borderTopLeftRadius) || 0) * F + "px";
    ["--linie-breite", "--glow-groesse", "--glow-kante-breite", "--glow-schatten-groesse",
      "--glow-schatten-versatz", "--glow-hover-groesse"].forEach(function (v) {
      const z = parseFloat(s.getPropertyValue(v));
      if (!isNaN(z)) g.style.setProperty(v, z * F + "px");
    });
    g.querySelector(".tunnel-karte-name").style.fontSize = parseFloat(getComputedStyle(name).fontSize) * F + "px";
    k.classList.add("ist-huelle");
    k.appendChild(g);
    return g;
  }


  /* ==========================================================================
     MATHEMATIK: Vektoren, Drehung, Kurven
     ========================================================================== */

  function punkt(M, x, y) {
    const p = M.transformPoint(new DOMPoint(x, y, 0, 1));
    return { x: p.x / p.w, y: p.y / p.w, z: p.z / p.w };
  }
  function minus(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function einheit(a) {
    const l = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  }
  function kreuz(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  }

  /** Drehachse und -winkel einer Drehmatrix (Zeilen r0, r1, r2). */
  function achseUndWinkel(r) {
    const R = [[r[0].x, r[0].y, r[0].z], [r[1].x, r[1].y, r[1].z], [r[2].x, r[2].y, r[2].z]];
    const spur = R[0][0] + R[1][1] + R[2][2];
    const winkel = Math.acos(Math.max(-1, Math.min(1, (spur - 1) / 2)));
    if (winkel < 1e-5) return { achse: { x: 0, y: 1, z: 0 }, winkel: 0 };
    const sin2 = 2 * Math.sin(winkel);
    if (Math.abs(sin2) < 1e-6) {
      // 180°: Achse aus der Diagonale (kommt bei Karten praktisch nicht vor)
      return { achse: einheit({ x: Math.sqrt(Math.max(0, (R[0][0] + 1) / 2)), y: Math.sqrt(Math.max(0, (R[1][1] + 1) / 2)), z: Math.sqrt(Math.max(0, (R[2][2] + 1) / 2)) }), winkel: winkel };
    }
    return {
      achse: einheit({ x: (R[2][1] - R[1][2]) / sin2, y: (R[0][2] - R[2][0]) / sin2, z: (R[1][0] - R[0][1]) / sin2 }),
      winkel: winkel,
    };
  }

  /** Drehmatrix um eine Achse (Rodrigues) als DOMMatrix. */
  function drehMatrix(n, a) {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    const R = [
      [t * n.x * n.x + c,       t * n.x * n.y - s * n.z, t * n.x * n.z + s * n.y],
      [t * n.x * n.y + s * n.z, t * n.y * n.y + c,       t * n.y * n.z - s * n.x],
      [t * n.x * n.z - s * n.y, t * n.y * n.z + s * n.x, t * n.z * n.z + c],
    ];
    // DOMMatrix: Spalte für Spalte
    return DOMMatrix.fromFloat64Array(new Float64Array([
      R[0][0], R[1][0], R[2][0], 0,
      R[0][1], R[1][1], R[2][1], 0,
      R[0][2], R[1][2], R[2][2], 0,
      0, 0, 0, 1,
    ]));
  }

  /**
   * Kurve aus einer CSS-Angabe (cubic-bezier(…) oder ein Schlüsselwort):
   * bei(x) = Fortschritt zur Zeit x, steigungEnde = Tempo am Ende.
   */
  function kurve(css) {
    const woerter = {
      linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], "ease-in": [0.42, 0, 1, 1],
      "ease-out": [0, 0, 0.58, 1], "ease-in-out": [0.42, 0, 0.58, 1],
    };
    let p = woerter[css];
    const m = /cubic-bezier\(([^)]+)\)/.exec(css);
    if (m) p = m[1].split(",").map(parseFloat);
    if (!p || p.length !== 4 || p.some(isNaN)) p = woerter["ease-in"];
    const x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    const b = function (t, a1, a2) { return 3 * (1 - t) * (1 - t) * t * a1 + 3 * (1 - t) * t * t * a2 + t * t * t; };
    return {
      css: "cubic-bezier(" + p.join(", ") + ")",
      bei: function (x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let lo = 0, hi = 1;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (b(mid, x1, x2) < x) lo = mid; else hi = mid;
        }
        return b((lo + hi) / 2, y1, y2);
      },
      // dy/dx bei x = 1 (Tangente durch den letzten Kontrollpunkt)
      steigungEnde: x2 < 1 ? (1 - y2) / (1 - x2) : 1,
    };
  }


  return {
    karteGeklickt: karteGeklickt,
    wechsle: wechsle,
    istAktiv: istAktiv,
  };
})();
