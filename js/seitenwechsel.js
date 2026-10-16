/* ==========================================================================
   seitenwechsel.js – Übergänge zwischen den Ansichten

   1. Karte → Abschnitt (Startseite → z. B. "Zu erledigen"):
      Die angeklickte Karte wird selbst zur neuen Seite. Eine Kopie der
      Karte liegt in einer festen Ebene über der Seite (FLIP-Technik):
        F (First)  – Lage, Größe und 3D-Drehung der echten Karte auslesen
        L (Last)   – Ziel: der ganze Inhaltsbereich unter der Navigation
        I (Invert) – die Kopie startet genau auf der echten Karte
        P (Play)   – eine durchgehende Bewegung zum Ziel
      Dabei dreht sich die Karte gerade, wächst, ihre Fläche geht in den
      Seitenhintergrund über, die übrigen Karten weichen zurück, der Titel
      gleitet an die Stelle der Überschrift. Erst danach blendet der
      Inhalt des Abschnitts ein.
   2. Abschnitt → Startseite (Logo, Zurück-Button, Navigation): derselbe
      Weg rückwärts.
   3. Abschnitt → Abschnitt: kurze, ruhige Überblendung.
   4. "Bewegung reduzieren": immer nur eine kurze Überblendung.

   Die Zielseite wird unter der Ebene schon vollständig aufgebaut, bevor
   die Karte sie erreicht – nichts lädt nach oder blitzt auf.
   Animiert werden nur transform, opacity und border-radius (Web
   Animations API). Neuladen und direkte Links: ohne Animation (app.js).

   Dauer und Kurven: CSS-Variablen --uebergang-… in css/style.css.
   ========================================================================== */

