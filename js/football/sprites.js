/* ==========================================================================
   football/sprites.js – Pixel-Figuren des Fußball-Duells (Seitenansicht)
   Jede Figur wird aus zwei Teilen zusammengesetzt:
   - KOPF: je Frisur ein Raster (Zeilen 0–8), Blick nach rechts
   - POSE: der Körper (Stehen, Laufen, Passen, Schießen, Zweikampf,
     Jubel, Hechten) als Raster ab Zeile 9
   Jedes Zeichen ist eine Farbe der Palette der Figur ("." = durchsichtig):
     k Umriss · s Haut · S Hautschatten · h Haare · H Haarglanz · e Augen
     t Trikot · T Trikotschatten · p Hose · c Stutzen · b Schuhe
     g Hände (bei Torhütern: Handschuhe)
   Die Rückennummer wird mit einer 3×5-Pixelschrift aufs Trikot gesetzt
   (in den Jubel-Posen, wenn sich die Figur zum Publikum dreht).
   Später lassen sich die Raster einfach durch eigene Grafiken ersetzen:
   zeichneFigur() ist die einzige Stelle, die sie auf den Canvas bringt.
   Alle Figuren hier sind eigens für NTB gezeichnet.
   ========================================================================== */

const FootballSprites = (function () {

  // ------------------------------------------------------------------
  // Köpfe (16 breit, Zeilen 0–8). Gesicht rechts, Hinterkopf links.
  // ------------------------------------------------------------------
  const GESICHT = [
    "...khhsssssssk..",   // 6: Wange und Nase
    "....kSsssssk....",   // 7: Kinn
    ".....kSSSk......",   // 8: Hals
  ];

  const FRISUREN = {
    // Strubbelig, schwarz, mit einer Strähne, die vorn in die Stirn fällt
    strubbel: [
      "......k..k......",
      "....kkhkkhkk....",
      "...khhhhhhhhk...",
      "...khHhhhhhhhk..",
      "...khhhhhhhhhk..",
      "...khhhssshek...",
    ],
    // Kurz geschoren
    kurz: [
      "................",
      ".....kkkkk......",
      "....khhhhhk.....",
      "...khHhhhhhk....",
      "...khhhhhhhk....",
      "...khhhssssek...",
    ],
    // Hochgestellte Spitzen
    stachel: [
      "....k.k.k.......",
      "...khkhkhk.k....",
      "...khhhhhhkhk...",
      "...khHhhhhhhk...",
      "...khhhhhhhk....",
      "...khhhssssek...",
    ],
    // Mit Stirnband in Trikotfarbe
    band: [
      "................",
      ".....kkkkk......",
      "....khhhhhk.....",
      "...kTTTTTTTk....",
      "...khhhhhhhk....",
      "...khhhssssek...",
    ],
  };

  // ------------------------------------------------------------------
  // Posen: Körper ab Zeile `ab`; kopf = Versatz des Kopfes { x, y }.
  // ------------------------------------------------------------------
  const OBERKOERPER = [
    "....kttttttk....",   // 9
    "...kttttttTtk...",   // 10
    "...ktttttTTgk...",   // 11: Hand vorn
    "...ktttttTTk....",   // 12
    "....kttttTk.....",   // 13
    "....kpppppk.....",   // 14
    "....kpppppk.....",   // 15
  ];

  const BEINE = {
    stehen: [
      "....kpk.kpk.....",
      "....ksk.ksk.....",
      "....kck.kck.....",
      "....kck.kck.....",
      "....kck.kck.....",
      "....kbbk.kbbk...",
      "....kkkk.kkkk...",
      "................",
    ],
    schritt1: [
      "...kpk..kpk.....",
      "..ksk....ksk....",
      "..kck.....kck...",
      ".kck......kck...",
      ".kck.......kck..",
      "kbbk.......kbbk.",
      "kkkk.......kkkk.",
      "................",
    ],
    schritt2: [
      "....kpk.kpk.....",
      "...ksk...ksk....",
      "..kck....kck....",
      "..kck.....kck...",
      ".kbbk......kck..",
      ".kkk.......kbbk.",
      "...........kkkk.",
      "................",
    ],
    ausholen: [
      "...kpkkpk.......",
      "..ksk.ksk.......",
      ".kck..kck.......",
      "kck...kck.......",
      "bbk...kck.......",
      "kkk...kbbk......",
      "......kkkk......",
      "................",
    ],
    tritt: [
      "....kpk.kpppk...",
      "....ksk....kssk.",
      "....kck.....kcck",
      "....kck......kbb",
      "....kck......kkk",
      "....kbbk........",
      "....kkkk........",
      "................",
    ],
  };

  function pose(beine, extra) {
    return Object.assign({ ab: 9, kopf: { x: 0, y: 0 }, koerper: OBERKOERPER.concat(BEINE[beine]), nummer: false }, extra || {});
  }

  const POSEN = {
    stehen: [pose("stehen")],
    laufen: [pose("schritt1"), pose("stehen"), pose("schritt2"), pose("stehen")],
    passen: [pose("ausholen"), pose("tritt")],
    schiessen: [pose("ausholen"), pose("tritt")],
    // Zweikampf: tief nach vorn in die Grätsche (18 breit)
    zweikampf: [{
      ab: 13, kopf: { x: 2, y: 4 }, breite: 18, nummer: false,
      koerper: [
        "......kttttttk....",
        ".....ktttttTTtk...",
        "....ktttttTTkgk...",
        "....kpppppkk......",
        "...kpppppk........",
        "..kpk...kpk.......",
        "..ksk.....kskk....",
        ".kck........kcck..",
        ".kck..........kcbk",
        "kbbk...........kbk",
        "kkkk............k.",
      ],
    }],
    // Jubel: beide Arme hoch (Hände über dem Kopf), zum Publikum gedreht –
    // nur hier ist die Rückennummer zu sehen (auch im Standbild)
    jubel: [
      pose("stehen", { nummer: true, arme: [[1, 2], [1, 3], [2, 4], [2, 5], [2, 6], [14, 2], [14, 3], [13, 4], [13, 5], [13, 6]] }),
      pose("schritt1", { nummer: true, arme: [[1, 1], [1, 2], [2, 3], [2, 4], [2, 5], [14, 1], [14, 2], [13, 3], [13, 4], [13, 5]] }),
    ],
    // Torwart hechtet: flach in der Luft, die Handschuhe vorn am Kopf (24 breit)
    hechten: [{
      ab: 14, kopf: { x: 8, y: 6 }, breite: 24, nummer: false,
      arme: [[22, 12], [22, 11], [23, 10], [23, 9], [22, 9]],
      koerper: [
        "........kkkk............",
        "kk.....kttttttTk........",
        "kbck.kkppptttttTk.......",
        "kbcckpppppttttk.........",
        ".kkccpppkkkkkk..........",
        "...kkkkk................",
      ],
    }],
  };

  // 3×5-Ziffern für die Rückennummer
  const ZIFFERN = {
    0: ["111", "101", "101", "101", "111"], 1: ["1", "1", "1", "1", "1"],
    2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "011", "001", "111"],
    4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "010", "010", "010"],
    8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"],
  };

  // Der Ball (5×5) in zwei Drehungen
  const BALL = [
    [".kkk.", "kwwdk", "kwddk", "kdwwk", ".kkk."],
    [".kkk.", "kdwwk", "kwwdk", "kwddk", ".kkk."],
  ];
  const BALL_FARBEN = { k: "#1c1f26", w: "#f7f9fc", d: "#2a2e38" };

  const HOEHE = 24;

  /** Palette einer Figur → Zeichen-Farben. */
  function farbenVon(figur) {
    const p = figur.palette;
    return {
      k: "#15161c", s: p.haut, S: p.hautSchatten, h: p.haare, H: p.haareGlanz, e: p.augen,
      t: p.trikot, T: p.trikotSchatten, p: p.hose, c: p.stutzen, b: p.schuhe,
      g: figur.sprite && figur.sprite.torwart ? "#f5e663" : p.haut,
      n: p.nummer,
    };
  }

  /**
   * Das Raster einer Figur in einer Pose (Kopf + Körper + Nummer).
   * @returns {string[]} Zeilen gleicher Breite
   */
  function raster(figur, poseName, bild) {
    const liste = POSEN[poseName] || POSEN.stehen;
    const p = liste[(bild || 0) % liste.length];
    const breite = p.breite || 16;
    const feld = [];
    for (let y = 0; y < HOEHE; y++) feld.push(new Array(breite).fill("."));
    const setze = function (x, y, z) { if (z !== "." && y >= 0 && y < HOEHE && x >= 0 && x < breite) feld[y][x] = z; };
    // Körper
    p.koerper.forEach(function (zeile, i) {
      for (let x = 0; x < zeile.length; x++) setze(x, p.ab + i, zeile[x]);
    });
    // Kopf (Frisur + Gesicht) darüber
    const frisur = FRISUREN[(figur.sprite && figur.sprite.frisur) || "kurz"] || FRISUREN.kurz;
    frisur.concat(GESICHT).forEach(function (zeile, i) {
      for (let x = 0; x < zeile.length; x++) setze(x + p.kopf.x, i + p.kopf.y, zeile[x]);
    });
    // Arme (Jubel)
    (p.arme || []).forEach(function (a) { setze(a[0], a[1], "g"); });
    // Rückennummer auf dem Trikot (Zeilen 9–13, ab Spalte 5)
    if (p.nummer && figur.nummer !== undefined) {
      const ziffern = String(figur.nummer).split("").map(function (z) { return ZIFFERN[z]; });
      const gesamt = ziffern.reduce(function (s, z) { return s + z[0].length; }, 0) + ziffern.length - 1;
      let x0 = 7 - Math.floor(gesamt / 2);
      ziffern.forEach(function (z) {
        for (let y = 0; y < 5; y++) for (let x = 0; x < z[y].length; x++) if (z[y][x] === "1") setze(x0 + x, 9 + y, "n");
        x0 += z[0].length + 1;
      });
    }
    return feld.map(function (z) { return z.join(""); });
  }

  // Fertig gezeichnete Bilder (Canvas) zwischenspeichern
  const cache = {};

  function bildVon(figurId, figur, poseName, bild) {
    const schluessel = figurId + "|" + poseName + "|" + bild;
    if (cache[schluessel]) return cache[schluessel];
    const r = raster(figur, poseName, bild);
    const farben = farbenVon(figur);
    const c = document.createElement("canvas");
    c.width = r[0].length;
    c.height = r.length;
    const ctx = c.getContext("2d");
    r.forEach(function (zeile, y) {
      for (let x = 0; x < zeile.length; x++) {
        const z = zeile[x];
        if (z === ".") continue;
        ctx.fillStyle = farben[z] || "#ff00ff";
        ctx.fillRect(x, y, 1, 1);
      }
    });
    cache[schluessel] = c;
    return c;
  }

  /**
   * Eine Figur zeichnen: Füße (Mitte unten) bei (x, y).
   * richtung: 1 = Blick nach rechts, −1 = nach links (gespiegelt).
   */
  function zeichneFigur(ctx, figurId, figur, poseName, bild, x, y, richtung) {
    const c = bildVon(figurId, figur, poseName, bild);
    const links = Math.round(x - 8);         // Mitte = Spalte 8 des 16er-Rasters
    const oben = Math.round(y - HOEHE);
    ctx.save();
    if (richtung < 0) {
      ctx.translate(Math.round(x) * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(c, links, oben);
    ctx.restore();
  }

  /** Der Ball: Mitte bei (x, y), bild 0/1 dreht ihn. */
  function zeichneBall(ctx, x, y, bild) {
    const r = BALL[(bild || 0) % 2];
    const x0 = Math.round(x) - 2, y0 = Math.round(y) - 2;
    r.forEach(function (zeile, yy) {
      for (let xx = 0; xx < 5; xx++) {
        const z = zeile[xx];
        if (z === ".") continue;
        ctx.fillStyle = BALL_FARBEN[z];
        ctx.fillRect(x0 + xx, y0 + yy, 1, 1);
      }
    });
  }

  /** Anzahl der Bilder einer Pose (für Animationen). */
  function bilder(poseName) {
    return (POSEN[poseName] || POSEN.stehen).length;
  }

  return {
    HOEHE: HOEHE,
    posen: Object.keys(POSEN),
    frisuren: Object.keys(FRISUREN),
    raster: raster,
    bilder: bilder,
    zeichneFigur: zeichneFigur,
    zeichneBall: zeichneBall,
    // Für Prüfungen: die rohen Daten
    daten: { FRISUREN: FRISUREN, POSEN: POSEN, ZIFFERN: ZIFFERN, BALL: BALL },
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballSprites;
}
