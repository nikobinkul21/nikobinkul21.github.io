/* ==========================================================================
   worlds/welt2.js – Welt 2: "Wald" (Level 21 bis 40)
   Dichter Wald, Lichtstrahlen durch die Kronen, Nebel am Boden. Die Bosse
   werden von Level 21 bis 40 bedrohlicher: erst Fuchs, Bogenschütze und
   Wildschwein, dann Räuber, Hexen und Waldgeister, am Ende Werwolf,
   kopfloser Reiter und Urborke, der erwachte Baumriese, als Weltboss.

   Aufbau eines Bosses wie in worlds/welt1.js (name, sprite, faehigkeit,
   angriffsBonus, erscheinen, niederlage, sieg). Neue Bausteine für den Wald
   (js/sudoku-sprites.js): Körper fuchs, keiler, baer, spinne, flamme;
   dazu z. B. Kapuze mit Feder, Hexenhut, Geweih, Langbogen, Köcher.

   Welt 2 ist spürbar härter als Welt 1 – Angriffsbonus:
     normale Bosse +1, Elite-Bosse (Level 25, 30, 35) +3, Weltboss (Level 40) +5.
   Fähigkeiten: jede genau viermal, nie dieselbe zweimal hintereinander
   (auch nicht über die Weltgrenze: Level 20 hat Fluch, Level 21 Siegel);
   Tick, Tick wie in jeder Welt erst ab ihrem 5. Level (hier ab Level 25).

   Anspielungen sind nur Anspielungen: eigene Namen, eigenes Aussehen mit
   ein, zwei erkennbaren Merkmalen, eigene Sätze.
   ========================================================================== */

