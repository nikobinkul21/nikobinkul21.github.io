/* ==========================================================================
   climb/darstellung.js – Oberfläche des Kletterspiels (#games/climb)
   Aufbau von oben nach unten:
     Bühne    – Pixel-Szene auf einem Canvas: die Wand in der Mitte, links
                und rechts die Landschaft der Zone (drei Ebenen mit
                Parallaxe), die Kletterin, die Kamera folgt nach oben.
                Darüber: Höhe groß am Rand, Einblendung der Zone, Start-,
                Pausen- und Endbildschirm, Tastaturtest.
     Tasten   – die vier gehaltenen Tasten und die neue, so angeordnet wie
                auf der Tastatur (Tastatur-Steuerung)
     Raster   – große Griff-Felder für mehrere Finger (Touch-Steuerung)
   Die Regeln (climb/regeln.js) entscheiden, die Eingabe (climb/eingabe.js)
   liefert Tasten, die Zonen (climb/zonen.js) die Landschaften.
   Alle Werte: climb/konfig.js (KletterKonfig.bild).
   ========================================================================== */

function initClimb(container) {
  const K = KletterKonfig;
  const B = K.bild;
  const S = KletterSprites;

  const GLIED_NAMEN = {
    handLinks: "Hand links", handRechts: "Hand rechts", fussLinks: "Fuß links", fussRechts: "Fuß rechts",
  };
  const GRUND_TEXTE = {
    losgelassen: "Du hast eine Taste losgelassen, die du halten musstest.",
    falscheTaste: "Du hast eine Taste gedrückt, die nicht gefordert war.",
    zeit: "Die Zeit für den Griffwechsel ist abgelaufen.",
  };

  // ------------------------------------------------------------------
  // Gerüst
  // ------------------------------------------------------------------
  container.innerHTML =
    '<div class="klettern">' +
      '<div class="kl-buehne">' +
        '<canvas class="kl-szene" aria-hidden="true"></canvas>' +
        // Höhe groß am Rand, darunter der Rekord
        '<div class="kl-hoehe" aria-hidden="true"><span class="kl-hoehe-zahl">0</span><span class="kl-hoehe-m">m</span>' +
          '<span class="kl-rekord-klein"></span></div>' +
        // Einblendung beim Erreichen einer Zone
        '<div class="kl-zone" hidden><span class="kl-zone-nr"></span><strong class="kl-zone-name"></strong><span class="kl-zone-unter"></span></div>' +
        // Start: Anleitung – die vier Tasten stehen unten
        '<div class="kl-tafel kl-start">' +
          '<p class="kl-tafel-titel">Bereit zum Klettern?</p>' +
          '<p class="kl-start-text"></p>' +
          '<div class="kl-tafel-knoepfe">' +
            '<button type="button" class="knopf kl-test-knopf">Tastatur testen</button>' +
          "</div>" +
          '<p class="kl-start-hinweis"></p>' +
        "</div>" +
        '<div class="kl-tafel kl-pause" hidden>' +
          '<p class="kl-tafel-titel">Pause</p>' +
          '<p class="kl-pause-text"></p>' +
        "</div>" +
        '<div class="kl-tafel kl-ende" role="dialog" aria-label="Abgestürzt" hidden>' +
          '<p class="kl-tafel-titel">Abgestürzt!</p>' +
          '<p class="kl-ende-grund"></p>' +
          '<p class="kl-ende-hoehe"><span class="kl-ende-zahl"></span> m</p>' +
          '<p class="kl-ende-rekord"></p>' +
          '<div class="kl-tafel-knoepfe"><button type="button" class="knopf kl-nochmal">Nochmal</button></div>' +
        "</div>" +
        // Tastaturtest: fünf Tasten gleichzeitig halten, dreimal
        '<div class="kl-tafel kl-test" role="dialog" aria-label="Tastaturtest" hidden>' +
          '<p class="kl-tafel-titel">Tastaturtest <span class="kl-test-nr"></span></p>' +
          '<p class="kl-test-text"></p>' +
          '<div class="kl-tastenbild kl-test-tasten"></div>' +
          '<div class="kl-tafel-knoepfe">' +
            '<button type="button" class="knopf kl-test-geht-nicht">Klappt nicht</button>' +
            '<button type="button" class="knopf kl-test-fertig">Schließen</button>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="kl-tasten"><div class="kl-tastenbild kl-spiel-tasten"></div></div>' +
      '<div class="kl-raster" hidden></div>' +
      '<div class="kl-fuss">' +
        '<button type="button" class="kl-modus-knopf"></button>' +
      "</div>" +
      '<p class="kl-status nur-vorlesen" role="status"></p>' +
    "</div>";

  const $ = function (s) { return container.querySelector(s); };
  const el = {
    wurzel: $(".klettern"), buehne: $(".kl-buehne"), szene: $(".kl-szene"),
    hoeheZahl: $(".kl-hoehe-zahl"), rekordKlein: $(".kl-rekord-klein"),
    zone: $(".kl-zone"), zoneNr: $(".kl-zone-nr"), zoneName: $(".kl-zone-name"), zoneUnter: $(".kl-zone-unter"),
    start: $(".kl-start"), startText: $(".kl-start-text"), startHinweis: $(".kl-start-hinweis"),
    pause: $(".kl-pause"), pauseText: $(".kl-pause-text"),
    ende: $(".kl-ende"), endeGrund: $(".kl-ende-grund"), endeZahl: $(".kl-ende-zahl"), endeRekord: $(".kl-ende-rekord"),
    test: $(".kl-test"), testNr: $(".kl-test-nr"), testText: $(".kl-test-text"), testTasten: $(".kl-test-tasten"),
    tasten: $(".kl-tasten"), spielTasten: $(".kl-spiel-tasten"), raster: $(".kl-raster"),
    modusKnopf: $(".kl-modus-knopf"), status: $(".kl-status"),
  };
  const ctx = el.szene.getContext("2d");

  // ------------------------------------------------------------------
  // Zustand der Anzeige
  // ------------------------------------------------------------------
  let modus = KletterEingabe.vermutlichTouch() ? "touch" : "tastatur";
  const spiel = KletterRegeln.erstelle({ art: modus });
  let beschriftung = {};          // Code → Beschriftung der Taste
  let sichtbar = false;           // ist #games/climb gerade offen?
  let W = 160, H = 200;           // Größe der Szene in Spielpixeln
  let wandL = 42, wandR = 118;    // Wand von … bis (Spielpixel)
  let test = null;                // laufender Tastaturtest

  // Animation: Körper und Gliedmaßen (relativ zur Hüfte, y nach oben),
  // Kamera in Wandpixeln (y nach oben, 0 = Boden)
  const anim = {
    kamera: 0, kameraVon: 0, kameraZiel: 0, kameraStart: 0,
    glieder: {},               // glied → { x, y, vonX, vonY, zielX, zielY, start, dauer, hebt }
    sturz: null,               // { start, ausloeser }
    wackeln: 0,                // Zeitpunkt, bis zu dem die Szene wackelt
    zone: KletterZonen[0], zoneVorher: null, zoneWechsel: 0,
  };

  function ruhig() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function jetzt() { return performance.now(); }

  // Haltung der Kletterin (Hände und Füße relativ zur Hüfte): climb/konfig.js
  const RUHE = {};
  KletterRegeln.GLIEDER.forEach(function (g) { RUHE[g] = B.figur[g]; });

  function gliederZuruecksetzen() {
    anim.glieder = {};
    Object.keys(RUHE).forEach(function (g) {
      const y = RUHE[g].hoch - RUHE[g].start;
      anim.glieder[g] = { x: RUHE[g].x, y: y, vonX: RUHE[g].x, vonY: y, zielX: RUHE[g].x, zielY: y, start: 0, dauer: 1, hebt: 0 };
    });
  }

  function hash(n, salz) {
    let h = (n * 374761393 + (salz || 0) * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 10000) / 10000;
  }

  // weich ankommen
  function weich(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }


  // ------------------------------------------------------------------
  // Größe: Die Bühne füllt den Platz unter der Kopfzeile, die Szene wird
  // ganzzahlig vergrößert (harte Pixelkanten)
  // ------------------------------------------------------------------
  function passeGroesseAn() {
    if (el.wurzel.offsetParent === null) return;
    const oben = el.wurzel.getBoundingClientRect().top + window.scrollY;
    const unten = parseFloat(getComputedStyle(document.querySelector(".hauptbereich") || document.body).paddingBottom) || 0;
    el.wurzel.style.setProperty("--kl-hoehe", Math.max(440, window.innerHeight - oben - unten) + "px");
    const bw = el.buehne.clientWidth, bh = el.buehne.clientHeight;
    if (!bw || !bh) return;
    const faktor = Math.max(B.minVergroesserung, Math.round(bh / B.zielHoehe));
    W = Math.ceil(bw / faktor);
    H = Math.ceil(bh / faktor);
    el.szene.width = W;
    el.szene.height = H;
    el.szene.style.width = W * faktor + "px";
    el.szene.style.height = H * faktor + "px";
    const wand = Math.min(B.wandBreite, W - 40);
    wandL = Math.round((W - wand) / 2);
    wandR = wandL + wand;
    wandKacheln = {};
  }
  window.addEventListener("resize", passeGroesseAn);
  // Ändert sich die Bühne selbst (z. B. Wechsel Tastatur/Touch), passt sich die Szene an
  if (window.ResizeObserver) new ResizeObserver(function () { passeGroesseAn(); }).observe(el.buehne);


  // ------------------------------------------------------------------
  // Die Wand (Struktur je Zone, als Kachel vorbereitet)
  // ------------------------------------------------------------------
  let wandKacheln = {};
  const KACHEL_H = 40;

  function wandKachel(zone) {
    if (wandKacheln[zone.id]) return wandKacheln[zone.id];
    const breite = wandR - wandL;
    const c = document.createElement("canvas");
    c.width = breite;
    c.height = KACHEL_H;
    const k = c.getContext("2d");
    const f = zone.farben;
    k.fillStyle = f.wand;
    k.fillRect(0, 0, breite, KACHEL_H);
    const punkt = function (x, y, farbe) { k.fillStyle = farbe; k.fillRect(x, y, 1, 1); };
    for (let y = 0; y < KACHEL_H; y++) {
      for (let x = 0; x < breite; x++) {
        const r = hash(x * 131 + y, zone.id.length * 7);
        switch (zone.wand) {
          case "ziegel": {
            // Ziegel 8 × 4 mit Fugen, jede zweite Reihe versetzt
            const versatz = Math.floor(y / 4) % 2 ? 4 : 0;
            if (y % 4 === 3 || (x + versatz) % 8 === 7) punkt(x, y, f.wandHell);
            else if (r < 0.08) punkt(x, y, f.wandDunkel);
            break;
          }
          case "rinde":
            // senkrechte Rillen
            if ((x + Math.floor(hash(Math.floor(y / 6), x) * 2)) % 5 === 0) punkt(x, y, f.wandDunkel);
            else if (r < 0.06) punkt(x, y, f.wandHell);
            break;
          case "eis":
            if (r < 0.05) punkt(x, y, f.wandHell);
            else if ((x * 3 + y * 2) % 23 === 0) punkt(x, y, f.wandDunkel);
            break;
          case "fels":
            if (r < 0.07) punkt(x, y, f.wandDunkel);
            else if (r > 0.95) punkt(x, y, f.wandHell);
            // Risse
            if ((x + y * 3) % 37 === 0 && r < 0.6) punkt(x, y, f.wandDunkel);
            break;
          default: // "erde": Krümel und kleine Steine
            if (r < 0.1) punkt(x, y, f.wandDunkel);
            else if (r > 0.94) punkt(x, y, f.wandHell);
        }
      }
    }
    // Kanten der Wand dunkler (Tiefe)
    k.fillStyle = f.wandDunkel;
    k.fillRect(0, 0, 2, KACHEL_H);
    k.fillRect(breite - 2, 0, 2, KACHEL_H);
    wandKacheln[zone.id] = c;
    return c;
  }

  /** Bildschirm-y einer Wandhöhe (Wandpixel, nach oben). */
  function aufSchirm(wandY) {
    return Math.round(H * B.kameraAnteil - (wandY - anim.kamera));
  }

  function zeichneWand() {
    const pxProMeter = B.pixelProGriff / K.meterProGriff;
    // Von unten nach oben: jede Zone bekommt ihr Stück Wand
    KletterZonen.forEach(function (zone, i) {
      const naechste = KletterZonen[i + 1];
      const von = zone.ab * pxProMeter;
      const bis = naechste ? naechste.ab * pxProMeter : Infinity;
      const yUnten = aufSchirm(von), yOben = bis === Infinity ? -1 : aufSchirm(bis);
      if (yUnten < 0 || yOben > H) return;
      const a = Math.max(0, yOben), b = Math.min(H, yUnten);
      if (b <= a) return;
      const kachel = wandKachel(zone);
      ctx.save();
      ctx.beginPath();
      ctx.rect(wandL, a, wandR - wandL, b - a);
      ctx.clip();
      // Kacheln an der Wand festmachen (sie scrollen mit)
      const start = Math.floor((anim.kamera - H) / KACHEL_H) - 1;
      for (let k = start; k < start + Math.ceil(2 * H / KACHEL_H) + 3; k++) {
        ctx.drawImage(kachel, wandL, aufSchirm((k + 1) * KACHEL_H));
      }
      ctx.restore();
      // Übergang: ein Sims an der Zonengrenze
      if (zone.ab > 0 && yUnten >= 0 && yUnten <= H) {
        ctx.fillStyle = zone.farben.wandDunkel;
        ctx.fillRect(wandL - 2, yUnten - 1, wandR - wandL + 4, 2);
      }
    });
    // Griffe an der Wand (zufällig, an der Wand fest)
    const vonGriff = Math.floor((anim.kamera - H) / 6) - 2;
    for (let k = vonGriff; k < vonGriff + Math.ceil(2 * H / 6) + 4; k++) {
      if (k < 1 || hash(k, 3) < 0.35) continue;
      const wy = k * 6;
      const zone = kletterZoneFuer(wy / pxProMeter);
      const x = wandL + 4 + Math.floor(hash(k, 9) * (wandR - wandL - 10));
      griffZeichnen(x, aufSchirm(wy), zone.farben, hash(k, 5) < 0.5);
    }
  }

  function griffZeichnen(x, y, f, gross) {
    ctx.fillStyle = f.wandDunkel;
    ctx.fillRect(x - 1, y + 1, gross ? 5 : 4, 1);
    ctx.fillStyle = f.griff;
    ctx.fillRect(x - 1, y - 1, gross ? 5 : 4, 2);
    ctx.fillStyle = f.griffHell;
    ctx.fillRect(x, y - 1, 2, 1);
  }


  // ------------------------------------------------------------------
  // Landschaft: Himmel und drei Ebenen je Zone
  // MALER: ein Maler je Muster aus climb/zonen.js. "Flächen" (abstand 1)
  // füllen die ganze Ebene, alle anderen sind einzelne Dinge, die alle
  // "abstand" Pixel wiederkehren.
  // ------------------------------------------------------------------
  const MALER = {
    // --- Grube ---
    erdwand: function (b) {
      for (let y = 0; y < H; y += 3) {
        for (let x = 0; x < W; x += 3) {
          if (x > wandL - 3 && x < wandR) continue;
          const r = hash(Math.floor(x / 3) * 977 + Math.floor((y - b.versatz) / 3) * 31, 4);
          ctx.fillStyle = r < 0.2 ? b.f.wandDunkel : r > 0.93 ? b.f.wand : "rgba(0,0,0,0)";
          if (r < 0.2 || r > 0.93) ctx.fillRect(x, y, 3, 3);
        }
      }
    },
    wurzel: function (b) {
      S.zeichne(ctx, "wurzel", b.links ? wandL - 14 : wandR, b.y, b.f, { spiegeln: b.links });
    },
    stein: function (b) {
      S.zeichne(ctx, "stein", b.links ? b.x : b.x, b.y, b.f);
    },
    // --- Dorf ---
    huegel: function (b) {
      // ferne Hügel und Dächer am unteren Rand
      for (let x = 0; x < W; x++) {
        const h = 18 + Math.round(6 * Math.sin((x + b.versatz * 0.2) / 13) + 4 * Math.sin(x / 5.3));
        ctx.fillStyle = "rgba(120, 160, 110, 0.55)";
        ctx.fillRect(x, H - h, 1, h);
      }
    },
    haus: function (b) {
      const x = b.links ? Math.min(b.x, wandL - 12) : Math.max(b.x, wandR - 4);
      S.zeichne(ctx, "haus", x, b.y, b.f, { spiegeln: !b.links });
      // Rauch aus dem Schornstein
      const sx = b.links ? x + 11 : x + 3;
      for (let k = 0; k < 3; k++) {
        const t = b.ruhig ? k / 3 : ((b.zeit / 900 + k / 3 + b.r) % 1);
        ctx.fillStyle = "rgba(220, 220, 225, " + (0.7 - t * 0.6).toFixed(2) + ")";
        ctx.fillRect(sx + Math.round(Math.sin(t * 6 + b.r * 9) * 2), b.y - 2 - Math.round(t * 12), 2, 2);
      }
    },
    waescheleine: function (b) {
      const von = b.links ? 2 : wandR, bis = b.links ? wandL : W - 2;
      ctx.fillStyle = "#5a4a3a";
      for (let x = von; x < bis; x++) {
        const t = (x - von) / Math.max(1, bis - von);
        ctx.fillRect(x, b.y + Math.round(Math.sin(t * Math.PI) * 4), 1, 1);
      }
      const teile = ["hemd", "socke", "hose", "socke"];
      for (let k = 0; k < 3; k++) {
        const t = 0.2 + k * 0.28;
        const x = Math.round(von + t * (bis - von));
        const wehen = b.ruhig ? 0 : Math.round(Math.sin(b.zeit / 400 + k) * 0.6);
        S.zeichne(ctx, teile[(k + Math.floor(b.r * 4)) % 4], x + wehen, b.y + Math.round(Math.sin(t * Math.PI) * 4) + 1);
      }
    },
    // --- Wald ---
    lichtstrahl: function (b) {
      ctx.fillStyle = "rgba(255, 246, 190, 0.14)";
      const x0 = b.links ? 0 : wandR;
      for (let k = 0; k < 26; k++) ctx.fillRect(x0 + k + Math.round(b.r * 10), b.y + k * 2, 6, 2);
    },
    baum: function (b) {
      S.zeichne(ctx, "baum", b.links ? b.x - 6 : b.x, b.y, b.f, { spiegeln: !b.links });
    },
    vogel: function (b) {
      const breite = W + 20;
      const x = b.ruhig ? b.r * W : ((b.r * breite + b.zeit / 30 * (b.links ? 1 : -1)) % breite + breite) % breite - 10;
      const bild = !b.ruhig && Math.floor(b.zeit / 220 + b.r * 5) % 2 ? "vogel2" : "vogel1";
      S.zeichne(ctx, bild, x, b.y);
    },
    blaetter: function (b) {
      const fall = b.ruhig ? 0 : (b.zeit / 60 + b.r * 50) % 50;
      const x = (b.links ? wandL - 16 : wandR + 6) + (b.ruhig ? 0 : Math.round(Math.sin(b.zeit / 500 + b.r * 7) * 4));
      S.zeichne(ctx, "blatt", x, b.y + fall);
    },
    // --- Felsen ---
    tal: function (b) {
      // Tief unten: Berge in Blau, ein Fluss im Tal
      const lagen = [["rgba(130, 160, 195, 0.7)", Math.round(H * 0.34), 19], ["rgba(95, 125, 160, 0.85)", Math.round(H * 0.22), 12]];
      lagen.forEach(function (l, n) {
        for (let x = 0; x < W; x++) {
          const h = l[1] + Math.round(7 * Math.sin((x + n * 40 + b.versatz * 0.1) / l[2]) + 3 * Math.sin(x / 4.1 + n));
          ctx.fillStyle = l[0];
          ctx.fillRect(x, H - h, 1, h);
        }
      });
      ctx.fillStyle = "rgba(170, 215, 240, 0.8)";
      for (let x = 0; x < W; x++) ctx.fillRect(x, H - 6 + Math.round(Math.sin(x / 9) * 2), 1, 1);
    },
    felsnase: function (b) {
      S.zeichne(ctx, "felsnase", b.links ? wandL - 13 : wandR - 1, b.y, b.f, { spiegeln: !b.links });
    },
    adler: function (b) {
      const x = b.ruhig ? b.r * (W - 14) : W / 2 + Math.sin(b.zeit / 2400 + b.r * 6) * (W / 2 - 8) - 6;
      const y = b.y + (b.ruhig ? 0 : Math.round(Math.cos(b.zeit / 2400 + b.r * 6) * 8));
      S.zeichne(ctx, !b.ruhig && Math.floor(b.zeit / 600) % 3 === 0 ? "adler2" : "adler1", x, y);
    },
    // --- Gipfel ---
    wolkenmeer: function (b) {
      // Wolken UNTER einem: eine weiße Decke am unteren Rand
      for (let x = 0; x < W; x++) {
        const h = Math.round(H * 0.16) + Math.round(5 * Math.sin((x + b.versatz * 0.15) / 9) + 3 * Math.sin(x / 3.7));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, H - h, 1, h);
        ctx.fillStyle = "#dfe8f2";
        ctx.fillRect(x, H - h + 4, 1, 2);
      }
    },
    schneegipfel: function (b) {
      const x0 = b.links ? Math.max(-10, b.x - 20) : Math.min(W - 20, b.x + 4);
      for (let k = 0; k < 18; k++) {
        ctx.fillStyle = k < 6 ? "#ffffff" : "#8e9cad";
        ctx.fillRect(x0 + 18 - k, b.y + k, k * 2 + 1, 1);
      }
    },
    wind: function (b) {
      const lang = 6 + Math.round(b.r * 8);
      const x = b.ruhig ? b.r * W : ((b.zeit / 6 + b.r * W * 3) % (W + lang)) - lang;
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(Math.round(x), b.y, lang, 1);
    },
    // --- Über den Wolken ---
    sterne: function (b) {
      for (let y = 0; y < H; y += 6) {
        for (let x = 0; x < W; x += 6) {
          const zelle = Math.floor(x / 6) * 1597 + Math.floor((y - b.versatz) / 6) * 53;
          const r = hash(zelle, 11);
          if (r > 0.16) continue;
          const yy = y + ((b.versatz % 6) + 6) % 6;
          const funkeln = b.ruhig ? 1 : 0.55 + 0.45 * Math.sin(b.zeit / 400 + r * 80);
          ctx.fillStyle = "rgba(255, 250, 220, " + funkeln.toFixed(2) + ")";
          ctx.fillRect(x + Math.floor(hash(zelle, 2) * 5), yy, 1, 1);
          if (r < 0.02) {
            ctx.fillRect(x + Math.floor(hash(zelle, 2) * 5) - 1, yy, 3, 1);
            ctx.fillRect(x + Math.floor(hash(zelle, 2) * 5), yy - 1, 1, 3);
          }
        }
      }
      // Mond
      ctx.fillStyle = "#fff6c4";
      ctx.fillRect(W - 26, 14, 8, 8);
      ctx.fillRect(W - 27, 15, 10, 6);
      ctx.fillStyle = "#e8d98a";
      ctx.fillRect(W - 23, 17, 2, 2);
    },
    sternschnuppe: function (b) {
      if (b.ruhig) return;
      const t = (b.zeit / 1800 + b.r) % 1;
      if (t > 0.35) return;
      const x = (b.links ? 4 : wandR + 4) + Math.round(t * 60), y = b.y + Math.round(t * 30);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = "rgba(255, 246, 196, " + (1 - k / 6).toFixed(2) + ")";
        ctx.fillRect(x - k * 2, y - k, 2, 1);
      }
    },
    wolkenfetzen: function (b) {
      const x = b.ruhig ? b.x : b.x + Math.round(Math.sin(b.zeit / 3000 + b.r * 9) * 6);
      ctx.globalAlpha = 0.85;
      S.zeichne(ctx, "wolkenfetzen", x, b.y);
      ctx.globalAlpha = 1;
    },
  };

  /** Himmel einer Zone: von oben nach unten in Pixelstufen. */
  function zeichneHimmel(zone) {
    const oben = farbe(zone.farben.himmel[0]), unten = farbe(zone.farben.himmel[1]);
    const stufen = 8;
    for (let s = 0; s < stufen; s++) {
      const t = s / (stufen - 1);
      ctx.fillStyle = "rgb(" + [0, 1, 2].map(function (i) { return Math.round(oben[i] + (unten[i] - oben[i]) * t); }).join(",") + ")";
      ctx.fillRect(0, Math.floor(s * H / stufen), W, Math.ceil(H / stufen) + 1);
    }
  }

  function farbe(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Eine ganze Landschaft (Himmel, drei Ebenen, Dunst) – für die Zone "zone". */
  function zeichneLandschaft(zone, zeit) {
    const r = ruhig();
    zeichneHimmel(zone);
    ["fern", "mitte", "nah"].forEach(function (ebene) {
      const faktor = r ? 1 : B.parallaxe[ebene];
      const versatz = anim.kamera * faktor;      // so weit ist die Ebene schon gescrollt
      (zone.hintergrund[ebene] || []).forEach(function (m) {
        const maler = MALER[m.muster];
        if (!maler) return;
        const basis = { f: zone.farben, zeit: r ? 0 : zeit, ruhig: r, versatz: Math.round(versatz) };
        if (m.abstand <= 1) { maler(basis); return; }
        // Einzelne Dinge: Nummer k liegt bei k · abstand (Ebenenpixel)
        const erster = Math.floor((versatz - H * (1 - B.kameraAnteil) - 40) / m.abstand);
        const letzter = Math.ceil((versatz + H * B.kameraAnteil + 40) / m.abstand);
        for (let k = erster; k <= letzter; k++) {
          const rr = hash(k, m.muster.length * 13 + ebene.length);
          const links = m.seite === "links" || (m.seite === "beide" && hash(k, 77) < 0.5);
          const yEbene = k * m.abstand + Math.round(rr * m.abstand * 0.5);
          const y = Math.round(H * B.kameraAnteil - (yEbene - versatz));
          const x = links ? Math.round(rr * Math.max(1, wandL - 14)) : Math.round(wandR + 4 + rr * Math.max(1, W - wandR - 14));
          maler(Object.assign({ x: x, y: y, links: links, r: rr }, basis));
        }
      });
      if (ebene === "fern") {
        ctx.fillStyle = zone.farben.nebel;
        ctx.fillRect(0, 0, W, H);
      }
    });
  }

  /** Grund der Grube: Erdboden und Laterne (an der Wand fest, unter den Füßen). */
  function zeichneBoden(zeit) {
    const y0 = aufSchirm(-B.bodenUnterHuefte);
    if (y0 > H + 20) return;
    const zone = KletterZonen[0];
    ctx.fillStyle = zone.farben.wandDunkel;
    ctx.fillRect(0, y0, W, H - y0 + 1);
    ctx.fillStyle = zone.farben.wand;
    ctx.fillRect(0, y0, W, 2);
    if (!zone.boden) return;
    // Laterne links neben der Wand, mit warmem Schein (flackert leicht)
    const lx = Math.max(4, wandL - 20), ly = y0 - 12;
    const flackern = ruhig() ? 0 : Math.sin(zeit / 130) * 0.04 + Math.sin(zeit / 47) * 0.03;
    [[26, 0.1], [17, 0.12], [10, 0.16]].forEach(function (ring) {
      ctx.fillStyle = "rgba(255, 207, 90, " + (ring[1] + flackern).toFixed(3) + ")";
      for (let dy = -ring[0]; dy <= ring[0]; dy += 2) {
        const breite = Math.round(Math.sqrt(ring[0] * ring[0] - dy * dy));
        ctx.fillRect(lx + 4 - breite, ly + 6 + dy, breite * 2, 2);
      }
    });
    S.zeichne(ctx, "laterne", lx, ly);
  }


  // ------------------------------------------------------------------
  // Die Kletterin
  // ------------------------------------------------------------------

  /** Dicke Pixel-Linie (mit dunklem Rand) – Arme und Beine. */
  function glied(x0, y0, x1, y1, farbe, dicke) {
    const schritte = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    [[S.PALETTE.u, dicke + 2, -1], [farbe, dicke, 0]].forEach(function (lage) {
      ctx.fillStyle = lage[0];
      for (let i = 0; i <= schritte; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / schritte), y = Math.round(y0 + (y1 - y0) * i / schritte);
        ctx.fillRect(x + lage[2], y + lage[2], lage[1], lage[1]);
      }
    });
  }

  /** Wo ist die Gliedmaße gerade? (Animation des Umgreifens, mit kleinem Bogen) */
  function gliedPosition(g, t) {
    const a = anim.glieder[g];
    const p = weich((t - a.start) / a.dauer);
    const bogen = a.hebt ? Math.sin(p * Math.PI) * a.hebt : 0;
    return { x: a.vonX + (a.zielX - a.vonX) * p + (g.indexOf("Links") !== -1 ? -bogen : bogen), y: a.vonY + (a.zielY - a.vonY) * p };
  }

  function zeichneFigur(t) {
    const hx = Math.round(W / 2);                 // Hüfte: Mitte der Wand …
    let hy = Math.round(H * B.kameraAnteil);      // … auf Höhe der Kamera
    let kopfueber = false;
    const flattern = {};
    if (anim.sturz) {
      // Sturz: fällt beschleunigt aus dem Bild, Arme und Beine flattern
      const s = (t - anim.sturz.start) / 1000;
      hy += Math.round(B.sturzBeschleunigung * s * s);
      kopfueber = s > 0.28;
      Object.keys(RUHE).forEach(function (g, i) {
        flattern[g] = ruhig() ? { x: 0, y: 0 } : { x: Math.round(Math.sin(s * 18 + i * 1.7) * 4), y: Math.round(Math.cos(s * 15 + i) * 5) };
      });
    }
    const koerper = S.bild("koerper", null, { umriss: true, kopfueber: kopfueber });
    const kx = hx - 6, ky = kopfueber ? hy - 1 : hy - 16;     // linke obere Ecke des Körpers (mit Umriss)
    const gelenk = function (g) {
      const p = S.GELENKE[g];
      const y = kopfueber ? 15 - p.y : p.y;
      return { x: kx + 1 + p.x, y: ky + 1 + y };
    };
    // Erst Beine und Arme (hinter dem Körper), dann Hände/Füße, dann der Körper
    const enden = {};
    Object.keys(RUHE).forEach(function (g) {
      const pos = gliedPosition(g, t);
      const fl = flattern[g] || { x: 0, y: 0 };
      const ziel = anim.sturz
        ? { x: hx + RUHE[g].x * 0.8 + fl.x, y: (g.indexOf("hand") === 0) === kopfueber ? hy + 8 + fl.y : hy - 22 + fl.y }
        : { x: hx + Math.round(pos.x), y: hy - Math.round(pos.y) };
      enden[g] = ziel;
      const start = gelenk(g);
      const istHand = g.indexOf("hand") === 0;
      // Griff unter der haltenden Hand bzw. dem haltenden Fuß
      if (!anim.sturz) griffZeichnen(ziel.x - 1, ziel.y + (istHand ? 0 : 2), anim.zone.farben, true);
      glied(start.x, start.y, ziel.x, ziel.y, istHand ? S.PALETTE.J : S.PALETTE.P, 2);
    });
    Object.keys(RUHE).forEach(function (g) {
      const e = enden[g];
      if (g.indexOf("hand") === 0) S.zeichne(ctx, "hand", e.x - 1, e.y - 1);
      else S.zeichne(ctx, "fuss", e.x - (g === "fussLinks" ? 2 : 0), e.y);
    });
    ctx.drawImage(koerper, kx, ky);
  }


  // ------------------------------------------------------------------
  // Ein Bild der Szene
  // ------------------------------------------------------------------
  function zeichne(t) {
    // Kamera folgt dem Körper (beim Sturz bleibt sie stehen)
    const p = weich((t - anim.kameraStart) / B.steigenMs);
    anim.kamera = anim.kameraVon + (anim.kameraZiel - anim.kameraVon) * p;

    ctx.save();
    if (t < anim.wackeln && !ruhig()) {
      ctx.translate(Math.round(Math.sin(t / 25) * 2), Math.round(Math.cos(t / 31) * 1));
    }
    // Landschaft – beim Zonenwechsel blendet die alte in die neue über
    const ueber = ruhig() ? 1 : Math.min(1, (t - anim.zoneWechsel) / B.zonenUebergangMs);
    if (anim.zoneVorher && ueber < 1) {
      zeichneLandschaft(anim.zoneVorher, t);
      ctx.globalAlpha = ueber;
      zeichneLandschaft(anim.zone, t);
      ctx.globalAlpha = 1;
    } else {
      zeichneLandschaft(anim.zone, t);
    }
    zeichneWand();
    zeichneBoden(t);
    zeichneFigur(t);
    ctx.restore();
  }


  // ------------------------------------------------------------------
  // Tasten: so angeordnet wie auf der Tastatur
  // ------------------------------------------------------------------

  /**
   * Füllt ein Tastenbild mit Tasten (Kappen) an ihrer Lage auf der Tastatur.
   * @param {HTMLElement} ziel
   * @param {object[]} eintraege – { code, art: "halten"|"los"|"neu"|"ziel", unten, glied, balken }
   */
  function zeigeKappen(ziel, eintraege) {
    const feld = spiel.feld;
    const xs = eintraege.map(function (e) { return feld.nachCode[e.code].x; });
    const ys = eintraege.map(function (e) { return feld.nachCode[e.code].y; });
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    // Senkrecht immer alle Reihen des Felds (sonst springt die Höhe der
    // Leiste – und mit ihr die Bühne – bei jedem Wechsel), waagerecht nur
    // der Bereich der gezeigten Tasten
    const minY = 0, maxY = Math.max.apply(null, feld.tasten.map(function (t) { return t.y; }));
    ziel.style.setProperty("--kl-spalten", (maxX - minX + 1).toFixed(2));
    ziel.style.setProperty("--kl-reihen", String(maxY - minY + 1));
    // Vorhandene Kappen wiederverwenden (sonst ruckelt das Pulsieren)
    const alte = {};
    Array.from(ziel.children).forEach(function (k) { alte[k.dataset.code] = k; });
    const bleiben = {};
    eintraege.forEach(function (e) {
      let kappe = alte[e.code];
      if (!kappe) {
        kappe = document.createElement("div");
        kappe.className = "kl-kappe";
        kappe.dataset.code = e.code;
        kappe.innerHTML = '<span class="kl-kappe-zeichen"></span><span class="kl-kappe-glied"></span><span class="kl-kappe-balken"><span></span></span>';
        ziel.appendChild(kappe);
      }
      bleiben[e.code] = true;
      const t = feld.nachCode[e.code];
      kappe.style.setProperty("--kl-x", (t.x - minX).toFixed(2));
      kappe.style.setProperty("--kl-y", String(t.y - minY));
      kappe.dataset.art = e.art;
      kappe.classList.toggle("ist-unten", Boolean(e.unten));
      kappe.querySelector(".kl-kappe-zeichen").textContent = beschriftung[e.code] || t.label;
      kappe.querySelector(".kl-kappe-glied").textContent = e.text !== undefined ? e.text
        : e.art === "los" ? "loslassen" : e.art === "neu" ? "greifen" : e.glied ? GLIED_NAMEN[e.glied] : "";
      kappe.querySelector(".kl-kappe-balken").hidden = e.balken === undefined;
      if (e.balken !== undefined) kappe.querySelector(".kl-kappe-balken span").style.transform = "scaleX(" + e.balken.toFixed(3) + ")";
    });
    Object.keys(alte).forEach(function (c) { if (!bleiben[c]) alte[c].remove(); });
  }

  /** Was die Tasten bzw. Felder gerade zeigen sollen. */
  function eintraegeFuerSpiel(st) {
    const unten = new Set(st.gedrueckt);
    const liste = st.gehalten.map(function (c) {
      let art = "halten";
      if (st.phase === "start") art = "ziel";
      else if (st.wechsel && c === st.wechsel.los && (st.phase === "klettern" || st.phase === "pause")) art = "los";
      return { code: c, art: art, unten: unten.has(c), glied: st.glieder[c] };
    });
    if (st.wechsel && (st.phase === "klettern" || st.phase === "pause")) {
      liste.push({ code: st.wechsel.neu, art: "neu", unten: unten.has(st.wechsel.neu), glied: st.glieder[st.wechsel.los],
        balken: st.wechsel.zeitMs ? st.wechsel.restMs / st.wechsel.zeitMs : 0 });
    }
    return liste;
  }

  /** Touch-Raster: alle Felder, mit Markierung der geforderten. */
  function baueRaster() {
    el.raster.innerHTML = "";
    el.raster.style.setProperty("--kl-raster-spalten", String(K.touch.spalten));
    spiel.feld.tasten.forEach(function (t) {
      const f = document.createElement("div");
      f.className = "kl-feld";
      f.dataset.code = t.code;
      f.innerHTML = '<span class="kl-feld-text"></span><span class="kl-kappe-balken"><span></span></span>';
      el.raster.appendChild(f);
    });
  }

  function zeigeRaster(st) {
    const eintraege = {};
    eintraegeFuerSpiel(st).forEach(function (e) { eintraege[e.code] = e; });
    const unten = new Set(st.gedrueckt);
    Array.from(el.raster.children).forEach(function (f) {
      const e = eintraege[f.dataset.code];
      f.dataset.art = e ? e.art : "";
      f.classList.toggle("ist-unten", unten.has(f.dataset.code));
      f.querySelector(".kl-feld-text").textContent = e ? (e.art === "los" ? "loslassen" : e.art === "neu" ? "greifen" : e.art === "ziel" ? "halten" : GLIED_NAMEN[e.glied] || "") : "";
      const balken = f.querySelector(".kl-kappe-balken");
      balken.hidden = !e || e.balken === undefined;
      if (e && e.balken !== undefined) balken.firstChild.style.transform = "scaleX(" + e.balken.toFixed(3) + ")";
    });
  }

  function zeigeSteuerung(t) {
    const st = spiel.stand(t);
    if (modus === "touch") zeigeRaster(st);
    else zeigeKappen(el.spielTasten, eintraegeFuerSpiel(st));
    el.hoeheZahl.textContent = String(st.hoehe);
  }


  // ------------------------------------------------------------------
  // Tafeln: Start, Pause, Ende
  // ------------------------------------------------------------------
  function zeigeStart() {
    const st = spiel.stand(jetzt());
    const tasten = st.gehalten.map(function (c) { return beschriftung[c] || spiel.feld.nachCode[c].label; });
    el.startText.textContent = modus === "touch"
      ? "Lege vier Finger auf die markierten Felder und halte sie. Dann wechselst du immer einen Finger: das rote Feld loslassen, das grüne greifen."
      : "Halte die vier Tasten " + tasten.join(", ") + " gleichzeitig gedrückt. Dann wechselst du immer eine Taste: die rote loslassen, die grüne drücken – die anderen drei bleiben unten.";
    const gespeichert = KletterSpeicher.laden();
    el.start.querySelector(".kl-test-knopf").hidden = modus === "touch";
    el.startHinweis.textContent = modus === "touch" ? "" : gespeichert.tastaturTest === null
      ? "Erstes Mal? Mach kurz den Tastaturtest – manche Tastaturen erkennen nicht alle Kombinationen."
      : gespeichert.tastaturTest === "probleme" ? "Beim Tastaturtest kamen nicht alle Tasten an. Klappt es nicht, nimm eine andere Tastatur." : "";
    el.start.hidden = false;
    el.pause.hidden = true;
    el.ende.hidden = true;
    melde(modus === "touch" ? "Halte die vier markierten Felder." : "Halte die Tasten " + tasten.join(", ") + ".");
  }

  function zeigeRekord() {
    el.rekordKlein.textContent = "Rekord " + KletterSpeicher.laden().rekord + " m";
  }

  function melde(text) { el.status.textContent = text; }

  /** Neuer Versuch: alles auf Anfang. */
  function neuerVersuch() {
    spiel.neu();
    anim.kamera = anim.kameraVon = anim.kameraZiel = 0;
    anim.sturz = null;
    anim.zone = KletterZonen[0];
    anim.zoneVorher = null;
    el.zone.hidden = true;
    gliederZuruecksetzen();
    zeigeStart();
    zeigeRekord();
    zeigeSteuerung(jetzt());
  }

  // ------------------------------------------------------------------
  // Ereignisse der Regeln
  // ------------------------------------------------------------------
  spiel.an("start", function () {
    el.start.hidden = true;
    melde("Los geht's!");
  });
  spiel.an("wechsel", function (e) {
    const neu = beschriftung[e.neu] || spiel.feld.nachCode[e.neu].label;
    const los = beschriftung[e.los] || spiel.feld.nachCode[e.los].label;
    melde(modus === "touch" ? GLIED_NAMEN[e.glied] + ": umgreifen." : los + " loslassen, " + neu + " greifen.");
  });
  spiel.an("griff", function (e) {
    const t = jetzt();
    // Die umgreifende Gliedmaße geht nach oben, die anderen rutschen am Körper nach unten
    const feld = spiel.feld;
    const st = spiel.stand(t);
    const mittel = st.gehalten.reduce(function (s, c) { return s + feld.nachCode[c].x; }, 0) / 4;
    Object.keys(anim.glieder).forEach(function (g) {
      const a = anim.glieder[g];
      const pos = gliedPosition(g, t);
      a.vonX = pos.x; a.vonY = pos.y; a.start = t;
      if (g === e.glied) {
        const m = B.figur.seitlichMax;
        const dx = Math.max(-m, Math.min(m, Math.round((feld.nachCode[e.neu].x - mittel) * 0.8)));
        a.zielX = RUHE[g].x + dx;
        a.zielY = RUHE[g].hoch;
        a.dauer = B.umgreifenMs;
        a.hebt = B.umgreifenBogen;
      } else {
        a.zielY = a.zielY - B.pixelProGriff;
        a.dauer = B.steigenMs;
        a.hebt = 0;
      }
    });
    // Die Kamera steigt mit
    anim.kameraVon = anim.kamera;
    anim.kameraZiel = e.griffe * B.pixelProGriff;
    anim.kameraStart = t;
    el.hoeheZahl.textContent = String(e.hoehe);
    if (!ruhig()) {
      el.hoeheZahl.classList.remove("springt");
      void el.hoeheZahl.offsetWidth;
      el.hoeheZahl.classList.add("springt");
    }
  });
  spiel.an("zone", function (e) {
    anim.zoneVorher = anim.zone;
    anim.zone = e.zone;
    anim.zoneWechsel = jetzt();
    const nr = KletterZonen.indexOf(e.zone) + 1;
    el.zoneNr.textContent = "Zone " + nr + " · " + e.zone.ab + " m";
    el.zoneName.textContent = e.zone.name;
    el.zoneUnter.textContent = e.zone.untertitel || "";
    el.zone.style.setProperty("--kl-zone-farbe", e.zone.farben.text);
    el.zone.style.setProperty("--kl-zone-grund", e.zone.farben.textGrund || "rgba(255, 255, 255, 0.82)");
    el.zone.hidden = false;
    el.zone.classList.remove("erscheint");
    void el.zone.offsetWidth;
    el.zone.classList.add("erscheint");
    clearTimeout(el.zone.zeit);
    el.zone.zeit = setTimeout(function () { el.zone.hidden = true; }, B.zoneEinblendungMs);
    melde("Neue Zone: " + e.zone.name + ".");
  });
  spiel.an("pause", function () {
    const st = spiel.stand(jetzt());
    el.pauseText.textContent = modus === "touch"
      ? "Lege die vier Finger wieder auf die gehaltenen Felder – dann geht es weiter."
      : "Halte wieder die vier Tasten " + st.gehalten.map(function (c) { return beschriftung[c] || spiel.feld.nachCode[c].label; }).join(", ") +
        " – dann geht es mit der restlichen Zeit weiter.";
    el.pause.hidden = false;
    melde("Pause. " + el.pauseText.textContent);
  });
  spiel.an("weiter", function () {
    el.pause.hidden = true;
    melde("Weiter.");
  });
  spiel.an("absturz", function (e) {
    const t = jetzt();
    anim.sturz = { start: t };
    anim.kameraVon = anim.kameraZiel = anim.kamera;
    anim.wackeln = t + B.wackelnMs;
    const rekord = KletterSpeicher.eintragen(e.hoehe);
    melde("Abgestürzt bei " + e.hoehe + " Metern.");
    setTimeout(function () {
      if (spiel.stand(jetzt()).phase !== "absturz") return;
      el.endeGrund.textContent = GRUND_TEXTE[e.grund] || "";
      el.endeZahl.textContent = String(e.hoehe);
      el.endeRekord.textContent = rekord.neu && e.hoehe > 0 ? "Neuer Rekord!" : "Rekord: " + rekord.rekord + " m";
      el.endeRekord.classList.toggle("ist-neu", rekord.neu && e.hoehe > 0);
      el.ende.hidden = false;
      el.pause.hidden = true;
      zeigeRekord();
      el.ende.querySelector(".kl-nochmal").focus({ preventScroll: true });
    }, ruhig() ? B.sturzMsRuhig : B.sturzMs);
  });

  el.ende.querySelector(".kl-nochmal").addEventListener("click", function () {
    el.ende.hidden = true;
    neuerVersuch();
    el.wurzel.focus({ preventScroll: true });
  });


  // ------------------------------------------------------------------
  // Tastaturtest: fünf Tasten gleichzeitig, so wie sie im Spiel vorkommen
  // ------------------------------------------------------------------
  function starteTest() {
    const feld = KletterRegeln.tastenFeld("tastatur");
    test = {
      kombis: KletterRegeln.testKombinationen(feld, K.tastaturTest.durchgaenge, K.tastaturTest.hoehe, Math.random),
      nr: 0, unten: new Set(), probleme: 0, fertig: false,
    };
    el.test.hidden = false;
    el.test.querySelector(".kl-test-geht-nicht").hidden = false;
    zeigeTest();
    el.test.querySelector(".kl-test-fertig").focus({ preventScroll: true });
  }

  function zeigeTest() {
    if (test.fertig) {
      el.testNr.textContent = "";
      el.testTasten.innerHTML = "";
      el.test.querySelector(".kl-test-geht-nicht").hidden = true;
      el.testText.textContent = test.probleme === 0
        ? "Alles erkannt – deine Tastatur schafft die Kombinationen. Viel Spaß beim Klettern!"
        : "Bei " + test.probleme + " von " + test.kombis.length + " Kombinationen kamen nicht alle Tasten an. " +
          "Das liegt an der Tastatur (sie erkennt nicht alle gleichzeitig gedrückten Tasten). Eine andere Tastatur – oder die Touch-Steuerung – hilft.";
      melde(el.testText.textContent);
      return;
    }
    const kombi = test.kombis[test.nr];
    el.testNr.textContent = (test.nr + 1) + "/" + test.kombis.length;
    el.testText.textContent = "Halte diese fünf Tasten gleichzeitig gedrückt. Jede, die ankommt, wird grün.";
    zeigeKappen(el.testTasten, kombi.map(function (c) {
      return { code: c, art: test.unten.has(c) ? "neu" : "halten", unten: test.unten.has(c), text: test.unten.has(c) ? "erkannt" : "" };
    }));
    melde("Test " + (test.nr + 1) + ": " + kombi.map(function (c) { return beschriftung[c] || spiel.feld.nachCode[c].label; }).join(", ") + " gleichzeitig halten.");
  }

  function naechsterTest(geklappt) {
    if (!geklappt) test.probleme++;
    test.nr++;
    test.unten.clear();
    if (test.nr >= test.kombis.length) {
      test.fertig = true;
      KletterSpeicher.setzeTastaturTest(test.probleme === 0 ? "ok" : "probleme");
      zeigeStart();
    }
    zeigeTest();
  }

  function testTaste(code, gedrueckt) {
    if (test.fertig) return;
    if (gedrueckt) test.unten.add(code); else test.unten.delete(code);
    const kombi = test.kombis[test.nr];
    zeigeTest();
    if (kombi.every(function (c) { return test.unten.has(c); })) {
      const nr = test.nr;
      setTimeout(function () { if (test && test.nr === nr) naechsterTest(true); }, B.testWeiterMs);
    }
  }

  function schliesseTest() {
    test = null;
    el.test.hidden = true;
    zeigeStart();
    el.wurzel.focus({ preventScroll: true });
  }

  el.start.querySelector(".kl-test-knopf").addEventListener("click", starteTest);
  el.test.querySelector(".kl-test-geht-nicht").addEventListener("click", function () { naechsterTest(false); });
  el.test.querySelector(".kl-test-fertig").addEventListener("click", schliesseTest);


  // ------------------------------------------------------------------
  // Eingabe
  // ------------------------------------------------------------------
  const eingabe = KletterEingabe.erstelle({
    aktiv: function () { return sichtbar && el.ende.hidden; },
    beimDruecken: function (code, quelle) {
      if (test) { testTaste(code, true); return; }
      if (quelle !== (modus === "touch" ? "touch" : "tastatur")) return;
      spiel.druecke(code, jetzt());
      zeigeSteuerung(jetzt());
    },
    beimLoslassen: function (code, quelle) {
      if (test) { testTaste(code, false); return; }
      if (quelle !== (modus === "touch" ? "touch" : "tastatur")) return;
      spiel.lasseLos(code, jetzt());
      zeigeSteuerung(jetzt());
    },
    beimFokusVerlust: function () {
      if (test) test.unten.clear();
      spiel.pausiere(jetzt());
      zeigeSteuerung(jetzt());
    },
    beimTastendruck: function (ev) {
      // Wer im Touch-Modus vor dem Start eine Spieltaste drückt, hat eine Tastatur
      if (modus === "touch" && /^(Key|Digit)/.test(ev.code) && spiel.stand(jetzt()).phase === "start") setzeModus("tastatur");
    },
  });
  eingabe.verbindeRaster(el.raster);

  function setzeModus(neu) {
    modus = neu;
    eingabe.zuruecksetzen();
    spiel.setzeArt(neu);
    el.wurzel.dataset.modus = neu;
    el.tasten.hidden = neu === "touch";
    el.raster.hidden = neu !== "touch";
    el.modusKnopf.textContent = neu === "touch" ? "Mit Tastatur spielen" : "Touch-Steuerung (ohne Tastatur)";
    if (neu === "touch") baueRaster();
    KletterEingabe.beschriftungen(spiel.feld).then(function (b) { beschriftung = b; zeigeSteuerung(jetzt()); if (!el.start.hidden) zeigeStart(); });
    requestAnimationFrame(passeGroesseAn);
    neuerVersuch();
  }
  el.modusKnopf.addEventListener("click", function () {
    setzeModus(modus === "touch" ? "tastatur" : "touch");
  });


  // ------------------------------------------------------------------
  // Schleife: Zeit, Bild, Zeitbalken
  // ------------------------------------------------------------------
  let schleifeLaeuft = false;
  function schleife() {
    // Seite verlassen (anderer Bereich der Navigation)? Dann ruht das Spiel –
    // wie bei Fokusverlust: pausieren statt abstürzen
    if (sichtbar && el.wurzel.offsetParent === null) {
      sichtbar = false;
      eingabe.zuruecksetzen();
      spiel.pausiere(jetzt());
    }
    if (!sichtbar) { schleifeLaeuft = false; return; }
    const t = jetzt();
    spiel.tick(t);
    zeichne(t);
    zeigeSteuerung(t);
    requestAnimationFrame(schleife);
  }

  el.wurzel.tabIndex = -1;
  // Für Tests: das Spiel ist am Element erreichbar (keine Steuerung von außen nötig)
  el.wurzel.__kletterSpiel = spiel;
  setzeModus(modus);

  return {
    // bei jedem Öffnen von #games/climb
    zeige: function () {
      sichtbar = true;
      requestAnimationFrame(function () {
        passeGroesseAn();
        if (!schleifeLaeuft) { schleifeLaeuft = true; requestAnimationFrame(schleife); }
      });
    },
  };
}