const Seitenwechsel = (function () {

  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  let laeuft = false;          // gerade ein Übergang aktiv?
  let aktiv = null;            // { animationen, ende() } des laufenden Übergangs
  let sperre = null;           // durchsichtige Fläche, die Klicks abfängt


  /* ==========================================================================
     KONFIGURATION (aus den CSS-Variablen)
     ========================================================================== */

  function konfig() {
    const s = getComputedStyle(document.documentElement);
    const ms = function (name) { return parseFloat(s.getPropertyValue(name)) || 0; };
    return {
      dauer: ms("--uebergang-dauer"),                 // Karte ↔ Seite
      kurve: s.getPropertyValue("--uebergang-kurve").trim() || "ease-out",
      inhaltDauer: ms("--uebergang-inhalt-dauer"),    // Inhalt ein-/ausblenden
      inhaltVersatz: ms("--uebergang-inhalt-versatz"),// so weit rückt der Inhalt von unten nach
      weichen: ms("--uebergang-weichen"),             // so weit weichen die übrigen Karten zurück
      wechselDauer: ms("--uebergang-wechsel-dauer"),  // Abschnitt ↔ Abschnitt
      ruhigDauer: ms("--uebergang-ruhig-dauer"),      // "Bewegung reduzieren"
      radiusEnde: ms("--uebergang-radius-ende"),      // Rundung der fertigen Seite
      // Ab diesem Anteil der Dauer ist die Bewegung (weich ankommende Kurve)
      // praktisch am Ziel (< 1 px Rest) – dann geht es gleich weiter
      endeAnteil: parseFloat(s.getPropertyValue("--uebergang-ende-anteil")) || 1,
    };
  }


  /* ==========================================================================
     ÖFFENTLICH
     ========================================================================== */

  /**
   * Klick auf eine Karte der Startseite. Sperrt sofort (Doppelklicks lösen
   * keinen zweiten Übergang aus) und setzt den Hash wie bisher; den
   * eigentlichen Übergang startet dann wechsle() beim hashchange.
   * @returns {boolean} true, wenn der Klick übernommen wurde
   */
  function karteGeklickt(href) {
    if (laeuft) return true;            // gesperrt: Klick verschlucken
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
     1. KARTE → ABSCHNITT
     ========================================================================== */

  function karteZurSeite(karte, ziel, zeige, c) {
    sperren();
    const home = document.querySelector("#view-home .home");
    const tunnel = home.querySelector(".tunnel");
    const ebene = baueEbene(true);

    // F: Lage der echten Karte und ihres Titels (inkl. 3D-Drehung)
    const start = misstKarte(karte, tunnel);

    // Stillstehendes Abbild der Startseite in die Ebene (die echte Seite
    // wechselt gleich darunter zum Abschnitt). Die Karte selbst fehlt im
    // Abbild – sie wird durch die bewegte Kopie ersetzt.
    const abbild = abbildDerStartseite(home, karte, ebene);

    const buehne = baueBuehne(ebene, start);
    const kopie = baueKartenKopie(buehne, karte, start);
    const titelKarte = baueTitelKopie(buehne, start.titel);

    // Zielseite schon jetzt vollständig aufbauen – unter der Ebene
    zeige();
    window.scrollTo(0, 0);
    const section = document.getElementById("view-" + ziel.name);
    const inhalt = inhaltVon(section);
    inhalt.forEach(function (e) { e.classList.add("seitenwechsel-wartet"); });

    const animationen = [];
    let erledigt = false;
    aktiv = {
      ende: function () { fertig(true); },
    };
    // Erst im nächsten Bild messen und starten: Abschnitte dürfen nach dem
    // Anzeigen noch scrollen (Kalender am Smartphone springt zum aktuellen
    // Monat). Bis dahin zeigt die Ebene unverändert die Startseite.
    requestAnimationFrame(los);

    function los() {
      if (erledigt) return;
      // L: Ziel = Inhaltsbereich unter der Navigation; Titel → Überschrift
      const flaeche = inhaltsbereich(buehne);
      const ueberschrift = sichtbareUeberschrift(section);
      const titelSeite = ueberschrift ? baueUeberschriftKopie(buehne, ueberschrift) : null;
      const wege = titelWege(start.titel, titelSeite, ueberschrift, buehne, section);

      // P: alles gleichzeitig, eine Kurve
      const zeit = { duration: c.dauer, easing: c.kurve, fill: "both" };
      animationen.push(kopie.huelle.animate([
        { transform: start.matrix.toString() },
        { transform: flaeche.matrix(start.breite, start.hoehe).toString() },
      ], zeit));
      [kopie.gesicht, kopie.grund].forEach(function (schicht) {
        animationen.push(schicht.animate([
          { borderRadius: radius(start.radius, 1, 1) },
          { borderRadius: radius(c.radiusEnde, flaeche.sx(start.breite), flaeche.sy(start.hoehe)) },
        ], zeit));
      });
      // Fläche geht in den Seitenhintergrund über – erst in der zweiten Hälfte,
      // damit man die Karte wachsen sieht
      animationen.push(kopie.gesicht.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0, offset: 0.9 }, { opacity: 0 }], zeit));
      animationen.push(kopie.grund.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.9 }, { opacity: 1 }], zeit));
      // Titel: Kartentitel → Überschrift (beide Kopien laufen denselben Weg und überblenden)
      animationen.push(titelKarte.animate([{ transform: wege.karteStart }, { transform: wege.karteEnde }], zeit));
      animationen.push(titelKarte.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }], zeit));
      if (titelSeite) {
        animationen.push(titelSeite.animate([{ transform: wege.seiteStart }, { transform: wege.seiteEnde }], zeit));
        animationen.push(titelSeite.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }], zeit));
      }
      // Übrige Karten weichen zurück und blenden aus, Begrüßung und "Heute" ebenso
      animationen.push.apply(animationen, abbildWeicht(abbild, c, zeit));
      // Am Ziel (siehe endeAnteil) ist die Karte praktisch die Seite: Ebene weg, Inhalt ein
      beiAnteil(animationen[0], c, function () { fertig(false); });
    }

    function fertig(sofort) {
      if (erledigt) return;
      erledigt = true;
      animationen.forEach(function (a) { a.cancel(); });
      ebene.remove();
      inhalt.forEach(function (e) { e.classList.remove("seitenwechsel-wartet"); });
      if (sofort) {
        entsperren();
        return;
      }
      // Erst jetzt: Inhalt blendet weich ein, etwas von unten nachrückend
      const ein = inhalt.map(function (e) {
        return e.animate([
          { opacity: 0, transform: "translateY(" + c.inhaltVersatz + "px)" },
          { opacity: 1, transform: "none" },
        ], { duration: c.inhaltDauer, easing: c.kurve });
      });
      aktiv = { ende: function () { ein.forEach(function (a) { a.finish(); }); entsperren(); } };
      Promise.all(ein.map(function (a) { return a.finished; })).then(entsperren, entsperren);
    }
  }


  /* ==========================================================================
     2. ABSCHNITT → STARTSEITE (derselbe Weg rückwärts)
     ========================================================================== */

  function seiteZurKarte(von, zeige, c) {
    sperren();
    const section = document.getElementById("view-" + von);
    const inhalt = inhaltVon(section);

    // Zuerst blendet der Inhalt aus (die Überschrift bleibt – sie wird gleich zum Kartentitel)
    const aus = inhalt.map(function (e) {
      return e.animate([
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(" + (c.inhaltVersatz / 2) + "px)" },
      ], { duration: c.inhaltDauer * 0.7, easing: "ease-in", fill: "forwards" });
    });
    let abgebrochen = false;
    aktiv = { ende: function () { abgebrochen = true; aus.forEach(function (a) { a.cancel(); }); zeige(); entsperren(); } };

    Promise.all(aus.map(function (a) { return a.finished; })).then(function () {
      if (abgebrochen) return;
      // Alles Weitere synchron, damit der Browser nichts dazwischen zeichnet
      const ueberschrift = sichtbareUeberschrift(section);
      const ueberschriftRect = ueberschrift ? textRechteck(ueberschrift) : null;
      const ueberschriftStil = ueberschrift ? getComputedStyle(ueberschrift) : null;
      const ueberschriftText = ueberschrift ? ueberschrift.textContent : "";

      StartseiteAnsicht.ohneAufbau();   // kein Aufbau von hinten – die Karten kommen mit dem Übergang
      zeige();
      aus.forEach(function (a) { a.cancel(); });
      window.scrollTo(0, 0);

      const home = document.querySelector("#view-home .home");
      const tunnel = home.querySelector(".tunnel");
      const karte = karteZu(von);
      const start = misstKarte(karte, tunnel);
      const ebene = baueEbene(false);
      const buehne = baueBuehne(ebene, start);
      const kopie = baueKartenKopie(buehne, karte, start);
      const titelKarte = baueTitelKopie(buehne, start.titel);
      const titelSeite = ueberschrift ? baueUeberschriftKopie(buehne, null, ueberschriftRect, ueberschriftStil, ueberschriftText) : null;
      const flaeche = inhaltsbereich(buehne);
      const wege = titelWege(start.titel, titelSeite, ueberschriftRect ? { rect: ueberschriftRect, stil: ueberschriftStil } : null, buehne, section);

      karte.style.visibility = "hidden";
      const andere = [...home.querySelectorAll(".tunnel-karte")].filter(function (k) { return k !== karte; });
      const umgebung = [home.querySelector(".tunnel-ziel"), home.querySelector(".home-heute")];

      const zeit = { duration: c.dauer, easing: c.kurve, fill: "both" };
      const animationen = [];
      animationen.push(kopie.huelle.animate([
        { transform: flaeche.matrix(start.breite, start.hoehe).toString() },
        { transform: start.matrix.toString() },
      ], zeit));
      [kopie.gesicht, kopie.grund].forEach(function (schicht) {
        animationen.push(schicht.animate([
          { borderRadius: radius(c.radiusEnde, flaeche.sx(start.breite), flaeche.sy(start.hoehe)) },
          { borderRadius: radius(start.radius, 1, 1) },
        ], zeit));
      });
      animationen.push(kopie.gesicht.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], zeit));
      animationen.push(kopie.grund.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], zeit));
      animationen.push(titelKarte.animate([{ transform: wege.karteEnde }, { transform: wege.karteStart }], zeit));
      animationen.push(titelKarte.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.65 }, { opacity: 1 }], zeit));
      if (titelSeite) {
        animationen.push(titelSeite.animate([{ transform: wege.seiteEnde }, { transform: wege.seiteStart }], zeit));
        animationen.push(titelSeite.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.65 }, { opacity: 0 }], zeit));
      }
      // Die anderen Karten kommen wieder, Begrüßung und "Heute" blenden ein
      andere.forEach(function (k) {
        animationen.push(k.animate([
          { transform: "translateZ(" + (-c.weichen) + "px)", opacity: 0 },
          { transform: "translateZ(0px)", opacity: 1 },
        ], zeit));
      });
      umgebung.forEach(function (e) {
        animationen.push(e.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], zeit));
      });

      let erledigt = false;
      function fertig() {
        if (erledigt) return;
        erledigt = true;
        animationen.forEach(function (a) { a.cancel(); });
        ebene.remove();
        karte.style.visibility = "";
        entsperren();
      }
      aktiv = { ende: fertig };
      beiAnteil(animationen[0], c, fertig);
    });
  }


  /* ==========================================================================
     3. ÜBERBLENDUNG (Abschnitt ↔ Abschnitt, "Bewegung reduzieren")
     ========================================================================== */

  function ueberblenden(zeige, dauer) {
    sperren();
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
     MESSEN: Lage der Karte im 3D-Raum (FLIP "First")
     ========================================================================== */

  /**
   * Gesamte Abbildung eines Elements in das Koordinatensystem von "bis":
   * je Ebene Versatz + transform um transform-origin. Ergebnis wirkt auf
   * die linke obere Ecke des Elements (transform-origin der Kopie: 0 0).
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

  function misstKarte(karte, tunnel) {
    const s = getComputedStyle(karte);
    const name = karte.querySelector(".tunnel-karte-name");
    const ns = getComputedStyle(name);
    return {
      tunnel: tunnel,
      tunnelRect: tunnel.getBoundingClientRect(),
      perspektive: getComputedStyle(tunnel).perspective,
      ursprung: getComputedStyle(tunnel).perspectiveOrigin,
      matrix: matrixBis(karte, tunnel),
      breite: karte.offsetWidth,
      hoehe: karte.offsetHeight,
      radius: parseFloat(s.borderTopLeftRadius) || 0,
      stil: s,
      titel: {
        el: name,
        matrix: matrixBis(name, tunnel),
        breite: name.offsetWidth,
        hoehe: name.offsetHeight,
        stil: ns,
      },
    };
  }


  /* ==========================================================================
     BAUEN: Ebene, Bühne, Kopien
     ========================================================================== */

  /** Feste Ebene unter der Navigation. deckend = mit Seitenhintergrund. */
  function baueEbene(deckend) {
    const ebene = document.createElement("div");
    ebene.className = "seitenwechsel-ebene" + (deckend ? " ist-deckend" : "");
    ebene.setAttribute("aria-hidden", "true");
    ebene.style.top = navUnterkante() + "px";
    document.body.appendChild(ebene);
    return ebene;
  }

  /** Bühne mit derselben Perspektive wie der Tunnel, genau über ihm. */
  function baueBuehne(ebene, start) {
    const b = document.createElement("div");
    b.className = "seitenwechsel-buehne";
    const r = start.tunnelRect;
    b.style.left = r.left + "px";
    b.style.top = (r.top - navUnterkante()) + "px";
    b.style.width = r.width + "px";
    b.style.height = r.height + "px";
    b.style.perspective = start.perspektive;
    b.style.perspectiveOrigin = start.ursprung;
    ebene.appendChild(b);
    return b;
  }

  /** Kopie der Karte: Hülle (bewegt sich) mit Kartenfläche und Seitengrund. */
  function baueKartenKopie(buehne, karte, start) {
    const huelle = document.createElement("div");
    huelle.className = "seitenwechsel-karte";
    huelle.style.width = start.breite + "px";
    huelle.style.height = start.hoehe + "px";
    huelle.style.transform = start.matrix.toString();
    const gesicht = document.createElement("div");
    gesicht.className = "seitenwechsel-gesicht";
    const s = start.stil;
    gesicht.style.background = s.backgroundColor;
    gesicht.style.border = s.borderTopWidth + " solid " + s.borderTopColor;
    gesicht.style.boxShadow = s.boxShadow;
    gesicht.style.borderRadius = start.radius + "px";
    const grund = document.createElement("div");
    grund.className = "seitenwechsel-grund";
    grund.style.borderRadius = start.radius + "px";
    huelle.appendChild(gesicht);
    huelle.appendChild(grund);
    buehne.appendChild(huelle);
    return { huelle: huelle, gesicht: gesicht, grund: grund };
  }

  /** Kopie des Kartentitels (gleiche Schrift, Größe, Umbruch). */
  function baueTitelKopie(buehne, titel) {
    const t = titel.el.cloneNode(true);
    t.className = "seitenwechsel-titel";
    kopiereSchrift(t, titel.stil);
    t.style.width = titel.breite + "px";
    t.style.textAlign = "center";
    t.style.transform = titel.matrix.toString();
    buehne.appendChild(t);
    return t;
  }

  /** Kopie der Abschnitts-Überschrift in ihrer endgültigen Gestalt (eine Zeile). */
  function baueUeberschriftKopie(buehne, h1, rect, stil, text) {
    rect = rect || textRechteck(h1);
    stil = stil || getComputedStyle(h1);
    const t = document.createElement("div");
    t.className = "seitenwechsel-titel";
    t.textContent = text !== undefined ? text : h1.textContent;
    kopiereSchrift(t, stil);
    t.style.whiteSpace = "nowrap";
    t.style.width = rect.width + "px";
    t.style.textAlign = "left";
    t.__rect = rect;
    buehne.appendChild(t);
    return t;
  }

  function kopiereSchrift(el, s) {
    ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color"].forEach(function (p) {
      el.style[p] = s[p];
    });
  }

  /**
   * Abbild der Startseite in der Ebene (nur Hinweg): stillstehende Kopie,
   * ohne IDs, ohne Aufbau-Animation, die angeklickte Karte unsichtbar.
   */
  function abbildDerStartseite(home, karte, ebene) {
    const rect = home.getBoundingClientRect();
    const kopie = home.cloneNode(true);
    kopie.querySelectorAll("[id]").forEach(function (e) { e.removeAttribute("id"); });
    kopie.querySelectorAll(".tunnel").forEach(function (t) { t.classList.remove("baut-auf"); });
    const index = [...home.querySelectorAll(".tunnel-karte")].indexOf(karte);
    const karten = [...kopie.querySelectorAll(".tunnel-karte")];
    karten[index].style.visibility = "hidden";
    kopie.classList.add("seitenwechsel-abbild");
    kopie.style.left = rect.left + "px";
    kopie.style.top = (rect.top - navUnterkante()) + "px";
    kopie.style.width = rect.width + "px";
    ebene.appendChild(kopie);
    return {
      karten: karten.filter(function (k, i) { return i !== index; }),
      umgebung: [kopie.querySelector(".tunnel-ziel"), kopie.querySelector(".home-heute")],
    };
  }

  /** Übrige Karten weichen zurück und blenden aus; Begrüßung und "Heute" ebenso. */
  function abbildWeicht(abbild, c, zeit) {
    const a = [];
    abbild.karten.forEach(function (k) {
      a.push(k.animate([
        { transform: "translateZ(0px)", opacity: 1 },
        { transform: "translateZ(" + (-c.weichen) + "px)", opacity: 0, offset: 0.7 },
        { transform: "translateZ(" + (-c.weichen) + "px)", opacity: 0 },
      ], zeit));
    });
    abbild.umgebung.forEach(function (e) {
      a.push(e.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], zeit));
    });
    return a;
  }


  /* ==========================================================================
     ZIELE (FLIP "Last")
     ========================================================================== */

  /** Inhaltsbereich unter der Navigation, in Koordinaten der Bühne. */
  function inhaltsbereich(buehne) {
    const b = buehne.getBoundingClientRect();
    const oben = navUnterkante();
    const x = -b.left;
    const y = oben - b.top;
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight - oben;
    return {
      sx: function (breite) { return w / breite; },
      sy: function (hoehe) { return h / hoehe; },
      matrix: function (breite, hoehe) {
        return new DOMMatrix().translate(x, y).scale(w / breite, h / hoehe);
      },
    };
  }

  /**
   * Wege der beiden Titel-Kopien. Beide laufen denselben Weg (von der Mitte
   * des Kartentitels zur Mitte der Überschrift) und überblenden unterwegs:
   * so wird aus dem (evtl. umbrochenen) Kartentitel die einzeilige Überschrift.
   */
  function titelWege(titel, titelSeite, ueberschrift, buehne, section) {
    const b = buehne.getBoundingClientRect();
    const fa = parseFloat(titel.stil.fontSize);
    // Mitte des Kartentitels in seinen eigenen Koordinaten
    const ca = { x: titel.breite / 2, y: titel.hoehe / 2 };
    let ziel, fb;
    if (ueberschrift) {
      const rect = titelSeite.__rect;
      const stil = ueberschrift.stil || getComputedStyle(ueberschrift);
      fb = parseFloat(stil.fontSize);
      ziel = { x: rect.left - b.left, y: rect.top - b.top, w: rect.width, h: rect.height };
    } else {
      // Überschrift nicht sichtbar (z. B. Kalender am Computer): Titel gleitet
      // an den Anfang des Inhalts und verblasst dort
      const r = section.getBoundingClientRect();
      fb = fa * 0.6;
      // (ist der Abschnitt schon gescrollt, dann oben im sichtbaren Bereich)
      ziel = { x: r.left - b.left + r.width / 2 - 100, y: Math.max(r.top, navUnterkante()) - b.top + 10, w: 200, h: fb * 1.2 };
    }
    const s = fb / fa;                                  // Kartentitel → Größe der Überschrift
    const zielMitte = { x: ziel.x + ziel.w / 2, y: ziel.y + ziel.h / 2 };
    const karteEnde = new DOMMatrix().translate(zielMitte.x - ca.x * s, zielMitte.y - ca.y * s).scale(s);
    const wege = { karteStart: titel.matrix.toString(), karteEnde: karteEnde.toString() };
    if (titelSeite) {
      const k = fa / fb;                                // Überschrift → Größe des Kartentitels
      const wb = ziel.w, hb = ziel.h;
      wege.seiteStart = titel.matrix.multiply(new DOMMatrix().translate(ca.x - wb * k / 2, ca.y - hb * k / 2).scale(k)).toString();
      wege.seiteEnde = new DOMMatrix().translate(ziel.x, ziel.y).toString();
    }
    return wege;
  }


  /* ==========================================================================
     HELFER
     ========================================================================== */

  /**
   * Ruft fn, sobald die Animation den Anteil endeAnteil ihrer Dauer erreicht
   * hat. Gemessen an der Animation selbst (nicht per setTimeout), damit auch
   * ein verspäteter Start oder ruckelnde Bilder keinen Rest-Sprung erzeugen.
   */
  function beiAnteil(anim, c, fn) {
    const ziel = c.dauer * c.endeAnteil;
    (function pruefe() {
      if (anim.playState === "idle") return;          // abgebrochen
      if (anim.playState === "finished" || (anim.currentTime || 0) >= ziel) fn();
      else requestAnimationFrame(pruefe);
    })();
  }

  /** Die Karte der Startseite, die zu einer Ansicht führt (oder null). */
  function karteZu(name) {
    return [...document.querySelectorAll("#view-home .tunnel-karte")].find(function (k) {
      return k.getAttribute("href").slice(1).split("/")[0] === name;
    }) || null;
  }

  /** Inhalt eines Abschnitts: alles außer der Überschrift. */
  function inhaltVon(section) {
    return [...section.children].filter(function (e) { return e.tagName !== "H1"; });
  }

  /** Die Überschrift des Abschnitts, falls sie sichtbar ist. */
  function sichtbareUeberschrift(section) {
    const h1 = section.querySelector(":scope > h1");
    if (!h1) return null;
    const s = getComputedStyle(h1);
    const r = h1.getBoundingClientRect();
    const imBild = r.bottom > navUnterkante() && r.top < window.innerHeight;
    return s.clipPath === "none" && r.width > 2 && s.visibility !== "hidden" && imBild ? h1 : null;
  }

  /** Rechteck nur des Textes (h1 ist ein Block über die ganze Breite). */
  function textRechteck(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  }

  /**
   * Rundung so, dass sie nach der (ungleichmäßigen) Skalierung sx/sy wie
   * "px" Pixel aussieht: elliptische Radien px/sx bzw. px/sy.
   */
  function radius(px, sx, sy) {
    return (px / sx).toFixed(2) + "px / " + (px / sy).toFixed(2) + "px";
  }

  function navUnterkante() {
    const leiste = document.querySelector(".leiste");
    return leiste ? Math.max(0, leiste.getBoundingClientRect().bottom) : 0;
  }


  return {
    karteGeklickt: karteGeklickt,
    wechsle: wechsle,
    istAktiv: istAktiv,
  };
})();
