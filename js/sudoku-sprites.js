/* ==========================================================================
   sudoku-sprites.js – Pixel-Figuren für das Sudoku-Abenteuer
   - Der Held: ein festes Raster aus Zeichen (jedes Zeichen = eine Farbe der
     Palette, "." = durchsichtig).
   - Die Bosse: aus einem Baukasten zusammengesetzt (Grundkörper + Haare,
     Kopfbedeckung, Gesicht, Waffe, Extras) – der Bauplan steht beim Boss in
     js/worlds/weltN.js. Weltbosse haben einen eigenen, größeren Sprite.
   - Die Hintergründe der Welten: kleine Pixel-Szenen in den Weltfarben.
   Gezeichnet wird auf ein <canvas> – mit harten Pixelkanten (siehe CSS:
   image-rendering: pixelated).
   Alle Figuren hier sind eigens für NTB gezeichnet.
   ========================================================================== */

const SudokuSprites = (function () {

  const FIGUREN = {

    /* Der Held – von hinten gesehen, mit übergroßem Schwert (24 × 24) */
    held: {
      palette: {
        k: "#1b1b24",   // Umriss
        h: "#6b3f1f",   // Haare
        s: "#f1c49a",   // Haut
        a: "#9aa4b1",   // Schulterpanzer
        c: "#b8323a",   // Umhang
        C: "#8e2229",   // Umhang-Falte
        b: "#5a3a22",   // Stiefel, Griff
        W: "#ffffff",   // Klinge hell
        w: "#c9d3df",   // Klinge
        g: "#e2b23a",   // Parierstange
      },
      raster: [
        "....................k...",
        "...................kWk..",
        "..................kWwwk.",
        "..................kWwwk.",
        "..................kWwwk.",
        "..................kWwwk.",
        "..................kWwwk.",
        "..................kWwwk.",
        "......kkkkkk......kWwwk.",
        ".....khhhhhhk.....kWwwk.",
        "....khhhhhhhhk....kWwwk.",
        "....khhhhhhhhk..kggggggk",
        "....kshhhhhhsk.....kbk..",
        "...kaakhhhhkaak....ksk..",
        "..kaaaaccccaaaak.kssk...",
        "..kaaacccccccaaksk......",
        "...kacccccccccak........",
        "...kccccCcccccck........",
        "...kcccccCccccck........",
        "...kccccccCcccck........",
        "...kccccccccccck........",
        "....kbbk..kbbk..........",
        "....kbbk..kbbk..........",
        "...kbbbk..kbbbk.........",
      ],
    },

    /* Der Held pariert: das Schwert quer über dem Kopf, die Hand am Griff (24 × 24) */
    heldPariert: {
      palette: null,      // dieselben Farben wie "held" (siehe unten)
      raster: [
        "........................",
        "........................",
        "........................",
        "...................kgk..",
        ".kkkkkkkkkkkkkkkkkkkgkkk",
        "kWWWWWWWWWWWWWWWWWWkgbbk",
        "kwwwwwwwwwwwwwwwwwwkgbbk",
        ".kkkkkkkkkkkkkkkkkkkgksk",
        "...................kgksk",
        "......kkkkkk........ksk.",
        ".....khhhhhhk.......ksk.",
        "....khhhhhhhhk.....ksk..",
        "....khhhhhhhhk.....ksk..",
        "....kshhhhhhsk....ksk...",
        "...kaakhhhhkaak...ksk...",
        "..kaaaaccccaaaak.kssk...",
        "..kaaacccccccaaksk......",
        "...kacccccccccak........",
        "...kccccCcccccck........",
        "...kcccccCccccck........",
        "...kccccccCcccck........",
        "....kbbk..kbbk..........",
        "....kbbk..kbbk..........",
        "...kbbbk..kbbbk.........",
      ],
    },

  };
  FIGUREN.heldPariert.palette = FIGUREN.held.palette;

  /* ------------------------------------------------------------------------
     BAUKASTEN FÜR BOSSE
     Ein Boss-Sprite entsteht aus einem Bauplan (siehe js/worlds/welt1.js):
       koerper – Grundkörper: mensch, huene, tier, geist, konstrukt,
                 fuchs, keiler, baer, spinne, flamme (Welt 2: Wald)
       farben  – haut, haare, kleid, kleid2, hose, schuhe, augen (#rrggbb)
       haare, kopf, gesicht [], waffe, extras [] – Teile, die darüber liegen
     Gezeichnet wird auf ein Raster aus Farbzeichen (wie bei den Figuren
     oben). Am Ende bekommt alles automatisch einen dunklen Umriss.
     Neues Teil? Eine Funktion in TEILE ergänzen – sie bekommt die Leinwand
     und die Maße des Körpers (Kopf, Augen, Mund, Rumpf, Hand).
     ------------------------------------------------------------------------ */

  // Feste Farben der Teile (Großbuchstabe = dunklere Schattierung)
  const GRUNDFARBEN = {
    k: "#1b1b24",   // Umriss
    n: "#1b1b24",   // Schwarz (Augen, Hutband …)
    e: "#1b1b24",   // Augen (überschreibbar)
    w: "#ffffff",   // Weiß
    m: "#7a2a2a",   // Mund
    x: "#c9d3df", X: "#7d8794",    // Metall
    g: "#8a5a32", G: "#5e3c22",    // Holz
    y: "#f2c230", Y: "#b8862a",    // Gold
    r: "#d83a4a", R: "#8e2229",    // Rot
    q: "#e8d38a", Q: "#c4a65a",    // Stroh
    o: "#ef8a22", O: "#b8601a",    // Kürbis
    u: "#2f5fa8",                  // Stirnband
    v: "#6a4a9a",                  // Veilchen
    i: "#e89a9a",                  // Wangen
    j: "#3f8a5a",                  // Flaschenglas
    l: "#bfe6f5",                  // Glas hell
    f: "#4caf50",                  // Feder
    F: "#3b2e26",                  // Pelz
    M: "#a39d90", N: "#6f6a60",    // Mauerstein, Fugen
    z: "#ffffffaa",                // Dampf, Rauch (ohne Umriss)
  };
  const OHNE_UMRISS = { z: true };

  /** Dunklere Schattierung einer Farbe "#rrggbb". */
  function dunkler(hex, faktor) {
    const f = faktor || 0.72;
    return "#" + [1, 3, 5].map(function (i) {
      return Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0");
    }).join("");
  }

  /**
   * Leere Leinwand: ein Raster aus Farbzeichen (null = durchsichtig).
   * Gezeichnet wird in Körper-Koordinaten; "oben" Pixel Platz bleiben über
   * dem Kopf (für Hüte, Haare, Kronen).
   */
  function leinwand(breite, hoehe, oben) {
    const dy = oben || 0;
    const z = [];
    for (let y = 0; y < hoehe; y++) z.push(new Array(breite).fill(null));
    const drin = function (x, y) { return x >= 0 && y >= 0 && x < breite && y < hoehe; };
    const l = {
      breite: breite, hoehe: hoehe, z: z,
      px: function (x, y, f) { if (drin(x, y + dy)) z[y + dy][x] = f; },
      rect: function (x, y, b, h, f) { for (let j = 0; j < h; j++) for (let i = 0; i < b; i++) l.px(x + i, y + j, f); },
      farbe: function (x, y) { return drin(x, y + dy) ? z[y + dy][x] : null; },
      // Ersetzt in einem Bereich nur bestimmte Farben (z. B. Kleidung → Haut)
      tausche: function (x, y, b, h, von, nach) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + b; i++) if (von.indexOf(l.farbe(i, j)) !== -1) l.px(i, j, nach);
      },
      // Gerade Linie von (x0, y0) nach (x1, y1) – für Beine, Äste, Bögen
      linie: function (x0, y0, x1, y1, f) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) l.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), f);
      },
      // Nur leere Felder füllen (z. B. Spinnennetz hinter der Figur)
      leerPx: function (x, y, f) { if (drin(x, y + dy) && z[y + dy][x] === null) z[y + dy][x] = f; },
      // Raster-Koordinaten (ohne Versatz) – für den Umriss
      hat: function (x, y) { return drin(x, y) && z[y][x] !== null; },
    };
    return l;
  }

  /** Umriss: Jedes leere Feld neben einer Farbe wird dunkel. */
  function umriss(l) {
    const neu = [];
    for (let y = 0; y < l.hoehe; y++) for (let x = 0; x < l.breite; x++) {
      if (l.z[y][x] !== null) continue;
      const nachbar = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
        const f = l.hat(x + d[0], y + d[1]) ? l.z[y + d[1]][x + d[0]] : null;
        return f !== null && f !== "k" && !OHNE_UMRISS[f];
      });
      if (nachbar) neu.push([x, y]);
    }
    neu.forEach(function (p) { l.z[p[1]][p[0]] = "k"; });
  }

  // Grundkörper (36 × 34, Füße unten; die Leinwand hat darüber 6 Pixel Platz). Jeder liefert
  // seine Maße für die Teile: kopf {x, y, b, h}, augen [[x, y], [x, y]],
  // mund [x, y], rumpf {x, y, b, h}, arme [{x, y, b, h}], hand [x, y].
  const KOERPER = {
    mensch: function (l, bau) {
      const d = bau.extras.indexOf("gross") !== -1 ? -2 : 0;      // groß: alles bis auf die Beine höher
      l.rect(14, 26 + d, 3, 6 - d, "p"); l.rect(19, 26 + d, 3, 6 - d, "p");
      l.rect(13, 30, 4, 2, "b"); l.rect(19, 30, 4, 2, "b");
      l.rect(13, 16 + d, 10, 10, "c"); l.rect(21, 16 + d, 2, 10, "C");
      l.rect(11, 17 + d, 2, 7, "c"); l.rect(23, 17 + d, 2, 7, "c");
      l.rect(11, 24 + d, 2, 2, "s"); l.rect(23, 24 + d, 2, 2, "s");
      l.rect(16, 15 + d, 4, 1, "S");
      l.rect(13, 6 + d, 10, 9, "s"); l.rect(13, 14 + d, 10, 1, "S");
      [[13, 6], [22, 6], [13, 14], [22, 14]].forEach(function (p) { l.px(p[0], p[1] + d, null); });
      const m = { kopf: { x: 13, y: 6 + d, b: 10, h: 9 }, augen: [[15, 10 + d], [20, 10 + d]], mund: [17, 13 + d],
        rumpf: { x: 13, y: 16 + d, b: 10, h: 10 }, arme: [{ x: 11, y: 17 + d, b: 2, h: 7 }, { x: 23, y: 17 + d, b: 2, h: 7 }],
        hand: [23, 24 + d], hand2: [11, 24 + d], boden: 32 };
      augenUndMund(l, m);
      return m;
    },
    huene: function (l) {
      l.rect(11, 26, 5, 5, "p"); l.rect(20, 26, 5, 5, "p");
      l.rect(10, 30, 6, 2, "b"); l.rect(20, 30, 6, 2, "b");
      l.rect(9, 14, 18, 12, "c"); l.rect(24, 14, 3, 12, "C");
      l.rect(5, 15, 4, 9, "s"); l.rect(27, 15, 4, 9, "s");
      l.rect(5, 15, 4, 3, "c"); l.rect(27, 15, 4, 3, "c");
      l.rect(5, 24, 4, 2, "S"); l.rect(27, 24, 4, 2, "S");
      l.rect(15, 13, 6, 1, "S");
      l.rect(14, 5, 8, 8, "s"); l.rect(14, 12, 8, 1, "S");
      [[14, 5], [21, 5]].forEach(function (p) { l.px(p[0], p[1], null); });
      const m = { kopf: { x: 14, y: 5, b: 8, h: 8 }, augen: [[16, 8], [19, 8]], mund: [17, 11],
        rumpf: { x: 9, y: 14, b: 18, h: 12 }, arme: [{ x: 5, y: 15, b: 4, h: 9 }, { x: 27, y: 15, b: 4, h: 9 }],
        hand: [27, 24], hand2: [5, 24], boden: 32 };
      augenUndMund(l, m);
      return m;
    },
    geist: function (l) {
      // schwebt: kein Unterkörper, unten ausgefranst
      l.rect(12, 15, 12, 12, "c"); l.rect(21, 15, 3, 12, "C");
      for (let x = 12; x < 24; x += 3) { l.px(x, 27, "c"); l.px(x + 1, 27, "c"); l.px(x + 1, 28, "c"); }
      l.rect(9, 16, 3, 6, "c"); l.rect(24, 16, 3, 6, "c");
      l.rect(9, 22, 3, 2, "s"); l.rect(24, 22, 3, 2, "s");
      l.rect(13, 5, 10, 10, "s");
      [[13, 5], [22, 5]].forEach(function (p) { l.px(p[0], p[1], null); });
      const m = { kopf: { x: 13, y: 5, b: 10, h: 10 }, augen: [[15, 9], [20, 9]], mund: [17, 13],
        rumpf: { x: 12, y: 15, b: 12, h: 12 }, arme: [{ x: 9, y: 16, b: 3, h: 6 }, { x: 24, y: 16, b: 3, h: 6 }],
        hand: [24, 22], hand2: [9, 22], boden: 30, durchscheinend: true };
      augenUndMund(l, m);
      return m;
    },
    konstrukt: function (l) {
      // Vogelscheuche: Pfahl, Querstange, Hemd, Sackkopf
      l.rect(17, 24, 2, 8, "g");
      l.rect(5, 17, 26, 2, "g");
      l.rect(12, 15, 12, 10, "c"); l.rect(21, 15, 3, 10, "C");
      l.rect(6, 16, 6, 4, "c"); l.rect(24, 16, 6, 4, "c");
      l.rect(4, 16, 2, 4, "q"); l.rect(30, 16, 2, 4, "q");
      l.rect(16, 14, 4, 1, "Q");
      l.rect(13, 5, 10, 9, "s"); l.rect(13, 13, 10, 1, "S");
      const m = { kopf: { x: 13, y: 5, b: 10, h: 9 }, augen: [[15, 9], [20, 9]], mund: [17, 12],
        rumpf: { x: 12, y: 15, b: 12, h: 10 }, arme: [{ x: 6, y: 16, b: 6, h: 4 }, { x: 24, y: 16, b: 6, h: 4 }],
        hand: [30, 17], hand2: [4, 17], boden: 32 };
      augenUndMund(l, m);
      return m;
    },
    tier: function (l) {
      // Vierbeiner von der Seite, Kopf rechts
      l.rect(6, 15, 20, 10, "c"); l.rect(6, 22, 20, 3, "C");
      [7, 11, 19, 23].forEach(function (x) { l.rect(x, 25, 3, 6, "C"); l.rect(x, 30, 3, 2, "b"); });
      l.rect(24, 10, 9, 9, "s"); l.rect(31, 14, 3, 4, "S");
      l.rect(4, 14, 2, 2, "c");
      const m = { kopf: { x: 24, y: 10, b: 9, h: 9 }, augen: [[29, 12]], mund: [31, 17],
        rumpf: { x: 6, y: 15, b: 20, h: 10 }, arme: [], hand: [30, 18], hand2: [24, 18], boden: 32 };
      l.rect(29, 12, 1, 2, "e");
      return m;
    },

    /* --- Welt 2 (Wald): Tierkörper und Waldwesen --- */
    fuchs: function (l) {
      // Schlanker Fuchs von der Seite: lange Beine, spitze Schnauze,
      // Stehohren, buschiger Schwanz mit weißer Spitze (links oben)
      l.rect(8, 17, 16, 6, "c"); l.rect(8, 21, 16, 2, "C"); l.rect(18, 21, 5, 2, "w");
      [9, 13, 18, 22].forEach(function (x) { l.rect(x, 23, 2, 7, "C"); l.rect(x, 29, 2, 3, "n"); });
      l.rect(22, 13, 4, 7, "c"); l.rect(23, 16, 3, 4, "w");              // Hals mit weißer Brust
      l.rect(24, 9, 7, 6, "s"); l.rect(31, 11, 3, 3, "s"); l.px(34, 12, "s"); l.px(35, 12, "n");
      l.rect(29, 13, 5, 2, "w");                                          // weiße Wangen
      l.rect(24, 6, 2, 3, "s"); l.px(24, 5, "s"); l.rect(28, 6, 2, 3, "s"); l.px(29, 5, "s");
      l.px(25, 7, "n"); l.px(28, 7, "n");
      l.px(28, 10, "e"); l.px(29, 11, "e");                                // schmales, schlaues Auge
      // Schwanz: dick, nach links oben geschwungen
      [[4, 16, 5], [3, 14, 5], [2, 12, 5], [2, 10, 4], [2, 8, 3]].forEach(function (s) { l.rect(s[0], s[1], s[2], 2, "c"); });
      l.rect(7, 17, 2, 2, "c"); l.rect(2, 7, 3, 2, "w"); l.px(3, 6, "w");
      return { kopf: { x: 24, y: 9, b: 10, h: 6 }, augen: [[28, 10]], mund: [32, 14], rumpf: { x: 8, y: 17, b: 16, h: 6 },
        arme: [], hand: [32, 14], hand2: [22, 18], boden: 32, hals: { x: 22, y: 14, b: 4 } };
    },
    keiler: function (l) {
      // Massiges Wildschwein von der Seite: hoher Widerrist, kurze Beine,
      // tiefer Kopf mit Rüssel
      l.rect(5, 15, 21, 9, "c"); l.rect(7, 13, 17, 2, "c"); l.rect(15, 11, 9, 2, "c"); l.rect(5, 22, 21, 2, "C");
      [7, 11, 18, 22].forEach(function (x) { l.rect(x, 24, 3, 5, "C"); l.rect(x, 29, 3, 3, "n"); });
      l.rect(24, 13, 7, 9, "s"); l.rect(30, 16, 4, 5, "s"); l.rect(34, 17, 1, 3, "i"); l.px(34, 18, "n");
      l.rect(25, 10, 2, 3, "S"); l.px(25, 9, "S");                         // Ohr
      l.px(28, 15, "r");                                                   // kleines, wütendes Auge
      l.px(4, 15, "C"); l.px(3, 14, "C"); l.px(3, 16, "C");                 // Ringelschwanz
      return { kopf: { x: 24, y: 13, b: 10, h: 9 }, augen: [[28, 15]], mund: [31, 20], rumpf: { x: 5, y: 15, b: 21, h: 9 },
        arme: [], hand: [32, 20], hand2: [24, 20], boden: 32, hals: { x: 23, y: 19, b: 3 } };
    },
    baer: function (l) {
      // Aufgerichteter Bär: breiter Körper, runder Kopf, runde Ohren,
      // helle Schnauze und heller Bauch
      l.rect(10, 26, 6, 4, "C"); l.rect(20, 26, 6, 4, "C"); l.rect(9, 30, 7, 2, "C"); l.rect(20, 30, 7, 2, "C");
      l.rect(8, 13, 20, 14, "c"); l.rect(25, 13, 3, 14, "C"); l.rect(12, 17, 11, 9, "s");
      [[8, 13], [27, 13]].forEach(function (p) { l.px(p[0], p[1], null); });
      l.rect(4, 13, 4, 10, "c"); l.rect(28, 13, 4, 10, "c"); l.rect(4, 23, 4, 2, "C"); l.rect(28, 23, 4, 2, "C");
      l.rect(12, 2, 12, 11, "c"); [[12, 2], [23, 2], [12, 12], [23, 12]].forEach(function (p) { l.px(p[0], p[1], null); });
      l.rect(11, 0, 3, 3, "c"); l.rect(22, 0, 3, 3, "c"); l.px(12, 1, "S"); l.px(23, 1, "S");
      l.rect(15, 8, 6, 4, "s"); l.rect(17, 8, 2, 1, "n");
      const m = { kopf: { x: 12, y: 2, b: 12, h: 11 }, augen: [[14, 5], [21, 5]], mund: [17, 11], rumpf: { x: 8, y: 13, b: 20, h: 14 },
        arme: [{ x: 4, y: 13, b: 4, h: 10 }, { x: 28, y: 13, b: 4, h: 10 }], hand: [28, 23], hand2: [4, 23], boden: 32,
        hals: { x: 13, y: 12, b: 10 } };
      augenUndMund(l, m);
      return m;
    },
    spinne: function (l) {
      // Riesenspinne: großer Hinterleib links, Kopfbruststück rechts mit
      // vielen roten Augen und Giftklauen, acht geknickte Beine
      const beine = [[17, 19, 11, 8, 4, 31], [19, 19, 14, 6, 9, 31], [24, 20, 30, 7, 33, 31], [27, 20, 34, 10, 35, 30],
        [16, 20, 8, 12, 1, 31], [21, 21, 18, 10, 14, 31], [25, 21, 24, 11, 28, 31], [28, 21, 31, 13, 31, 31]];
      beine.forEach(function (b, i) {
        const f = i < 4 ? "C" : "c";
        l.linie(b[0], b[1], b[2], b[3], f); l.linie(b[2], b[3], b[4], b[5], f);
        l.linie(b[0] + 1, b[1], b[2] + 1, b[3], f);
      });
      for (let y = -8; y <= 8; y++) for (let x = -10; x <= 10; x++) {
        if ((x * x) / 100 + (y * y) / 64 <= 1) l.px(11 + x, 17 + y, y > 4 ? "C" : "c");
      }
      // Zeichnung auf dem Rücken (sanduhrförmig)
      [[10, 12], [11, 12], [10, 13], [11, 13], [9, 15], [12, 15], [10, 16], [11, 16], [10, 17], [11, 17]].forEach(function (p) { l.px(p[0], p[1], "d"); });
      for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) {
        if ((x * x) / 36 + (y * y) / 25 <= 1) l.px(25 + x, 20 + y, "c");
      }
      l.rect(28, 16, 6, 7, "s"); l.px(33, 16, null);
      [[29, 17], [31, 17], [33, 18], [30, 19], [32, 19], [29, 20]].forEach(function (p) { l.px(p[0], p[1], "r"); });
      l.px(30, 23, "w"); l.px(32, 23, "w"); l.px(30, 24, "w"); l.px(32, 24, "w");
      return { kopf: { x: 28, y: 16, b: 6, h: 7 }, augen: [[29, 17], [31, 17]], mund: [31, 22], rumpf: { x: 1, y: 9, b: 30, h: 17 },
        arme: [], hand: [33, 22], hand2: [20, 22], boden: 32 };
    },
    flamme: function (l) {
      // Irrlicht: schwebende Flamme, unten rund, oben spitz und flackernd,
      // mit hellem Kern (durchscheinend)
      for (let y = 2; y <= 26; y++) {
        const t = (y - 2) / 24;
        const halb = Math.round(t < 0.75 ? 9 * Math.sin(t / 0.75 * Math.PI / 2) : 9 * Math.cos((t - 0.75) / 0.25 * Math.PI / 2) + 1);
        const wackel = y < 12 ? Math.round(Math.sin(y * 1.3) * 2) : 0;
        l.rect(18 - halb + wackel, y, halb * 2, 1, "c");
        if (halb > 3) l.rect(18 - halb + 3 + wackel, y, halb * 2 - 6, 1, "s");
      }
      l.rect(20, 0, 2, 3, "c"); l.px(14, 4, "c"); l.px(13, 3, "c");       // Flammenzungen
      const m = { kopf: { x: 12, y: 10, b: 12, h: 12 }, augen: [[15, 15], [20, 15]], mund: [17, 20], rumpf: { x: 10, y: 12, b: 16, h: 14 },
        arme: [], hand: [26, 20], hand2: [9, 20], boden: 30, durchscheinend: true };
      m.augen.forEach(function (a) { l.rect(a[0], a[1], 2, 2, "e"); });
      l.rect(17, 20, 3, 2, "n");                                          // runder Mund: "Ooh …"
      return m;
    },
  };

  /** Standard-Augen (2 Pixel hoch) und Mund. */
  function augenUndMund(l, m) {
    m.augen.forEach(function (a) { l.rect(a[0], a[1], 1, 2, "e"); });
    l.rect(m.mund[0], m.mund[1], 2, 1, "m");
  }

  // Teile, die auf den Körper kommen. Jede Funktion: (leinwand, maße)
  const TEILE = {
    /* --- Haare --- */
    haare: {
      kurz: function (l, m) { const k = m.kopf; l.rect(k.x, k.y - 1, k.b, 3, "h"); l.rect(k.x, k.y + 2, 1, 2, "h"); l.rect(k.x + k.b - 1, k.y + 2, 1, 2, "h"); },
      glatze: function (l, m) { const k = m.kopf; l.px(k.x + 2, k.y + 1, "w"); l.px(k.x + 3, k.y + 1, "w"); },
      kranz: function (l, m) { const k = m.kopf; l.rect(k.x - 1, k.y + 2, 2, 3, "h"); l.rect(k.x + k.b - 1, k.y + 2, 2, 3, "h"); l.px(k.x + 2, k.y + 1, "w"); },
      stachel: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h");
        for (let i = -1; i <= k.b; i++) { l.px(k.x + i, k.y - 2, i % 2 ? "h" : null); if (i % 3 === 0) l.px(k.x + i, k.y - 3, "h"); }
        l.px(k.x - 2, k.y, "h"); l.px(k.x + k.b + 1, k.y, "h");
        l.rect(k.x, k.y + 2, 1, 2, "h"); l.rect(k.x + k.b - 1, k.y + 2, 1, 2, "h");
      },
      hochstachel: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 2, k.b + 2, 4, "h");
        for (let i = 0; i < k.b; i++) {
          const hoch = [2, 4, 3, 5, 4, 5, 3, 4, 2, 3][i % 10];
          l.rect(k.x + i, k.y - 2 - hoch, 1, hoch, "h");
        }
        l.px(k.x - 2, k.y - 3, "h"); l.px(k.x + k.b + 1, k.y - 3, "h");
      },
      lang: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h");
        l.rect(k.x - 1, k.y + 2, 2, k.h + 5, "h"); l.rect(k.x + k.b - 1, k.y + 2, 2, k.h + 5, "h");
      },
      zoepfe: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h"); l.rect(k.x, k.y + 2, 2, 2, "h"); l.rect(k.x + k.b - 2, k.y + 2, 2, 2, "h");
        l.rect(k.x - 3, k.y + 3, 2, 12, "h"); l.rect(k.x + k.b + 1, k.y + 3, 2, 12, "h");
        l.rect(k.x - 3, k.y + 3, 2, 1, "y"); l.rect(k.x + k.b + 1, k.y + 3, 2, 1, "y");
      },
      locken: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h");
        for (let i = -1; i <= k.b; i += 2) l.px(k.x + i, k.y - 2, "h");
        l.rect(k.x - 2, k.y + 1, 2, 6, "h"); l.rect(k.x + k.b, k.y + 1, 2, 6, "h");
        l.px(k.x - 3, k.y + 3, "h"); l.px(k.x + k.b + 2, k.y + 4, "h");
      },
      struppig: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h");
        for (let i = -1; i <= k.b; i++) if (i % 3 !== 1) l.px(k.x + i, k.y - 2, "h");
        l.px(k.x - 2, k.y + 1, "h"); l.px(k.x + k.b + 1, k.y + 1, "h"); l.px(k.x - 2, k.y + 3, "h");
        l.rect(k.x, k.y + 2, 2, 1, "h"); l.rect(k.x + k.b - 3, k.y + 2, 3, 1, "h");
      },
      dreads: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 1, k.b + 2, 3, "h");
        [k.x - 2, k.x, k.x + k.b - 1, k.x + k.b + 1].forEach(function (x, n) {
          l.rect(x, k.y + 1, 1, 10, "h");
          l.px(x, k.y + 4 + (n % 2) * 2, n % 2 ? "r" : "y");
          l.px(x, k.y + 8, n % 2 ? "y" : "x");
        });
      },
      // Welt 2: wilde, weiße Mähne bis auf die Schultern
      maehne: function (l, m) {
        const k = m.kopf; l.rect(k.x - 2, k.y - 2, k.b + 4, 4, "h");
        for (let i = -2; i <= k.b + 1; i += 2) { l.px(k.x + i, k.y - 3, "h"); if (i % 4 === 0) l.px(k.x + i, k.y - 4, "h"); }
        l.rect(k.x - 3, k.y + 1, 3, k.h + 8, "h"); l.rect(k.x + k.b, k.y + 1, 3, k.h + 8, "h");
        [0, 2].forEach(function (d) { l.px(k.x - 4, k.y + 4 + d * 3, "h"); l.px(k.x + k.b + 3, k.y + 5 + d * 3, "h"); });
      },
    },

    /* --- Kopfbedeckungen --- */
    kopf: {
      schlapphut: function (l, m) {
        const k = m.kopf; l.rect(k.x - 3, k.y, k.b + 6, 2, "g"); l.px(k.x - 4, k.y + 2, "g"); l.px(k.x + k.b + 3, k.y + 1, "g");
        l.rect(k.x + 1, k.y - 4, k.b - 2, 4, "g"); l.rect(k.x + 1, k.y - 1, k.b - 2, 1, "G"); l.px(k.x + 3, k.y - 5, "g");
      },
      dreispitz: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 4, k.b + 2, 4, "n");
        l.rect(k.x - 3, k.y - 1, k.b + 6, 2, "n"); l.px(k.x - 4, k.y - 2, "n"); l.px(k.x + k.b + 3, k.y - 2, "n");
        l.rect(k.x - 3, k.y, k.b + 6, 1, "y"); l.px(k.x + 4, k.y - 3, "w"); l.px(k.x + 5, k.y - 3, "w");
        l.rect(k.x, k.y + 1, k.b, 1, "r");
      },
      spitzhut: function (l, m) {
        const k = m.kopf; l.rect(k.x - 4, k.y, k.b + 8, 1, "d"); l.rect(k.x - 3, k.y + 1, k.b + 6, 1, "D");
        for (let r = 0; r < 9; r++) {
          const b = Math.max(1, k.b - r);
          l.rect(k.x + Math.floor((k.b - b) / 2) + (r > 6 ? r - 6 : 0), k.y - 1 - r, b, 1, "d");
        }
      },
      kapuze: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 2, k.b + 2, 4, "c"); l.px(k.x + 3, k.y - 3, "c"); l.px(k.x + 4, k.y - 3, "c");
        l.rect(k.x - 1, k.y + 2, 2, k.h - 1, "c"); l.rect(k.x + k.b - 1, k.y + 2, 2, k.h - 1, "c");
        l.rect(k.x + 1, k.y + 2, k.b - 2, 1, "C");
      },
      stirnband: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y + 1, k.b + 2, 2, "u");
        l.rect(k.x + 2, k.y + 1, k.b - 4, 2, "x"); l.px(k.x + k.b / 2 - 1, k.y + 1, "X"); l.px(k.x + k.b / 2, k.y + 2, "X");
        l.px(k.x - 2, k.y + 3, "u"); l.px(k.x - 3, k.y + 4, "u");
      },
      topfhelm: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 2, k.b + 2, k.h + 2, "d"); l.rect(k.x + k.b - 1, k.y - 2, 2, k.h + 2, "D");
        l.rect(k.x, k.y + 3, k.b, 1, "n"); l.rect(k.x + Math.floor(k.b / 2) - 1, k.y + 4, 2, 3, "n");
        l.px(k.x + 2, k.y + 6, "n"); l.px(k.x + k.b - 3, k.y + 6, "n"); l.px(k.x + 1, k.y - 1, "x");
      },
      federhut: function (l, m) {
        const k = m.kopf; l.rect(k.x - 2, k.y, k.b + 4, 2, "d"); l.rect(k.x + 1, k.y - 3, k.b - 3, 3, "c");
        for (let i = 0; i < 6; i++) l.px(k.x + k.b - 3 + i, k.y - 2 - i, "f");
        l.px(k.x + k.b - 1, k.y - 2, "f"); l.px(k.x + k.b + 1, k.y - 5, "f");
      },
      flachhut: function (l, m) {
        const k = m.kopf; l.rect(k.x - 2, k.y, k.b + 4, 1, "n"); l.rect(k.x, k.y - 3, k.b, 3, "n"); l.rect(k.x, k.y - 1, k.b, 1, "X");
      },
      /* Welt 2 */
      // Kapuze mit Zipfel und roter Feder (Bogenschütze aus dem Dickicht)
      federkapuze: function (l, m) {
        TEILE.kopf.kapuze(l, m);
        const k = m.kopf; l.px(k.x - 2, k.y - 1, "c"); l.px(k.x - 3, k.y, "c"); l.px(k.x - 4, k.y + 1, "c");
        for (let i = 0; i < 5; i++) l.px(k.x + k.b + i - 1, k.y - 1 - i, i < 4 ? "r" : "R");
        l.px(k.x + k.b, k.y - 3, "r");
      },
      // Krummer Hexenhut mit breiter Krempe und Schnalle
      hexenhut: function (l, m) {
        const k = m.kopf; l.rect(k.x - 4, k.y, k.b + 8, 2, "d"); l.rect(k.x - 3, k.y + 1, k.b + 6, 1, "D");
        for (let r = 0; r < 8; r++) { const b = Math.max(2, k.b - 1 - r); l.rect(k.x + Math.floor((k.b - b) / 2) - Math.floor(r / 3), k.y - 1 - r, b, 1, "d"); }
        l.px(k.x - 2, k.y - 9, "d"); l.px(k.x - 3, k.y - 8, "d");          // abgeknickte Spitze
        l.rect(k.x + 1, k.y - 2, k.b - 2, 1, "n"); l.rect(k.x + 4, k.y - 2, 2, 1, "y");
      },
      // Helm mit Hundeschnauze (Metall, Zähne, ein Ohr)
      hundehelm: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 2, k.b + 2, 4, "X"); l.rect(k.x - 1, k.y + 2, 2, k.h - 3, "X");
        l.rect(k.x + k.b - 2, k.y - 1, 5, 3, "X"); l.px(k.x + k.b + 3, k.y, "X");
        l.px(k.x + k.b, k.y + 2, "w"); l.px(k.x + k.b + 2, k.y + 2, "w");
        l.rect(k.x, k.y - 4, 2, 2, "X"); l.px(k.x + 1, k.y - 5, "X"); l.rect(k.x + 1, k.y - 1, k.b - 3, 1, "x");
        l.px(k.x + k.b - 2, k.y, "n");                                     // Auge der Hundeschnauze
      },
      // Wolfsfell als Kapuze: Ohren, Fell hängt bis auf die Schultern
      wolfsfell: function (l, m) {
        const k = m.kopf; l.rect(k.x - 2, k.y - 2, k.b + 4, 3, "x"); l.rect(k.x - 2, k.y + 1, 2, k.h + 4, "x"); l.rect(k.x + k.b, k.y + 1, 2, k.h + 4, "x");
        [k.x - 1, k.x + k.b - 2].forEach(function (x) { l.rect(x, k.y - 4, 3, 2, "x"); l.px(x + 1, k.y - 5, "x"); l.px(x + 1, k.y - 3, "X"); });
        for (let x = k.x - 2; x < k.x + k.b + 2; x += 2) l.px(x, k.y - 2, "X");
        l.px(k.x + 1, k.y - 1, "n"); l.px(k.x + k.b - 2, k.y - 1, "n");     // Augen des Wolfsfells
      },
      // Mistelkranz: grüne Blätter, weiße Beeren
      mistelkranz: function (l, m) {
        const k = m.kopf; for (let i = -1; i <= k.b; i++) { l.px(k.x + i, k.y, i % 2 ? "f" : "j"); if (i % 2 === 0) l.px(k.x + i, k.y - 1, "f"); }
        [1, 4, 7].forEach(function (i) { l.px(k.x + i, k.y - 1, "w"); });
      },
      // Kapuze mit großem Hirschgeweih
      geweihkapuze: function (l, m) {
        TEILE.kopf.kapuze(l, m);
        const k = m.kopf, links = k.x + 1, rechts = k.x + k.b - 2;
        [[links, -1], [rechts, 1]].forEach(function (g) {
          const x = g[0], r = g[1];
          l.linie(x, k.y - 2, x + 5 * r, k.y - 10, "q");                    // Stange
          l.linie(x + 2 * r, k.y - 5, x + 5 * r, k.y - 5, "q");              // Sprossen
          l.linie(x + 4 * r, k.y - 8, x + 7 * r, k.y - 9, "q");
          l.linie(x + 3 * r, k.y - 7, x + 3 * r, k.y - 11, "Q");
        });
      },
      // Spitze Wolfsohren (Werwolf)
      wolfsohren: function (l, m) {
        const k = m.kopf; [k.x, k.x + k.b - 3].forEach(function (x) { l.rect(x, k.y - 2, 3, 2, "h"); l.px(x + 1, k.y - 3, "h"); l.px(x + 1, k.y - 4, "h"); l.px(x + 1, k.y - 2, "i"); });
        l.rect(k.x - 1, k.y, k.b + 2, 2, "h");
      },
    },

    /* --- Gesicht --- */
    gesicht: {
      veilchen: function (l, m) { const a = m.augen[0]; l.px(a[0] - 1, a[1], "v"); l.px(a[0] - 1, a[1] + 1, "v"); l.px(a[0] + 1, a[1] + 1, "v"); l.px(a[0], a[1] - 1, "v"); l.px(a[0], a[1] + 2, "v"); },
      stoppeln: function (l, m) { const k = m.kopf; for (let x = k.x + 1; x < k.x + k.b - 1; x += 2) l.px(x, m.mund[1] + 1, "S"); },
      trichterohren: function (l, m) {
        const k = m.kopf; [[k.x - 1, -1], [k.x + k.b, 1]].forEach(function (o) {
          l.px(o[0], k.y + 4, "s"); l.px(o[0] + o[1], k.y + 3, "s"); l.px(o[0] + 2 * o[1], k.y + 2, "s");
          l.rect(o[1] < 0 ? o[0] - 3 : o[0] + 1, k.y + 1, 3, 1, "s");
        });
      },
      brille: function (l, m) {
        m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1] - 1, 3, 4, "n"); l.rect(a[0] - 1, a[1], 3, 2, "l"); l.rect(a[0], a[1], 1, 2, "e"); });
        l.rect(m.augen[0][0] + 2, m.augen[0][1], m.augen[1][0] - m.augen[0][0] - 3, 1, "n");
      },
      ziegenbart: function (l, m) { const p = m.mund; l.rect(p[0] - 1, p[1] - 1, 4, 1, "h"); l.rect(p[0], p[1] + 1, 2, 2, "h"); l.rect(p[0] - 1, p[1], 1, 2, "h"); l.rect(p[0] + 2, p[1], 1, 2, "h"); },
      zwirbelbart: function (l, m) { const p = m.mund; l.rect(p[0] - 2, p[1] - 1, 6, 1, "h"); l.px(p[0] - 3, p[1] - 2, "h"); l.px(p[0] + 4, p[1] - 2, "h"); },
      spitzbart: function (l, m) { const p = m.mund; l.rect(p[0] - 1, p[1] - 1, 4, 1, "h"); l.rect(p[0], p[1] + 1, 2, 1, "h"); l.px(p[0], p[1] + 2, "h"); },
      vollbart: function (l, m) {
        const k = m.kopf, p = m.mund; l.rect(k.x, p[1] - 1, k.b, 4, "h"); l.rect(k.x + 1, p[1] + 3, k.b - 2, 1, "h");
        l.rect(k.x, k.y + 4, 1, k.h - 4, "h"); l.rect(k.x + k.b - 1, k.y + 4, 1, k.h - 4, "h"); l.rect(p[0], p[1], 2, 1, "m");
      },
      langbart: function (l, m) {
        const k = m.kopf, p = m.mund; l.rect(k.x, p[1] - 1, k.b, 3, "h");
        for (let r = 0; r < 8; r++) { const b = Math.max(2, k.b - 2 - r); l.rect(k.x + Math.floor((k.b - b) / 2), p[1] + 2 + r, b, 1, r % 3 ? "h" : "H"); }
        l.rect(p[0], p[1], 2, 1, "m");
      },
      schnurrhaare: function (l, m) { const k = m.kopf, y = m.augen[0][1] + 2; [0, 2].forEach(function (j) { l.rect(k.x + 1, y + j, 2, 1, "n"); l.rect(k.x + k.b - 3, y + j, 2, 1, "n"); }); },
      halstuch: function (l, m) { const k = m.kopf; l.rect(k.x, m.mund[1] - 1, k.b, 3, "d"); l.rect(k.x + 1, m.mund[1] + 2, k.b - 2, 1, "D"); },
      boeseaugen: function (l, m) { const a = m.augen; l.px(a[0][0] - 1, a[0][1] - 2, "n"); l.px(a[0][0], a[0][1] - 1, "n"); l.px(a[1][0] + 1, a[1][1] - 2, "n"); l.px(a[1][0], a[1][1] - 1, "n"); },
      kajal: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1] - 1, 3, 1, "n"); l.px(a[0] - 1, a[1] + 1, "n"); l.px(a[0] + 1, a[1] + 1, "n"); }); },
      sanft: function (l, m) { const k = m.kopf; l.px(k.x + 1, m.mund[1] - 1, "i"); l.px(k.x + k.b - 2, m.mund[1] - 1, "i"); m.augen.forEach(function (a) { l.px(a[0], a[1], "w"); }); },
      katzenaugen: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1], 2, 2, "y"); l.rect(a[0], a[1], 1, 2, "n"); }); },
      narbe: function (l, m) { const a = m.augen[0]; [-2, -1, 2, 3].forEach(function (d) { l.px(a[0] - 1, a[1] + d, "R"); }); },
      spitzohren: function (l, m) {
        const k = m.kopf; for (let i = 0; i < 4; i++) { l.px(k.x - 1 - i, k.y + 4 - i, "s"); l.px(k.x + k.b + i, k.y + 4 - i, "s"); }
        l.px(k.x - 1, k.y + 5, "s"); l.px(k.x + k.b, k.y + 5, "s");
      },
      klingeimmund: function (l, m) {
        const p = m.mund; l.rect(p[0] - 1, p[1], 3, 1, "n"); l.px(p[0] + 2, p[1] - 1, "y"); l.px(p[0] + 2, p[1], "y"); l.px(p[0] + 2, p[1] + 1, "y");
        l.rect(p[0] + 3, p[1], 10, 1, "x"); l.px(p[0] + 12, p[1] - 1, "x");
      },
      augenbinde: function (l, m) { const k = m.kopf, y = m.augen[0][1] - 1; l.rect(k.x - 1, y, k.b + 2, 3, "n"); },
      pfeife: function (l, m) { const p = m.mund; l.px(p[0] + 2, p[1], "G"); l.px(p[0] + 3, p[1] + 1, "G"); l.rect(p[0] + 4, p[1], 2, 2, "g"); },
      hohlaugen: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1], 2, 3, "n"); }); l.rect(m.mund[0], m.mund[1] - 1, 2, 2, "n"); },
      starraugen: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1] - 1, 3, 3, "w"); l.px(a[0], a[1], "n"); }); },
      zaehne: function (l, m) {
        const k = m.kopf, y = m.mund[1] - 1; l.rect(k.x + 1, y, k.b - 2, 2, "w");
        for (let x = k.x + 2; x < k.x + k.b - 1; x += 2) l.rect(x, y, 1, 2, "S");
      },
      /* Welt 2 */
      rotestriche: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0], a[1] + 2, 1, 3, "r"); }); },
      warze: function (l, m) { const k = m.kopf; l.px(k.x + 2, m.mund[1] - 2, "j"); },
      hakennase: function (l, m) { const p = m.mund; l.px(p[0] + 1, p[1] - 3, "S"); l.px(p[0] + 2, p[1] - 2, "S"); l.px(p[0] + 2, p[1] - 1, "S"); },
      brandnarbe: function (l, m) {
        const k = m.kopf, mitte = k.x + Math.floor(k.b / 2);
        for (let y = k.y + 2; y < k.y + k.h; y++) for (let x = mitte; x < k.x + k.b; x++) {
          if (l.farbe(x, y) === "s" && (x + y) % 2) l.px(x, y, "i");
          if (l.farbe(x, y) === "s" && (x * 3 + y) % 5 === 0) l.px(x, y, "R");
        }
      },
      augenklappe: function (l, m) { const k = m.kopf, a = m.augen[0]; l.rect(a[0] - 1, a[1] - 1, 3, 3, "n"); l.rect(k.x, a[1] - 2, k.b, 1, "n"); },
      // Holzmaske: weiß, rote Bemalung, dunkle Augenlöcher
      holzmaske: function (l, m) {
        const k = m.kopf; l.rect(k.x, k.y + 2, k.b, k.h - 2, "w");
        m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1], 2, 2, "n"); l.px(a[0] - 1, a[1] + 3, "r"); l.px(a[0], a[1] + 4, "r"); l.px(a[0] + 1, a[1] + 3, "r"); });
        l.rect(k.x + Math.floor(k.b / 2) - 1, k.y + 2, 2, 2, "r"); l.rect(m.mund[0], m.mund[1], 2, 1, "R");
      },
      drittesauge: function (l, m) { const k = m.kopf, x = k.x + Math.floor(k.b / 2) - 1; l.rect(x - 1, k.y + 2, 4, 2, "w"); l.rect(x, k.y + 2, 2, 2, "r"); l.px(x, k.y + 2, "n"); },
      // Keine Augen im Gesicht (die sitzen woanders …)
      augenlos: function (l, m) { m.augen.forEach(function (a) { l.rect(a[0], a[1], 1, 2, "s"); l.px(a[0], a[1] + 1, "S"); }); l.rect(m.mund[0], m.mund[1], 2, 1, "S"); l.px(m.mund[0], m.mund[1] - 2, "n"); l.px(m.mund[0] + 1, m.mund[1] - 2, "n"); },
      // Wolfsschnauze mit Reißzähnen und gelben Augen
      wolfsschnauze: function (l, m) {
        const k = m.kopf, p = m.mund; l.rect(k.x + 1, p[1] - 2, k.b - 2, 4, "h"); l.rect(p[0] - 1, p[1] - 3, 4, 1, "h");
        l.rect(p[0], p[1] - 2, 2, 1, "n"); l.rect(k.x + 2, p[1] + 1, k.b - 4, 1, "n"); l.px(p[0] - 1, p[1] + 1, "w"); l.px(p[0] + 2, p[1] + 1, "w");
        m.augen.forEach(function (a) { l.px(a[0], a[1], "y"); });
      },
      // Unter der Kapuze nur Schatten – und zwei glimmende Punkte
      schattengesicht: function (l, m) { const k = m.kopf; l.rect(k.x + 1, k.y + 2, k.b - 2, k.h - 3, "n"); m.augen.forEach(function (a) { l.px(a[0], a[1] + 1, "y"); }); },
      // Hauer des Keilers
      hauer: function (l, m) { const p = m.mund; l.px(p[0], p[1], "w"); l.px(p[0] + 1, p[1] - 1, "w"); l.px(p[0] + 1, p[1] - 2, "w"); l.px(p[0] - 2, p[1], "w"); l.px(p[0] - 1, p[1] - 1, "w"); },
      naehmund: function (l, m) {
        const p = m.mund; l.rect(p[0] - 2, p[1], 6, 1, "n"); [-1, 1, 3].forEach(function (d) { l.px(p[0] + d, p[1] - 1, "n"); l.px(p[0] + d, p[1] + 1, "n"); });
        m.augen.forEach(function (a) { l.rect(a[0] - 1, a[1], 2, 2, "n"); });
      },
    },

    /* --- Waffen und Gegenstände (in der rechten Hand) --- */
    waffe: {
      krug: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 4, 4, 5, "y"); l.rect(h[0] + 1, h[1] - 5, 4, 1, "w"); l.px(h[0] + 5, h[1] - 3, "x"); l.px(h[0] + 5, h[1] - 2, "x"); l.rect(h[0] + 2, h[1] - 3, 1, 3, "Y"); },
      kelle: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 9, 1, 11, "x"); l.rect(h[0], h[1] - 12, 4, 3, "X"); l.rect(h[0] + 1, h[1] - 12, 2, 1, "x"); },
      dolch: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 6, 1, 6, "x"); l.rect(h[0], h[1], 3, 1, "y"); l.px(h[0] + 1, h[1] - 7, "w"); },
      kunai: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 5, 1, 5, "X"); l.px(h[0], h[1] - 4, "X"); l.px(h[0] + 2, h[1] - 4, "X"); l.px(h[0] + 1, h[1] + 2, "X"); },
      flasche: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 4, 3, 5, "j"); l.rect(h[0] + 2, h[1] - 7, 1, 3, "j"); l.px(h[0] + 2, h[1] - 8, "g"); l.px(h[0] + 1, h[1] - 3, "w"); },
      kolben: function (l, m) { const h = m.hand; l.rect(h[0], h[1] - 3, 4, 3, "u"); l.rect(h[0] + 1, h[1] - 6, 2, 3, "l"); l.px(h[0] + 3, h[1] - 3, "l"); },
      tuer: function (l, m) {
        const h = m.hand; l.rect(h[0] + 2, h[1] - 16, 6, 19, "g");
        for (let x = h[0] + 3; x < h[0] + 8; x += 2) l.rect(x, h[1] - 16, 1, 19, "G");
        l.rect(h[0] + 2, h[1] - 12, 6, 1, "X"); l.rect(h[0] + 2, h[1] - 1, 6, 1, "X");
      },
      schwert: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 11, 1, 10, "x"); l.rect(h[0] + 2, h[1] - 10, 1, 9, "X"); l.rect(h[0] - 1, h[1] - 1, 5, 1, "y"); l.px(h[0] + 1, h[1] + 2, "y"); },
      langschwert: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 15, 2, 14, "x"); l.rect(h[0] + 2, h[1] - 14, 1, 13, "X"); l.rect(h[0] - 1, h[1] - 1, 6, 1, "X"); l.px(h[0] + 1, h[1] + 2, "n"); },
      stab: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 17, 1, 25, "g"); l.rect(h[0], h[1] - 19, 3, 2, "G"); l.px(h[0] + 1, h[1] - 20, "G"); },
      stabrot: function (l, m) {
        const h = m.hand; l.rect(h[0] + 1, h[1] - 15, 1, 23, "x");
        l.rect(h[0] - 1, h[1] - 18, 5, 1, "y"); l.px(h[0] - 1, h[1] - 19, "y"); l.px(h[0] + 3, h[1] - 19, "y");
        l.rect(h[0], h[1] - 17, 3, 2, "r"); l.px(h[0] + 1, h[1] - 16, "y");
      },
      floete: function (l, m) { const p = m.mund; l.rect(p[0] + 2, p[1] + 1, 9, 1, "g"); [4, 6, 8].forEach(function (d) { l.px(p[0] + d, p[1] + 1, "G"); }); },
      /* Welt 2 */
      // Langbogen: Bogen nach rechts gewölbt, Sehne gerade
      langbogen: function (l, m) {
        const h = m.hand; for (let i = 0; i <= 22; i++) { const t = (i - 11) / 11; l.px(h[0] + 1 + Math.round(3 * (1 - t * t)), h[1] - 16 + i, "g"); }
        l.linie(h[0] + 1, h[1] - 16, h[0] + 1, h[1] + 6, "l"); l.px(h[0] + 4, h[1] - 5, "G");
      },
      schriftrolle: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 6, 3, 8, "q"); l.rect(h[0], h[1] - 7, 5, 1, "G"); l.rect(h[0], h[1] + 2, 5, 1, "G"); [-4, -2, 0].forEach(function (d) { l.px(h[0] + 2, h[1] + d, "Q"); }); },
      kraeuterkorb: function (l, m) {
        const h = m.hand; l.rect(h[0] - 1, h[1], 6, 4, "g"); for (let x = h[0]; x < h[0] + 5; x += 2) l.rect(x, h[1], 1, 4, "G");
        l.linie(h[0] - 1, h[1], h[0] + 2, h[1] - 3, "G"); l.linie(h[0] + 2, h[1] - 3, h[0] + 4, h[1], "G");
        l.px(h[0], h[1] - 1, "f"); l.px(h[0] + 1, h[1] - 2, "f"); l.px(h[0] + 3, h[1] - 1, "r"); l.px(h[0] + 3, h[1] - 2, "w");
      },
      krummsaebel: function (l, m) {
        const h = m.hand; for (let i = 0; i < 11; i++) { const x = h[0] + 1 + Math.round(i * i / 28); l.px(x, h[1] - 1 - i, "x"); l.px(x + 1, h[1] - 1 - i, "X"); }
        l.rect(h[0] - 1, h[1], 4, 1, "y"); l.px(h[0] + 1, h[1] + 1, "G");
      },
      speer: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 18, 1, 26, "g"); l.rect(h[0], h[1] - 21, 3, 3, "x"); l.px(h[0] + 1, h[1] - 22, "x"); l.px(h[0] + 1, h[1] - 23, "X"); l.px(h[0] + 2, h[1] - 17, "r"); },
      // Goldene Sichel (Druide)
      sichel: function (l, m) {
        const h = m.hand; l.rect(h[0] + 1, h[1] - 2, 1, 4, "g");
        [[1, -3], [2, -4], [3, -5], [4, -6], [4, -7], [4, -8], [3, -9], [2, -10]].forEach(function (d) { l.px(h[0] + d[0], h[1] + d[1], "y"); });
        l.px(h[0] + 3, h[1] - 7, "Y");
      },
      honigwabe: function (l, m) { const h = m.hand; l.rect(h[0] + 1, h[1] - 4, 5, 5, "y"); l.px(h[0] + 2, h[1] - 3, "Y"); l.px(h[0] + 4, h[1] - 3, "Y"); l.px(h[0] + 3, h[1] - 1, "Y"); l.rect(h[0] + 2, h[1] + 1, 1, 2, "Y"); },
      // Ein Ei im Maul (Fuchs)
      ei: function (l, m) { const p = m.mund; l.rect(p[0] + 1, p[1] - 1, 3, 3, "w"); l.px(p[0] + 2, p[1] - 2, "w"); l.px(p[0] + 2, p[1], "Q"); },
    },

    /* --- Extras (Kleidung, Begleiter, Umgebung) --- */
    extras: {
      flicken: function (l, m) { const r = m.rumpf; l.rect(r.x + 2, r.y + 2, 3, 3, "d"); l.rect(r.x + r.b - 5, r.y + 5, 3, 2, "y"); l.px(r.x + 3, r.y + 3, "n"); },
      stroh: function (l, m) { const r = m.rumpf; for (let x = r.x; x < r.x + r.b; x += 2) l.px(x, r.y + r.h, "q"); l.px(3, 21, "q"); l.px(32, 21, "q"); l.px(m.kopf.x + 2, m.kopf.y + m.kopf.h, "q"); },
      kraehe: function (l, m) {
        const x = m.arme[0].x - 1, y = m.arme[0].y - 4;
        l.rect(x, y, 4, 3, "n"); l.rect(x - 1, y - 2, 3, 2, "n"); l.px(x - 2, y - 1, "y"); l.px(x, y - 2, "w"); l.px(x + 4, y + 1, "n");
      },
      aermellos: function (l, m) { m.arme.forEach(function (a) { l.tausche(a.x, a.y, a.b, a.h, ["c", "C"], "s"); }); },
      weste: function (l, m) { const r = m.rumpf; l.rect(r.x, r.y, 4, r.h, "d"); l.rect(r.x + r.b - 4, r.y, 4, r.h, "D"); },
      schuerze: function (l, m) { const r = m.rumpf; l.rect(r.x + 3, r.y + 3, r.b - 6, r.h + 2, "w"); l.rect(r.x + 3, r.y, 1, 3, "w"); l.rect(r.x + r.b - 4, r.y, 1, 3, "w"); l.rect(r.x + 3, r.y + 6, r.b - 6, 1, "x"); },
      schulterdunkel: function (l, m) { const r = m.rumpf; l.rect(r.x, r.y, r.b, 3, "d"); m.arme.forEach(function (a) { l.rect(a.x, a.y, a.b, 2, "d"); }); l.rect(r.x + 4, r.y + 3, 2, 1, "w"); },
      hemdkragen: function (l, m) { const r = m.rumpf; l.rect(r.x + 3, r.y, 4, r.h - 2, "d"); l.px(r.x + 4, r.y + 3, "s"); l.px(r.x + 5, r.y + 3, "s"); l.rect(r.x, r.y + r.h - 3, r.b, 1, "n"); },
      schwertgriffe: function (l, m) {
        const k = m.kopf; [[k.x - 3, -1], [k.x + k.b + 2, 1]].forEach(function (s) {
          l.rect(s[0], k.y + 2, 1, 6, "n"); l.rect(s[0] - 1, k.y + 7, 3, 1, "x"); l.px(s[0], k.y + 1, "x");
        });
      },
      medaillon: function (l, m) { const r = m.rumpf, x = r.x + Math.floor(r.b / 2) - 1; l.rect(x, r.y + 3, 2, 2, "x"); l.px(x, r.y + 2, "X"); l.px(x + 1, r.y + 2, "X"); },
      bauchbinde: function (l, m) { const r = m.rumpf; l.rect(r.x, r.y + r.h - 4, r.b, 3, "d"); },
      dreischwerter: function (l, m) {
        const r = m.rumpf; ["w", "r", "n"].forEach(function (f, i) {
          l.rect(r.x - 2 - i, r.y + r.h - 6 + i, 1, 4, f); l.px(r.x - 1 - i, r.y + r.h - 2 + i, "y");
          l.rect(r.x + 1 - i, r.y + r.h - 1 + i, 1, 4, "X");
        });
      },
      kragen: function (l, m) { const k = m.kopf; l.rect(k.x - 1, k.y + k.h - 2, 3, 4, "c"); l.rect(k.x + k.b - 2, k.y + k.h - 2, 3, 4, "c"); l.rect(k.x + 1, k.y + k.h, k.b - 2, 1, "c"); },
      gross: function () {},
      einarm: function (l, m) {
        const a = m.arme[0]; l.rect(a.x, a.y, a.b, a.h + 2, null); l.rect(m.hand2[0], m.hand2[1], 2, 2, null);
        l.rect(a.x, a.y, a.b, 2, "c"); l.px(a.x, a.y + 2, "R"); l.px(a.x + 1, a.y + 2, "R");
      },
      plattenruestung: function (l, m) {
        const r = m.rumpf; l.rect(r.x + 1, r.y + 1, 1, r.h - 2, "d"); l.rect(r.x, r.y + 4, r.b, 1, "d"); l.rect(r.x, r.y + 7, r.b, 1, "d");
        m.arme.forEach(function (a) { l.rect(a.x - 1, a.y - 1, a.b + 2, 3, "d"); });
      },
      umhang: function (l, m) { const r = m.rumpf; l.rect(r.x - 2, r.y + 1, 2, r.h + 4, "d"); l.rect(r.x + r.b, r.y + 1, 2, r.h + 4, "D"); l.rect(r.x + 1, r.y, r.b - 2, 1, "y"); },
      bunt: function (l, m) {
        const r = m.rumpf; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.b; x++) {
          if ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 && (l.farbe(x, y) === "c" || l.farbe(x, y) === "C")) l.px(x, y, "d");
        }
      },
      ratten: function (l) {
        [[2, 29, 1], [27, 30, -1]].forEach(function (r) {
          const x = r[0], y = r[1]; l.rect(x, y, 5, 2, "X"); l.rect(x + (r[2] > 0 ? 4 : -1), y - 1, 2, 2, "X");
          l.px(x + (r[2] > 0 ? 5 : -1), y - 1, "r"); l.rect(x + (r[2] > 0 ? -2 : 5), y + 1, 2, 1, "i");
        });
      },
      kette: function (l, m) { const h = m.hand2; for (let i = 0; i < 9; i++) l.px(h[0] - 1 - Math.floor(i / 3), h[1] + 2 + i, i % 2 ? "X" : "x"); },
      pelz: function (l, m) {
        const r = m.rumpf; l.rect(r.x - 2, r.y - 1, r.b + 4, 4, "F");
        for (let x = r.x - 2; x < r.x + r.b + 2; x += 2) l.px(x, r.y + 3, "F");
        l.rect(r.x - 2, r.y + 3, 2, r.h, "F"); l.rect(r.x + r.b, r.y + 3, 2, r.h, "F");
      },
      muskeln: function (l, m) {
        const r = m.rumpf; for (let x = r.x + 2; x < r.x + r.b - 1; x += 3) l.rect(x, r.y + 1, 1, r.h - 2, "C");
        l.rect(r.x + 3, r.y + 4, r.b - 6, 1, "C"); m.arme.forEach(function (a) { l.rect(a.x + 1, a.y + 3, 1, a.h - 3, "S"); });
      },
      /* Welt 2 */
      // Köcher mit Pfeilen auf dem Rücken
      koecher: function (l, m) { const r = m.rumpf; l.rect(r.x - 2, r.y - 3, 3, 9, "G"); [[-2, "r"], [-1, "w"], [0, "r"]].forEach(function (p) { l.px(r.x + p[0], r.y - 4, p[1]); l.px(r.x + p[0], r.y - 5, "g"); }); },
      // Halstuch – bei Tieren um den Hals, sonst unter dem Kinn
      halstuch: function (l, m) {
        const h = m.hals || { x: m.kopf.x, y: m.kopf.y + m.kopf.h, b: m.kopf.b };
        l.rect(h.x, h.y, h.b, 2, "d"); l.rect(h.x + 1, h.y + 2, 2, 1, "d"); l.px(h.x + 1, h.y + 3, "D");
      },
      // Kleine Kröte zu Füßen
      kroete: function (l) { l.rect(2, 28, 6, 3, "j"); l.rect(3, 27, 4, 1, "j"); l.px(3, 26, "y"); l.px(6, 26, "y"); l.rect(3, 29, 4, 1, "n"); l.px(1, 30, "j"); l.px(8, 30, "j"); },
      buckel: function (l, m) { const r = m.rumpf; l.rect(r.x - 2, r.y - 1, 3, 5, "c"); l.px(r.x - 1, r.y - 2, "c"); },
      // Brodelnder Kessel (links unten); der Dampf kommt nach dem Umriss
      kessel: function (l) { l.rect(1, 25, 9, 6, "n"); l.rect(0, 24, 11, 1, "X"); l.rect(2, 24, 7, 1, "j"); l.px(3, 23, "f"); l.px(6, 23, "f"); l.px(2, 31, "n"); l.px(8, 31, "n"); l.rect(2, 27, 2, 1, "X"); },
      // Mantel aus Rabenfedern (hinter dem Körper), Federn an den Schultern
      rabenmantel: function (l, m) {
        const r = m.rumpf; l.rect(r.x - 3, r.y, 3, r.h + 5, "n"); l.rect(r.x + r.b, r.y, 3, r.h + 5, "n");
        for (let y = r.y + 3; y < r.y + r.h + 5; y += 3) { l.px(r.x - 4, y, "n"); l.px(r.x + r.b + 3, y + 1, "n"); }
        m.arme.forEach(function (a, i) { const x = i ? a.x + a.b : a.x - 2; l.rect(x, a.y - 3, 2, 3, "n"); l.px(x + (i ? 2 : -1), a.y - 4, "n"); l.px(x + (i ? 1 : 0), a.y - 2, "v"); });
      },
      // Hängende Männchen aus Reisig links und rechts
      reisigmaennchen: function (l) {
        [[4, 2], [31, 6]].forEach(function (p) {
          const x = p[0], y = p[1];
          l.rect(x, y - 7, 1, 3, "Q");                                     // Schnur
          l.px(x - 1, y - 3, "G"); l.px(x + 1, y - 3, "G"); l.px(x, y - 4, "G"); // Kopf: Zweigring
          l.rect(x, y - 2, 1, 7, "G"); l.rect(x - 2, y, 5, 1, "G");          // Körper, Arme
          l.px(x - 1, y + 5, "G"); l.px(x - 2, y + 6, "G"); l.px(x + 1, y + 5, "G"); l.px(x + 2, y + 6, "G");
          l.px(x - 3, y - 1, "G"); l.px(x + 3, y + 1, "G");
        });
      },
      jagdhorn: function (l, m) { const r = m.rumpf; l.linie(r.x + r.b - 3, r.y + 6, r.x + r.b + 2, r.y + 4, "q"); l.rect(r.x + r.b + 1, r.y + 2, 2, 3, "q"); l.px(r.x + r.b - 1, r.y + 5, "y"); },
      // Erhobene Arme mit je einem Auge in der Handfläche
      augenhaende: function (l, m) {
        m.arme.forEach(function (a) { l.rect(a.x, a.y, a.b, a.h + 2, null); });
        [m.hand2, m.hand].forEach(function (h, i) { l.rect(h[0], h[1] + 2, 2, 2, null); });
        m.arme.forEach(function (a, i) {
          const x = i ? a.x + 1 : a.x - 1;
          l.rect(x, a.y - 9, 2, 10, "s"); l.rect(x - 1, a.y - 13, 4, 4, "s");
          l.rect(x, a.y - 12, 2, 2, "w"); l.px(x + (i ? 0 : 1), a.y - 12, "r"); l.px(x + (i ? 1 : 0), a.y - 11, "n");
          l.px(x - 1, a.y - 14, "s"); l.px(x + 2, a.y - 14, "s");          // Finger
        });
      },
      // Zerrissenes Hemd (Werwolf)
      zerrissen: function (l, m) {
        const r = m.rumpf; for (let x = r.x; x < r.x + r.b; x++) if (x % 3 !== 1) l.px(x, r.y + r.h - 1, x % 2 ? "s" : null);
        l.linie(r.x + 3, r.y + 2, r.x + 6, r.y + 6, "s"); l.linie(r.x + r.b - 4, r.y + 3, r.x + r.b - 7, r.y + 8, "s");
      },
      krallen: function (l, m) { [m.hand, m.hand2].forEach(function (h) { l.px(h[0], h[1] + 2, "w"); l.px(h[0] + 1, h[1] + 2, "w"); l.px(h[0] + 2, h[1] + 1, "w"); }); },
      // Vollmond hinter der Figur (links oben)
      vollmond: function (l) { for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 26) l.px(6 + x, -1 + y, (x + 1) * (x + 1) + (y - 1) * (y - 1) <= 3 || (x - 3) * (x - 3) + (y + 2) * (y + 2) <= 1 ? "Q" : "q"); },
      // Thron aus Wurzeln: Lehne hinter der Figur, Wurzeln über den Beinen
      wurzelthron: function (l, m) {
        const r = m.rumpf;
        for (let x = r.x - 5; x < r.x + r.b + 5; x++) { const oben = 4 + Math.round(Math.abs(x - 18) / 3); l.rect(x, oben, 1, 28 - oben, (x % 3) ? "G" : "g"); }
      },
      wurzeln: function (l) {
        [[14, 25, 5, 32], [21, 25, 31, 32], [17, 26, 17, 32], [12, 22, 2, 30], [24, 22, 34, 29]].forEach(function (w) { l.linie(w[0], w[1], w[2], w[3], "g"); l.linie(w[0] + 1, w[1], w[2] + 1, w[3], "G"); });
      },
      // Kein Kopf – nur ein hoher Kragen über dem Hals
      kopflos: function (l, m) {
        const k = m.kopf; l.rect(k.x - 1, k.y - 6, k.b + 2, k.h + 6, null);
        l.rect(k.x + 1, k.y + k.h - 3, k.b - 2, 3, "d"); l.rect(k.x + 3, k.y + k.h - 4, k.b - 6, 1, "R");
      },
      // Leuchtende Kürbislaterne in der linken Hand
      kuerbislaterne: function (l, m) {
        const h = m.hand2; l.rect(h[0] - 4, h[1], 6, 5, "o"); l.rect(h[0] - 3, h[1] - 1, 4, 1, "o"); l.px(h[0] - 1, h[1] - 2, "G");
        l.px(h[0] - 3, h[1] + 1, "y"); l.px(h[0], h[1] + 1, "y"); l.rect(h[0] - 3, h[1] + 3, 4, 1, "y"); l.px(h[0] - 2, h[1] + 4, "O");
      },
      // Borstenkamm auf dem Rücken (Keiler)
      borsten: function (l, m) {
        const r = m.rumpf; for (let x = r.x + 2; x < r.x + r.b; x++) {
          let y = -6; while (y < 33 && l.farbe(x, y) === null) y++;
          if (x % 2 === 0) l.px(x, y - 1, "h"); if (x % 4 === 0) l.px(x, y - 2, "h");
        }
      },
      mauer: function (l) {
        l.rect(0, 22, 36, 12, "M");
        for (let y = 22; y < 34; y += 3) { l.rect(0, y, 36, 1, "N"); for (let x = (y / 3) % 2 ? 2 : 5; x < 36; x += 6) l.rect(x, y, 1, 3, "N"); }
      },
    },
  };

  // Teile, die erst nach dem Umriss kommen (Dampf, Rauch – durchscheinend)
  const NACH_UMRISS = {
    dampf: function (l, m) {
      const k = m.kopf; [[k.x - 4, k.y - 2], [k.x + k.b + 2, k.y - 1], [k.x - 2, k.y - 6], [k.x + k.b, k.y - 5], [k.x + 3, k.y - 4]].forEach(function (p) {
        l.rect(p[0], p[1], 3, 2, "z"); l.px(p[0] + 1, p[1] - 1, "z");
      });
    },
    pfeife: function (l, m) { const p = m.mund; [[6, -2], [7, -4], [6, -6], [8, -7]].forEach(function (d) { l.px(p[0] + d[0], p[1] + d[1], "z"); l.px(p[0] + d[0] + 1, p[1] + d[1], "z"); }); },
    /* Welt 2 */
    kessel: function (l) { [[2, 21], [5, 19], [3, 16], [6, 14]].forEach(function (p) { l.rect(p[0], p[1], 2, 2, "z"); l.px(p[0] + 1, p[1] - 1, "z"); }); },
    // Nebelschweif unter dem Irrlicht
    nebelschweif: function (l) { for (let x = 6; x < 31; x++) { const y = 28 + Math.round(Math.sin(x / 2.5) * 1.5); l.leerPx(x, y, "z"); if (x % 3) l.leerPx(x, y + 1, "z"); if (x % 5 === 0) l.leerPx(x, y - 1, "z"); } },
    // Funken um das Irrlicht
    flackern: function (l) { [[6, 4], [30, 2], [4, 16], [32, 14], [27, -3], [9, -2]].forEach(function (p) { l.leerPx(p[0], p[1], "z"); l.leerPx(p[0] + 1, p[1], "z"); l.leerPx(p[0], p[1] + 1, "z"); }); },
    // Spinnennetz hinter der Spinne (nur auf leeren Feldern)
    netz: function (l) {
      const mx = 1, my = -5;
      [[35, -5], [35, 8], [26, 20], [12, 26], [1, 20]].forEach(function (z) {
        const n = Math.max(Math.abs(z[0] - mx), Math.abs(z[1] - my));
        for (let i = 0; i <= n; i++) l.leerPx(Math.round(mx + (z[0] - mx) * i / n), Math.round(my + (z[1] - my) * i / n), "z");
      });
      [8, 15, 22].forEach(function (r) { for (let a = 0; a <= 90; a += 3) { const w = a * Math.PI / 180; l.leerPx(Math.round(mx + r * Math.cos(w) * 1.4), Math.round(my + r * Math.sin(w)), "z"); } });
    },
  };

  // Extras, die hinter dem Körper liegen (vor ihm gezeichnet werden)
  const HINTEN = ["umhang", "rabenmantel", "wurzelthron", "vollmond"];

  /** Palette eines Bauplans: Grundfarben + Farben des Bosses (+ dunklere Schattierungen). */
  function bauPalette(bau, durchscheinend) {
    const f = bau.farben || {};
    const p = Object.assign({}, GRUNDFARBEN);
    const paare = { s: "haut", h: "haare", c: "kleid", d: "kleid2", p: "hose", b: "schuhe" };
    const standard = { haut: "#efc29c", haare: "#5a3a22", kleid: "#6b7fa8", kleid2: "#9aa4b1", hose: "#4a4a5a", schuhe: "#4a3424" };
    Object.keys(paare).forEach(function (z) {
      const farbe = f[paare[z]] || standard[paare[z]];
      p[z] = farbe; p[z.toUpperCase()] = dunkler(farbe);
    });
    if (f.augen) p.e = f.augen;
    if (durchscheinend) ["s", "S", "c", "C", "h", "H", "d", "D"].forEach(function (z) { p[z] += "c0"; });
    return p;
  }

  /** Baut einen Boss aus dem Bauplan → { leinwand, palette }. */
  function baueBoss(bau) {
    if (bau.eigen && EIGENE[bau.eigen]) return EIGENE[bau.eigen]();
    const l = leinwand(36, 40, 6);
    const extras = bau.extras || [];
    const plan = Object.assign({}, bau, { extras: extras });
    // Umhang, Rabenmantel, Wurzelthron und Vollmond liegen hinter dem Körper
    const masse = KOERPER[bau.koerper || "mensch"](leinwand(36, 40, 6), plan);
    HINTEN.forEach(function (id) { if (extras.indexOf(id) !== -1) TEILE.extras[id](l, masse); });
    KOERPER[bau.koerper || "mensch"](l, plan);
    extras.forEach(function (id) { if (HINTEN.indexOf(id) === -1 && id !== "mauer" && TEILE.extras[id]) TEILE.extras[id](l, masse); });
    if (bau.haare && TEILE.haare[bau.haare]) TEILE.haare[bau.haare](l, masse);
    (bau.gesicht || []).forEach(function (id) { if (TEILE.gesicht[id]) TEILE.gesicht[id](l, masse); });
    if (bau.kopf && TEILE.kopf[bau.kopf]) TEILE.kopf[bau.kopf](l, masse);
    if (bau.waffe && TEILE.waffe[bau.waffe]) TEILE.waffe[bau.waffe](l, masse);
    if (extras.indexOf("mauer") !== -1) TEILE.extras.mauer(l, masse);       // vor allem anderen
    umriss(l);
    extras.concat(bau.gesicht || []).forEach(function (id) { if (NACH_UMRISS[id]) NACH_UMRISS[id](l, masse); });
    return { leinwand: l, palette: bauPalette(bau, masse.durchscheinend) };
  }

  // Eigene, größere Sprites (Weltbosse): 48 × 48 (+2 Pixel oben)
  const EIGENE = {
    /* Der Erntekönig: riesige Vogelscheuche aus Garben, Krähenkrone, Sense, Kürbiskopf */
    erntekoenig: function () {
      const l = leinwand(48, 50, 2);
      // Sense hinter dem Körper: Stiel rechts, Klinge oben nach links
      l.rect(41, 6, 2, 40, "g");
      for (let i = 0; i < 14; i++) l.rect(28 + i, 4 + Math.round(Math.pow((i - 13) / 13, 2) * 4), 1, 2 + (i > 3 ? 1 : 0), "x");
      l.rect(28, 7, 6, 1, "X");
      // Pfahl und Querstange
      l.rect(22, 36, 4, 12, "g");
      l.rect(3, 22, 42, 3, "g");
      // Körper aus Garben, darüber ein zerlumpter Umhang
      l.rect(14, 21, 20, 17, "q");
      for (let x = 15; x < 34; x += 3) l.rect(x, 22, 1, 15, "Q");
      l.rect(12, 20, 24, 6, "R"); l.rect(13, 26, 4, 5, "R"); l.rect(31, 26, 4, 6, "R"); l.rect(20, 26, 3, 3, "R");
      l.rect(14, 33, 20, 2, "G");                 // Strick um die Garben
      for (let x = 14; x < 35; x += 2) l.px(x, 38, "q");
      // Ärmel und Strohhände
      l.rect(4, 21, 9, 5, "R"); l.rect(35, 21, 8, 5, "R");
      l.rect(1, 21, 3, 5, "q"); l.px(0, 22, "q"); l.px(0, 24, "q");
      l.rect(43, 22, 2, 4, "q");
      // Kürbiskopf mit glühenden Augen und gezacktem Mund
      l.rect(16, 9, 16, 11, "o"); l.rect(18, 8, 12, 1, "o"); l.rect(18, 20, 12, 1, "O");
      for (let x = 19; x < 30; x += 4) l.rect(x, 9, 1, 11, "O");
      l.rect(23, 6, 2, 2, "G");
      [[19, 12], [26, 12]].forEach(function (a) { l.rect(a[0], a[1], 3, 2, "y"); l.px(a[0] + 1, a[1] - 1, "y"); });
      for (let x = 19; x < 30; x++) l.px(x, 16 + (x % 2), "Y");
      l.rect(19, 17, 11, 1, "Y");
      // Krone aus Krähen
      l.rect(17, 6, 14, 2, "y");
      [[16, 1], [22, 0], [28, 1]].forEach(function (k) {
        l.rect(k[0], k[1] + 2, 4, 3, "n"); l.rect(k[0] + 1, k[1], 2, 2, "n"); l.px(k[0] + 3, k[1] + 1, "y"); l.px(k[0] + 1, k[1], "r");
      });
      umriss(l);
      return { leinwand: l, palette: Object.assign({}, GRUNDFARBEN) };
    },

    /* Urborke, der Erwachte (Welt 2): uralter Baumriese – Laubkrone mit
       Eulennest, Rindengesicht mit glühenden Augen, Moosbart, Astarme,
       Wurzelbeine */
    urborke: function () {
      const l = leinwand(48, 50, 2);
      const farben = { t: "#7a5434", T: "#4e3420", a: "#2f6a3a", A: "#1f4a28", b: "#6f9a3a" };
      // Wurzelbeine, breit auslaufend
      [[17, 36, 3, 47], [20, 37, 12, 47], [24, 37, 24, 47], [28, 37, 36, 47], [31, 36, 45, 47]].forEach(function (w) {
        l.linie(w[0], w[1], w[2], w[3], "t"); l.linie(w[0] + 1, w[1], w[2] + 1, w[3], "t"); l.linie(w[0] + 2, w[1], w[2] + 2, w[3], "T");
      });
      // Astarme, nach oben gereckt, mit Zweigen
      [[16, 22, 4, 12, -1], [32, 22, 44, 12, 1]].forEach(function (a) {
        l.linie(a[0], a[1], a[2], a[3], "t"); l.linie(a[0], a[1] + 1, a[2], a[3] + 1, "t"); l.linie(a[0], a[1] + 2, a[2], a[3] + 2, "T");
        l.linie(a[2], a[3], a[2] - 2 * a[4], a[3] - 5, "t"); l.linie(a[2] + 2 * a[4], a[3] + 4, a[2] + 4 * a[4], a[3] - 1, "t");
        [[a[2] - 2 * a[4], a[3] - 6], [a[2] + 4 * a[4], a[3] - 2]].forEach(function (b) { l.rect(b[0] - 1, b[1] - 1, 3, 3, "b"); l.px(b[0], b[1] - 2, "a"); });
      });
      // Stamm mit Rindenfurchen
      l.rect(15, 14, 18, 24, "t");
      for (let x = 16; x < 33; x += 3) l.rect(x, 15 + (x % 2), 1, 21, "T");
      // Gesicht: tiefe Höhlen mit glühenden Augen, knorriger Mund
      [[18, 19], [26, 19]].forEach(function (a) { l.rect(a[0], a[1], 5, 4, "n"); l.rect(a[0] + 1, a[1] + 1, 3, 2, "y"); l.px(a[0] + 2, a[1] + 1, "w"); });
      l.rect(17, 18, 7, 1, "T"); l.rect(25, 18, 7, 1, "T");               // schwere Brauen
      l.rect(20, 26, 9, 3, "n"); l.px(21, 26, "t"); l.px(24, 28, "t"); l.px(27, 26, "t");
      // Moosbart bis zur Hüfte
      for (let x = 18; x < 31; x++) { const lang = 4 + ((x * 7) % 5); l.rect(x, 29, 1, lang, x % 2 ? "a" : "A"); }
      // Laubkrone
      for (let y = -6; y <= 8; y++) for (let x = -22; x <= 22; x++) {
        if ((x * x) / 484 + (y * y) / 64 <= 1) l.px(24 + x, 7 + y, (x * 3 + y * 5) % 7 === 0 ? "b" : y > 4 ? "A" : "a");
      }
      l.rect(15, 14, 18, 1, "A");
      // Eulennest in der Krone, die Eule schaut heraus
      l.rect(31, 2, 8, 2, "G"); l.rect(32, -1, 5, 3, "q"); l.px(33, 0, "y"); l.px(35, 0, "y"); l.px(34, 1, "o"); l.px(32, -2, "q"); l.px(36, -2, "q");
      umriss(l);
      return { leinwand: l, palette: Object.assign({}, GRUNDFARBEN, farben) };
    },
  };


  /* ------------------------------------------------------------------------
     HINTERGRÜNDE DER WELTEN
     Kleine Pixel-Szenen (160 × 132) in den Farben der Welt (welt.farben),
     per CSS auf die ganze Bühne gestreckt.
     ------------------------------------------------------------------------ */

  /** Mischt zwei Farben "#rrggbb" (anteil 0 = a, 1 = b). */
  function mische(a, b, anteil) {
    return "#" + [1, 3, 5].map(function (i) {
      const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
      return Math.round(x + (y - x) * anteil).toString(16).padStart(2, "0");
    }).join("");
  }

  /** Pseudo-Zufall mit festem Startwert – derselbe Hintergrund bei jedem Zeichnen. */
  function fest(startwert) {
    let s = startwert;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  const HINTERGRUENDE = {
    // Gemeinsam: Himmel in Streifen, Horizont bei 52 %, Boden mit Sprenkeln
    grund: function (ctx, f, B, H) {
      const horizont = Math.round(H * 0.52);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = mische(f.himmelOben, f.himmelUnten, i / 5);
        ctx.fillRect(0, Math.round(i * horizont / 6), B, Math.ceil(horizont / 6) + 1);
      }
      ctx.fillStyle = f.boden; ctx.fillRect(0, horizont, B, H - horizont);
      const z = fest(7);
      ctx.fillStyle = f.bodenDunkel;
      for (let i = 0; i < 220; i++) ctx.fillRect(Math.floor(z() * B), horizont + 2 + Math.floor(z() * (H - horizont)), 2, 1);
      return horizont;
    },
    felder: function (ctx, f, B, H) {
      const horizont = HINTERGRUENDE.grund(ctx, f, B, H);
      // Wolken
      ctx.fillStyle = "#ffffff";
      [[18, 10], [88, 6], [128, 16]].forEach(function (w) { ctx.fillRect(w[0], w[1], 16, 3); ctx.fillRect(w[0] + 3, w[1] - 2, 9, 2); ctx.fillRect(w[0] + 6, w[1] - 3, 4, 1); });
      // Hügel in der Ferne
      ctx.fillStyle = f.fern;
      for (let x = 0; x < B; x++) { const h = Math.round(7 + 4 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3)); ctx.fillRect(x, horizont - h, 1, h); }
      // Taverne links am Horizont: Haus, rotes Dach, Schild
      ctx.fillStyle = "#d8c49a"; ctx.fillRect(8, horizont - 16, 22, 14);
      ctx.fillStyle = "#a8323a"; for (let r = 0; r < 7; r++) ctx.fillRect(6 + r, horizont - 17 - r, 26 - 2 * r, 1);
      ctx.fillStyle = "#5e3c22"; ctx.fillRect(16, horizont - 9, 5, 7); ctx.fillRect(31, horizont - 14, 1, 7); ctx.fillRect(31, horizont - 14, 6, 1);
      ctx.fillStyle = "#f2c230"; ctx.fillRect(33, horizont - 12, 4, 3);
      ctx.fillStyle = "#7cc4f0"; ctx.fillRect(11, horizont - 13, 3, 3); ctx.fillRect(24, horizont - 13, 3, 3);
      // Weizenfeld: Reihen in der Akzentfarbe
      ctx.fillStyle = f.akzent;
      for (let y = horizont + 3; y < horizont + 20; y += 3) for (let x = (y % 2) * 2; x < B; x += 4) ctx.fillRect(x, y, 2, 1);
      // Zaun
      ctx.fillStyle = "#8a5a32";
      const zaun = horizont + 1;
      ctx.fillRect(0, zaun - 4, B, 1); ctx.fillRect(0, zaun - 1, B, 1);
      for (let x = 2; x < B; x += 12) ctx.fillRect(x, zaun - 6, 2, 7);
    },
    // Welt 2: dichter Wald – Stämme in der Tiefe, Laubdach, Lichtstrahlen
    // durch die Kronen, Farne am Boden und Nebel
    wald: function (ctx, f, B, H) {
      const horizont = HINTERGRUENDE.grund(ctx, f, B, H);
      const z = fest(21);
      // Stämme in der Ferne (schmal, in der Fernfarbe)
      for (let x = 2; x < B; x += 9 + Math.floor(z() * 6)) {
        const b = 2 + Math.floor(z() * 3);
        ctx.fillStyle = f.fern; ctx.fillRect(x, 0, b, horizont + 2);
        ctx.fillStyle = mische(f.fern, f.himmelOben, 0.4); ctx.fillRect(x + b - 1, 0, 1, horizont + 2);
      }
      // Laubdach oben: Blattballen in zwei Tönen
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(z() * B), y = Math.floor(z() * 26) - 4, r = 4 + Math.floor(z() * 7);
        ctx.fillStyle = i % 3 ? f.bodenDunkel : mische(f.bodenDunkel, f.akzent, 0.25);
        for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(x - w, y + dy, w * 2, 1); }
      }
      // Lichtstrahlen schräg durch die Kronen
      [[24, 9], [70, 6], [118, 11]].forEach(function (s) {
        ctx.fillStyle = "rgba(255, 246, 196, 0.13)";
        for (let y = 10; y < horizont + 18; y++) ctx.fillRect(s[0] + Math.floor(y * 0.45), y, s[1], 1);
      });
      // Nahe Stämme links und rechts: braun, mit Rindenfurchen und Wurzeln
      [[0, 14], [140, 16]].forEach(function (s) {
        ctx.fillStyle = f.stamm || "#5a3e28"; ctx.fillRect(s[0], 0, s[1], horizont + 6);
        ctx.fillRect(s[0] - 3, horizont + 2, s[1] + 6, 3);
        ctx.fillStyle = f.stammDunkel || "#3c2818";
        for (let x = s[0] + 2; x < s[0] + s[1]; x += 4) ctx.fillRect(x, 0, 1, horizont + 4);
      });
      // Farne und Büsche am Horizont
      ctx.fillStyle = f.bodenDunkel;
      for (let x = 0; x < B; x += 5) { const h = 3 + Math.floor(z() * 5); ctx.fillRect(x, horizont - h, 3, h + 1); ctx.fillRect(x - 1, horizont - h + 1, 1, 2); ctx.fillRect(x + 3, horizont - h + 2, 1, 2); }
      // Pilze hier und da
      [[30, 6], [101, 10], [126, 4]].forEach(function (p) { ctx.fillStyle = "#e8e0c8"; ctx.fillRect(p[0] + 1, horizont + p[1], 1, 2); ctx.fillStyle = "#c2493f"; ctx.fillRect(p[0], horizont + p[1] - 1, 3, 1); });
      // Bodennebel: halbdurchsichtige, gewellte Schwaden
      for (let y = horizont - 4; y < H; y += 3) {
        ctx.fillStyle = "rgba(225, 238, 225, " + (y < horizont + 6 ? 0.16 : 0.09) + ")";
        for (let x = 0; x < B; x += 2) if (Math.sin(x / 9 + y) > -0.2) ctx.fillRect(x, y + Math.round(Math.sin(x / 7 + y / 3)), 2, 2);
      }
    },
    hoehlen: function (ctx, f, B, H) {
      const horizont = HINTERGRUENDE.grund(ctx, f, B, H);
      ctx.fillStyle = f.fern;
      for (let x = 0; x < B; x += 9) { const h = 6 + (x * 13) % 14; for (let r = 0; r < h; r++) ctx.fillRect(x + Math.floor(r / 3), r, Math.max(1, 6 - Math.floor(r / 2)), 1); }
      ctx.fillStyle = f.akzent; ctx.fillRect(20, horizont - 20, 3, 4); ctx.fillRect(130, horizont - 24, 3, 4);
      ctx.fillStyle = "#8a5a32"; ctx.fillRect(0, horizont + 14, B, 1); ctx.fillRect(0, horizont + 20, B, 1);
      for (let x = 0; x < B; x += 6) ctx.fillRect(x, horizont + 13, 2, 9);
    },
    schnee: function (ctx, f, B, H) {
      const horizont = HINTERGRUENDE.grund(ctx, f, B, H);
      [[10, 40], [60, 52], [115, 44]].forEach(function (b) {
        for (let r = 0; r < b[1]; r++) {
          ctx.fillStyle = r < b[1] * 0.3 ? "#ffffff" : f.fern;
          ctx.fillRect(b[0] + b[1] / 2 - r * 0.8, horizont - b[1] + r, r * 1.6 + 1, 1);
        }
      });
      ctx.fillStyle = "#3f6f5a";
      for (let x = 6; x < B; x += 22) for (let r = 0; r < 10; r++) ctx.fillRect(x + 5 - r / 2, horizont - 10 + r, r + 1, 1);
    },
  };

  /** Zeichnet den Hintergrund einer Welt auf ein Canvas. */
  function zeichneHintergrund(canvas, welt) {
    const B = 160, H = 132;
    canvas.width = B; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const malen = HINTERGRUENDE[welt.hintergrund] || HINTERGRUENDE.grund;
    malen(ctx, welt.farben, B, H);
  }



  /* ------------------------------------------------------------------------
     FARBEN VERSCHIEBEN (für wiederkehrende Bosse in späteren Runden)
     ------------------------------------------------------------------------ */

  /** Dreht den Farbton einer Farbe "#rrggbb" um "grad" Grad. Graustufen bleiben grau. */
  function farbtonDrehen(hex, grad) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return hex;                     // grau → unverändert
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60 + grad) % 360 + 360) % 360 / 360;

    function kanal(t) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return "#" + [kanal(h + 1 / 3), kanal(h), kanal(h - 1 / 3)]
      .map(function (x) { return Math.round(x * 255).toString(16).padStart(2, "0"); }).join("");
  }



  /* ------------------------------------------------------------------------
     ZEICHNEN
     ------------------------------------------------------------------------ */

  /**
   * Zeichnet eine Figur auf ein Canvas (1 Pixel der Figur = 1 Canvas-Pixel;
   * vergrößert wird per CSS mit image-rendering: pixelated).
   * @param {HTMLCanvasElement} canvas
   * @param {string|object} figur – Name einer festen Figur (z. B. "held") oder
   *                                Bauplan eines Bosses (siehe Baukasten)
   * @param {number} runde – 0 = Originalfarben, 1, 2 … = andere Farbpalette
   *                         (wiederkehrende Bosse im 2., 3. … Durchlauf)
   */
  function zeichne(canvas, figur, runde) {
    let raster, palette;
    if (typeof figur === "string") {
      const f = FIGUREN[figur];
      if (!f) return;
      raster = f.raster.map(function (zeile) { return zeile.split("").map(function (z) { return z === "." ? null : z; }); });
      palette = f.palette;
    } else if (figur) {
      const b = baueBoss(figur);
      raster = b.leinwand.z;
      palette = b.palette;
    } else {
      return;
    }
    const hoehe = raster.length;
    const breite = raster[0].length;
    canvas.width = breite;
    canvas.height = hoehe;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, breite, hoehe);

    const drehung = (runde || 0) * 75;               // pro Runde 75° weiter im Farbkreis
    const farben = {};
    Object.keys(palette).forEach(function (zeichen) {
      const p = palette[zeichen];
      // Durchsichtige Farben (#rrggbbaa): Farbton drehen, Deckkraft behalten
      farben[zeichen] = drehung && zeichen !== "k" ? farbtonDrehen(p.slice(0, 7), drehung) + p.slice(7) : p;
    });

    raster.forEach(function (zeile, y) {
      for (let x = 0; x < zeile.length; x++) {
        const zeichen = zeile[x];
        if (zeichen === null || !farben[zeichen]) continue;
        ctx.fillStyle = farben[zeichen];
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  return {
    FIGUREN: FIGUREN,
    zeichne: zeichne,
    zeichneHintergrund: zeichneHintergrund,
    baueBoss: baueBoss,
    // Namen aller Bausteine (für Prüfungen der Baupläne)
    bausteine: {
      koerper: Object.keys(KOERPER), eigene: Object.keys(EIGENE), hintergruende: Object.keys(HINTERGRUENDE),
      haare: Object.keys(TEILE.haare), kopf: Object.keys(TEILE.kopf), gesicht: Object.keys(TEILE.gesicht),
      waffe: Object.keys(TEILE.waffe), extras: Object.keys(TEILE.extras).concat(Object.keys(NACH_UMRISS)),
    },
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = SudokuSprites;
}
