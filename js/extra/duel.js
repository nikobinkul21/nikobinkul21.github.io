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
  let auswahlGezeigt = null;         // die Auswahl, für die die Walzen gerade laufen
  let auswahlBereit = false;         // Walzen stehen – jetzt darf gewählt werden
  const gedrueckt = { gruen: {}, blau: {} };
  // Kurze Tipper (Stoß, Sprung, Schuss) gehen nie verloren, auch wenn die
  // Taste schon vor dem nächsten Spielschritt wieder losgelassen ist
  let getippt = { gruen: {}, blau: {} };
  const TIPPER = { angriff: true, springen: true, schuss: true };
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
  const grob = window.matchMedia("(pointer: coarse)");

  const TASTEN = {
    KeyA: ["gruen", "links"], KeyD: ["gruen", "rechts"], KeyW: ["gruen", "springen"],
    KeyS: ["gruen", "ducken"], KeyF: ["gruen", "angriff"], KeyG: ["gruen", "schuss"],
    ArrowLeft: ["blau", "links"], ArrowRight: ["blau", "rechts"], ArrowUp: ["blau", "springen"],
    ArrowDown: ["blau", "ducken"], KeyL: ["blau", "angriff"], KeyK: ["blau", "schuss"],
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
            '<p class="dl-hilfe dl-nur-tastatur"><span class="dl-gruen">Grün</span> A D laufen · W springen · S ducken · F Stoß · G Schuss<br>' +
              '<span class="dl-blau">Blau</span> ← → laufen · ↑ springen · ↓ ducken · L Stoß · K Schuss</p>' +
            '<p class="dl-hilfe">Bis 5 Siege. Wer eine Runde verliert, wählt ein Power-up.</p>' +
            '<button type="button" class="dl-link" data-aktion="zurueck">Zurück zum Sudoku</button>' +
          "</div>" +
          '<div class="dl-schirm dl-auswahl" data-schirm="auswahl" hidden>' +
            '<h2 class="dl-auswahl-titel"></h2>' +
            '<div class="dl-slots"></div>' +
            '<p class="dl-hilfe dl-auswahl-hilfe"></p>' +
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
            '<button type="button" class="dl-taste dl-taste--schuss" data-taste="schuss" hidden>Schuss</button>' +
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
    el.auswahl = container.querySelector('[data-schirm="auswahl"]');
    el.auswahlTitel = container.querySelector(".dl-auswahl-titel");
    el.auswahlHilfe = container.querySelector(".dl-auswahl-hilfe");
    el.slots = container.querySelector(".dl-slots");
    el.schussTaste = container.querySelector('[data-taste="schuss"]');
    el.stossTaste = container.querySelector('[data-taste="angriff"]');

    el.slots.addEventListener("click", function (event) {
      const karte = event.target.closest("[data-wahl]");
      if (karte) menschWaehlt(Number(karte.dataset.wahl));
    });

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
      if (TIPPER[t.dataset.taste]) getippt.gruen[t.dataset.taste] = true;
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
    el.auswahl.hidden = welcher !== "auswahl";
    el.wurzel.classList.toggle("dl--zwei", modus === "zwei");
    el.touch.hidden = !(grob.matches && (welcher === null || welcher === "auswahl") && modus === "cpu");
  }

  function starte(neuerModus) {
    modus = neuerModus;
    spiel = R().erstelle();
    el.wurzel.__spiel = spiel;
    effekte = [];
    endeGezeigt = false;
    auswahlGezeigt = null;
    getippt = { gruen: {}, blau: {} };
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
    // Power-up wählen: Tasten 1 bis 3
    const ziffer = /^(Digit|Numpad)([1-9])$/.exec(event.code);
    if (ziffer && !el.auswahl.hidden) {
      event.preventDefault();
      menschWaehlt(Number(ziffer[2]) - 1);
      return;
    }
    const z = TASTEN[event.code];
    if (!z || !el.menue.hidden || !el.ende.hidden) return;
    event.preventDefault();
    // Gegen den Computer steuern beide Tastenbelegungen Grün
    const wer = modus === "cpu" ? "gruen" : z[0];
    if (TIPPER[z[1]] && !event.repeat) getippt[wer][z[1]] = true;
    gedrueckt[wer][z[1]] = true;
  }

  function tasteHoch(event) {
    const z = TASTEN[event.code];
    if (!z) return;
    gedrueckt[modus === "cpu" ? "gruen" : z[0]][z[1]] = false;
  }

  function allesLoslassen() {
    gedrueckt.gruen = {};
    gedrueckt.blau = {};
    getippt = { gruen: {}, blau: {} };
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
          gruen: Object.assign({}, gedrueckt.gruen, getippt.gruen),
          blau: modus === "cpu" ? R().ki(spiel, "blau", DT) : Object.assign({}, gedrueckt.blau, getippt.blau),
        };
        getippt = { gruen: {}, blau: {} };
        spiel.schritt(DT, eingaben);
        spiel.zustand.ereignisse.forEach(neuerEffekt);
      }
      effekte.forEach(function (e) { e.t += DT; });
    }
    effekte = effekte.filter(function (e) { return e.t < e.dauer; });
    if (imSpiel && spiel.zustand.phase === "auswahl" && auswahlGezeigt !== spiel.zustand.auswahl) zeigeAuswahl();
    if (imSpiel && spiel.zustand.phase === "ende" && spiel.zustand.zeit > 0.4 && !endeGezeigt) zeigeErgebnis();
    // Schuss-Knopf erst, wenn Grün den Querschläger hat
    const kannSchiessen = Boolean(R().werte(spiel.zustand.gruen).geschoss);
    if (el.schussTaste.hidden === kannSchiessen) el.schussTaste.hidden = !kannSchiessen;
    // Als Mech wird der Stoß-Knopf zum Dauerfeuer-Knopf (gedrückt halten)
    const feuer = Boolean(spiel.zustand.gruen.mech);
    if (el.stossTaste.classList.contains("dl-taste--feuer") !== feuer) {
      el.stossTaste.classList.toggle("dl-taste--feuer", feuer);
      el.stossTaste.textContent = feuer ? "Feuer" : "Stoß";
    }
    zeichne();
    requestAnimationFrame(bild);
  }

  function neuerEffekt(e) {
    const KE = R().K.ereignis, KM = R().K.mech;
    if (e.art === "treffer" && e.klein) {
      effekte.push({ art: "funke", x: e.x, y: e.y, t: 0, dauer: 0.2, text: "" });
    } else if (e.art === "treffer") {
      effekte.push({ art: "treffer", x: e.x, y: e.y, t: 0, dauer: 0.55, text: AUSRUFE[Math.floor(Math.random() * AUSRUFE.length)] });
    } else if (e.art === "prall") {
      effekte.push({ art: "prall", x: e.x, y: e.y, t: 0, dauer: 0.45, text: "Klonk!" });
    } else if (e.art === "abpraller" || e.art === "kugelWeg") {
      effekte.push({ art: "funke", x: e.x, y: e.y, t: 0, dauer: 0.25, text: "" });
    } else if (e.art === "blasePlatzt" || e.art === "blaseWeg") {
      effekte.push({ art: "platzen", x: e.x, y: e.y, t: 0, dauer: KE.anzeige.platzen });
    } else if (e.art === "eiermann") {
      const A = KE.anzeige;
      effekte.push({ art: "eiermann", t: 0, dauer: A.einflug + KE.textDauer + A.ausblenden });
      effekte.push({ art: "blitz", t: 0, dauer: A.blitz });
      if (!ruhig.matches) effekte.push({ art: "beben", t: 0, dauer: A.beben });
    } else if (e.art === "mechSchuss") {
      effekte.push({ art: "muendung", x: e.x, y: e.y, blick: e.blick, winkel: e.winkel, t: 0, dauer: KM.anzeige.muendung, w: Math.random() * 6 });
      const f = spiel.zustand[e.wer];
      effekte.push({
        art: "huelse", x: f.x - e.blick * 8, y: e.y + 6, t: 0, dauer: KM.anzeige.huelse,
        vx: -e.blick * (90 + Math.random() * 90), vy: 260 + Math.random() * 140, dreh: (Math.random() * 2 - 1) * 24,
      });
    } else if (e.art === "druckwelle") {
      const D = KM.druckwelle;
      if (!ruhig.matches) effekte.push({ art: "beben", t: 0, dauer: D.beben, weite: D.bebenWeite });
    } else if (e.art === "mechEnde") {
      const m = R().K.hoehe * KM.groesse;
      const teile = [];
      for (let i = 0; i < KM.anzeige.teile; i++) {
        const w = Math.PI * (0.1 + 0.8 * Math.random());
        const v = 260 + Math.random() * 420;
        teile.push({
          dx: (Math.random() * 2 - 1) * 30, dy: m * (0.2 + 0.7 * Math.random()),
          vx: Math.cos(w) * v * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(w) * v,
          dreh: (Math.random() * 2 - 1) * 14, b: 8 + Math.random() * 16, h: 6 + Math.random() * 12,
          art: i === 0 ? "bart" : i < 4 ? "dunkel" : "rot",
        });
      }
      effekte.push({ art: "explosion", x: e.x, y: e.y + m / 2, boden: e.y, t: 0, dauer: KM.anzeige.explosion, teile: teile });
    }
  }


  /* ------------------------------------------------------------------------
     Auswahl nach einer Runde: drei Walzen wie am Spielautomaten
     ------------------------------------------------------------------------ */

  function spielerName(id) {
    if (modus === "cpu") return id === "gruen" ? "Du" : "Der Computer";
    return id === "gruen" ? "Grün" : "Blau";
  }

  function karteHtml(id, f, wahl) {
    const p = R().powerup(id);
    const stufe = Math.min(p.max, (f.powerups[id] || 0) + 1);
    const tag = wahl === undefined ? "div" : "button";
    return "<" + tag + ' class="dl-karte"' + (wahl === undefined ? "" : ' type="button" data-wahl="' + wahl + '" disabled') + ">" +
      '<span class="dl-karte-symbol" aria-hidden="true">' + p.symbol + "</span>" +
      '<span class="dl-karte-name">' + p.name + "</span>" +
      '<span class="dl-karte-text">' + p.beschreibung + "</span>" +
      '<span class="dl-karte-stufe">Stufe ' + stufe + " von " + p.max + "</span>" +
      (wahl === undefined ? "" : '<span class="dl-karte-taste" aria-hidden="true">' + (wahl + 1) + "</span>") +
      "</" + tag + ">";
  }

  function zeigeAuswahl() {
    const z = spiel.zustand;
    const a = z.auswahl;
    const f = z[a.wer];
    const K = R().K;
    auswahlGezeigt = a;
    auswahlBereit = false;
    const computer = modus === "cpu" && a.wer === "blau";
    el.auswahlTitel.textContent = spielerName(a.wer) + (modus === "cpu" && a.wer === "gruen" ? " wählst" : " wählt") + " ein Power-up";
    el.auswahlTitel.dataset.wer = a.wer;
    el.auswahlHilfe.textContent = computer ? "" : "Klicken, antippen oder Taste 1 bis 3";

    // Füllkarten der Walzen: alle Power-ups, die noch nicht ausgereizt sind
    const offen = K.powerups.filter(function (p) { return (f.powerups[p.id] || 0) < p.max; }).map(function (p) { return p.id; });
    el.slots.innerHTML = "";
    const stopps = a.angebote.map(function (id, i) {
      const slot = document.createElement("div");
      slot.className = "dl-slot";
      let html = "";
      for (let k = 0; k < K.auswahl.walzeKarten; k++) html += karteHtml(offen[Math.floor(Math.random() * offen.length)], f);
      html += karteHtml(id, f, i);
      slot.innerHTML = '<div class="dl-walze">' + html + "</div>";
      el.slots.appendChild(slot);
      return slot;
    });
    zeigeSchirm("auswahl");

    const walzen = stopps.map(function (slot, i) {
      const walze = slot.firstChild;
      const hoehe = walze.firstChild.offsetHeight;
      const dauer = ruhig.matches ? 150 : (K.auswahl.walzeStart + i * K.auswahl.walzeVersatz) * 1000;
      return walze.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(" + (-K.auswahl.walzeKarten * hoehe) + "px)" }],
        { duration: dauer, easing: "cubic-bezier(0.2, 0.6, 0.25, 1.06)", fill: "forwards" }
      ).finished.then(function () { slot.classList.add("steht"); });
    });
    Promise.all(walzen).then(function () {
      if (auswahlGezeigt !== a) return;
      auswahlBereit = true;
      el.slots.querySelectorAll("[data-wahl]").forEach(function (k) { k.disabled = computer; });
      if (computer) {
        const wahl = R().kiWahl(spiel);
        setTimeout(function () {
          if (auswahlGezeigt !== a) return;
          markiere(wahl);
          setTimeout(function () { nimm(wahl); }, 500);
        }, K.auswahl.kiBedenkzeit * 1000);
      } else {
        const erste = el.slots.querySelector("[data-wahl]");
        if (erste) erste.focus({ preventScroll: true });
      }
    });
  }

  function markiere(wahl) {
    const k = el.slots.querySelector('[data-wahl="' + wahl + '"]');
    if (k) k.classList.add("ist-gewaehlt");
  }

  function menschWaehlt(wahl) {
    const a = spiel.zustand.auswahl;
    if (!auswahlBereit || !a || (modus === "cpu" && a.wer === "blau") || !a.angebote[wahl]) return;
    markiere(wahl);
    auswahlBereit = false;
    setTimeout(function () { nimm(wahl); }, 260);
  }

  function nimm(wahl) {
    const a = spiel.zustand.auswahl;
    if (!a || !spiel.waehle(wahl)) return;
    auswahlGezeigt = null;
    getippt = { gruen: {}, blau: {} };
    zeigeSchirm(null);
    el.canvas.focus({ preventScroll: true });
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
    ["gruen", "blau", "grund", "linie", "text", "leise", "stern", "mech", "bart"].forEach(function (n) {
      farben[n] = s.getPropertyValue("--dl-" + n).trim();
    });
    farben.mechDunkel = s.getPropertyValue("--dl-mech-dunkel").trim();
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
    const beben = effekte.find(function (e) { return e.art === "beben"; });
    if (beben) {
      const st = (beben.weite || R().K.ereignis.anzeige.bebenWeite) * (1 - beben.t / beben.dauer);
      c.translate((Math.random() * 2 - 1) * st, (Math.random() * 2 - 1) * st);
    }

    // Boden
    c.strokeStyle = farben.linie;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(20, BODEN);
    c.lineTo(W - 20, BODEN);
    c.stroke();

    schatten(c, z.gruen);
    schatten(c, z.blau);
    ["gruen", "blau"].forEach(function (id) {
      const f = z[id];
      // Turbo: leichte Bewegungsunschärfe hinter der Figur
      const w = R().werte(f);
      if (w.tempo > R().K.tempo && Math.abs(f.vx) > R().K.tempo * 1.05 && !f.ko) {
        [0.045, 0.025].forEach(function (k, i) {
          c.globalAlpha = i ? 0.22 : 0.1;
          figur(c, Object.assign({}, f, { x: f.x - f.vx * k }), farben[id], z.uhr);
        });
        c.globalAlpha = 1;
      }
      if (f.mech) {
        mech(c, f, z.uhr);
        mechBalken(c, f);
      } else {
        figur(c, f, farben[id], z.uhr);
      }
      schussBalken(c, f, w, farben[id]);
    });
    z.wellen.forEach(function (w) { welle(c, w); });
    z.geschosse.forEach(function (k) { kugel(c, k, k.art === "mech" ? farben.mech : farben[k.von]); });
    effekte.forEach(function (e) {
      if (EFFEKTE[e.art]) EFFEKTE[e.art](c, e);
      else if (e.art !== "eiermann" && e.art !== "blitz" && e.art !== "beben") effekt(c, e);
    });
    anzeige(c, z);
    if (z.blase) blase(c, z.blase, z.uhr);
    effekte.forEach(function (e) {
      if (e.art === "blitz") {
        c.globalAlpha = 0.75 * Math.pow(1 - e.t / e.dauer, 2);
        c.fillStyle = "#fff";
        c.fillRect(-20, -20, W + 40, H + 40);
        c.globalAlpha = 1;
      } else if (e.art === "eiermann") {
        eiermannText(c, e);
      }
    });
  }

  /** Abklingzeit des Schusses: kleiner Balken unter der Figur. */
  function schussBalken(c, f, w, farbe) {
    if (!w.geschoss || f.ko) return;
    const anteil = 1 - Math.max(0, f.schussPause) / w.geschoss.abklingen;
    const breite = 40, x = f.x - breite / 2, y = BODEN + 12;
    c.globalAlpha = 0.25;
    c.fillStyle = farben.leise;
    c.fillRect(x, y, breite, 4);
    c.globalAlpha = anteil >= 1 ? 1 : 0.7;
    c.fillStyle = farbe;
    c.fillRect(x, y, breite * anteil, 4);
    c.globalAlpha = 1;
  }

  /** Kugel mit kurzer Leuchtspur. */
  function kugel(c, k, farbe) {
    c.save();
    c.lineCap = "round";
    for (let i = 1; i < k.spur.length; i++) {
      const a = k.spur[i - 1], b = k.spur[i];
      c.globalAlpha = (i / k.spur.length) * 0.55;
      c.strokeStyle = farbe;
      c.lineWidth = k.radius * 2 * (i / k.spur.length);
      c.beginPath();
      c.moveTo(a.x, BODEN - a.y);
      c.lineTo(b.x, BODEN - b.y);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.shadowColor = farbe;
    c.shadowBlur = k.art === "mech" ? 6 : 14;
    c.fillStyle = farbe;
    c.beginPath();
    c.arc(k.x, BODEN - k.y, k.radius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function schatten(c, f) {
    const s = Math.max(0.35, 1 - f.y / 300);
    const g = f.mech ? R().K.mech.groesse : 1;
    c.fillStyle = farben.leise;
    c.globalAlpha = 0.25 * s;
    c.beginPath();
    c.ellipse(f.x, BODEN + 4, 26 * s * g, 5 * s * g, 0, 0, Math.PI * 2);
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
    c.lineTo(b * (K.griff + R().werte(f).stab + e * K.stoss.weite), 0);
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

  /** Der Mega-Mech: klobiger roter Roboter, Ursprung Hüfte, doppelt so groß. */
  function mech(c, f, uhr) {
    const K = R().K, KM = K.mech;
    const g = KM.groesse;
    const huefte = K.huefte * g;
    const amBoden = f.y <= 0.5;
    const laeufst = amBoden && Math.abs(f.vx) > 10;
    const schritt = laeufst ? Math.sin(f.laufPhase * 0.7) * 14 : 0;
    const wippen = laeufst ? Math.abs(Math.sin(f.laufPhase * 0.7)) * 4 : Math.sin(uhr * 2) * 1.2;
    const kontur = "#2a0808";

    c.save();
    if (f.mech.rest < KM.blinken && Math.floor(f.mech.rest * 8) % 2 === 0) c.globalAlpha = 0.4;
    c.translate(f.x, BODEN - f.y - huefte);
    c.scale(f.blick, 1);
    c.lineJoin = "round";
    c.strokeStyle = kontur;
    c.lineWidth = 3;
    const block = function (x, y, b, h, farbe) {
      c.fillStyle = farbe;
      c.fillRect(x, y, b, h);
      c.strokeRect(x, y, b, h);
    };

    // Beine mit breiten Füßen
    const bein = amBoden ? huefte : huefte * 0.75;
    [[-24 - schritt, farben.mechDunkel], [4 + schritt, farben.mech]].forEach(function (b) {
      block(b[0], 4, 20, bein - 16, b[1]);
      block(b[0] - 4, bein - 14, 32, 14, farben.mechDunkel);
    });
    c.translate(0, -wippen);
    block(-30, -12, 60, 26, farben.mechDunkel);

    // Hinterer Arm
    c.lineCap = "square";
    c.strokeStyle = farben.mechDunkel;
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(-34, -98);
    c.lineTo(-30, -52);
    c.lineTo(4, -6);
    c.stroke();
    c.strokeStyle = kontur;
    c.lineWidth = 3;

    // Rumpf mit Brustplatte und Nieten
    block(-36, -112, 72, 104, farben.mech);
    block(-22, -96, 44, 40, farben.mechDunkel);
    c.fillStyle = "#ffd43b";
    c.fillRect(-14, -84, 28, 6);
    c.fillRect(-14, -72, 18, 6);
    c.fillStyle = kontur;
    [[-30, -106], [30, -106], [-30, -16], [30, -16]].forEach(function (n) {
      c.beginPath();
      c.arc(n[0], n[1], 2.5, 0, Math.PI * 2);
      c.fill();
    });
    block(-46, -114, 18, 26, farben.mechDunkel);

    // Kopf: Sehschlitz, Antenne, buschiger Schnurrbart
    block(-26, -158, 52, 44, farben.mech);
    block(-20, -150, 44, 14, kontur);
    c.fillStyle = "#fff";
    c.fillRect(2, -147, 8, 8);
    c.fillRect(14, -147, 8, 8);
    c.beginPath();
    c.moveTo(0, -158);
    c.lineTo(-4, -178);
    c.stroke();
    c.fillStyle = Math.floor(uhr * 3) % 2 ? farben.stern : farben.mechDunkel;
    c.beginPath();
    c.arc(-4, -182, 5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = farben.bart;
    [[-30, -127, 5], [-22, -128, 7], [-12, -129, 8], [0, -130, 8.5], [12, -129, 8], [24, -128, 7], [34, -127, 5]].forEach(function (k) {
      c.beginPath();
      c.arc(k[0] + 2, k[1], k[2], 0, Math.PI * 2);
      c.fill();
    });
    [-1, 1].forEach(function (s) {
      c.beginPath();
      c.arc(2 + s * 40, -133, 5, 0, Math.PI * 2);
      c.fill();
    });

    // Vorderer Arm und Schulter
    c.strokeStyle = farben.mech;
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(38, -98);
    c.lineTo(46, -50);
    c.lineTo(20, -6);
    c.stroke();
    c.strokeStyle = kontur;
    c.lineWidth = 3;
    block(28, -116, 22, 28, farben.mech);

    // Der riesige rote Strich – vorn die Mündung
    // Der riesige rote Strich schwenkt beim Sperrfeuer mit
    c.translate(K.griff * g, wippen);
    c.save();
    c.rotate(-f.mech.winkel * Math.PI / 180);
    block(0, -8, KM.stab - 10, 16, farben.mech);
    block(KM.stab - 12, -6, 12, 12, kontur);
    c.restore();
    block(-4, -12, 16, 24, farben.mechDunkel);
    c.restore();
  }

  /** Druckwelle: heller Ring flach über dem Boden, Staubwolken an der Front. */
  function welle(c, w) {
    const D = R().K.mech.druckwelle;
    const voll = D.reichweite / D.tempo;
    const deckung = w.t <= voll ? 1 : Math.max(0, 1 - (w.t - voll) / D.ausklingen);
    c.save();
    // Staub an der Aufprallstelle
    if (w.t < 0.5) {
      c.globalAlpha = 0.35 * (1 - w.t / 0.5);
      c.fillStyle = farben.leise;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.arc(w.x + i * 22 * (1 + w.t * 2), BODEN - 10 + Math.abs(i) * 2 - w.t * 30, 16 + w.t * 30 - Math.abs(i) * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Staubwolken laufen mit der Front nach links und rechts
    c.globalAlpha = 0.4 * deckung;
    c.fillStyle = farben.leise;
    [-1, 1].forEach(function (s) {
      for (let i = 0; i < 4; i++) {
        const x = w.x + s * (w.r - i * 16);
        if (s * (x - w.x) < 0) continue;
        c.beginPath();
        c.arc(x, BODEN - 8 - i * 3, 12 - i * 2 + Math.sin(w.t * 20 + i) * 2, 0, Math.PI * 2);
        c.fill();
      }
    });
    // Heller, flacher Ring
    c.globalAlpha = deckung;
    c.strokeStyle = farben.stern;
    c.lineWidth = 5;
    c.beginPath();
    c.ellipse(w.x, BODEN, Math.max(1, w.r), Math.max(3, w.r * 0.07), 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  }

  /** Restzeit über dem Mech, blinkt in den letzten Sekunden. */
  function mechBalken(c, f) {
    const K = R().K, KM = K.mech;
    const anteil = Math.max(0, f.mech.rest / KM.dauer);
    const breite = 80, x = f.x - breite / 2, y = BODEN - f.y - K.hoehe * KM.groesse - 34;
    if (f.mech.rest < KM.blinken && Math.floor(f.mech.rest * 8) % 2 === 0) return;
    c.globalAlpha = 0.25;
    c.fillStyle = farben.leise;
    c.fillRect(x, y, breite, 7);
    c.globalAlpha = 1;
    c.fillStyle = farben.mech;
    c.fillRect(x, y, breite * anteil, 7);
    c.strokeStyle = farben.linie;
    c.lineWidth = 1.5;
    c.strokeRect(x, y, breite, 7);
  }

  /** Geschwungener Schnurrbart (Breite b, Mitte x/y). */
  function schnurrbart(c, x, y, b, farbe) {
    c.save();
    c.translate(x, y);
    c.scale(b / 2, b / 2);
    c.fillStyle = farbe;
    [1, -1].forEach(function (s) {
      c.save();
      c.scale(s, 1);
      c.beginPath();
      c.moveTo(0, -0.1);
      c.bezierCurveTo(0.2, -0.38, 0.55, -0.32, 0.72, -0.06);
      c.bezierCurveTo(0.8, 0.08, 0.95, 0.06, 0.98, -0.18);
      c.bezierCurveTo(1.06, 0.18, 0.78, 0.36, 0.5, 0.24);
      c.bezierCurveTo(0.3, 0.16, 0.12, 0.1, 0, 0.16);
      c.closePath();
      c.fill();
      c.restore();
    });
    c.restore();
  }

  /** Die Blase: vorher ein blinkendes "!", dann fällt sie, schaukelt und schwebt. */
  function blase(c, b, uhr) {
    const KE = R().K.ereignis;
    const r = KE.radius;
    if (b.phase === "warnung") {
      if (Math.floor(b.t * KE.anzeige.warnTakt * 2) % 2) return;
      const y = BODEN - KE.startHoehe;
      c.fillStyle = farben.stern;
      c.strokeStyle = "#2a0808";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(b.x, y, 17, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = "#2a0808";
      c.font = "800 26px " + getComputedStyle(document.body).fontFamily;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("!", b.x, y + 1);
      c.textBaseline = "alphabetic";
      return;
    }
    const y = BODEN - b.y;
    const bald = b.phase === "liegt" && b.liegt > KE.platzenNach - 1.5;
    const wabern = Math.sin(uhr * (bald ? 14 : 5)) * (bald ? 0.09 : 0.05);
    // Schatten am Boden
    c.fillStyle = farben.leise;
    c.globalAlpha = 0.2 * Math.max(0.3, 1 - b.y / 300);
    c.beginPath();
    c.ellipse(b.x, BODEN + 4, r * 0.8, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    c.save();
    c.translate(b.x, y);
    c.scale(1 + wabern, 1 - wabern);
    const farbton = (uhr * 120) % 360;
    const v = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    v.addColorStop(0, "rgba(255,255,255,0.4)");
    v.addColorStop(0.7, "hsla(" + farbton + ",90%,70%,0.14)");
    v.addColorStop(1, "hsla(" + (farbton + 60) + ",90%,60%,0.4)");
    c.fillStyle = v;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      c.strokeStyle = "hsl(" + ((farbton + i * 30) % 360) + ",85%,55%)";
      c.beginPath();
      c.arc(0, 0, r, i * Math.PI / 6, (i + 1) * Math.PI / 6 + 0.02);
      c.stroke();
    }
    schnurrbart(c, 0, r * 0.12, r * 1.35, farben.bart);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.ellipse(-r * 0.42, -r * 0.45, r * 0.22, r * 0.11, -0.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Effekte des Ereignisses (Weltkoordinaten: y nach oben)
  const EFFEKTE = {
    platzen: function (c, e) {
      const p = e.t / e.dauer, r = R().K.ereignis.radius;
      const x = e.x, y = BODEN - e.y;
      c.globalAlpha = 1 - p;
      c.lineWidth = 3 * (1 - p) + 1;
      for (let i = 0; i < 10; i++) {
        const w = i * Math.PI / 5;
        const d = r * (0.9 + p * 1.3);
        c.strokeStyle = "hsl(" + (i * 36) + ",85%,58%)";
        c.beginPath();
        c.moveTo(x + Math.cos(w) * d * 0.75, y + Math.sin(w) * d * 0.75);
        c.lineTo(x + Math.cos(w) * d, y + Math.sin(w) * d);
        c.stroke();
        c.fillStyle = c.strokeStyle;
        c.beginPath();
        c.arc(x + Math.cos(w + 0.3) * (r + p * 50), y + Math.sin(w + 0.3) * (r + p * 50) + p * p * 30, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    },
    muendung: function (c, e) {
      c.save();
      c.translate(e.x, BODEN - e.y);
      c.scale(e.blick, 1);
      c.rotate((e.w - 3) * 0.04 - (e.winkel || 0) * Math.PI / 180);
      c.globalAlpha = 1 - e.t / e.dauer;
      c.fillStyle = "#ffa94d";
      c.beginPath();
      c.moveTo(0, -9);
      c.lineTo(10, -4);
      c.lineTo(26, 0);
      c.lineTo(10, 4);
      c.lineTo(0, 9);
      c.lineTo(4, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff3bf";
      c.beginPath();
      c.arc(5, 0, 4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    },
    huelse: function (c, e) {
      const sch = 1800;
      const landung = (e.vy + Math.sqrt(e.vy * e.vy + 2 * sch * e.y)) / sch;
      const t = Math.min(e.t, landung);
      const x = e.x + e.vx * t, y = Math.max(1.5, e.y + e.vy * t - sch * t * t / 2);
      c.save();
      c.translate(x, BODEN - y);
      c.rotate(e.dreh * t);
      c.globalAlpha = Math.min(1, (e.dauer - e.t) / (e.dauer * 0.3));
      c.fillStyle = "#d4a017";
      c.fillRect(-4, -1.5, 8, 3);
      c.restore();
      c.globalAlpha = 1;
    },
    explosion: function (c, e) {
      const p = e.t / e.dauer;
      const x = e.x, y = BODEN - e.y;
      // Feuerball
      if (p < 0.5) {
        const q = p / 0.5;
        c.globalAlpha = 1 - q;
        [["#ffd43b", 1], ["#ff922b", 0.75], ["#fff", 0.4]].forEach(function (s) {
          c.fillStyle = s[0];
          c.beginPath();
          c.arc(x, y, (30 + q * 70) * s[1], 0, Math.PI * 2);
          c.fill();
        });
      }
      // Teile fliegen umher und bleiben am Boden liegen
      c.globalAlpha = Math.min(1, (1 - p) * 3);
      c.strokeStyle = "#2a0808";
      c.lineWidth = 2;
      e.teile.forEach(function (t) {
        const sch = 1600;
        const y0 = e.boden + t.dy;
        const landung = (t.vy + Math.sqrt(t.vy * t.vy + 2 * sch * y0)) / sch;
        const tt = Math.min(e.t, landung);
        const tx = e.x + t.dx + t.vx * tt;
        const ty = Math.max(t.h / 2, y0 + t.vy * tt - sch * tt * tt / 2);
        c.save();
        c.translate(tx, BODEN - ty);
        c.rotate(t.dreh * tt);
        if (t.art === "bart") {
          schnurrbart(c, 0, 0, 34, farben.bart);
        } else {
          c.fillStyle = t.art === "rot" ? farben.mech : farben.mechDunkel;
          c.fillRect(-t.b / 2, -t.h / 2, t.b, t.h);
          c.strokeRect(-t.b / 2, -t.h / 2, t.b, t.h);
        }
        c.restore();
      });
      c.globalAlpha = 1;
    },
  };

  /** "Der Eiermann kommt!!!" – groß in der Mitte, fliegt wackelnd ein und blendet aus. */
  function eiermannText(c, e) {
    const KE = R().K.ereignis, A = KE.anzeige;
    const g = Math.min(2.4, Math.max(1, 640 / (el.canvas.clientWidth || W)));
    let groesse = 84 * Math.min(g, 1.6);
    c.font = "800 " + groesse + "px " + getComputedStyle(document.body).fontFamily;
    const zuBreit = c.measureText(KE.text).width / (W - 60);
    if (zuBreit > 1) {
      groesse /= zuBreit;
      c.font = "800 " + groesse + "px " + getComputedStyle(document.body).fontFamily;
    }
    const ende = A.einflug + KE.textDauer;
    let deckung = e.t > ende ? 1 - (e.t - ende) / A.ausblenden : 1;
    let skala = 1, dreh = 0, versatz = 0;
    if (ruhig.matches) {
      deckung = Math.min(deckung, e.t / A.einflug);
    } else {
      const p = Math.min(1, e.t / A.einflug);
      // Einflug von oben mit Überschwingen, danach kurzes Wackeln
      const k = 1.7;
      const zurueck = 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2);
      skala = 0.3 + 0.7 * zurueck;
      versatz = (1 - zurueck) * -220;
      dreh = Math.sin(e.t * 24) * 0.12 * Math.exp(-e.t * 3.5);
    }
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, deckung));
    c.translate(W / 2, H / 2 - 10 + versatz);
    c.rotate(dreh);
    c.scale(skala, skala);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    c.lineWidth = groesse * 0.16;
    c.strokeStyle = "#1b0606";
    c.strokeText(KE.text, 0, 0);
    c.fillStyle = farben.mech;
    c.fillText(KE.text, 0, 0);
    c.restore();
    c.textBaseline = "alphabetic";
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
    const r = (e.art === "funke" ? 6 : 14) + e.t * (e.art === "funke" ? 60 : 90);
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
      const breite = g > 1.5 ? 300 : 340, hoehe = 18 * g, oben = 22;
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
      // Name und darunter die Power-ups mit Stufe
      c.fillStyle = farben.text;
      c.font = "600 " + 18 * g + "px " + schrift;
      c.textAlign = r === 1 ? "left" : "right";
      const name = modus === "cpu" ? (s[0] === "gruen" ? "Du" : "Computer") : (s[0] === "gruen" ? "Grün" : "Blau");
      const zeile = oben + hoehe + 22 * g;
      c.fillText(name, x, zeile);
      const symbole = K.powerups.filter(function (p) { return f.powerups[p.id]; }).map(function (p) {
        return p.symbol + f.powerups[p.id];
      });
      if (symbole.length) {
        c.font = "600 " + 16 * g + "px " + schrift;
        c.fillText(symbole.join("  "), x, zeile + 24 * g);
      }
    });

    // Spielstand der Runden zwischen den Lebensbalken
    c.textAlign = "center";
    c.fillStyle = farben.text;
    c.font = "700 " + 30 * Math.min(g, 1.8) + "px " + schrift;
    c.fillText(z.gruen.siege + " : " + z.blau.siege, W / 2, 22 + 26 * Math.min(g, 1.8));
    c.font = "500 " + 14 * g + "px " + schrift;
    c.fillStyle = farben.leise;
    c.fillText("Runde " + z.runde, W / 2, 22 + 26 * Math.min(g, 1.8) + 20 * g);

    let gross = "";
    if (z.phase === "start") gross = z.zeit < 0.7 ? "Runde " + z.runde : "Los!";
    if (z.phase === "rundeEnde") {
      gross = z.zeit < 0.9 ? "K.o.!" : z.rundenSieger ? rundenText(z.rundenSieger) : "Unentschieden";
    }
    if (gross && el.menue.hidden && el.ende.hidden && el.auswahl.hidden) {
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
