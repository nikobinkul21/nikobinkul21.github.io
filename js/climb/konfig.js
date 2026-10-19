/* ==========================================================================
   climb/konfig.js – alle Werte des Kletterspiels an EINER Stelle
   Zeiten, die Hand (Start, Spannweite, Reihen), Tastaturtest, Darstellung.
   Das Tastaturraster steht in climb/keyboard.js, die Zonen (Landschaften)
   in climb/zonen.js, die Pixelbilder in climb/sprites.js.
   ========================================================================== */

const KletterKonfig = {

  // Jeder gelungene Griffwechsel bringt so viele Meter
  meterProGriff: 2,

  // ZEIT PRO WECHSEL: beginnt großzügig und sinkt mit der Höhe gleichmäßig
  // bis zum Minimum (erreicht bei "endeHoehe" Metern, danach bleibt sie so).
  zeit: {
    startMs: 3000,          // am Boden
    minMs: 1000,            // ganz oben
    endeHoehe: 300,         // ab dieser Höhe (m) gilt minMs
    kurve: 1,               // 1 = gleichmäßig, < 1 = am Anfang schneller kürzer
  },

  // EINE HAND: Vier Finger einer Hand liegen auf der Tastatur. Jeder
  // Griffwechsel bewegt genau einen Finger auf eine benachbarte Taste
  // (Raster und Nachbarn: climb/keyboard.js). Für Tastatur und Touch gleich.
  hand: {
    // Jeder Versuch beginnt hier (event.code, von links nach rechts)
    start: ["KeyD", "KeyF", "KeyH", "KeyJ"],
    // Erlaubte Reihen: QWERTZ-Reihe, Grundreihe, untere Reihe – die
    // Zahlenreihe kommt ab dieser Höhe dazu (das ist neben der Zeit die
    // einzige Steigerung der Schwierigkeit)
    reihen: [1, 2, 3],
    zahlenreiheAb: 120,
    // Spannweite in Tastenspalten: Zwischen zwei benachbarten Fingern
    // liegen höchstens 2 Spalten (Abstand 3), zwischen dem äußersten
    // linken und rechten Finger insgesamt höchstens 5 (Abstand 6). Enger
    // als eine Spalte geht nicht (zwei Finger nie in derselben Spalte).
    maxAbstandNachbarn: 3,
    maxAbstandGesamt: 6,
    // Wandern: Die Hand darf über die Tastatur wandern. Liegt ihre Mitte
    // mehr als so viele Spalten neben der Startmitte, führen die nächsten
    // Wechsel bevorzugt zurück.
    maxWandern: 2,
    // Nie mehr als so oft hintereinander derselbe Finger
    maxGleicherFinger: 3,
    // Welcher Finger liegt auf welcher Position (von links nach rechts)?
    // Nur die Beschriftung hängt davon ab – die Regeln sind gleich.
    finger: {
      rechts: ["Zeige", "Mittel", "Ring", "Klein"],
      links: ["Klein", "Ring", "Mittel", "Zeige"],
    },
    fingerLang: { Zeige: "Zeigefinger", Mittel: "Mittelfinger", Ring: "Ringfinger", Klein: "kleiner Finger" },
    // Kürzel auf der kleinen Tastatur unter den großen Tasten
    fingerKurz: { Zeige: "Z", Mittel: "M", Ring: "R", Klein: "K" },
    standard: "rechts",       // Hand, solange nichts gewählt ist
  },

  // TASTATURTEST: Viele Tastaturen erkennen manche Kombinationen aus
  // mehreren gleichzeitig gedrückten Tasten nicht (Ghosting). Der Test
  // klettert einen Weg entlang, auf dem jeder Schritt ein erlaubter
  // Griffwechsel ist:
  //   schnell – so viele Griffe (quer über die Tastatur verteilt)
  //   alle    – jeder mögliche Griff ohne Zahlenreihe (in Etappen, der
  //             Fortschritt bleibt gespeichert)
  //   zahlen  – zusätzlich alle Griffe mit der Zahlenreihe
  tastaturTest: {
    schnell: 30,
  },

  // DARSTELLUNG (Pixel). Gerechnet wird in "Spielpixeln", die ganzzahlig
  // vergrößert werden (harte Kanten).
  bild: {
    zielHoehe: 150,         // so viele Spielpixel hoch ist die Szene ungefähr
    minVergroesserung: 2,
    pixelProGriff: 5,       // so weit scrollt die Wand je Griff (und so weit rutschen
                            // die haltenden Hände und Füße am Körper nach unten)
    wandBreite: 76,         // Breite der Kletterwand in der Mitte
    kameraAnteil: 0.62,     // die Hüfte der Figur steht bei 62 % der Höhe (von oben)
    bodenUnterHuefte: 13,   // so tief unter der Hüfte liegt zu Beginn der Boden der Grube
    // Parallaxe: Wie schnell zieht jede Ebene im Verhältnis zur Wand vorbei?
    // (Bei "Bewegung reduzieren" alle wie die Wand: keine Parallaxe.)
    parallaxe: { fern: 0.2, mitte: 0.45, nah: 0.75 },
    zonenUebergangMs: 900,  // die alte Landschaft blendet in die neue über
    umgreifenMs: 220,       // so lange greift die Hand bzw. der Fuß um
    umgreifenBogen: 3,      // so weit holt die Hand bzw. der Fuß dabei seitlich aus
    steigenMs: 260,         // so lange steigt der Körper nach
    sturzMs: 1300,          // Sturz bis zum Endbildschirm (reduzierte Bewegung: sturzMsRuhig)
    sturzMsRuhig: 300,
    sturzBeschleunigung: 150, // Spielpixel pro Sekunde² beim Fallen
    wackelnMs: 320,         // so lange wackelt die Szene beim Absturz (nicht bei reduzierter Bewegung)
    zoneEinblendungMs: 2200,
    testWeiterMs: 450,      // Tastaturtest: so lange bleibt eine erkannte Kombination grün stehen
    // Haltung der Kletterin: Lage von Händen und Füßen relativ zur Hüfte
    // (Spielpixel, y nach oben). "hoch" ist der Griff direkt nach dem
    // Umgreifen; bei jedem anderen Griff steigt der Körper um pixelProGriff –
    // die haltende Hand rutscht also am Körper so weit nach unten wie die
    // Wand. "start" = so weit unter "hoch" zu Beginn (gestaffelt).
    figur: {
      handLinks: { x: -8, hoch: 24, start: 5 },
      handRechts: { x: 8, hoch: 24, start: 12 },
      fussLinks: { x: -6, hoch: 4, start: 14 },
      fussRechts: { x: 6, hoch: 4, start: 7 },
      seitlichMax: 3,         // so weit verschiebt die Lage der neuen Taste den Griff seitlich
    },
  },

  // Gespeichert wird im localStorage unter diesem Namen
  speicherSchluessel: "ntb-klettern",
};

if (typeof module !== "undefined") module.exports = KletterKonfig;
