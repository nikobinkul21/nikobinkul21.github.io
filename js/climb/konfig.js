/* ==========================================================================
   climb/konfig.js – alle Werte des Kletterspiels an EINER Stelle
   Zeiten, Schwierigkeit, Tastenfelder (Tastatur und Touch), Darstellung.
   Die Zonen (Landschaften) stehen in climb/zonen.js, die Pixelbilder in
   climb/sprites.js.
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

  // SPREIZUNG: Wie weit liegt die neue Taste von der losgelassenen entfernt
  // (in Tastenbreiten, Reihen zählen als 1)? Und wie weit dürfen die vier
  // gehaltenen Tasten höchstens auseinanderliegen? Beides wächst mit der
  // Höhe von "start" bis "ende" (erreicht bei endeHoehe).
  spreizung: {
    endeHoehe: 200,
    abstandMin: { start: 0.9, ende: 2.5 },   // die Finger müssen sich später strecken …
    abstandMax: { start: 2.2, ende: 6 },     // … und weiter greifen
    spanneMax: { start: 4.5, ende: 9 },      // Breite aller vier gehaltenen Tasten
  },

  // Welche Gliedmaße greift um? Bevorzugt die, die am längsten hält –
  // mit so viel Zufall (in Griffen), damit es nicht starr reihum geht
  wechsel: {
    alterZufall: 2.5,
  },

  // TASTATUR: Buchstaben und Zahlen der Haupttastatur, deutsches Layout
  // (QWERTZ). Gezählt wird event.code – also die POSITION der Taste, egal
  // welches Layout eingestellt ist. "label" ist die Beschriftung auf
  // QWERTZ (auf anderen Layouts liest eingabe.js die echte Beschriftung,
  // wenn der Browser sie verrät).
  //   reihe  – 0 Zahlen, 1 Q-Reihe, 2 A-Reihe, 3 Y-Reihe
  //   x      – Lage in Tastenbreiten (mit dem Versatz der Reihen)
  //   spalte – Fingerspalte (1-Q-A-Y = 0, 2-W-S-X = 1 …)
  //
  // GEISTERTASTEN (Ghosting): Viele Tastaturen erkennen manche Kombinationen
  // aus mehreren gleichzeitig gedrückten Tasten nicht – vor allem, wenn drei
  // Tasten die Ecken eines "Rechtecks" im Tastenraster bilden. Deshalb gilt
  // für die (bis zu fünf) gleichzeitig gedrückten Tasten:
  //   - jede in einer anderen Fingerspalte (so entsteht nie ein Rechteck),
  //   - höchstens maxProReihe in derselben Reihe (zusätzliche Vorsicht;
  //     3, weil am Anfang nur zwei Reihen erlaubt sind und fünf Tasten
  //     hineinpassen müssen).
  tastatur: {
    geisterschutz: true,
    maxProReihe: 3,
    // Reihen kommen nach und nach dazu: am Anfang nur die Buchstabenmitte
    reihenAb: [
      { reihe: 1, ab: 0 },
      { reihe: 2, ab: 0 },
      { reihe: 3, ab: 16 },
      { reihe: 0, ab: 50 },
    ],
    // Startgriff: vier benachbarte Spalten im Zickzack über Q- und A-Reihe
    // (wie eine aufgelegte Hand), erste Spalte zufällig aus diesem Bereich
    startSpalten: { von: 1, bis: 5 },
    startReihen: [1, 2],
    reihen: [
      { reihe: 0, x0: 1, codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"],
        labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
      { reihe: 1, x0: 1.5, codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
        labels: ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P"] },
      { reihe: 2, x0: 1.75, codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
        labels: ["A", "S", "D", "F", "G", "H", "J", "K", "L"] },
      { reihe: 3, x0: 2.25, codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"],
        labels: ["Y", "X", "C", "V", "B", "N", "M"] },
    ],
  },

  // TOUCH (Smartphone ohne Tastatur): ein Raster großer Griff-Felder, die mit
  // mehreren Fingern gleichzeitig gehalten werden. Dieselben Regeln – nur
  // ohne Geisterschutz (Bildschirme erkennen jede Kombination) und mit
  // Abständen in Feldern statt Tasten.
  touch: {
    spalten: 3,
    reihen: 4,
    geisterschutz: false,
    // Startgriff: diese vier Felder (Spalte, Reihe)
    start: [[0, 1], [2, 1], [0, 2], [2, 2]],
    spreizung: {
      endeHoehe: 200,
      abstandMin: { start: 0.9, ende: 1.4 },
      abstandMax: { start: 1.5, ende: 3.2 },
      spanneMax: { start: 3, ende: 3 },
    },
  },

  // Tastaturtest (vor dem ersten Spiel): so viele Kombinationen aus fünf
  // Tasten, wie sie im Spiel vorkommen, gleichzeitig halten
  tastaturTest: {
    durchgaenge: 3,
    hoehe: 220,             // Spreizung wie in dieser Höhe (weit auseinander)
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
