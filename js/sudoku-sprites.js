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

  };

  /* ------------------------------------------------------------------------
     BAUKASTEN FÜR BOSSE
     Ein Boss-Sprite entsteht aus einem Bauplan (siehe js/worlds/welt1.js):
       koerper – Grundkörper: mensch, huene, tier, geist, konstrukt
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
  };

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
    // Umhang und Pelz liegen hinter dem Körper
    const masse = KOERPER[bau.koerper || "mensch"](leinwand(36, 40, 6), plan);
    ["umhang"].forEach(function (id) { if (extras.indexOf(id) !== -1) TEILE.extras[id](l, masse); });
    KOERPER[bau.koerper || "mensch"](l, plan);
    extras.forEach(function (id) { if (id !== "umhang" && id !== "mauer" && TEILE.extras[id]) TEILE.extras[id](l, masse); });
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
    wald: function (ctx, f, B, H) {
      const horizont = HINTERGRUENDE.grund(ctx, f, B, H);
      for (let x = 0; x < B; x += 14) {
        const h = 26 + (x * 7) % 11;
        ctx.fillStyle = f.fern; ctx.fillRect(x + 4, horizont - h + 10, 4, h - 10);
        ctx.fillStyle = f.bodenDunkel;
        for (let r = 0; r < 12; r++) ctx.fillRect(x + 6 - r, horizont - h + r * 1.2, r * 2 + 1, 2);
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
