/* ==========================================================================
   extra/duel.js – Duell (Darstellung, Steuerung, eigene Ansicht)
   Wird erst bei Bedarf nachgeladen. Lädt selbst die Regeln
   (js/extra/duel-regeln.js) und das Aussehen (css/extra/duel.css), legt
   seine Ansicht an und meldet sie bei app.js an.
   ========================================================================== */

(function () {
  if (window.NtbZusatz) {
    window.NtbZusatz.oeffne();
    return;
  }

  const NAME = "x7";
  const ZURUECK = "#games/sudoku/frei";
  const W = 960, H = 540, BODEN = 440;          // Bühne in logischen Pixeln
  const DT = 1 / 120;                            // fester Zeitschritt

  let bereit = false, offenGewuenscht = true;
  let kamVomSudoku = false;

  window.NtbZusatz = {
    oeffne: function () {
      if (!bereit) { offenGewuenscht = true; return; }
      kamVomSudoku = /^#games\/sudoku/.test(location.hash);
      location.hash = "#" + NAME;
    },
  };

  function ladeSkript(src) {
    return new Promise(function (ok, fehler) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = fehler;
      document.body.appendChild(s);
    });
  }

  function ladeStil(href) {
    return new Promise(function (ok) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.onload = ok;
      l.onerror = ok;
      document.head.appendChild(l);
    });
  }

  Promise.all([ladeSkript("js/extra/duel-regeln.js"), ladeStil("css/extra/duel.css")]).then(function () {
    const section = document.createElement("section");
    section.className = "ansicht";
    section.id = "view-" + NAME;
    section.setAttribute("aria-labelledby", "titel-" + NAME);
    section.hidden = true;
    section.innerHTML = '<h1 id="titel-' + NAME + '" class="nur-screenreader" tabindex="-1">Duell</h1><div id="' + NAME + '-root"></div>';
    document.getElementById("main").appendChild(section);
    ansichtAnmelden(NAME, { init: init, zeige: zeige, root: NAME + "-root" });
    bereit = true;
    if (offenGewuenscht) window.NtbZusatz.oeffne();
  });


  /* ------------------------------------------------------------------------
     Ansicht
     ------------------------------------------------------------------------ */

  const R = () => DuellRegeln;
  const el = {};
  let spiel = null;
  let modus = "cpu";                 // "cpu" oder "zwei"
  let laeuft = false, zuletzt = 0, rest = 0;
  let effekte = [];
  let farben = {};
  let endeGezeigt = false;
  const gedrueckt = { gruen: {}, blau: {} };
  const grob = window.matchMedia("(pointer: coarse)");

  const TASTEN = {
    KeyA: ["gruen", "links"], KeyD: ["gruen", "rechts"], KeyW: ["gruen", "springen"],
    KeyS: ["gruen", "ducken"], KeyF: ["gruen", "angriff"],
    ArrowLeft: ["blau", "links"], ArrowRight: ["blau", "rechts"], ArrowUp: ["blau", "springen"],
    ArrowDown: ["blau", "ducken"], KeyL: ["blau", "angriff"],
  };
  const AUSRUFE = ["Zack!", "Bonk!", "Pow!", "Autsch!", "Plopp!"];

  function init(container) {
    container.innerHTML =
      '<div class="dl">' +
        '<div class="dl-buehne">' +
          '<canvas class="dl-canvas" tabindex="-1" aria-label="Spielfeld"></canvas>' +
          '<div class="dl-schirm" data-schirm="menue">' +
            '<h2 class="dl-titel">Strich-Duell</h2>' +
            '<div class="dl-knoepfe">' +
              '<button type="button" class="knopf knopf--haupt" data-aktion="cpu">Gegen den Computer</button>' +
              '<button type="button" class="knopf dl-nur-tastatur" data-aktion="zwei">Zu zweit</button>' +
            "</div>" +
            '<p class="dl-hilfe dl-nur-tastatur"><span class="dl-gruen">Grün</span> A D laufen · W springen · S ducken · F Stoß<br>' +
              '<span class="dl-blau">Blau</span> ← → laufen · ↑ springen · ↓ ducken · L Stoß</p>' +
            '<button type="button" class="dl-link" data-aktion="zurueck">Zurück zum Sudoku</button>' +
          "</div>" +
          '<div class="dl-schirm" data-schirm="ende" hidden>' +
            '<h2 class="dl-titel dl-ergebnis"></h2>' +
            '<p class="dl-stand"></p>' +
            '<div class="dl-knoepfe">' +
              '<button type="button" class="knopf knopf--haupt" data-aktion="revanche">Revanche</button>' +
              '<button type="button" class="knopf" data-aktion="zurueck">Zurück zum Sudoku</button>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="dl-touch" hidden>' +
          '<div class="dl-touch-gruppe">' +
            '<button type="button" class="dl-taste" data-taste="links" aria-label="Links">◀</button>' +
            '<button type="button" class="dl-taste" data-taste="rechts" aria-label="Rechts">▶</button>' +
          "</div>" +
          '<div class="dl-touch-gruppe">' +
            '<button type="button" class="dl-taste" data-taste="ducken" aria-label="Ducken">▼</button>' +
            '<button type="button" class="dl-taste" data-taste="springen" aria-label="Springen">▲</button>' +
            '<button type="button" class="dl-taste dl-taste--stoss" data-taste="angriff">Stoß</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    el.ansicht = document.getElementById("view-" + NAME);
    el.wurzel = container.querySelector(".dl");
    el.canvas = container.querySelector(".dl-canvas");
    el.ctx = el.canvas.getContext("2d");
    el.menue = container.querySelector('[data-schirm="menue"]');
    el.ende = container.querySelector('[data-schirm="ende"]');
    el.ergebnis = container.querySelector(".dl-ergebnis");
    el.stand = container.querySelector(".dl-stand");
    el.touch = container.querySelector(".dl-touch");

    container.addEventListener("click", function (event) {
      const k = event.target.closest("[data-aktion]");
      if (!k) return;
      const a = k.dataset.aktion;
      if (a === "cpu" || a === "zwei") starte(a);
      else if (a === "revanche") starte(modus);
      else if (a === "zurueck") zurueck();
    });

    // Bildschirmknöpfe: gedrückt halten
    el.touch.addEventListener("pointerdown", function (event) {
      const t = event.target.closest("[data-taste]");
      if (!t) return;
      event.preventDefault();
      t.setPointerCapture(event.pointerId);
      gedrueckt.gruen[t.dataset.taste] = true;
      t.classList.add("ist-gedrueckt");
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (art) {
      el.touch.addEventListener(art, function (event) {
        const t = event.target.closest("[data-taste]");
        if (!t) return;
        gedrueckt.gruen[t.dataset.taste] = false;
        t.classList.remove("ist-gedrueckt");
      });
    });
    el.touch.addEventListener("contextmenu", function (event) { event.preventDefault(); });

    document.addEventListener("keydown", tasteRunter);
    document.addEventListener("keyup", tasteHoch);
    window.addEventListener("blur", allesLoslassen);

    new ResizeObserver(groesseAnpassen).observe(el.canvas);
    new MutationObserver(leseFarben).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function zeige() {
    leseFarben();
    groesseAnpassen();
    if (!spiel) spiel = R().erstelle();
    zeigeSchirm("menue");
    starteSchleife();
    return el.menue.querySelector("button");
  }

  function zeigeSchirm(welcher) {
    el.menue.hidden = welcher !== "menue";
    el.ende.hidden = welcher !== "ende";
    el.wurzel.classList.toggle("dl--zwei", modus === "zwei");
    el.touch.hidden = !(grob.matches && welcher === null && modus === "cpu");
  }

  function starte(neuerModus) {
    modus = neuerModus;
    spiel = R().erstelle();
    effekte = [];
    endeGezeigt = false;
    allesLoslassen();
    zeigeSchirm(null);
    el.canvas.focus({ preventScroll: true });
  }

  function zurueck() {
    allesLoslassen();
    if (kamVomSudoku) {
      kamVomSudoku = false;
      history.back();
    } else {
      location.hash = ZURUECK;
    }
  }

  function sichtbar() {
    return el.ansicht && !el.ansicht.hidden;
  }

  function tasteRunter(event) {
    if (!sichtbar() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      zurueck();
      return;
    }
    const z = TASTEN[event.code];
    if (!z || !el.menue.hidden || !el.ende.hidden) return;
    event.preventDefault();
    // Gegen den Computer steuern beide Tastenbelegungen Grün
    gedrueckt[modus === "cpu" ? "gruen" : z[0]][z[1]] = true;
  }

  function tasteHoch(event) {
    const z = TASTEN[event.code];
    if (!z) return;
    gedrueckt[modus === "cpu" ? "gruen" : z[0]][z[1]] = false;
  }

  function allesLoslassen() {
    gedrueckt.gruen = {};
    gedrueckt.blau = {};
    if (el.touch) el.touch.querySelectorAll(".ist-gedrueckt").forEach(function (t) { t.classList.remove("ist-gedrueckt"); });
  }


  /* ------------------------------------------------------------------------
     Spielschleife
     ------------------------------------------------------------------------ */

  function starteSchleife() {
    if (laeuft) return;
    laeuft = true;
    zuletzt = performance.now();
    requestAnimationFrame(bild);
  }

  function bild(jetzt) {
    if (!sichtbar()) {
      laeuft = false;
      allesLoslassen();
      return;
    }
    rest += Math.min(0.1, (jetzt - zuletzt) / 1000);
    zuletzt = jetzt;
    const imSpiel = el.menue.hidden && el.ende.hidden;
    while (rest >= DT) {
      rest -= DT;
      if (imSpiel) {
        const eingaben = {
          gruen: gedrueckt.gruen,
          blau: modus === "cpu" ? R().ki(spiel, "blau", DT) : gedrueckt.blau,
        };
        spiel.schritt(DT, eingaben);
        spiel.zustand.ereignisse.forEach(neuerEffekt);
      }
      effekte.forEach(function (e) { e.t += DT; });
    }
    effekte = effekte.filter(function (e) { return e.t < e.dauer; });
    if (imSpiel && spiel.zustand.phase === "ende" && spiel.zustand.zeit > 0.4 && !endeGezeigt) zeigeErgebnis();
    zeichne();
    requestAnimationFrame(bild);
  }

  function neuerEffekt(e) {
    if (e.art === "treffer") {
      effekte.push({ art: "treffer", x: e.x, y: e.y, t: 0, dauer: 0.55, text: AUSRUFE[Math.floor(Math.random() * AUSRUFE.length)] });
    } else if (e.art === "prall") {
      effekte.push({ art: "prall", x: e.x, y: e.y, t: 0, dauer: 0.45, text: "Klonk!" });
    }
  }

  function zeigeErgebnis() {
    endeGezeigt = true;
    allesLoslassen();
    const z = spiel.zustand;
    const gruenSiegt = z.sieger === "gruen";
    el.ergebnis.textContent = modus === "cpu"
      ? (gruenSiegt ? "Du gewinnst!" : "Der Computer gewinnt!")
      : (gruenSiegt ? "Grün gewinnt!" : "Blau gewinnt!");
    el.ergebnis.dataset.sieger = z.sieger;
    el.stand.textContent = z.gruen.siege + " : " + z.blau.siege;
    zeigeSchirm("ende");
    el.ende.querySelector("button").focus({ preventScroll: true });
  }


  /* ------------------------------------------------------------------------
     Zeichnen
     ------------------------------------------------------------------------ */

  function leseFarben() {
    if (!el.wurzel) return;
    const s = getComputedStyle(el.wurzel);
    ["gruen", "blau", "grund", "linie", "text", "leise", "stern"].forEach(function (n) {
      farben[n] = s.getPropertyValue("--dl-" + n).trim();
    });
  }

  function groesseAnpassen() {
    const breite = el.canvas.clientWidth;
    if (!breite) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(breite * dpr);
    el.canvas.height = Math.round(breite * H / W * dpr);
  }

  function zeichne() {
    const c = el.ctx;
    const z = spiel.zustand;
    c.setTransform(el.canvas.width / W, 0, 0, el.canvas.height / H, 0, 0);
    c.fillStyle = farben.grund;
    c.fillRect(0, 0, W, H);

    // Boden
    c.strokeStyle = farben.linie;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(20, BODEN);
    c.lineTo(W - 20, BODEN);
    c.stroke();

    schatten(c, z.gruen);
    schatten(c, z.blau);
    figur(c, z.gruen, farben.gruen, z.uhr);
    figur(c, z.blau, farben.blau, z.uhr);
    effekte.forEach(function (e) { effekt(c, e); });
    anzeige(c, z);
  }

  function schatten(c, f) {
    const s = Math.max(0.35, 1 - f.y / 300);
    c.fillStyle = farben.leise;
    c.globalAlpha = 0.25 * s;
    c.beginPath();
    c.ellipse(f.x, BODEN + 4, 26 * s, 5 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  /** Ein Strichmännchen mit seinem Stab. Ursprung: Hüfte. */
  function figur(c, f, farbe, uhr) {
    const K = R().K;
    const b = f.blick;
    const amBoden = f.y <= 0.5;
    const geduckt = f.geduckt && amBoden;
    const huefte = geduckt ? K.huefteGeduckt : K.huefte;
    const laeufst = amBoden && !geduckt && Math.abs(f.vx) > 10 && f.starre <= 0 && !f.ko;
    // Wackeln beim Laufen, leichtes Atmen im Stand
    const wackel = laeufst ? Math.sin(f.laufPhase) * 0.2 : Math.sin(uhr * 2.4) * 0.03;
    const e = spiel.ausfahrt(f);

    c.save();
    c.translate(f.x, BODEN - f.y - huefte);
    c.rotate(f.drehung * b);
    c.strokeStyle = farbe;
    c.fillStyle = farbe;
    c.lineWidth = 5;
    c.lineCap = "round";
    c.lineJoin = "round";

    // Beine
    let fuesse;
    if (geduckt) fuesse = [[b * 16, 14, b * 8, huefte], [-b * 10, 12, -b * 14, huefte]];
    else if (!amBoden) fuesse = [[b * 12, 22, b * 4, 40], [-b * 8, 24, -b * 14, 38]];
    else {
      const schwung = laeufst ? Math.sin(f.laufPhase) * 16 : 0;
      fuesse = [[schwung * 0.5 + 4, huefte / 2, schwung + 10, huefte], [-schwung * 0.5 - 4, huefte / 2, -schwung - 10, huefte]];
    }
    fuesse.forEach(function (p) {
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(p[0], p[1]);
      c.lineTo(p[2], p[3]);
      c.stroke();
    });

    // Rumpf, Kopf (geduckt nach vorn gebeugt)
    c.save();
    c.rotate(wackel + (geduckt ? b * 0.55 : 0));
    const hals = geduckt ? -30 : -40;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, hals);
    c.stroke();
    c.beginPath();
    c.arc(0, hals - 13, 11, 0, Math.PI * 2);
    c.stroke();
    // Arme zum Griff an der Hüfte
    const schulter = hals + 6;
    c.beginPath();
    c.moveTo(0, schulter);
    c.lineTo(-b * 6, schulter + 16);
    c.lineTo(b * 6, -2);
    c.moveTo(0, schulter);
    c.lineTo(b * 10, schulter + 14);
    c.lineTo(b * 6, -2);
    c.stroke();
    c.restore();

    // Der Stab: waagerecht auf Hüfthöhe
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(b * K.griff, 0);
    c.lineTo(b * (K.griff + K.stab + e * K.stoss.weite), 0);
    c.stroke();
    c.restore();

    // K.o.: Sternchen kreisen über dem Kopf
    if (f.ko && amBoden) {
      const kx = f.x + (f.drehung > 0 ? 1 : -1) * b * 52, ky = BODEN - 12;
      for (let i = 0; i < 3; i++) {
        const w = uhr * 4 + i * Math.PI * 2 / 3;
        stern(c, kx + Math.cos(w) * 22, ky - 18 + Math.sin(w) * 7, 6, farben.stern);
      }
    }
  }

  function stern(c, x, y, r, farbe) {
    c.fillStyle = farbe;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const w = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr);
    }
    c.closePath();
    c.fill();
  }

  function effekt(c, e) {
    const a = 1 - e.t / e.dauer;
    const x = e.x, y = BODEN - e.y;
    c.globalAlpha = Math.max(0, a);
    c.strokeStyle = farben.stern;
    c.lineWidth = 3;
    const r = 14 + e.t * 90;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const w = i * Math.PI / 4 + (e.art === "prall" ? 0.3 : 0);
      c.moveTo(x + Math.cos(w) * r * 0.5, y + Math.sin(w) * r * 0.5);
      c.lineTo(x + Math.cos(w) * r, y + Math.sin(w) * r);
    }
    c.stroke();
    c.fillStyle = farben.text;
    c.font = "700 " + (26 + e.t * 20) + "px " + getComputedStyle(document.body).fontFamily;
    c.textAlign = "center";
    c.fillText(e.text, x, y - 40 - e.t * 40);
    c.globalAlpha = 1;
  }

  function anzeige(c, z) {
    const K = R().K;
    const schrift = getComputedStyle(document.body).fontFamily;
    // Auf kleinen Bildschirmen wird die ganze Bühne verkleinert – die Anzeige
    // oben wächst dann mit, damit sie lesbar bleibt
    const g = Math.min(2.4, Math.max(1, 640 / (el.canvas.clientWidth || W)));
    [["gruen", 30, 1], ["blau", W - 30, -1]].forEach(function (s) {
      const f = z[s[0]], x = s[1], r = s[2];
      const breite = g > 1.5 ? 330 : 360, hoehe = 18 * g, oben = 22;
      const links = r === 1 ? x : x - breite;
      c.fillStyle = farben.leise;
      c.globalAlpha = 0.18;
      c.fillRect(links, oben, breite, hoehe);
      c.globalAlpha = 1;
      c.fillStyle = farben[s[0]];
      const voll = breite * f.leben / K.leben;
      c.fillRect(r === 1 ? links : links + breite - voll, oben, voll, hoehe);
      c.strokeStyle = farben.linie;
      c.lineWidth = 2;
      c.strokeRect(links, oben, breite, hoehe);
      // Name und gewonnene Runden
      c.fillStyle = farben.text;
      c.font = "600 " + 18 * g + "px " + schrift;
      c.textAlign = r === 1 ? "left" : "right";
      const name = modus === "cpu" ? (s[0] === "gruen" ? "Du" : "Computer") : (s[0] === "gruen" ? "Grün" : "Blau");
      const zeile = oben + hoehe + 22 * g;
      c.fillText(name, x, zeile);
      // Gewonnene Runden: Kreise direkt hinter dem Namen
      const nachName = c.measureText(name).width + 14 * g;
      for (let i = 0; i < K.siegeNoetig; i++) {
        const px = x + r * (nachName + 7 * g + i * 20 * g);
        c.beginPath();
        c.arc(px, zeile - 6 * g, 7 * g, 0, Math.PI * 2);
        c.strokeStyle = farben[s[0]];
        c.stroke();
        if (i < f.siege) { c.fillStyle = farben[s[0]]; c.fill(); }
      }
    });

    c.textAlign = "center";
    c.fillStyle = farben.text;
    c.font = "600 " + 18 * g + "px " + schrift;
    c.fillText("Runde " + z.runde, W / 2, 22 + 15 * g);

    let gross = "";
    if (z.phase === "start") gross = z.zeit < 0.7 ? "Runde " + z.runde : "Los!";
    if (z.phase === "rundeEnde") {
      gross = z.zeit < 0.9 ? "K.o.!" : z.rundenSieger ? rundenText(z.rundenSieger) : "Unentschieden";
    }
    if (gross && el.menue.hidden && el.ende.hidden) {
      let groesse = (gross.length > 8 ? 40 : 64) * Math.min(g, 1.6);
      c.font = "700 " + groesse + "px " + schrift;
      const zuBreit = c.measureText(gross).width / (W - 80);
      if (zuBreit > 1) {
        groesse /= zuBreit;
        c.font = "700 " + groesse + "px " + schrift;
      }
      c.fillText(gross, W / 2, 210);
    }
  }

  function rundenText(id) {
    if (modus === "cpu") return id === "gruen" ? "Du gewinnst die Runde" : "Der Computer gewinnt die Runde";
    return (id === "gruen" ? "Grün" : "Blau") + " gewinnt die Runde";
  }
})();
