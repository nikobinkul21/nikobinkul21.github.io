/* ==========================================================================
   worlds/welt1.js – Welt 1: "Felder und Tavernen" (Level 1 bis 20)
   Weizenfelder, Feldwege, Schenken und Brücken. Die Bosse werden von
   Level 1 bis 20 bedrohlicher: erst Vogelscheuchen und Raufbolde, am Ende
   Söldner, ein Koloss und der Erntekönig als Weltboss.

   Aufbau eines Bosses:
     name        – Anzeigename
     sprite      – Bauplan für den Sprite-Baukasten (js/sudoku-sprites.js):
                   koerper (mensch, huene, tier, geist, konstrukt), farben,
                   haare, kopf, gesicht [], waffe, extras []
                   Der Weltboss hat stattdessen { eigen: "<name>" } – einen
                   eigenen, größeren Sprite.
     faehigkeit  – genau eine Fähigkeit: id aus KONFIG.faehigkeiten
                   (finsternis, fluch, siegel, tickTick, verwirrung). Innerhalb
                   einer Welt abwechslungsreich, nie dieselbe zweimal
                   hintereinander; Tick, Tick erst ab Level 5.
     erscheinen  – Satz beim Erscheinen (Sprechblase, höchstens ~60 Zeichen)
     niederlage  – Satz bei seiner Niederlage (der Held hat gewonnen)
     sieg        – Satz, wenn der Held gegen ihn verliert (Ende des Durchlaufs)
   Level 5, 10 und 15 sind Elite-Bosse, Level 20 ist der Weltboss
   (Regeln in js/sudoku-rpg.js, KONFIG.welten).

   Anspielungen sind nur Anspielungen: eigene Namen, eigenes Aussehen mit
   ein, zwei erkennbaren Merkmalen, eigene Sätze.
   ========================================================================== */

