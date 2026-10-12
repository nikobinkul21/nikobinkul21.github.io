/* ==========================================================================
   football/konfig.js – alle Werte des Fußball-Duells an EINER Stelle
   Regeln, Würfel, Zonen, Gewichte der Computer-Steuerung, Zeiten der
   Szene und Maße der Pixel-Darstellung. Die Werte der Figuren stehen bei
   den Figuren (football/figuren.js), die Farben der Arena bei der Arena
   (football/arenen.js).
   ========================================================================== */

const FootballKonfig = {

  // Die beiden Teams: 0 = du (Knöpfe), 1 = der Computer.
  // Die Einträge verweisen auf Figuren aus football/figuren.js.
  // spieler[0] greift vorne an und verteidigt in der gegnerischen Hälfte,
  // spieler[1] verteidigt in der eigenen Hälfte (siehe regeln.verteidiger).
  teams: [
    { name: "Nordlicht", spieler: ["haru", "milo"], torwart: "timo" },
    { name: "Glutwerk", spieler: ["viktor", "jano"], torwart: "bo" },
  ],

  arena: "halleNull",     // Eintrag aus football/arenen.js

  regeln: {
    // Zonen aus deiner Sicht von links nach rechts:
    // 0 eigenes Tor · 1 eigene Hälfte · 2 Mitte · 3 gegnerische Hälfte · 4 Strafraum
    // Für den Gegner gilt dieselbe Leiste gespiegelt (seine Zone = 4 − Zone).
    zonen: ["Eigenes Tor", "Eigene Hälfte", "Mitte", "Gegn. Hälfte", "Strafraum"],
    anstossZone: 2,          // Anstoß in der Mitte
    anstossTeam: 0,          // wer das Match beginnt (0 = du)
    siegTore: 3,             // ein Match endet bei 3 Toren …
    maxZuege: 20,            // … oder nach 20 Spielzügen
    wuerfel: 6,              // jeder Wertevergleich: Wert + W6 gegen Wert + W6
    gleichstandFuer: "verteidiger",   // gleiche Summe: der Verteidiger (bzw. Torwart) gewinnt
    schussAbZone: 3,         // Schießen erst ab der gegnerischen Hälfte (aus Sicht des Angreifers)
    // Zuschlag auf den Schusswert gegen den Torwart je Zone (aus Sicht des Schützen)
    schussZone: { 3: 0, 4: 4 },
    // Nach einem gehaltenen oder geblockten Schuss bekommt das verteidigende
    // Team den Ball in dieser Zone (aus seiner Sicht: 1 = eigene Hälfte)
    nachParadeZone: 1,
    elfmeter: {
      runden: 3,             // je 3 Schüsse, danach Schuss um Schuss (Sudden Death)
      richtungen: ["links", "mitte", "rechts"],
      // Hält der Torwart in die richtige Ecke, entscheidet der Wertevergleich
      // (Schießen + W6 gegen Tor blockieren + W6). Falsche Ecke: Tor.
    },
  },

  // Die sechs Aktionen. wert = welcher Wert der Figur zählt,
  // konter = welche Verteidigung zu welchem Angriff passt.
  aktionen: {
    angriff: [
      { id: "passen", name: "Passen", nomen: "Pass", taste: "1", wert: "passen" },
      { id: "dribbeln", name: "Dribbeln", nomen: "Dribbling", taste: "2", wert: "dribbeln" },
      { id: "schiessen", name: "Schießen", nomen: "Schuss", taste: "3", wert: "schiessen" },
    ],
    verteidigung: [
      { id: "zweikampf", name: "Zweikampf", nomen: "Zweikampf", taste: "1", wert: "zweikampf", konter: "dribbeln" },
      { id: "passBlockieren", name: "Pass blockieren", nomen: "Passblock", taste: "2", wert: "passBlockieren", konter: "passen" },
      { id: "torBlockieren", name: "Tor blockieren", nomen: "Torblock", taste: "3", wert: "torBlockieren", konter: "schiessen" },
    ],
  },

  // Computer-Steuerung. Alle Gewichte relativ zueinander (keine Prozente).
  ki: {
    // Angriff: je Zone aus SEINER Sicht (0 eigenes Tor … 4 Strafraum)
    angriff: {
      0: { passen: 6, dribbeln: 4, schiessen: 0 },
      1: { passen: 6, dribbeln: 4, schiessen: 0 },
      2: { passen: 5, dribbeln: 5, schiessen: 0 },
      3: { passen: 4, dribbeln: 4, schiessen: 3 },
      4: { passen: 1, dribbeln: 2, schiessen: 7 },
    },
    // Verteidigung: Grundgewichte je Zone aus Sicht DEINES Angriffs
    verteidigung: {
      0: { zweikampf: 5, passBlockieren: 5, torBlockieren: 0 },
      1: { zweikampf: 5, passBlockieren: 5, torBlockieren: 0 },
      2: { zweikampf: 5, passBlockieren: 5, torBlockieren: 0 },
      3: { zweikampf: 4, passBlockieren: 4, torBlockieren: 4 },
      4: { zweikampf: 2, passBlockieren: 2, torBlockieren: 6 },
    },
    // Anpassung an deine Vorlieben: deine letzten Angriffsaktionen
    // (gedaechtnis) verschieben die Gewichte. anpassung = Anteil der
    // Gesamtgewichte, der nach deinen Vorlieben verteilt wird.
    gedaechtnis: 8,
    anpassung: 0.5,
    // Elfmeter: Gewichte der Richtungen für den Schuss des Computers;
    // als Torwart reagiert er wie oben auf deine bisherigen Richtungen
    elfmeterSchuss: { links: 4, mitte: 2, rechts: 4 },
    elfmeterAnpassung: 0.5,
  },

  // Zeiten der Darstellung (Millisekunden). Alles ist per Klick abkürzbar.
  zeiten: {
    aufdecken: 700,          // beide Aktionen stehen nebeneinander
    szene: 1500,             // die Szene spielt den Ausgang
    standbild: 1000,         // Standbild bei Tor oder Ballgewinn
    elfmeter: 1300,          // ein Elfmeter
    ruhig: 350,              // "Bewegung reduzieren": nur kurzes Einblenden
  },

  // Pixel-Szene (Canvas). Ein Pixel der Szene = mehrere Bildschirmpixel.
  szene: {
    breite: 192,             // Canvas-Auflösung (logische Pixel)
    hoehe: 108,
    zonenBreite: 88,         // Breite einer Zone in der Spielwelt
    rand: 28,                // Platz hinter den Toren
    boden: 96,               // y der Füße
    kameraTempo: 0.12,       // wie schnell die Kamera dem Ball folgt (0–1 je Bild)
  },
};

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballKonfig;
}
