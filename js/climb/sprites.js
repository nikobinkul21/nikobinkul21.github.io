/* ==========================================================================
   climb/sprites.js – Pixelbilder des Kletterspiels
   Jedes Bild ist ein Raster aus Zeichen; jedes Zeichen steht für eine Farbe
   aus der Palette ("." = durchsichtig). Großbuchstaben und Kleinbuchstaben
   sind verschiedene Farben. Die Figur ist eine eigene Kletterin in
   Rückenansicht (Bommelmütze, Rucksack); Arme und Beine zeichnet
   climb/darstellung.js als Pixel-Linien dazu, damit Hände und Füße frei
   umgreifen können.

   Die Ziffern 1 bis 5 stehen für Farben der aktuellen Zone (ZONEN_FARBEN) –
   so passen Steine und Felsnasen zur jeweiligen Wand.
   ========================================================================== */

const KletterSprites = (function () {

  const PALETTE = {
    // Figur
    o: "#ffd166",   // Bommel und Streifen der Mütze
    R: "#e4572e",   // Mütze
    H: "#5a3620",   // Haare
    s: "#f2bd91",   // Haut (Nacken, Hände)
    J: "#1f9e89",   // Jacke
    j: "#46cfb4",   // Jacke hell (Licht)
    b: "#7a4b2a",   // Rucksack
    B: "#a8703f",   // Rucksack hell
    g: "#2b2b33",   // Gurt
    c: "#f4f1ea",   // Kreidebeutel
    P: "#34466b",   // Hose
    S: "#3a2a22",   // Schuhe
    u: "#1b1512",   // Umriss
    // Landschaft
    k: "#2b2420",   // dunkles Metall, Linien
    Y: "#ffcf5a",   // Licht (Laterne, Fenster)
    y: "#fff2b8",   // Licht hell
    t: "#7a5232",   // Wurzel
    T: "#5a3a22",   // Wurzel dunkel, Stamm
    D: "#9c3d2f",   // Dachziegel
    d: "#c45a43",   // Dach hell
    W: "#efe2c6",   // Hauswand
    w: "#d2c2a0",   // Hauswand Schatten
    F: "#ffd27a",   // Fenster (warm)
    f: "#5a3a2a",   // Fensterrahmen, Tür
    C: "#8a8f99",   // Schornstein
    G: "#3f8f3a",   // Laub
    L: "#6ab84f",   // Laub hell
    N: "#2c6a2e",   // Laub dunkel
    v: "#2b2f3a",   // Vogel
    A: "#6b4426",   // Adler
    a: "#f4efe4",   // Adlerkopf
    q: "#f2a33a",   // Schnabel
    e: "#ffffff",   // Weiß (Wolken, Schnee, Hemd)
    E: "#dfe8f2",   // Wolke Schatten
    r: "#d94f5c",   // Wäsche rot
    n: "#4f86d9",   // Wäsche blau
  };

  // Ziffer → Farbe der Zone (climb/zonen.js, farben)
  const ZONEN_FARBEN = { 1: "wandDunkel", 2: "wand", 3: "wandHell", 4: "griff", 5: "griffHell" };

  const BILDER = {
    // Körper der Kletterin, Rückenansicht (10 × 16). Schultern bei (1|8)
    // und (8|8), Hüften bei (3|15) und (6|15) – siehe GELENKE.
    koerper: [
      "....oo....",
      "...RRRR...",
      "..RRRRRR..",
      "..RooooR..",
      "..HHHHHH..",
      "...HHHH...",
      "....ss....",
      ".JJJJJJJJ.",
      "JJjJJJJjJJ",
      "JJJbbbbJJJ",
      "JJJbBBbJJJ",
      ".JJbbbbJJ.",
      ".JJJJJJJJ.",
      "..gggcgg..",
      "..PPPPPP..",
      "..PP..PP..",
    ],
    hand: [
      "ss",
      "ss",
    ],
    fuss: [
      "SSS",
      "SSS",
    ],
    // Laterne am Grund der Grube (8 × 12)
    laterne: [
      "...kk...",
      "..k..k..",
      "..kkkk..",
      ".kkkkkk.",
      ".kYYYYk.",
      ".kYyyYk.",
      ".kYyyYk.",
      ".kYYYYk.",
      ".kkkkkk.",
      "..k..k..",
      "..kkkk..",
      "........",
    ],
    // Wurzel, die aus der Erdwand hängt (14 × 7)
    wurzel: [
      "ttttTT........",
      "..tttttt......",
      "....T..ttt....",
      "...t.....tt...",
      "..t........t..",
      "..t.........t.",
      ".............t",
    ],
    // Stein in der Erdwand (Farben der Zone)
    stein: [
      "..3333..",
      ".322221.",
      "32222211",
      ".222111.",
      "..1111..",
    ],
    // Haus mit Schornstein (16 × 15)
    haus: [
      "...........CC...",
      "...........CC...",
      "......DDDDDDD...",
      ".....DdddddddD..",
      "....DdddddddddD.",
      "...DDDDDDDDDDDDD",
      "....WWWWWWWWWWw.",
      "....WffWWWWffWw.",
      "....WFFWWWWFFWw.",
      "....WFFWWWWFFWw.",
      "....WWWWWWWWWWw.",
      "....WWWWWffWWWw.",
      "....WFFWWffWFFw.",
      "....WFFWWffWFFw.",
      "....WWWWWffWWWw.",
    ],
    // Wäsche an der Leine
    hemd: [
      "r...r",
      "rrrrr",
      ".rrr.",
      ".rrr.",
    ],
    hose: [
      "nnnn",
      "nnnn",
      "nn.n",
      "n..n",
    ],
    socke: [
      "e.",
      "e.",
      "ee",
    ],
    // Baumkrone (16 × 11)
    baum: [
      ".....LLLL.......",
      "...LLLGGGGG.....",
      "..LLGGGGGGGGG...",
      ".LGGGGNGGGGGGG..",
      "LGGGGNNGGGGGGGG.",
      "GGGGGGGGGGNGGGGG",
      ".GGGNGGGGGNNGGG.",
      "..NGGGGGGGGGGN..",
      "....NNGGGGNN....",
      ".......TT.......",
      ".......TT.......",
    ],
    // Vogel, zwei Bilder (Flügel oben / unten)
    vogel1: [
      "v...v",
      ".v.v.",
      "..v..",
    ],
    vogel2: [
      ".....",
      ".vvv.",
      "v.v.v",
    ],
    // Blatt, das herabsegelt
    blatt: [
      "LG",
      "G.",
    ],
    // Felsnase, die aus der Seite ragt (Farben der Zone)
    felsnase: [
      "33333.........",
      "222223333.....",
      "22222222233...",
      "2222222222223.",
      "11122222222222",
      "..111112222211",
      ".....11111111.",
      "........111...",
    ],
    // Adler, zwei Bilder (13 × 5)
    adler1: [
      "AA.........AA",
      ".AAA.....AAA.",
      "...AAAaaAA...",
      ".....AAAaq...",
      "......A......",
    ],
    adler2: [
      ".............",
      "......aa.....",
      "AAAAAAAAAqAAA",
      ".AA..AAA..AA.",
      "......A......",
    ],
    // Wolke (16 × 6)
    wolke: [
      ".....eeee.......",
      "...eeeeeeee.ee..",
      ".eeeeeeeeeeeeee.",
      "eeeeeeeeeeeeeeee",
      ".EEEEEEEEEEEEEE.",
      "...EEEEEEEEEE...",
    ],
    wolkenfetzen: [
      "..eeee.....",
      "eeeeeeeee..",
      ".EEEEEEEEee",
    ],
  };

  // Gelenke am Körper (Pixel im Raster)
  const GELENKE = {
    handLinks: { x: 1, y: 8 },
    handRechts: { x: 8, y: 8 },
    fussLinks: { x: 3, y: 15 },
    fussRechts: { x: 6, y: 15 },
  };

  const cache = {};

  /**
   * Ein Bild als fertige kleine Leinwand (einmal erzeugt, dann gemerkt).
   * @param {string} name
   * @param {object} [farben] – Farben der Zone (für die Ziffern 1–5)
   * @param {object} [o] – { spiegeln, kopfueber, umriss: true = dunkle Kontur }
   */
  function bild(name, farben, o) {
    o = o || {};
    const schluessel = name + "|" + (farben ? farben.wand : "") + "|" + (o.spiegeln ? 1 : 0) + (o.kopfueber ? 1 : 0) + (o.umriss ? 1 : 0);
    if (cache[schluessel]) return cache[schluessel];
    const raster = BILDER[name];
    const rand = o.umriss ? 1 : 0;
    const breite = Math.max.apply(null, raster.map(function (z) { return z.length; }));
    const hoehe = raster.length;
    const leinwand = document.createElement("canvas");
    leinwand.width = breite + 2 * rand;
    leinwand.height = hoehe + 2 * rand;
    const ctx = leinwand.getContext("2d");
    const farbeVon = function (zelle) {
      if (zelle === ".") return null;
      if (ZONEN_FARBEN[zelle]) return farben ? farben[ZONEN_FARBEN[zelle]] : "#888";
      return PALETTE[zelle] || null;
    };
    const voll = function (x, y) {
      if (y < 0 || y >= hoehe || x < 0) return false;
      const z = raster[y][x];
      return z !== undefined && z !== ".";
    };
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        const zx = o.spiegeln ? breite - 1 - x : x;
        const zy = o.kopfueber ? hoehe - 1 - y : y;
        const f = farbeVon(raster[zy][zx] || ".");
        if (f) {
          ctx.fillStyle = f;
          ctx.fillRect(x + rand, y + rand, 1, 1);
        } else if (rand && (voll(zx - 1, zy) || voll(zx + 1, zy) || voll(zx, zy - 1) || voll(zx, zy + 1))) {
          // Kontur: leere Zelle direkt neben einer vollen
          ctx.fillStyle = PALETTE.u;
          ctx.fillRect(x + rand, y + rand, 1, 1);
        }
      }
    }
    // Rand außen herum (Kontur über die Rasterkante hinaus)
    if (rand) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = PALETTE.u;
      for (let y = 0; y < hoehe; y++) {
        for (let x = 0; x < breite; x++) {
          const zx = o.spiegeln ? breite - 1 - x : x;
          const zy = o.kopfueber ? hoehe - 1 - y : y;
          if (!voll(zx, zy)) continue;
          if (x === 0) ctx.fillRect(0, y + rand, 1, 1);
          if (x === breite - 1) ctx.fillRect(breite + 1, y + rand, 1, 1);
          if (y === 0) ctx.fillRect(x + rand, 0, 1, 1);
          if (y === hoehe - 1) ctx.fillRect(x + rand, hoehe + 1, 1, 1);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    cache[schluessel] = leinwand;
    return leinwand;
  }

  /** Zeichnet ein Bild mit seiner linken oberen Ecke bei (x|y) – ganzzahlig. */
  function zeichne(ctx, name, x, y, farben, o) {
    const b = bild(name, farben, o);
    ctx.drawImage(b, Math.round(x), Math.round(y));
    return b;
  }

  return { PALETTE: PALETTE, BILDER: BILDER, GELENKE: GELENKE, bild: bild, zeichne: zeichne };
})();