(function () {
  const welt = {
    nummer: 2,
    id: "wald",
    name: "Wald",
    // Pixel-Hintergrund im Kampffenster (js/sudoku-sprites.js, HINTERGRUENDE)
    hintergrund: "wald",
    // Farbstimmung: dunkles Grün unter dem Laubdach, Moos, Rinde
    farben: {
      himmelOben: "#2c4a30", himmelUnten: "#7aa66e",
      boden: "#55703a", bodenDunkel: "#2f4a24",
      fern: "#476a45", akzent: "#b5d86a",
      stamm: "#5a3e28", stammDunkel: "#3c2818",
    },

    bosse: [
      // Level 21 – eigene Figur: ein schlauer Fuchs, der den Hühnerstall ausräumt
      {
        name: "Fuchs Schlitzohr",
        sprite: { koerper: "fuchs", farben: { haut: "#e0803a", kleid: "#d2702a", kleid2: "#2f5fa8", schuhe: "#2a2420" },
          waffe: "ei", extras: ["halstuch"] },
        faehigkeit: "siegel",
        angriffsBonus: 1,
        erscheinen: "Ein Ei für mich, eins für mich … alle für mich!",
        niederlage: "Na gut. Die Hühner gehören dir.",
        sieg: "Schlau schlägt schnell. Jedes Mal.",
      },
      // Level 22 – Anspielung auf den Meisterschützen aus den Robin-Hood-
      // Geschichten (grüne Kapuze mit Feder, Langbogen; nimmt's den Reichen)
      {
        name: "Der Grünrock aus dem Dickicht",
        sprite: { koerper: "mensch", farben: { haut: "#e9bf98", haare: "#7a4a22", kleid: "#3f7a3a", kleid2: "#6b4a2b", hose: "#5a4630" },
          kopf: "federkapuze", gesicht: ["spitzbart"], waffe: "langbogen", extras: ["koecher"] },
        faehigkeit: "verwirrung",
        angriffsBonus: 1,
        erscheinen: "Ich nehm's den Reichen. Du siehst reich aus.",
        niederlage: "Schon gut, du bist arm genug. Lauf!",
        sieg: "Steuer eingetrieben. Für einen guten Zweck.",
      },
      // Level 23 – eigene Figur: eine Wildsau, die ihr Eichelfeld verteidigt
      {
        name: "Bache Borstenwut",
        sprite: { koerper: "keiler", farben: { haut: "#6e5644", kleid: "#5a4636", haare: "#2e241c" },
          gesicht: ["hauer"], extras: ["borsten"] },
        faehigkeit: "finsternis",
        angriffsBonus: 1,
        erscheinen: "Grunz! Das ist MEIN Eichelfeld!",
        niederlage: "Grunz … ich such mir Trüffel.",
        sieg: "Grunz! Platt gewalzt.",
      },
      // Level 24 – Anspielung auf den Bergeremiten aus "Naruto" (wilde weiße
      // Mähne, rote Striche unter den Augen, reitet Kröten, schreibt Bücher)
      {
        name: "Der Krötenweise",
        sprite: { koerper: "mensch", farben: { haut: "#efc29c", haare: "#eeeef0", kleid: "#3f7a4a", kleid2: "#b8323a", hose: "#3f7a4a" },
          haare: "maehne", gesicht: ["rotestriche"], waffe: "schriftrolle", extras: ["weste", "kroete", "gross"] },
        faehigkeit: "fluch",
        angriffsBonus: 1,
        erscheinen: "Der große Krötenweise ist da! Applaus!",
        niederlage: "Kommt alles in mein nächstes Buch.",
        sieg: "Recherche beendet. Du warst ein Kapitel.",
      },
      // Level 25 (Elite) – eigene Figur: die Kräuterhexe mit dem Tee, den
      // man besser nicht trinkt
      {
        name: "Mutter Wermut, die Kräuterhexe",
        sprite: { koerper: "mensch", farben: { haut: "#d9c9a4", haare: "#8a8a80", kleid: "#4a3a5a", kleid2: "#5f7a3a", hose: "#3a2f46" },
          haare: "struppig", kopf: "hexenhut", gesicht: ["hakennase", "warze", "boeseaugen"], waffe: "kraeuterkorb", extras: ["buckel", "kessel"] },
        faehigkeit: "verwirrung",
        angriffsBonus: 3,   // Elite-Boss
        erscheinen: "Ein Tässchen Tee, mein Kind? Ganz frisch …",
        niederlage: "Mein Tee! Ich hab mich selbst vergiftet!",
        sieg: "Trink aus, Kindchen. Es wird dir gefallen.",
      },
      // Level 26 – Anspielung auf den vernarbten Kämpfer aus "Game of Thrones"
      // (Helm mit Hundeschnauze, Brandnarbe; fürchtet Feuer, liebt Hühnchen)
      {
        name: "Der Hund vom Waldweg",
        sprite: { koerper: "huene", farben: { haut: "#e3b08a", haare: "#2a2420", kleid: "#3a3a42", hose: "#2c2c32" },
          kopf: "hundehelm", gesicht: ["brandnarbe"], waffe: "langschwert", extras: ["plattenruestung"] },
        faehigkeit: "tickTick",
        angriffsBonus: 1,
        erscheinen: "Ich will dein Hühnchen. Dann deine HP.",
        niederlage: "Hätte ich bloß das Hühnchen gegessen.",
        sieg: "Alles Hühnchen. Hab ich doch gesagt.",
      },
      // Level 27 – eigene Figur: Hauptmann einer Räuberbande, die den Wald
      // für sich beansprucht
      {
        name: "Rabenhauptmann Krähfuß",
        sprite: { koerper: "mensch", farben: { haut: "#d9a47c", haare: "#1e1a18", kleid: "#3a3240", kleid2: "#8e2229", hose: "#2a2620" },
          haare: "struppig", gesicht: ["augenklappe", "spitzbart"], waffe: "krummsaebel", extras: ["rabenmantel", "kraehe", "bauchbinde"] },
        faehigkeit: "siegel",
        angriffsBonus: 1,
        erscheinen: "Halt! Ab hier gehört der Wald meiner Bande.",
        niederlage: "Rückzug, Männer! … Männer?",
        sieg: "Durchsucht ihn. Gründlich.",
      },
      // Level 28 – Anspielung auf das Mädchen, das mit den Wölfen lebt, aus
      // "Prinzessin Mononoke" (weiße Maske mit roter Bemalung, Wolfsfell, Speer)
      {
        name: "Das Wolfsmädchen mit der Maske",
        sprite: { koerper: "mensch", farben: { haut: "#efc8a6", haare: "#2a2420", kleid: "#2c2c34", kleid2: "#d8c49a", hose: "#2c2c34" },
          haare: "kurz", gesicht: ["holzmaske"], kopf: "wolfsfell", waffe: "speer" },
        faehigkeit: "fluch",
        angriffsBonus: 1,
        erscheinen: "Verschwinde aus dem Wald, Mensch!",
        niederlage: "Der Wald vergisst dich nicht.",
        sieg: "Die Wölfe haben Hunger. Lauf.",
      },
      // Level 29 – eigene Figur: ein Irrlicht, das Wanderer ins Moor lockt
      {
        name: "Das Irrlicht vom Moor",
        sprite: { koerper: "flamme", farben: { haut: "#f4ffc8", kleid: "#a6e86a" },
          extras: ["nebelschweif", "flackern"] },
        faehigkeit: "verwirrung",
        angriffsBonus: 1,
        erscheinen: "Hier lang … nein, hier … oder doch dort?",
        niederlage: "Puff … ausgeflackert.",
        sieg: "Du hast dich verlaufen. Für immer.",
      },
      // Level 30 (Elite) – Anspielung auf den Elbenprinzen aus "Der Herr der
      // Ringe" (lange blonde Haare, Spitzohren, Langbogen; zählt seine
      // Treffer im Wettstreit mit einem Zwerg)
      {
        name: "Der Elbenschütze vom Blattwerk",
        sprite: { koerper: "mensch", farben: { haut: "#f4dcc4", haare: "#f0dc8a", kleid: "#5f7f5a", kleid2: "#8a9a8a", hose: "#4a5a46", augen: "#3a6aa8" },
          haare: "lang", gesicht: ["spitzohren"], waffe: "langbogen", extras: ["umhang", "koecher", "gross"] },
        faehigkeit: "tickTick",
        angriffsBonus: 3,   // Elite-Boss
        erscheinen: "Ein Pfeil, ein Treffer. Zwei sind Angeberei.",
        niederlage: "Ich zähl trotzdem mehr als der Zwerg.",
        sieg: "Treffer Nummer zweiundvierzig.",
      },
      // Level 31 – eigene Figur: eine Bärin, die man besser nicht weckt
      {
        name: "Bärin Brummgrimm",
        sprite: { koerper: "baer", farben: { haut: "#c49a6a", kleid: "#6e4628" },
          gesicht: ["narbe"], waffe: "honigwabe", extras: ["krallen"] },
        faehigkeit: "finsternis",
        angriffsBonus: 1,
        erscheinen: "Brumm. Wer stört meinen Winterschlaf?",
        niederlage: "Brumm … weck mich im Frühling.",
        sieg: "Brumm. Jetzt schlaf ich weiter.",
      },
      // Level 32 – Anspielung auf die unsichtbare Hexe aus "Blair Witch
      // Project" (Männchen aus Reisig, man steht in der Ecke)
      {
        name: "Die Hexe der Reisigmännchen",
        sprite: { koerper: "geist", farben: { haut: "#4a4038", haare: "#2a2420", kleid: "#4a4038" },
          kopf: "kapuze", gesicht: ["schattengesicht"], extras: ["reisigmaennchen"] },
        faehigkeit: "fluch",
        angriffsBonus: 1,
        erscheinen: "Dreh dich nicht um. Schon gar nicht zur Ecke.",
        niederlage: "Na toll. Jetzt bin ich die Gruselige.",
        sieg: "Steh still in der Ecke. Für immer.",
      },
      // Level 33 – eigene Figur: ein Druide, der mit den Eichen spricht
      {
        name: "Druide Eichenmistel",
        sprite: { koerper: "mensch", farben: { haut: "#e8c4a6", haare: "#f2f2ee", kleid: "#ecebe4", kleid2: "#cfcab8", hose: "#cfcab8" },
          haare: "lang", kopf: "mistelkranz", gesicht: ["langbart"], waffe: "sichel", extras: ["gross"] },
        faehigkeit: "siegel",
        angriffsBonus: 1,
        erscheinen: "Die Eiche hat mir von dir erzählt.",
        niederlage: "Die Mistel … sie hat mich verlassen.",
        sieg: "Ich opfere dich der großen Eiche.",
      },
      // Level 34 – Anspielung auf die Riesenspinne aus "Der Herr der Ringe"
      // (gewaltiger Leib, viele Augen, wickelt ihre Beute für später ein)
      {
        name: "Mutter Achtbein",
        sprite: { koerper: "spinne", farben: { haut: "#3a3040", kleid: "#2a2430", kleid2: "#b8323a" },
          extras: ["netz"] },
        faehigkeit: "finsternis",
        angriffsBonus: 1,
        erscheinen: "Bleib doch. Ich hab das Netz extra geputzt.",
        niederlage: "Acht Beine und trotzdem gestolpert.",
        sieg: "Gut eingewickelt. Für später.",
      },
      // Level 35 (Elite) – eigene Figur nach der Waldsage vom Wilden Jäger:
      // ein Jäger mit Hirschgeweih, der jede Jagd gewinnt
      {
        name: "Der Gehörnte Jäger",
        sprite: { koerper: "huene", farben: { haut: "#c9a07a", haare: "#3b2e26", kleid: "#4a3a2a", kleid2: "#6b5a3a", hose: "#3a2f22" },
          kopf: "geweihkapuze", gesicht: ["boeseaugen", "vollbart"], waffe: "speer", extras: ["pelz", "jagdhorn"] },
        faehigkeit: "tickTick",
        angriffsBonus: 3,   // Elite-Boss
        erscheinen: "Die Jagd beginnt. Du hast drei Atemzüge.",
        niederlage: "Die Jagd ist … vorbei.",
        sieg: "Erlegt. Das Geweih kommt an die Wand.",
      },
      // Level 36 – Anspielung auf das bleiche Wesen am Festmahl aus
      // "Pans Labyrinth" (Augen in den Handflächen; wer nascht, bleibt)
      {
        name: "Der Bleiche mit den Augenhänden",
        sprite: { koerper: "mensch", farben: { haut: "#e9d6cf", haare: "#e9d6cf", kleid: "#e2cbc3", hose: "#d8bfb6" },
          haare: "glatze", gesicht: ["augenlos"], extras: ["augenhaende", "gross"] },
        faehigkeit: "verwirrung",
        angriffsBonus: 1,
        erscheinen: "Nimm dir ruhig was. Ich schau nur zu.",
        niederlage: "Ich hätte nicht nur zuschauen sollen.",
        sieg: "Hast genascht? Dann bleibst du hier.",
      },
      // Level 37 – eigene Figur: ein Werwolf, der bei Vollmond zum Raubtier wird
      {
        name: "Der Werwolf vom Mondhang",
        sprite: { koerper: "huene", farben: { haut: "#7a6a5a", haare: "#5a4a3c", kleid: "#b8a688", hose: "#4a3a2a" },
          kopf: "wolfsohren", gesicht: ["wolfsschnauze"], extras: ["vollmond", "zerrissen", "krallen"] },
        faehigkeit: "fluch",
        angriffsBonus: 1,
        erscheinen: "Vollmond. Schlechter Abend für dich.",
        niederlage: "Morgen bin ich wieder ganz nett.",
        sieg: "Auuuuh! Guten Appetit, ich.",
      },
      // Level 38 – Anspielung auf den dreiäugigen Seher aus "Game of Thrones"
      // (uralt, mit den Wurzeln eines Baums verwachsen, Rabe; sieht alles)
      {
        name: "Der Dreiäugige im Wurzelthron",
        sprite: { koerper: "mensch", farben: { haut: "#d8c8b0", haare: "#e8e6de", kleid: "#6a5a40", kleid2: "#4e4230", hose: "#5a4a34" },
          haare: "lang", gesicht: ["langbart", "drittesauge"], extras: ["wurzelthron", "wurzeln", "kraehe"] },
        faehigkeit: "siegel",
        angriffsBonus: 1,
        erscheinen: "Ich hab dich kommen sehen. Seit Jahren.",
        niederlage: "Das … hab ich nicht kommen sehen.",
        sieg: "Wusste ich alles schon vorher.",
      },
      // Level 39 – Anspielung auf den kopflosen Reiter aus "Sleepy Hollow"
      // (kein Kopf, Kürbislaterne, Säbel, dunkler Umhang)
      {
        name: "Der Kopflose vom Hohlweg",
        sprite: { koerper: "mensch", farben: { haut: "#c9a07a", kleid: "#3a3f52", kleid2: "#7a2228", hose: "#24242c", schuhe: "#2a1e16" },
          waffe: "krummsaebel", extras: ["umhang", "kopflos", "kuerbislaterne", "gross"] },
        faehigkeit: "tickTick",
        angriffsBonus: 1,
        erscheinen: "Ich hab meinen Kopf verloren. Gleich deinen?",
        niederlage: "Kopflos verloren. Wie passend.",
        sieg: "Ein Kopf für meine Sammlung. Danke!",
      },
      // Level 40 (Weltboss) – eigene Figur: ein uralter Baumriese, der
      // tausend Jahre geschlafen hat – mit Moosbart, glühenden Augen und
      // einem Eulennest in der Krone
      {
        name: "Urborke, der Erwachte",
        sprite: { eigen: "urborke" },
        faehigkeit: "finsternis",
        angriffsBonus: 5,   // Weltboss
        erscheinen: "Tausend Jahre schlief ich. Du hast mich geweckt.",
        niederlage: "Ich … wurzle … wieder ein.",
        sieg: "Werde Erde. Werde Wald.",
      },
    ],
  };

  // Im Browser: in die Liste aller Welten eintragen; in Node.js (Tests): exportieren
  if (typeof module !== "undefined" && module.exports) module.exports = welt;
  else (window.SUDOKU_WELTEN = window.SUDOKU_WELTEN || [])[welt.nummer - 1] = welt;
})();
