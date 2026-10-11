/* ==========================================================================
   sudoku-damage-fx.js – Schadensaufbau im Sudoku-Abenteuer
   Nur Darstellung: Die Schadensberechnung (js/sudoku-rpg.js) liefert die
   einzelnen Schritte ("Wurf 14", "Kombo ×1,3" …) – hier werden sie nur
   abgespielt:
     1. Die gewürfelte Zahl löst sich vom Würfel und steht groß daneben.
     2. Jeder Bonus fliegt als Etikett von seiner Quelle auf die Zahl zu
        (Kombo vom Kombo-Zähler, Doppelschaden von der fertigen Zeile …).
     3. Bei jedem Einschlag zählt die Zahl auf den Zwischenwert hoch.
     4. Die Summe fliegt mit Leuchtspur ins Schwert des Helden.
     5. Das Schwert leuchtet (je nach Schaden in fünf Stufen), der Held
        schlägt zu, das Leuchten entlädt sich im Boss (entladen).
   Gesteuert wird alles von js/sudoku-battle-ui.js. Aussehen:
   css/sudoku-damage-fx.css. Animiert werden nur transform und opacity.
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Werte an einer Stelle
   -------------------------------------------------------------------------- */
const SUDOKU_FX_KONFIG = {
  // Leuchtstufen des Schwerts: ab diesem Schaden (ohne Gift) gilt die Stufe.
  // "funken" = so viele Funken beim Einschlag im Boss.
  stufen: [
    { ab: 0, id: "glimmen", name: "kaum sichtbar", funken: 0 },
    { ab: 15, id: "weiss", name: "schwaches weißes Leuchten", funken: 0 },
    { ab: 30, id: "blau", name: "kräftiges blaues Leuchten", funken: 0 },
    { ab: 60, id: "glut", name: "orangerotes Leuchten mit Funken", funken: 10 },
    { ab: 100, id: "regenbogen", name: "Regenbogen-Leuchten", funken: 18 },
  ],

  // Dauer der Abschnitte (Millisekunden, Stufe "Normal" auf dem Desktop).
  // Zusammen mit dem Schlag des Helden höchstens etwa 1,5 Sekunden.
  zeiten: {
    abloesen: 140,          // Zahl löst sich vom Würfel
    krit: 200,              // kritischer Treffer: Zahl verdreifacht sich
    etiketten: 480,         // alle Boni ZUSAMMEN – viele Boni fliegen dichter hintereinander
    etikettFlug: 240,       // Flugzeit eines Etiketts (sie starten gestaffelt)
    etikettAbstandMax: 180, // höchstens so viel Zeit zwischen zwei Einschlägen
    regenbogenAbzug: 160,   // bei der Regenbogen-Stufe kürzer, dafür …
    zumSchwert: 200,        // Flug ins Schwert
    aufladen: 100,          // Schwert leuchtet auf
    aufladenRegenbogen: 300, // … längeres Aufladen bei der Regenbogen-Stufe
    entladen: 200,          // Einschlag im Boss (beginnt mitten im Schlag des Helden)
    abprallen: 420,         // Fehlschlag / immun: Zahl zerfällt oder prallt ab
    reduziertSchritt: 160,  // "Bewegung reduzieren": Pause je Zählschritt
  },

  // Regenbogenschlag (Regenbogenfeld): feste Abschnitte, zusammen etwa 3 Sekunden.
  // Läuft immer in voller Länge – auch bei "Schnell" und auf dem Smartphone,
  // und er lässt sich nicht abkürzen.
  regenbogenSchlag: {
    zerspringen: 450,       // Feld zerspringt in buntes Licht
    strahl: 500,            // Regenbogenstrahl fliegt zum Schwert
    aufladen: 750,          // Schwert lädt sich in allen Farben auf
    ausholen: 300,          // Held holt zum Riesenschlag aus
    aufloesen: 1000,        // Blitz, HP auf null, Boss zerfällt in bunte Funken
    ruhig: 1400,            // ruhige Fassung ("Aus" / "Bewegung reduzieren"): Einblenden
    funkenFeld: 16,         // Funken beim Zerspringen des Felds
    funkenBoss: 36,         // Funken beim Zerfallen des Bosses
  },

  // Auf dem Smartphone sind die Wege kürzer – der Ablauf ist etwa halb so lang
  faktorHandy: 0.5,

  // Wo die große Zahl "daneben" steht (Abstand zur Würfelmitte, Pixel)
  daneben: { desktop: { x: -96, y: 0 }, handy: { x: -34, y: -52 } },

  // Wo im Bild des Helden das Schwert sitzt (Anteil von Breite und Höhe)
  schwertPunkt: { x: 0.85, y: 0.25 },

  // Größe der Zahl: wächst mit dem Wert bis zu diesem Faktor
  groesseMax: 1.9,
  groesseVoll: 120,         // ab diesem Wert ist sie am größten
};


