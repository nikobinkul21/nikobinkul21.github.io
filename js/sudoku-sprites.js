/* ==========================================================================
   sudoku-sprites.js – Pixel-Figuren für das Sudoku-Abenteuer
   Jede Figur ist ein kleines Raster aus Zeichen. Jedes Zeichen steht für
   eine Farbe aus der Palette der Figur, "." ist durchsichtig.
   Gezeichnet wird auf ein <canvas> – mit harten Pixelkanten (siehe CSS:
   image-rendering: pixelated).

   EIGENE GRAFIK EINSETZEN: Einfach das Raster und/oder die Palette einer
   Figur ersetzen. Alle Zeilen einer Figur müssen gleich lang sein.
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

    /* Boss 1: Schleimkönig */
    schleim: {
      palette: {
        k: "#1b1b24", g: "#4cbf5a", G: "#2f8a3d", l: "#a6eeb0",
        w: "#ffffff", p: "#1b1b24", y: "#f2c230", r: "#d83a4a",
      },
      raster: [
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        ".........y..y..y........",
        ".........yyyyyyy........",
        ".........yryyyry........",
        "........kkkkkkkkk.......",
        "......kkgggggggggkk.....",
        ".....kggllgggggggggk....",
        "....kggllgggggggggggk...",
        "...kgglgggwwgggggwwgk...",
        "...kggggggwpgggggwpgk...",
        "..kgggggggggggggggggggk.",
        "..kggggggkkkkkgggggggk..",
        "..kgggggggGGGgggggggggk.",
        ".kgggggggggggggggggggggk",
        ".kGgggggggggggggggggggGk",
        ".kGGgggggggggggggggggGGk",
        "..kGGGGGGGGGGGGGGGGGGGk.",
        "...kkkkkkkkkkkkkkkkkkk..",
        "........................",
        "........................",
      ],
    },

    /* Boss 2: Knochenfürst */
    knochen: {
      palette: {
        k: "#1b1b24", w: "#ece7d6", r: "#ff3b3b", p: "#6a3fa0", P: "#4a2a75",
      },
      raster: [
        "........................",
        "......k............k....",
        ".......kk........kk.....",
        "........kk......kk......",
        ".......kkkkkkkkkk.......",
        "......kwwwwwwwwwwk......",
        ".....kwwwwwwwwwwwwk.....",
        "....kwwwwwwwwwwwwwwk....",
        "....kwwkkkwwwwkkkwwk....",
        "....kwkrrkkwwkkrrkwk....",
        "....kwwkkkwwwwkkkwwk....",
        "....kwwwwwwkkwwwwwwk....",
        ".....kwwwwwwwwwwwwk.....",
        "......kwkwkwkwkwkk......",
        "......kwwwwwwwwwwk......",
        ".......kkkkkkkkkk.......",
        ".....kppppkwwkppppk.....",
        "....kpppppkwwkpppppk....",
        "...kppppppkwwkppppppk...",
        "...kpppppkwwwwkpppppk...",
        "..kppppppkwkkwkppppppk..",
        "..kpppppppkwwkpppppppk..",
        "..kPPPPPPPPPPPPPPPPPPk..",
        "..kkkkkkkkkkkkkkkkkkkk..",
      ],
    },

    /* Boss 3: Giftpilz */
    pilz: {
      palette: {
        k: "#1b1b24", r: "#d8343f", R: "#9c1f2a", w: "#fff4e8",
        s: "#f0dcc0", S: "#c9ad8a", p: "#3a2a1a",
      },
      raster: [
        "........................",
        "........................",
        ".........kkkkkk.........",
        "......kkkrrrrrrkkk......",
        ".....krrrwwrrrrrrrk.....",
        "....krrrwwwwrrrwwrrk....",
        "...krrrrrwwrrrrwwrrrk...",
        "..krrwwrrrrrrrrrrrwwrk..",
        "..krwwwwrrrrwwrrrrwwrk..",
        ".krrrwwrrrrwwwwrrrrrrrk.",
        ".kRRRRRRRRRRRRRRRRRRRRk.",
        "..kkkkkkkkkkkkkkkkkkkk..",
        "......kssssssssssk......",
        "......ksppssssppsk......",
        "......ksppssssppsk......",
        "......kssssssssssk......",
        "......ksssskkksssk......",
        "......kssskrrksssk......",
        "......kssssssssssk......",
        ".....kssssssssssssk.....",
        "....kSSSSSSSSSSSSSSk....",
        "....kkkkkkkkkkkkkkkk....",
        "........................",
        "........................",
      ],
    },

    /* Boss 4: Steingolem */
    golem: {
      palette: {
        k: "#1b1b24", o: "#8f939c", O: "#5d616b", e: "#39e6ff", m: "#5fae4c",
      },
      raster: [
        "........................",
        "........................",
        "........................",
        ".......kkkkkkkkkk.......",
        "......koooooooooOk......",
        "......kooeeooeeoOk......",
        "......koooooooooOk......",
        "......kOOkkkkkOOOk......",
        "...kkkkkkkkkkkkkkkkkk...",
        "..kooookoooommookoooOk..",
        ".koooOkoooooooooOkoooOk.",
        ".kmooOkoooooooooOkoomOk.",
        ".kOOOOkoooOOOoooOkOOOOk.",
        "..kkkkkoooooooooOkkkkk..",
        "..kOOk.koooooooOk.kOOk..",
        "..kkkk.kooomoooOk.kkkk..",
        ".......kooooOooOk.......",
        "......koooOk.kooOk......",
        "......koooOk.koooOk.....",
        ".....kOOOOOk.kOOOOOk....",
        ".....kkkkkkk.kkkkkkk....",
        "........................",
        "........................",
        "........................",
      ],
    },

    /* Boss 5: Schattendrache */
    drache: {
      palette: {
        k: "#1b1b24", d: "#7a4fc4", D: "#4b2d86", y: "#ffd23a",
        n: "#e8e0c8", W: "#ffffff",
      },
      raster: [
        "........................",
        "...kk..............kk...",
        "...knk............knk...",
        "....knk..........knk....",
        ".....knkkkkkkkkkknk.....",
        "......kddddddddddk......",
        ".....kddddddddddddk.....",
        "....kddykkddddkkyddk....",
        "....kdyykddddddkyydk....",
        "....kddddddddddddddk....",
        "....kDddddddddddddDk....",
        "...kDDdddkkkkkkdddDDk...",
        "...kDddkWkWkWkWkWddDk...",
        "...kDdddkkkkkkkkkddDk...",
        "....kDDddddddddddDDk....",
        ".....kkDDddddddDDkk.....",
        "...kk..kkDDddDDkk..kk...",
        "..kDDk..kDddddDk..kDDk..",
        ".kDDDDkkDddddddDkkDDDDk.",
        ".kDDDDDDdddddddddDDDDDDk",
        "..kkkkkkdddddddddkkkkkk.",
        ".......kDDDDDDDDDk......",
        "........kkkkkkkkk.......",
        "........................",
      ],
    },
  };


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
   * @param {string} name   – z. B. "held" oder "schleim"
   * @param {number} runde  – 0 = Originalfarben, 1, 2 … = andere Farbpalette
   */
  function zeichne(canvas, name, runde) {
    const figur = FIGUREN[name];
    if (!figur) return;
    const hoehe = figur.raster.length;
    const breite = figur.raster[0].length;
    canvas.width = breite;
    canvas.height = hoehe;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, breite, hoehe);

    const drehung = (runde || 0) * 75;               // pro Runde 75° weiter im Farbkreis
    const farben = {};
    Object.keys(figur.palette).forEach(function (zeichen) {
      farben[zeichen] = drehung ? farbtonDrehen(figur.palette[zeichen], drehung) : figur.palette[zeichen];
    });

    figur.raster.forEach(function (zeile, y) {
      for (let x = 0; x < zeile.length; x++) {
        const zeichen = zeile[x];
        if (zeichen === "." || !farben[zeichen]) continue;
        ctx.fillStyle = farben[zeichen];
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  return {
    FIGUREN: FIGUREN,
    zeichne: zeichne,
  };
})();
