/* ==========================================================================
   football/arenen.js – die Arenen des Fußball-Duells
   Jede Arena ist ein Eintrag:
     name, beschreibung,
     rasen       – zwei Grüntöne für die gemähten Streifen, dazu der Rand
     linien      – Farbe der Linien (Mittellinie, Strafraum, Tor)
     hintergrund – Himmel/Decke, Wand, Wandfugen, Licht
     deko        – Liste der Dinge im Hintergrund, in Weltkoordinaten
                   (x in Pixeln der Spielwelt, siehe konfig.szene):
                   { art: "bildschirm" | "lampe" | "saeule" | "luke" | "kamera", x, … }
   Gezeichnet wird alles in football/szene.js. Eigene Erfindungen für NTB.
   ========================================================================== */

const FootballArenen = {

  // Halle Null: eine abgeschottete Trainingseinrichtung unter einer
  // flachen Betondecke – hohe, glatte Wände, kühles Licht aus
  // Leuchtbändern, Bildschirme mit Messwerten am Spielfeldrand.
  halleNull: {
    name: "Halle Null",
    beschreibung: "Abgeschottete Trainingshalle mit kühlem Licht und Messbildschirmen",
    rasen: { hell: "#3f9a63", dunkel: "#368a57", rand: "#2a6e45", schatten: "#24603c" },
    linien: "#e8f3ff",
    hintergrund: {
      decke: "#0d1422",           // ganz oben
      wand: "#1c2a3d",            // hohe Wand
      wandHell: "#24364f",        // Wandplatten
      fuge: "#121c2b",            // Fugen zwischen den Platten
      licht: "#9fd8ff",           // Leuchtband
      lichtSchein: "rgba(159, 216, 255, 0.18)",
      bande: "#0f1826",           // Bande am Spielfeldrand
      bandeLicht: "#3ad0ff",      // Leuchtstreifen auf der Bande
      bildschirm: "#0a1a2b",
      bildschirmText: "#5fe3ff",
      bildschirmWarn: "#ffcf5c",
    },
    deko: [
      { art: "lampe", x: 40 }, { art: "lampe", x: 150 }, { art: "lampe", x: 260 },
      { art: "lampe", x: 370 }, { art: "lampe", x: 480 },
      { art: "saeule", x: 6 }, { art: "saeule", x: 252 }, { art: "saeule", x: 498 },
      { art: "bildschirm", x: 60, inhalt: "balken" },
      { art: "bildschirm", x: 168, inhalt: "zahl" },
      { art: "bildschirm", x: 300, inhalt: "kurve" },
      { art: "bildschirm", x: 410, inhalt: "zahl" },
      { art: "luke", x: 214 },
      { art: "kamera", x: 120 }, { art: "kamera", x: 390 },
    ],
  },
};

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballArenen;
}