const SudokuSchadenFx = (function () {

  const K = SUDOKU_FX_KONFIG;
  let ebene = null;         // Ebene über der Seite für alle fliegenden Teile

  /* ------------------------------------------------------------------------
     KLEINE HELFER
     ------------------------------------------------------------------------ */

  /** Leuchtstufe für einen Schaden (Objekt aus K.stufen, dazu .nummer 0–4). */
  function stufeFuer(schaden) {
    let nummer = 0;
    K.stufen.forEach(function (s, i) { if (schaden >= s.ab) nummer = i; });
    return Object.assign({ nummer: nummer }, K.stufen[nummer]);
  }

  /** Aufrunden wie in der Schadensberechnung (ohne Rechenfehler des Computers). */
  function aufrunden(x) {
    return Math.ceil(Math.round(x * 1e6) / 1e6);
  }

  function gradMitName(name) {
    return SudokuEngine.SCHWIERIGKEITSGRADE.find(function (g) { return g.name === name; });
  }

  /**
   * Liest aus den Schritten der Schadensberechnung, was nacheinander passiert.
   * "Kombo ×1,3" → { label: "Kombo ×1,3", quelle: "kombo", wert: Zwischenwert }
   * Der letzte Zwischenwert ist immer genau der berechnete Schaden.
   * @returns {object[]} { art: "krit" | "bonus", label, quelle, wert }
   */
  function schritteAus(e) {
    const liste = [];
    let wert = startwert(e);
    let vorKombo = null, komboFaktor = 1;                    // für den Buch-Bonus (zählt zur Kombo dazu)
    e.rechnung.schritte.forEach(function (schritt, i) {
      if (i === 0) return;                                   // "Wurf 14"
      // Bücher: "Bücher +15 %" – erhöht den Kombo-Multiplikator um 0,15
      const buch = /^Bücher \+(\d+) %$/.exec(schritt);
      if (buch) {
        const basis = vorKombo === null ? wert : vorKombo;
        wert = basis * (komboFaktor + Number(buch[1]) / 100);
        liste.push({ art: "bonus", label: schritt, quelle: "buecher", wert: aufrunden(wert), zeile: i - 1 });
        return;
      }
      const teil = /^(.*) ([×+])([\d,]+)$/.exec(schritt);
      if (!teil) return;
      const name = teil[1], rechnung = teil[2], text = teil[3];
      const zahl = parseFloat(text.replace(",", "."));
      if (name === "Kombo") { vorKombo = wert; komboFaktor = zahl; }
      // Reihenbrecher: ein Etikett JE fertiger Einheit, jedes fliegt von seiner
      // Zeile, Spalte oder seinem Block los ("einheit" = 0, 1, 2 in dieser Reihenfolge)
      if (name === "Reihenbrecher") {
        const einheiten = einheitenListe(e);
        const anzahl = Math.max(1, einheiten.length);
        const jeEinheit = zahl / anzahl;
        for (let k = 0; k < anzahl; k++) {
          wert += jeEinheit;
          liste.push({ art: "bonus", label: "Reihenbrecher +" + SudokuRPG.zahlText(jeEinheit), quelle: "reihe",
            einheit: einheiten[k] || null, wert: aufrunden(wert), zeile: i - 1 });
        }
        return;
      }
      wert = rechnung === "×" ? wert * zahl : wert + zahl;
      const grad = gradMitName(name);
      // zeile: zu welcher Zeile in "Letzter Treffer" der Schritt gehört
      const eintrag = { art: "bonus", label: name + " " + rechnung + text, quelle: "wuerfel", wert: aufrunden(wert), zeile: i - 1 };
      if (name === "Kritisch") {
        eintrag.art = "krit";
        eintrag.label = "Krit " + rechnung + text;
      } else if (name === "Zuschlag") {
        eintrag.label = "+" + text;
        eintrag.quelle = "klinge";
      } else if (name === "Kombo") {
        eintrag.quelle = "kombo";
      } else if (name === "Mindestwurf") {
        eintrag.quelle = "buch";                             // Buch des Fünften
      } else if (name === "Doppelt") {
        eintrag.quelle = "doppelt";
      } else if (grad) {
        eintrag.label = name + " +" + Math.round((zahl - 1) * 100) + " %";
        eintrag.quelle = "grad";
      } else if (e.boss && e.boss.selten && name === e.boss.selten.name) {
        eintrag.quelle = "selten";                           // z. B. "Kombofluch ×1"
      }
      liste.push(eintrag);
    });
    if (liste.length > 0) liste[liste.length - 1].wert = e.schaden;
    return liste;
  }

  /** Womit der Aufbau beginnt: der Wurf – bei mehreren Würfeln ihre Summe (nach Krit/Immunität). */
  function startwert(e) {
    return e.rechnung && e.rechnung.wuerfel ? e.rechnung.basis : e.wurf;
  }

  /** Die Einheiten, die diese Zahl vervollständigt hat: ["zeile", "spalte", "block"] (Auswahl). */
  function einheitenListe(e) {
    const ein = e.einheiten || {};
    return ["zeile", "spalte", "block"].filter(function (n) { return ein[n]; });
  }

  /** Alle Zeiten mal Faktor (Schnell, Smartphone …). */
  function zeitenMal(faktor) {
    const t = {};
    Object.keys(K.zeiten).forEach(function (k) {
      t[k] = K.zeiten[k] * faktor;
    });
    return t;
  }

  function ebeneHolen() {
    if (!ebene || !document.body.contains(ebene)) {
      ebene = document.createElement("div");
      ebene.className = "fx-ebene";
      ebene.setAttribute("aria-hidden", "true");
      document.body.appendChild(ebene);
    }
    return ebene;
  }

  /** Alles Fliegende sofort entfernen (beim Überspringen). */
  function aufraeumen() {
    if (ebene) ebene.innerHTML = "";
  }

  function verschiebung(p) {
    return "translate(" + p.x + "px, " + p.y + "px)";
  }

  /** Ein Element in der Ebene, mittig an Punkt p. */
  function element(klasse, p, inhalt) {
    const aussen = document.createElement("div");
    aussen.className = "fx-teil " + klasse;
    aussen.style.transform = verschiebung(p);
    // fx-mitte zentriert (fest), fx-inhalt wird animiert – so stört nichts die Zentrierung
    aussen.innerHTML = '<div class="fx-mitte"><div class="fx-inhalt">' + (inhalt || "") + "</div></div>";
    ebeneHolen().appendChild(aussen);
    return aussen;
  }

  /** Fliegt von a nach b (nur transform). */
  function fliege(el, a, b, ms, kurve) {
    el.style.transform = verschiebung(b);
    return el.animate([{ transform: verschiebung(a) }, { transform: verschiebung(b) }],
      { duration: Math.max(1, ms), easing: kurve || "cubic-bezier(0.3, 0.7, 0.4, 1)" });
  }

  /** Größe der Zahl für einen Wert. */
  function groesseVon(wert) {
    return 1 + (K.groesseMax - 1) * Math.min(1, wert / K.groesseVoll);
  }

  /** Setzt Wert, Farbe (Stufe des Werts) und Grundgröße der großen Zahl. */
  function zeigeWert(zahl, wert) {
    const innen = zahl.querySelector(".fx-wert");
    innen.textContent = wert;
    zahl.dataset.stufe = stufeFuer(wert).id;
    innen.style.transform = "scale(" + groesseVon(wert) + ")";
  }

  /** Zählt die Zahl sichtbar von a nach b hoch (bricht bei Eile sofort ab). */
  function zaehle(zahl, a, b, ms, u) {
    return new Promise(function (fertig) {
      const start = performance.now();
      function schritt(jetzt) {
        const t = Math.min(1, (jetzt - start) / Math.max(1, ms));
        if (t >= 1 || u.eilig()) {
          zeigeWert(zahl, b);
          fertig();
          return;
        }
        zahl.querySelector(".fx-wert").textContent = Math.round(a + (b - a) * t);
        requestAnimationFrame(schritt);
      }
      requestAnimationFrame(schritt);
    });
  }

  /** Kleiner Satz beim Einschlag: kurz größer und nach oben, dann die neue Größe. */
  function huepfe(zahl, wert, ms) {
    const innen = zahl.querySelector(".fx-wert");
    const g = groesseVon(wert);
    innen.animate([
      { transform: "translateY(0) scale(" + g + ")" },
      { transform: "translateY(-10px) scale(" + (g * 1.3) + ")" },
      { transform: "translateY(0) scale(" + g + ")" },
    ], { duration: Math.max(1, ms), easing: "ease-out" });
  }

  /** Ring, der aufplatzt (kritischer Treffer, Einschlag im Boss). */
  function ring(p, klasse, ms, groesse) {
    const r = element("fx-ring " + klasse, p);
    r.querySelector(".fx-inhalt").animate([
      { transform: "scale(0.2)", opacity: 1 },
      { transform: "scale(" + (groesse || 1) + ")", opacity: 0 },
    ], { duration: Math.max(1, ms), easing: "ease-out", fill: "forwards" });
    setTimeout(function () { r.remove(); }, ms + 50);
  }

  /** Funken in alle Richtungen (bei Regenbogen bunt). */
  function funken(p, anzahl, bunt, ms) {
    for (let i = 0; i < anzahl; i++) {
      const winkel = (Math.PI * 2 * i) / anzahl + Math.random() * 0.4;
      const weite = 40 + Math.random() * 50;
      const f = element("fx-funke" + (bunt ? " fx-funke--bunt" : ""), p);
      if (bunt) f.style.setProperty("--funke-farbe", "hsl(" + Math.round((360 * i) / anzahl) + ", 95%, 60%)");
      f.querySelector(".fx-inhalt").animate([
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: "translate(" + Math.cos(winkel) * weite + "px, " + Math.sin(winkel) * weite + "px) scale(0.3)", opacity: 0 },
      ], { duration: Math.max(1, ms * (0.8 + Math.random() * 0.5)), easing: "ease-out", fill: "forwards" });
      setTimeout(function () { f.remove(); }, ms * 1.4 + 50);
    }
  }

  /** Leuchtspur: Punkte entlang des Wegs, die nacheinander aufleuchten und verblassen. */
  function leuchtspur(a, b, ms, stufe) {
    const anzahl = 7;
    for (let i = 1; i <= anzahl; i++) {
      const t = i / (anzahl + 1);
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const punkt = element("fx-spur", p);
      punkt.dataset.stufe = stufe.id;
      punkt.querySelector(".fx-inhalt").animate([
        { opacity: 0, transform: "scale(1)" },
        { opacity: 0.85, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.4)" },
      ], { duration: Math.max(1, ms * 1.4), delay: ms * t, fill: "both" });
      setTimeout(function () { punkt.remove(); }, ms * 2.6 + 50);
    }
  }


  /* ------------------------------------------------------------------------
     DAS SCHWERT
     ------------------------------------------------------------------------ */

  /** Leuchten am Schwert des Helden (Ebene im Bild des Helden, siehe CSS). */
  function schwertGlut(held) {
    let glut = held.querySelector(".schwert-glut");
    if (!glut) {
      glut = document.createElement("span");
      glut.className = "schwert-glut";
      glut.setAttribute("aria-hidden", "true");
      // Vier Farbschichten: Bei "Regenbogen" blenden sie nacheinander über (nur opacity)
      glut.innerHTML = '<span class="glut-schicht glut-1"></span><span class="glut-schicht glut-2"></span>' +
        '<span class="glut-schicht glut-3"></span><span class="glut-schicht glut-4"></span>';
      held.appendChild(glut);
    }
    return glut;
  }

  function schwertLeuchten(held, stufe) {
    const glut = schwertGlut(held);
    glut.dataset.stufe = stufe.id;
    glut.classList.add("an");
  }

  function schwertAus(held) {
    const glut = held.querySelector(".schwert-glut");
    if (glut) glut.classList.remove("an");
  }


  /* ------------------------------------------------------------------------
     DER ABLAUF
     u (Umgebung, von sudoku-battle-ui.js):
       start, daneben, schwert, boss – Punkte { x, y } auf der Seite
       quelle(name)  – Punkt, von dem ein Bonus kommt (oder null → Würfel)
       held          – Element des Helden (für das Leuchten)
       warte(ms)     – Wartezeit, die beim Überspringen sofort endet
       pause(ms)     – wie warte, aber auch bei "Bewegung reduzieren"
       eilig()       – true, wenn übersprungen werden soll
       faktor        – Tempo (1 = Normal, kleiner = schneller)
       reduziert     – "Bewegung reduzieren": nichts fliegt
       beimSchritt(i, wert) – nach jedem Einschlag (für "Letzter Treffer")
     ------------------------------------------------------------------------ */

  /**
   * Schritte 1–4 und das Aufladen des Schwerts.
   * @returns {Promise<object>} – die Leuchtstufe, wenn das Schwert leuchtet
   */
  function aufbau(e, u) {
    const stufe = stufeFuer(e.schaden);
    const schritte = schritteAus(e);
    if (u.eilig()) return Promise.resolve(stufe);
    const t = zeitenMal(u.faktor);
    const zahl = element("fx-zahl", u.reduziert ? u.daneben : u.start, '<span class="fx-wert"></span>');
    zeigeWert(zahl, startwert(e));

    // "Bewegung reduzieren": nichts fliegt – die Zahl zählt an Ort und Stelle
    if (u.reduziert) {
      let kette = Promise.resolve();
      schritte.forEach(function (s, i) {
        kette = kette.then(function () { return u.pause(t.reduziertSchritt); }).then(function () {
          zeigeWert(zahl, s.wert);
          u.beimSchritt(s.zeile, s.wert);
        });
      });
      return kette.then(function () { return u.pause(t.reduziertSchritt); }).then(function () {
        zahl.remove();
        schwertLeuchten(u.held, stufe);
        return u.pause(t.aufladen * 2);
      }).then(function () { return stufe; });
    }

    let wert = startwert(e);
    let index = 0;
    // 1. Ablösen: die Zahl springt vom Würfel und steht groß daneben
    fliege(zahl, u.start, u.daneben, t.abloesen, "cubic-bezier(0.2, 0.9, 0.3, 1.3)");
    let kette = u.warte(t.abloesen);

    // Kritischer Treffer: verdreifacht sich mit einem Aufplatzen – vor allen anderen
    if (schritte[0] && schritte[0].art === "krit") {
      const krit = schritte[0];
      index = 1;
      kette = kette.then(function () {
        if (u.eilig()) return null;
        zahl.classList.add("ist-krit");
        ring(u.daneben, "fx-ring--krit", t.krit * 1.6, 2.2);
        huepfe(zahl, krit.wert, t.krit);
        return zaehle(zahl, wert, krit.wert, t.krit * 0.7, u);
      }).then(function () {
        wert = krit.wert;
        u.beimSchritt(krit.zeile, wert);
        return u.warte(t.krit * 0.3);
      });
    }

    // 2./3. Die Boni: Die Etiketten starten gestaffelt und schlagen nacheinander
    //       ein – je mehr Boni, desto dichter folgen sie (statt länger zu dauern)
    const boni = schritte.slice(index);
    kette = kette.then(function () {
      if (u.eilig() || boni.length === 0) return null;
      const budget = t.etiketten - (stufe.id === "regenbogen" ? t.regenbogenAbzug : 0);
      const flug = Math.min(t.etikettFlug, budget);
      const abstand = boni.length > 1
        ? Math.min(t.etikettAbstandMax, Math.max(0, budget - flug) / (boni.length - 1))
        : t.etikettAbstandMax * 0.6;
      let folge = Promise.resolve();
      boni.forEach(function (s, i) {
        // Flug startet nach i × abstand …
        const angekommen = u.warte(i * abstand).then(function () {
          if (u.eilig()) return null;
          const von = u.quelle(s.quelle, s) || u.start;
          const etikett = element("fx-etikett fx-etikett--" + s.quelle, von, "<span>" + s.label + "</span>");
          etikett.querySelector(".fx-inhalt").animate([
            { transform: "scale(0.6)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 },
          ], { duration: Math.max(1, flug * 0.4), fill: "forwards" });
          fliege(etikett, von, u.daneben, flug, "cubic-bezier(0.5, 0, 0.75, 0.6)");
          return u.warte(flug).then(function () { etikett.remove(); });
        });
        // … und die Einschläge kommen streng nacheinander
        folge = folge.then(function () { return angekommen; }).then(function () {
          if (u.eilig()) return null;
          huepfe(zahl, s.wert, Math.max(120 * u.faktor, abstand));
          ring(u.daneben, "fx-ring--" + stufeFuer(s.wert).id, Math.max(160 * u.faktor, abstand * 1.5), 0.8);
          return zaehle(zahl, wert, s.wert, abstand * 0.8, u);
        }).then(function () {
          wert = s.wert;
          u.beimSchritt(s.zeile, wert);
        });
      });
      return folge.then(function () { return u.warte(Math.min(120, abstand)); });
    });

    // 4. Die Summe fliegt mit Leuchtspur ins Schwert und geht darin auf
    return kette.then(function () {
      if (u.eilig()) return null;
      zeigeWert(zahl, e.schaden);
      leuchtspur(u.daneben, u.schwert, t.zumSchwert, stufe);
      fliege(zahl, u.daneben, u.schwert, t.zumSchwert, "cubic-bezier(0.55, 0, 0.9, 0.5)");
      zahl.querySelector(".fx-inhalt").animate([
        { transform: "scale(1)", opacity: 1 }, { transform: "scale(1)", opacity: 1, offset: 0.7 },
        { transform: "scale(0.2)", opacity: 0 },
      ], { duration: Math.max(1, t.zumSchwert), fill: "forwards" });
      return u.warte(t.zumSchwert);
    }).then(function () {
      zahl.remove();
      if (u.eilig()) return null;
      // 5. Das Schwert leuchtet auf – bei Regenbogen länger
      schwertLeuchten(u.held, stufe);
      ring(u.schwert, "fx-ring--" + stufe.id, t.aufladen * 2, 0.9);
      return u.warte(stufe.id === "regenbogen" ? t.aufladenRegenbogen : t.aufladen);
    }).then(function () { return stufe; });
  }

  /**
   * Das Leuchten entlädt sich im Boss: Einschlag in der Farbe der Stufe,
   * ab "glut" mit Funken (bei Regenbogen bunt).
   */
  function entladen(stufe, u) {
    if (u.eilig() || u.reduziert) return Promise.resolve();
    const t = zeitenMal(u.faktor);
    ring(u.boss, "fx-ring--" + stufe.id, t.entladen * 1.6, 1 + stufe.nummer * 0.45);
    if (stufe.funken > 0) funken(u.boss, stufe.funken, stufe.id === "regenbogen", t.entladen * 2);
    return u.warte(t.entladen);
  }

  /**
   * Kein Aufbau: Bei einem Fehlschlag zerfällt die Zahl, bei einem immunen
   * oder geblockten Wurf prallt sie am Boss ab. Das Schwert bleibt dunkel.
   * @param {string} art – "zerfallen" oder "abprallen"
   */
  function abprallen(e, u, art) {
    if (u.eilig()) return Promise.resolve();
    const t = zeitenMal(u.faktor);
    const zahl = element("fx-zahl fx-zahl--" + art, u.reduziert ? u.daneben : u.start, '<span class="fx-wert"></span>');
    zeigeWert(zahl, e.wurf);
    zahl.dataset.stufe = "aus";
    if (u.reduziert) {
      return u.pause(t.abprallen).then(function () { zahl.remove(); });
    }
    fliege(zahl, u.start, u.daneben, t.abloesen, "cubic-bezier(0.2, 0.9, 0.3, 1.3)");
    return u.warte(t.abloesen).then(function () {
      if (u.eilig()) return null;
      const mitte = zahl.querySelector(".fx-inhalt");
      if (art === "zerfallen") {
        // Zerfällt in Bröckchen, die nach unten fallen
        for (let i = 0; i < 6; i++) {
          const b = element("fx-broeckchen", { x: u.daneben.x + (i - 2.5) * 6, y: u.daneben.y });
          b.querySelector(".fx-inhalt").animate([
            { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
            { transform: "translate(" + ((i - 2.5) * 8) + "px, " + (40 + Math.random() * 30) + "px) rotate(" + (i * 60) + "deg)", opacity: 0 },
          ], { duration: Math.max(1, t.abprallen), easing: "ease-in", fill: "forwards" });
          setTimeout(function () { b.remove(); }, t.abprallen + 50);
        }
        mitte.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.6) translateY(12px)" }],
          { duration: Math.max(1, t.abprallen * 0.5), fill: "forwards" });
      } else {
        // Fliegt Richtung Boss, prallt ab und trudelt weg
        const halb = { x: u.daneben.x + (u.boss.x - u.daneben.x) * 0.6, y: u.daneben.y + (u.boss.y - u.daneben.y) * 0.6 };
        const zurueck = { x: halb.x + (u.daneben.x - halb.x) * 0.5, y: halb.y + 30 };
        zahl.style.transform = verschiebung(zurueck);
        zahl.animate([
          { transform: verschiebung(u.daneben) },
          { transform: verschiebung(halb), offset: 0.45 },
          { transform: verschiebung(zurueck) },
        ], { duration: Math.max(1, t.abprallen), easing: "ease-out" });
        ring(halb, "fx-ring--abprall", t.abprallen * 0.6, 1.2);
        mitte.animate([
          { opacity: 1, transform: "rotate(0deg)" }, { opacity: 1, transform: "rotate(0deg)", offset: 0.45 },
          { opacity: 0, transform: "rotate(-70deg)" },
        ], { duration: Math.max(1, t.abprallen), fill: "forwards" });
      }
      return u.warte(t.abprallen);
    }).then(function () { zahl.remove(); });
  }

  /* ------------------------------------------------------------------------
     REGENBOGENSCHLAG (Regenbogenfeld) – einzelne Bausteine, den Ablauf
     steuert sudoku-battle-ui.js
     ------------------------------------------------------------------------ */

  /** Das Feld zerspringt in buntes Licht: bunte Funken und ein Regenbogenring. */
  function zerspringen(p, ms) {
    ring(p, "fx-ring--regenbogen", ms * 1.2, 1.4);
    funken(p, K.regenbogenSchlag.funkenFeld, true, ms);
  }

  /**
   * Regenbogenstrahl von a nach b: ein bunter Lichtstreifen, der sich vom
   * Feld bis zum Schwert ausdehnt und dann verblasst (nur transform/opacity).
   */
  function regenbogenStrahl(a, b, ms) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const laenge = Math.sqrt(dx * dx + dy * dy);
    const winkel = Math.atan2(dy, dx) * 180 / Math.PI;
    const strahl = element("fx-strahl", a, '<span class="fx-strahl-licht"></span>');
    const innen = strahl.querySelector(".fx-inhalt");
    // fx-strahl beginnt am Punkt a (nicht zentriert) und zeigt Richtung b
    strahl.querySelector(".fx-mitte").style.transform = "rotate(" + winkel + "deg)";
    innen.style.width = laenge + "px";
    innen.animate([
      { transform: "scaleX(0)", opacity: 1 },
      { transform: "scaleX(1)", opacity: 1, offset: 0.55 },
      { transform: "scaleX(1)", opacity: 0 },
    ], { duration: Math.max(1, ms), easing: "ease-out", fill: "forwards" });
    leuchtspur(a, b, ms * 0.6, stufeFuer(Infinity));
    setTimeout(function () { strahl.remove(); }, ms + 50);
  }

  /**
   * Buchschlag: eine leuchtende Kopie der Ziffer fliegt von ihrem Feld zum
   * Schwert und verschwindet dort (nur transform/opacity).
   */
  function zifferFlug(von, nach, ziffer, ms) {
    const z = element("fx-buchziffer", von, '<span class="fx-buchziffer-wert"></span>');
    z.querySelector(".fx-buchziffer-wert").textContent = ziffer;
    fliege(z, von, nach, ms, "cubic-bezier(0.45, 0, 0.7, 0.4)");
    z.querySelector(".fx-inhalt").animate([
      { transform: "scale(1.3)", opacity: 1 },
      { transform: "scale(1)", opacity: 1, offset: 0.75 },
      { transform: "scale(0.3)", opacity: 0 },
    ], { duration: Math.max(1, ms), fill: "forwards" });
    setTimeout(function () { z.remove(); }, ms + 50);
  }

  /** Der ganze Bildschirm blitzt in Regenbogenfarben auf. */
  function bildschirmBlitz(ms) {
    const blitz = document.createElement("div");
    blitz.className = "fx-bildschirm-blitz";
    ebeneHolen().appendChild(blitz);
    blitz.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.15 }, { opacity: 0 }],
      { duration: Math.max(1, ms), easing: "ease-out", fill: "forwards" });
    setTimeout(function () { blitz.remove(); }, ms + 50);
  }

  /** Der Boss zerfällt in bunte Funken (viele, weit gestreut). */
  function aufloesen(p, ms) {
    ring(p, "fx-ring--regenbogen", ms * 0.6, 3);
    funken(p, K.regenbogenSchlag.funkenBoss, true, ms * 0.7);
    setTimeout(function () { funken(p, Math.round(K.regenbogenSchlag.funkenBoss / 2), true, ms * 0.5); }, ms * 0.3);
  }

  return {
    KONFIG: K,
    zerspringen: zerspringen,
    regenbogenStrahl: regenbogenStrahl,
    bildschirmBlitz: bildschirmBlitz,
    zifferFlug: zifferFlug,
    aufloesen: aufloesen,
    stufeFuer: stufeFuer,
    schritteAus: schritteAus,
    aufbau: aufbau,
    entladen: entladen,
    abprallen: abprallen,
    schwertLeuchten: schwertLeuchten,
    schwertAus: schwertAus,
    aufraeumen: aufraeumen,
  };
})();
