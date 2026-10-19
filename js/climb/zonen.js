/* ==========================================================================
   climb/zonen.js – die Landschaften des Kletterspiels
   Die Umgebung wechselt mit der Höhe. Neue Zone? Einfach ein weiterer
   Eintrag (sortiert nach "ab"):
     id, name   – Kennung und Name (Einblendung beim Erreichen)
     ab         – ab dieser Höhe in Metern
     untertitel – kurze Zeile unter dem Namen in der Einblendung
     farben     – Farbstimmung:
                    himmel [oben, unten] · wand / wandHell / wandDunkel (die
                    Kletterwand) · griff / griffHell (Griffe) · nebel (Dunst
                    über der Ferne) · text / textGrund (Einblendung:
                    Schrift und ihr Hintergrund)
     hintergrund – woraus die Landschaft besteht, in drei Ebenen mit
                   Parallaxe (fern, mitte, nah – siehe bild.parallaxe in
                   climb/konfig.js). Jede Ebene ist eine Liste von Mustern:
                     { muster, abstand, seite, … } – ein Muster aus
                     MALER in climb/darstellung.js ("haus", "baum" …),
                     alle "abstand" Spielpixel wiederholt; seite "links",
                     "rechts" oder "beide"
                   Dazu "boden": ein Bild ganz unten (nur in der ersten Zone)
     wand       – Struktur der Wand: "erde", "ziegel", "rinde", "fels", "eis"
   Die letzte Zone geht endlos weiter.
   ========================================================================== */

const KletterZonen = [
  {
    id: "grube", name: "Grube", ab: 0,
    untertitel: "Raus aus dem Dunkel",
    farben: {
      himmel: ["#2a1d16", "#120c09"], wand: "#5b3d27", wandHell: "#77543a", wandDunkel: "#3c2818",
      griff: "#a98457", griffHell: "#d2b07c", nebel: "rgba(18, 10, 6, 0.35)", text: "#f2d9a8", textGrund: "rgba(30, 18, 10, 0.82)",
    },
    wand: "erde",
    hintergrund: {
      fern: [{ muster: "erdwand", abstand: 1, seite: "beide" }],
      mitte: [{ muster: "wurzel", abstand: 34, seite: "beide" }],
      nah: [{ muster: "stein", abstand: 41, seite: "beide" }],
    },
    boden: "laterne",
  },
  {
    id: "dorf", name: "Dorf", ab: 20,
    untertitel: "Über die Dächer",
    farben: {
      himmel: ["#8fc7ef", "#f5d9a8"], wand: "#b8735a", wandHell: "#d4927a", wandDunkel: "#8d5240",
      griff: "#e9e1cf", griffHell: "#ffffff", nebel: "rgba(255, 236, 205, 0.25)", text: "#5a2b17",
    },
    wand: "ziegel",
    hintergrund: {
      fern: [{ muster: "huegel", abstand: 1, seite: "beide" }],
      mitte: [{ muster: "haus", abstand: 46, seite: "beide" }],
      nah: [{ muster: "waescheleine", abstand: 58, seite: "beide" }],
    },
  },
  {
    id: "wald", name: "Wald", ab: 60,
    untertitel: "Durch die Baumkronen",
    farben: {
      himmel: ["#a7dcc8", "#e3f2c4"], wand: "#6d4a2e", wandHell: "#8b6440", wandDunkel: "#4c3220",
      griff: "#9fca5a", griffHell: "#d6f08f", nebel: "rgba(214, 240, 200, 0.22)", text: "#1f4a24",
    },
    wand: "rinde",
    hintergrund: {
      fern: [{ muster: "lichtstrahl", abstand: 70, seite: "beide" }],
      mitte: [{ muster: "baum", abstand: 38, seite: "beide" }],
      nah: [{ muster: "vogel", abstand: 90, seite: "beide" }, { muster: "blaetter", abstand: 44, seite: "beide" }],
    },
  },
  {
    id: "felsen", name: "Felsen", ab: 120,
    untertitel: "Weit unten das Tal",
    farben: {
      himmel: ["#6fa6d6", "#d9e8f2"], wand: "#7d7f86", wandHell: "#a2a5ad", wandDunkel: "#56585e",
      griff: "#c9b48c", griffHell: "#efe0bd", nebel: "rgba(220, 234, 245, 0.3)", text: "#26313d",
    },
    wand: "fels",
    hintergrund: {
      fern: [{ muster: "tal", abstand: 1, seite: "beide" }],
      mitte: [{ muster: "felsnase", abstand: 52, seite: "beide" }],
      nah: [{ muster: "adler", abstand: 120, seite: "beide" }],
    },
  },
  {
    id: "gipfel", name: "Gipfel", ab: 200,
    untertitel: "Schnee und Wind",
    farben: {
      himmel: ["#4f7fc0", "#cfe2f5"], wand: "#c9d6e3", wandHell: "#f4f8fc", wandDunkel: "#97a8ba",
      griff: "#6d7d90", griffHell: "#95a6b8", nebel: "rgba(255, 255, 255, 0.28)", text: "#1c2f4a",
    },
    wand: "eis",
    hintergrund: {
      fern: [{ muster: "wolkenmeer", abstand: 1, seite: "beide" }],
      mitte: [{ muster: "schneegipfel", abstand: 64, seite: "beide" }],
      nah: [{ muster: "wind", abstand: 26, seite: "beide" }],
    },
  },
  {
    id: "wolken", name: "Über den Wolken", ab: 300,
    untertitel: "Nur noch Sterne",
    farben: {
      himmel: ["#070a1f", "#1d2552"], wand: "#5a6488", wandHell: "#7c87ad", wandDunkel: "#3d4566",
      griff: "#e8d98a", griffHell: "#fff6c4", nebel: "rgba(30, 38, 90, 0.2)", text: "#fff6c4", textGrund: "rgba(10, 14, 40, 0.8)",
    },
    wand: "fels",
    hintergrund: {
      fern: [{ muster: "sterne", abstand: 1, seite: "beide" }],
      mitte: [{ muster: "sternschnuppe", abstand: 160, seite: "beide" }],
      nah: [{ muster: "wolkenfetzen", abstand: 70, seite: "beide" }],
    },
  },
];

/** Die Zone für eine Höhe in Metern (die letzte geht endlos weiter). */
function kletterZoneFuer(meter) {
  let zone = KletterZonen[0];
  KletterZonen.forEach(function (z) { if (meter >= z.ab) zone = z; });
  return zone;
}

if (typeof module !== "undefined") module.exports = { KletterZonen: KletterZonen, kletterZoneFuer: kletterZoneFuer };