(function () {
  const welt = {
    nummer: 1,
    id: "felder",
    name: "Felder und Tavernen",
    // Pixel-Hintergrund im Kampffenster (js/sudoku-sprites.js, HINTERGRUENDE)
    hintergrund: "felder",
    // Farbstimmung: Himmel, Boden und Akzent für Hintergrund und Welt-Anzeige
    farben: {
      himmelOben: "#7cc4f0", himmelUnten: "#cfeaf7",
      boden: "#8cc35a", bodenDunkel: "#5e9a3c",
      fern: "#a7cf86", akzent: "#e0a43a",
    },

    bosse: [
      // Level 1 – eigene Figur: eine Vogelscheuche, die lieber schlafen würde
      {
        name: "Strohkopf, die Vogelscheuche",
        sprite: { koerper: "konstrukt", farben: { haut: "#e3c784", kleid: "#6f8fbf", kleid2: "#b8434a", hose: "#7a5a36" },
          kopf: "schlapphut", gesicht: ["naehmund"], extras: ["flicken", "kraehe", "stroh"] },
        faehigkeit: "finsternis",
        erscheinen: "Krah! Äh … Buh! Runter von meinem Acker!",
        niederlage: "Endlich darf ich mich hinlegen.",
        sieg: "Buh! Und jetzt runter vom Acker. Ich hab Schlaf nachzuholen.",
      },
      // Level 2 – eigene Figur: Raufbold aus der Dorfschenke
      {
        name: "Der Rüpel aus der Schenke",
        sprite: { koerper: "mensch", farben: { haut: "#e8b48a", haare: "#6b3f1f", kleid: "#e9e2cf", hose: "#4b5a73" },
          haare: "kurz", gesicht: ["veilchen", "stoppeln"], waffe: "krug", extras: ["aermellos"] },
        faehigkeit: "siegel",
        erscheinen: "Hast du gerade mein Bier angerempelt?",
        niederlage: "Schon gut … die nächste Runde geht auf mich.",
        sieg: "Und raus mit dir! Der Nächste, bitte.",
      },
      // Level 3 – Anspielung auf den grünen Sumpf-Oger aus "Shrek"
      // (Trichterohren, Weste; "Oger sind wie Zwiebeln" → Rüben)
      {
        name: "Der Sumpfoger vom Rübenfeld",
        sprite: { koerper: "huene", farben: { haut: "#8fb34a", kleid: "#e6dcc0", kleid2: "#6b4a2b", hose: "#6b4a2b" },
          haare: "glatze", gesicht: ["trichterohren"], extras: ["weste"] },
        faehigkeit: "fluch",
        erscheinen: "Was macht ihr alle auf MEINEM Feld?",
        niederlage: "Oger sind wie Rüben. Vielschichtig.",
        sieg: "Und jetzt raus aus meinem Feld!",
      },
      // Level 4 – Anspielung auf den Chemielehrer aus "Breaking Bad"
      // (Glatze, flacher Hut, Brille, Ziegenbart, gelber Schutzanzug)
      {
        name: "Der Kräuterkoch",
        sprite: { koerper: "mensch", farben: { haut: "#efc29c", haare: "#3a3a3a", kleid: "#e8d23a", hose: "#c9b52c" },
          haare: "glatze", kopf: "flachhut", gesicht: ["brille", "ziegenbart"], waffe: "kolben" },
        faehigkeit: "verwirrung",
        erscheinen: "Ich bin nicht in Gefahr. Ich bin der, der würfelt.",
        niederlage: "Merk dir meinen Namen … wie war der noch?",
        sieg: "Sag meinen Namen. … Genau.",
      },
      // Level 5 (Elite) – eigene Figur: der Wirt, der jede Zeche eintreibt
      {
        name: "Wirt Ochsenbauch",
        sprite: { koerper: "huene", farben: { haut: "#f0b98f", haare: "#3b2a1e", kleid: "#a8323a", hose: "#4a3a2a" },
          haare: "kranz", gesicht: ["zwirbelbart"], waffe: "kelle", extras: ["schuerze"] },
        faehigkeit: "tickTick",
        erscheinen: "Die Zeche, Freundchen! Und zwar sofort!",
        niederlage: "Na schön … ich schreib's an.",
        sieg: "Die Zeche zahlst diesmal du. Alles.",
      },
      // Level 6 – Anspielung auf den Ninja-Jungen aus "Naruto"
      // (orange Kleidung, Stirnband mit Platte, Stachelhaare, Schnurrhaar-Striche)
      {
        name: "Der Nudelninja",
        sprite: { koerper: "mensch", farben: { haut: "#f4c79d", haare: "#f2c230", kleid: "#ef7d22", kleid2: "#2b2f45", hose: "#ef7d22" },
          haare: "stachel", kopf: "stirnband", gesicht: ["schnurrhaare"], waffe: "kunai", extras: ["schulterdunkel"] },
        faehigkeit: "finsternis",
        erscheinen: "Eines Tages bin ich Dorfchef, echt jetzt!",
        niederlage: "Ich geb nie auf … nur heute kurz.",
        sieg: "Echt jetzt! Ich hab gewonnen!",
      },
      // Level 7 – eigene Figur: Wegelagerer am Feldweg
      {
        name: "Halsabschneider-Hinz",
        sprite: { koerper: "mensch", farben: { haut: "#d9a47c", haare: "#2d2a26", kleid: "#3f5a3a", kleid2: "#b8323a", hose: "#3a3328" },
          kopf: "kapuze", gesicht: ["halstuch", "boeseaugen"], waffe: "dolch" },
        faehigkeit: "fluch",
        erscheinen: "Geld oder Leben! Ach, ich nehm beides.",
        niederlage: "Hier, dein Geld. War ja eh deins.",
        sieg: "Geld UND Leben. Wie angekündigt.",
      },
      // Level 8 – Anspielung auf den schwankenden Piratenkapitän aus
      // "Fluch der Karibik" (Dreispitz, Zöpfe mit Perlen, Kajal, Rumflasche)
      {
        name: "Kapitän Schwankbart",
        sprite: { koerper: "mensch", farben: { haut: "#d8a27a", haare: "#2a2018", kleid: "#7a4a2a", kleid2: "#e9e2cf", hose: "#3b3246" },
          haare: "dreads", kopf: "dreispitz", gesicht: ["kajal", "spitzbart"], waffe: "flasche", extras: ["hemdkragen"] },
        faehigkeit: "verwirrung",
        erscheinen: "Wer hat schon wieder meinen Rum ausgetrunken?",
        niederlage: "Merk dir den Tag, an dem du mich FAST hattest!",
        sieg: "Darauf einen Rum! Hicks.",
      },
      // Level 9 – Anspielung auf den sanften Stallburschen aus
      // "Game of Thrones", der nur ein Wort sagt und die Tür hält
      {
        name: "Der Torhalter",
        sprite: { koerper: "huene", farben: { haut: "#e3b08a", haare: "#6b4a2b", kleid: "#7d7a6a", hose: "#4f4a3e" },
          haare: "struppig", gesicht: ["vollbart", "sanft"], waffe: "tuer" },
        faehigkeit: "siegel",
        erscheinen: "Tor. Tor! TOR!",
        niederlage: "… Tor zu.",
        sieg: "Tor! … Tor zu für dich.",
      },
      // Level 10 (Elite) – Anspielung auf den Monsterjäger aus "The Witcher"
      // (lange weiße Haare, Katzenaugen, zwei Schwerter, Wolfsmedaillon)
      {
        name: "Der Hexer vom Kreuzweg",
        sprite: { koerper: "mensch", farben: { haut: "#e6c0a0", haare: "#eef0f2", kleid: "#2c2c34", hose: "#24242a" },
          haare: "lang", gesicht: ["katzenaugen", "narbe"], waffe: "schwert", extras: ["schwertgriffe", "medaillon"] },
        faehigkeit: "fluch",
        erscheinen: "Hmm. Wieder ein Auftrag. Wieder Ärger.",
        niederlage: "Verflucht. Hmm.",
        sieg: "Hmm. Auftrag erledigt.",
      },
      // Level 11 – Anspielung auf die uralte Elfenmagierin aus "Frieren"
      // (Spitzohren, weiße Zöpfe, weiß-goldener Umhang, Stab mit rotem Stein;
      // sammelt nutzlose Zauber und fällt auf jede Schatztruhe herein)
      {
        name: "Die Elfe der nutzlosen Zauber",
        sprite: { koerper: "mensch", farben: { haut: "#f6dcc8", haare: "#f2f2ee", kleid: "#f2f0e6", kleid2: "#d4a83a", hose: "#3d3a46", augen: "#3a8a6a" },
          haare: "zoepfe", gesicht: ["spitzohren"], waffe: "stabrot", extras: ["umhang"] },
        faehigkeit: "verwirrung",
        erscheinen: "Achtzig Jahre? Ein Wimpernschlag. Fang an.",
        niederlage: "Moment … da drüben steht eine Truhe!",
        sieg: "In achtzig Jahren darfst du's noch mal versuchen.",
      },
      // Level 12 – Anspielung auf den Schwertkämpfer aus "One Piece"
      // (grüne Haare, drei Schwerter, eins im Mund, verläuft sich ständig)
      {
        name: "Der Dreiklingen-Söldner",
        sprite: { koerper: "mensch", farben: { haut: "#e2b088", haare: "#4caf50", kleid: "#ecebe4", kleid2: "#3f8a3f", hose: "#2b2b30" },
          haare: "kurz", gesicht: ["klingeimmund", "narbe"], extras: ["bauchbinde", "dreischwerter"] },
        faehigkeit: "finsternis",
        erscheinen: "Wo bin ich hier? Egal. Zieh!",
        niederlage: "Falscher Weg … schon wieder.",
        sieg: "Drei Klingen, ein Weg. Deiner endet hier.",
      },
      // Level 13 – Anspielung auf den Lehrer mit Augenbinde aus "Jujutsu Kaisen"
      // (weiße Stachelhaare, schwarze Augenbinde, Hochkragen; hält sich für
      // den Stärksten; sein Gebiet → Siegel)
      {
        name: "Der Lehrer mit der Augenbinde",
        sprite: { koerper: "mensch", farben: { haut: "#f1d0b4", haare: "#f4f6fa", kleid: "#1f2030", hose: "#1f2030" },
          haare: "hochstachel", gesicht: ["augenbinde"], extras: ["kragen", "gross"] },
        faehigkeit: "siegel",
        erscheinen: "Keine Sorge. Ich bin ja der Stärkste hier.",
        niederlage: "Na gut … dann eben nicht der Stärkste.",
        sieg: "Hab ich doch gesagt: der Stärkste.",
      },
      // Level 14 – Anspielung auf den schwarzen Ritter aus
      // "Die Ritter der Kokosnuß", der jede Wunde für einen Kratzer hält
      {
        name: "Der Unbeugsame Ritter",
        sprite: { koerper: "mensch", farben: { haut: "#e0b090", kleid: "#2a2a30", kleid2: "#43434c", hose: "#2a2a30" },
          kopf: "topfhelm", waffe: "schwert", extras: ["einarm", "plattenruestung"] },
        faehigkeit: "tickTick",
        erscheinen: "Hier kommt keiner vorbei. KEINER!",
        niederlage: "Ist doch nur ein Schrämmchen! Komm zurück!",
        sieg: "Keiner kommt vorbei. Hab ich doch gesagt!",
      },
      // Level 15 (Elite) – Anspielung auf den grauen Zauberer aus
      // "Der Herr der Ringe" (Spitzhut, langer Bart, Stab, Pfeife, Rauchringe)
      {
        name: "Der Alte vom Wegesrand",
        sprite: { koerper: "mensch", farben: { haut: "#e8c4a6", haare: "#b9bcc2", kleid: "#8d9099", kleid2: "#6f727a", hose: "#6f727a" },
          haare: "lang", kopf: "spitzhut", gesicht: ["langbart", "pfeife"], waffe: "stab", extras: ["umhang"] },
        faehigkeit: "siegel",
        erscheinen: "Hier ist für dich Endstation, junger Held.",
        niederlage: "Ich komme nie zu spät. Heute nur zu früh.",
        sieg: "Hier endet dein Weg, junger Held.",
      },
      // Level 16 – eigene Figur (nach dem Volksmärchen, kein Film):
      // der Rattenfänger mit Flöte
      {
        name: "Der Rattenfänger",
        sprite: { koerper: "mensch", farben: { haut: "#ecc29e", haare: "#a0522d", kleid: "#d2412f", kleid2: "#f2c230", hose: "#2f6f9a" },
          haare: "kurz", kopf: "federhut", gesicht: ["spitzbart"], waffe: "floete", extras: ["bunt", "ratten"] },
        faehigkeit: "verwirrung",
        erscheinen: "Eine Melodie, und deine Zahlen folgen mir.",
        niederlage: "Die Ratten … gehen ohne mich.",
        sieg: "Hörst du? Deine Zahlen tanzen jetzt für mich.",
      },
      // Level 17 – Anspielung auf den Wächter der Mauer im Norden aus
      // "Game of Thrones" (schwarzer Pelz, dunkle Locken, "Du weißt nichts")
      {
        name: "Der Wächter der Nordpalisade",
        sprite: { koerper: "mensch", farben: { haut: "#e8c0a0", haare: "#1e1a18", kleid: "#24232a", hose: "#24232a" },
          haare: "locken", gesicht: ["vollbart"], waffe: "langschwert", extras: ["pelz"] },
        faehigkeit: "finsternis",
        erscheinen: "Der Frost kommt. Aber zuerst komme ich.",
        niederlage: "Ich wusste wohl doch nichts.",
        sieg: "Die Wacht hält. Wie jede Nacht.",
      },
      // Level 18 – eigene Figur: der Geist eines Wirts, der nie Feierabend hatte
      {
        name: "Der Schankgeist",
        sprite: { koerper: "geist", farben: { haut: "#bfe3ef", haare: "#9fd0e0", kleid: "#9fd0e0" },
          gesicht: ["hohlaugen"], waffe: "krug", extras: ["kette"] },
        faehigkeit: "fluch",
        erscheinen: "Letzte Runde! Seit dreihundert Jahren.",
        niederlage: "Endlich … Sperrstunde.",
        sieg: "Noch einer für die Ewigkeit. Prost!",
      },
      // Level 19 – Anspielung auf den riesigen, hautlosen Titanen aus
      // "Attack on Titan", der über die Mauer schaut und dampft
      {
        name: "Der dampfende Mauerkoloss",
        sprite: { koerper: "huene", farben: { haut: "#c2493f", haare: "#8e2a24", kleid: "#c2493f", hose: "#c2493f" },
          haare: "glatze", gesicht: ["starraugen", "zaehne"], extras: ["muskeln", "mauer", "dampf"] },
        faehigkeit: "tickTick",
        erscheinen: "*dampf* Schöne Mauer habt ihr da.",
        niederlage: "*zisch* … verdampft.",
        sieg: "*dampf* Die Mauer steht. Du nicht.",
      },
      // Level 20 (Weltboss) – eigene Figur: die Vogelscheuche aus Level 1,
      // nur riesig – aus Garben, mit Krähenkrone, Sense und Kürbiskopf
      {
        name: "Der Erntekönig",
        sprite: { eigen: "erntekoenig" },
        faehigkeit: "fluch",
        erscheinen: "Ihr habt meine Felder lang genug zertrampelt!",
        niederlage: "Die Ernte … ist … eingefahren.",
        sieg: "Die Ernte gehört mir. Und du dazu.",
      },
    ],
  };

  // Im Browser: in die Liste aller Welten eintragen; in Node.js (Tests): exportieren
  if (typeof module !== "undefined" && module.exports) module.exports = welt;
  else (window.SUDOKU_WELTEN = window.SUDOKU_WELTEN || [])[welt.nummer - 1] = welt;
})();
