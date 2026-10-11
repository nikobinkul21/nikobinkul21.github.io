/* ==========================================================================
   sudoku-rpg.js – Regeln und Spielstand des Sudoku-Abenteuers
   KEIN Zugriff auf die Seite (kein document, kein DOM). Darstellung:
   js/sudoku-battle-ui.js und js/sudoku-ui.js.

   Grundidee:
     - Jede richtige Zahl wirft einen Würfel. Der Schaden entsteht in EINER
       Funktion (berechneSchaden) in fester Reihenfolge: Wurf, kritisch/
       Fehlschlag, Zuschläge, Kombo, Schwierigkeit, Doppelschaden, Gift.
     - Richtige Zahlen in Folge bauen eine Kombo auf, ein Fehler setzt sie zurück.
     - Jede falsche Zahl kostet ein Leben. Bei 0 Leben ist der Kampf
       verloren, der Boss beginnt mit vollen HP von vorn.
     - Richtige Zahlen und fertige Einheiten bringen Münzen (× Münzfaktor
       des Schwierigkeitsgrads).
     - Power-up-Felder im Sudoku lösen beim richtigen Ausfüllen eine
       Wirkung aus (Leben, Gift, Münzen …).
     - Nach jedem besiegten Boss wählt man eine von drei Verbesserungen.
     - Jeder Boss kann eine Eigenheit haben (Regeneration, Rüstung …).
     - Jeder fünfte Boss ist ein Elite-Boss: doppelte HP, dazu eine seltene
       Eigenschaft (Immunität, Schildwall …), als Belohnung Extra-Münzen und
       zwei Verbesserungen.

   Die Regeln MELDEN, was passiert (Ereignisse), statt selbst etwas
   anzuzeigen. Die Oberfläche hört zu und spielt Animationen ab:
     "richtig"        – richtige Zahl: Wurf, Rechnung, Schaden, Gift, Münzen …
                        (alles, was diese eine Zahl bewirkt, in EINEM Ereignis)
     "powerup"        – ein Power-up-Feld wurde ausgelöst
     "fehler"         – falsche Zahl: ein Leben weniger, Kombo weg, ggf. Eigenheit
     "bossBesiegt"    – HP auf 0
     "auswahl"        – Verbesserungen stehen zur Wahl (bis gewählt ist, zählt keine Zahl)
     "verbesserung"   – eine Verbesserung wurde gewählt
     "neuerBoss"      – der nächste Boss steht bereit
     "sudokuGeloest"  – alle Felder richtig
     "niederlage"     – keine Leben mehr
     "zurueckgesetzt" – Abenteuer von vorn

   ERWEITERN ohne die Grundregeln umzuschreiben:
     1. Auf Ereignisse hören:     spiel.an("bossBesiegt", function (e) { … })
     2. Den Schaden verändern:    spiel.erweitere({ schaden: {
                                    zuschlag: function (rechnung) { rechnung.wert += 2; }
                                  } })
        (ein Modifikator für eine Stufe der Schadensberechnung, siehe unten)
     3. Neue Power-up-Typen, Verbesserungen, Eigenheiten: je ein weiterer
        Eintrag in der Konfiguration
     4. Eigene Daten im Spielstand: zustand.extras.meinItem = …
        ("extras" wird mitgespeichert und bleibt sonst unangetastet)
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Zahlenwerte an EINER Stelle
   -------------------------------------------------------------------------- */
const SUDOKU_RPG_KONFIG = {
  // Bosse
  startHp: 80,          // HP des ersten Bosses
  hpZuwachs: 20,        // jeder weitere Boss hat so viel mehr

  // Würfel und Schaden
  wuerfelSeiten: 20,    // Würfel bei richtiger Zahl: 1 bis 20
  kritischFaktor: 3,    // höchste Augenzahl = kritischer Treffer: Würfelwert × 3
                        // (eine 1 ist ein Fehlschlag ohne Schaden)
  doppelschadenFaktor: 2, // Zeile/Spalte/Block vervollständigt → Schaden × 2
                          // (mehrere Einheiten gleichzeitig: trotzdem nur × 2)

  // Sprüche bei einem Fehlschlag (eine wird zufällig gezeigt)
  fehlschlagSprueche: [
    "Daneben! Der Held stolpert über seine eigenen Füße.",
    "Hoppla – ausgerutscht! Der Schlag geht ins Leere.",
    "Der Boss gähnt. Das Schwert trifft nur Luft.",
    "Autsch, der Held tritt auf seinen Umhang!",
    "Ein Schlag wie ein Windhauch … kein Schaden.",
  ],

  // Kombo: jede richtige Zahl in Folge +1, ein Fehler setzt sie auf 0
  kombo: {
    proStufe: 0.10,     // jede Stufe: 10 % mehr Schaden
    maxBonus: 1.00,     // höchstens +100 % (Kombo-Meister erhöht das)
  },

  // Leben
  startLeben: 3,        // so viele Leben zu Beginn (und nach einer Niederlage)
  maxLeben: 5,          // mehr geht nicht (Zähes Herz erhöht das)
  lebenNachBoss: 3,     // nach einem besiegten Boss wird darauf aufgefüllt
                        // (wer mehr hat, behält sie)

  // Münzen
  muenzen: {
    proZahl: 1,         // jede richtige Zahl
    proZeileOderSpalte: 3, // je vervollständigte Zeile bzw. Spalte
    proBlock: 5,        // je vervollständigter 3×3-Block
  },

  // Schwierigkeitsgrade (ids aus der Liste in sudoku-engine.js):
  //   gewicht       – wie oft der Grad ausgelost wird (höher = öfter)
  //   muenzFaktor   – alle Münzen einer Zahl werden damit malgenommen
  //                   (Kommastellen werden gesammelt, nichts geht verloren)
  //   schadensBonus – zusätzlicher Schaden, 0.10 = +10 %
  // Ein Grad, der hier fehlt, zählt wie { gewicht: 1, muenzFaktor: 1, schadensBonus: 0 }.
  schwierigkeit: {
    einfach: { gewicht: 1, muenzFaktor: 1.0, schadensBonus: 0 },
    mittel: { gewicht: 1, muenzFaktor: 1.25, schadensBonus: 0.10 },
    schwer: { gewicht: 1, muenzFaktor: 1.5, schadensBonus: 0.20 },
    special: { gewicht: 1, muenzFaktor: 2.0, schadensBonus: 0.35 },
  },

  // Power-up-Felder: so viele leere Felder pro Sudoku werden zu Power-ups
  powerupAnzahl: 5,

  // Die Power-up-Typen. Jeder Typ wird pro Feld nach "gewicht" ausgelost.
  // Neuer Typ? Einfach einen weiteren Eintrag – Farbe und Symbol nutzt die
  // Oberfläche (Symbole: siehe SYMBOLE in js/sudoku-battle-ui.js).
  // wirkung(effekt) verändert das Effekt-Objekt dieser Zahl:
  //   effekt.leben      – zusätzliche Leben
  //   effekt.muenzen    – zusätzliche Münzen
  //   effekt.giftAnteil – Anteil des Schadens, der zusätzlich als Gift trifft
  powerupTypen: [
    {
      id: "gold", name: "Gold", farbe: "#e6b422", symbol: "muenze", gewicht: 50,
      beschreibung: "+10 Münzen",
      wirkung: function (effekt) { effekt.muenzen += 10; },
    },
    {
      id: "gruen", name: "Grün", farbe: "#2fb35a", symbol: "tropfen", gewicht: 30,
      beschreibung: "Gift: die Hälfte des Schadens extra",
      wirkung: function (effekt) { effekt.giftAnteil += 0.5; },
    },
    {
      id: "rot", name: "Rot", farbe: "#e2364a", symbol: "herz", gewicht: 20,
      beschreibung: "+1 Leben",
      wirkung: function (effekt) { effekt.leben += 1; },
    },
  ],

  // Verbesserungen: Nach jedem besiegten Boss werden so viele zur Wahl gestellt
  verbesserungAngebot: 3,

  // Die Verbesserungen. Neue? Einfach einen weiteren Eintrag:
  //   id, name, symbol, farbe – Kennung und Aussehen (Symbole: SYMBOLE in sudoku-battle-ui.js)
  //   maxStufe     – so oft kann man sie höchstens wählen
  //   wert         – Stärke pro Stufe; in "beschreibung" steht {wert} bzw.
  //                  {prozent} (= wert × 100) für diese Zahl
  //   wirkung(w, stufe, wert) – verändert die Spielwerte w (siehe werteVon):
  //       w.wuerfelSeiten, w.kritischeAugen, w.festerSchaden, w.reihenSchaden,
  //       w.komboMax, w.muenzenProZahl, w.powerupAnzahl, w.maxLeben
  //   beimWaehlen(zustand, w, wert) – optional: passiert einmal beim Wählen
  //   naechsteStufe(stufe, wert) – optional: Text für die Karte in der Auswahl,
  //                  was die nächste Stufe bringt (sonst "Stufe 1 → 2")
  verbesserungen: [
    {
      id: "wuerfel", name: "Größerer Würfel", symbol: "wuerfel", farbe: "#6c4bd8",
      maxStufe: 5, wert: 2,
      beschreibung: "Der Würfel bekommt {wert} Seiten mehr.",
      wirkung: function (w, stufe, wert) { w.wuerfelSeiten += wert * stufe; },
    },
    {
      id: "klinge", name: "Scharfe Klinge", symbol: "klinge", farbe: "#5d7fa8",
      maxStufe: 5, wert: 2,
      beschreibung: "{wert} fester Schaden pro Treffer.",
      wirkung: function (w, stufe, wert) { w.festerSchaden += wert * stufe; },
    },
    {
      id: "herz", name: "Zähes Herz", symbol: "herz", farbe: "#e2364a",
      maxStufe: 3, wert: 1,
      beschreibung: "Lebensmaximum +{wert}, dazu {wert} Leben geheilt.",
      wirkung: function (w, stufe, wert) { w.maxLeben += wert * stufe; },
      beimWaehlen: function (zustand, w, wert) {
        zustand.leben = Math.min(w.maxLeben, zustand.leben + wert);
      },
    },
    {
      id: "schatzkarte", name: "Schatzkarte", symbol: "karte", farbe: "#b07a3a",
      maxStufe: 3, wert: 1,
      beschreibung: "{wert} Power-up-Feld mehr pro Sudoku.",
      wirkung: function (w, stufe, wert) { w.powerupAnzahl += wert * stufe; },
    },
    {
      id: "reihenbrecher", name: "Reihenbrecher", symbol: "reihe", farbe: "#1f9e89",
      maxStufe: 10, wert: 10,
      beschreibung: "Jede fertige Zeile, Spalte und jeder fertige Block: {wert} Extra-Schaden.",
      wirkung: function (w, stufe, wert) { w.reihenSchaden += wert * stufe; },
      naechsteStufe: function (stufe, wert) {
        return stufe === 0
          ? "Neu: " + wert + " Extra-Schaden"
          : "Stufe " + stufe + " auf " + (stufe + 1) + ": " + (stufe * wert) + " auf " + ((stufe + 1) * wert) + " Extra-Schaden";
      },
    },
    {
      id: "kombo", name: "Kombo-Meister", symbol: "blitz", farbe: "#e98a15",
      maxStufe: 2, wert: 0.5,
      beschreibung: "Kombo-Obergrenze +{prozent} Prozentpunkte.",
      wirkung: function (w, stufe, wert) { w.komboMax += wert * stufe; },
    },
    {
      id: "glueck", name: "Glückspilz", symbol: "pilz", farbe: "#d6336c",
      maxStufe: 3, wert: 1,
      beschreibung: "Auch die nächstniedrigere Augenzahl ist ein kritischer Treffer.",
      wirkung: function (w, stufe, wert) { w.kritischeAugen += wert * stufe; },
    },
    {
      id: "magnet", name: "Münzmagnet", symbol: "magnet", farbe: "#c0392b",
      maxStufe: 3, wert: 1,
      beschreibung: "{wert} Münze mehr pro richtiger Zahl.",
      wirkung: function (w, stufe, wert) { w.muenzenProZahl += wert * stufe; },
    },
  ],

  // Verbesserungen, die es nicht mehr gibt. Steht eine davon in einem
  // gespeicherten Spielstand, fällt sie weg – dafür darf man beim nächsten
  // Laden einmalig eine Verbesserung frei wählen.
  entfernteVerbesserungen: ["gift"],   // "Starkes Gift"

  // Regenbogenfeld: sehr selten, besiegt den aktuellen Boss sofort
  regenbogenfeld: {
    chance: 0.01,           // Wahrscheinlichkeit pro neuem Sudoku (0.01 = 1 %)
    testErzwingen: false,   // true: in JEDEM Sudoku ein Regenbogenfeld (zum Ausprobieren)
  },

  // Die Bosse in ihrer Reihenfolge. Nach dem letzten geht es mit dem
  // ersten weiter – mit anderer Farbpalette, höherer Nummer, derselben
  // Eigenheit und demselben Angriff. "sprite" verweist auf eine Figur in
  // js/sudoku-sprites.js, "eigenheit" auf einen Eintrag in eigenheiten
  // (null = keine), "angriff" auf einen Eintrag in angriffe (null = keiner).
  bosse: [
    { name: "Schleimkönig", sprite: "schleim", eigenheit: null, angriff: "schrei" },
    { name: "Knochenfürst", sprite: "knochen", eigenheit: "regeneration", angriff: "siegel" },
    { name: "Giftpilz", sprite: "pilz", eigenheit: "ruestung", angriff: "finsternis" },
    { name: "Steingolem", sprite: "golem", eigenheit: "nebel", angriff: "fluch" },
    { name: "Schattendrache", sprite: "drache", eigenheit: "dieb", angriff: "hieb" },
  ],

  // Gegenangriffe: Jeder Boss kündigt seinen Angriff an. Jede gesetzte Zahl
  // (richtig oder falsch) zählt den Zähler um 1 herunter, bei 0 greift der
  // Boss an und der Zähler beginnt von vorn. Eine Parade (fertige Zeile,
  // Spalte oder fertiger Block) wehrt den nächsten Angriff ganz ab.
  gegenangriff: {
    eliteKuerzer: 2,        // bei Elite-Bossen kommt der Angriff so viele Züge früher
    warnungAb: 2,           // in den letzten so vielen Zügen pulsiert die Anzeige
    paradenMax: 1,          // so viele Paraden kann man höchstens vorrätig haben
  },

  // Die Angriffe. Neuer Angriff? Einfach ein weiterer Eintrag:
  //   id, name, symbol, farbe – Kennung und Anzeige (Symbole: SYMBOLE in js/sudoku-battle-ui.js)
  //   abstand      – alle so vielen Züge greift der Boss an
  //   dauer        – so viele Züge hält die Wirkung an (0 = wirkt sofort und einmalig)
  //   wert         – Stärke (z. B. Leben beim Hieb)
  //   beschreibung – {dauer} und {wert} werden ersetzt
  //   wirkung(a)   – passiert beim Angriff. a = { zustand, raetsel, wert, dauer,
  //                  zufall, waehle(liste), leer(i), blockFelder(b) }.
  //                  Gibt { text, daten } zurück – oder null: Der Angriff verpufft.
  //                  "daten" merkt sich eine Wirkung mit Dauer (z. B. welcher Block).
  //   Wirkungen mit Dauer auf das Spielfeld (alle optional):
  //     feld(daten, i)    – "versiegelt" (dort kann man nichts setzen) oder
  //                         "verdeckt" (Zahl wird als "?" gezeigt) oder null
  //     ziffer(daten, z)  – "verflucht": diese Ziffer macht keinen Schaden
  //     gueltig(daten)    – prüft gespeicherte Daten beim Laden
  angriffe: [
    {
      id: "schrei", name: "Schrei", symbol: "schrei", farbe: "#e98a15",
      abstand: 10, dauer: 0, wert: 0.5,
      beschreibung: "Halbiert deine Kombo.",
      wirkung: function (a) {
        const vorher = a.zustand.kombo;
        a.zustand.kombo = Math.floor(vorher * a.wert);
        return { text: "Kombo " + vorher + " → " + a.zustand.kombo, daten: null };
      },
    },
    {
      id: "siegel", name: "Siegel", symbol: "siegel", farbe: "#8b5cff",
      abstand: 9, dauer: 4, wert: 0,
      beschreibung: "Versiegelt für {dauer} Züge einen 3×3-Block mit leeren Feldern. Dort kannst du nichts setzen.",
      wirkung: function (a) {
        // Nur Blöcke mit leeren Feldern – und nur, wenn außerhalb noch ein
        // leeres Feld frei bleibt. Sonst verpufft das Siegel.
        const leerGesamt = [];
        for (let i = 0; i < 81; i++) if (a.leer(i)) leerGesamt.push(i);
        const bloecke = [];
        for (let b = 0; b < 9; b++) {
          const innen = a.blockFelder(b).filter(a.leer).length;
          if (innen > 0 && leerGesamt.length - innen > 0) bloecke.push(b);
        }
        if (bloecke.length === 0) return null;
        const block = a.waehle(bloecke);
        return { text: "Block " + (block + 1) + " versiegelt", daten: { block: block } };
      },
      feld: function (daten, i) {
        const z = Math.floor(i / 9), s = i % 9;
        return Math.floor(z / 3) * 3 + Math.floor(s / 3) === daten.block ? "versiegelt" : null;
      },
      gueltig: function (daten) { return Number.isInteger(daten.block) && daten.block >= 0 && daten.block <= 8; },
    },
    {
      id: "finsternis", name: "Finsternis", symbol: "finsternis", farbe: "#3b3561",
      abstand: 9, dauer: 5, wert: 0,
      beschreibung: "Verdeckt für {dauer} Züge alle Zahlen in einer Zeile und einer Spalte.",
      wirkung: function (a) {
        const zeile = Math.floor(a.zufall() * 9), spalte = Math.floor(a.zufall() * 9);
        return { text: "Zeile " + (zeile + 1) + " und Spalte " + (spalte + 1) + " verdeckt", daten: { zeile: zeile, spalte: spalte } };
      },
      feld: function (daten, i) {
        return Math.floor(i / 9) === daten.zeile || i % 9 === daten.spalte ? "verdeckt" : null;
      },
      gueltig: function (daten) {
        return [daten.zeile, daten.spalte].every(function (x) { return Number.isInteger(x) && x >= 0 && x <= 8; });
      },
    },
    {
      id: "fluch", name: "Fluch", symbol: "fluch", farbe: "#2f9e5a",
      abstand: 8, dauer: 5, wert: 0,
      beschreibung: "Verflucht für {dauer} Züge eine Ziffer, die im Sudoku noch fehlt. Setzt du sie, macht sie keinen Schaden.",
      wirkung: function (a) {
        const fehlt = [];
        for (let i = 0; i < 81; i++) {
          if (a.leer(i) && fehlt.indexOf(a.raetsel.loesung[i]) === -1) fehlt.push(a.raetsel.loesung[i]);
        }
        if (fehlt.length === 0) return null;
        const ziffer = a.waehle(fehlt.sort());
        return { text: "Ziffer " + ziffer + " verflucht", daten: { ziffer: ziffer } };
      },
      ziffer: function (daten, z) { return z === daten.ziffer ? "verflucht" : null; },
      gueltig: function (daten) { return Number.isInteger(daten.ziffer) && daten.ziffer >= 1 && daten.ziffer <= 9; },
    },
    {
      id: "hieb", name: "Hieb", symbol: "hieb", farbe: "#d63a3a",
      abstand: 12, dauer: 0, wert: 1,
      beschreibung: "Kostet dich {wert} Leben.",
      wirkung: function (a) {
        a.zustand.leben = Math.max(0, a.zustand.leben - a.wert);
        return { text: "−" + a.wert + " Leben", daten: null };
      },
    },
  ],

  // Boss-Eigenheiten. Neue? Einfach einen weiteren Eintrag:
  //   id, name, farbe, wert – Kennung, Anzeige und Stärke
  //   beschreibung          – {wert} wird durch die Zahl ersetzt
  //   wirkung – eine oder mehrere dieser Stellen:
  //     beiFehler(spiel)  – nach jeder falschen Zahl; spiel = { zustand, boss, wert }.
  //                         Gibt einen kurzen Text zurück, wenn sie ausgelöst hat.
  //     schaden: { <stufe>: function (rechnung, kontext) } – hängt sich in die
  //                         Schadensberechnung ein (Stufen: siehe SCHADEN_STUFEN)
  //     powerupsUnsichtbar – true: die Oberfläche zeigt keine Power-up-Felder
  eigenheiten: [
    {
      id: "regeneration", name: "Regeneration", farbe: "#2fae8e", wert: 15,
      beschreibung: "Heilt bei jedem deiner Fehler {wert} HP.",
      wirkung: {
        beiFehler: function (spiel) {
          const vorher = spiel.zustand.bossHp;
          spiel.zustand.bossHp = Math.min(spiel.boss.maxHp, vorher + spiel.wert);
          const geheilt = spiel.zustand.bossHp - vorher;
          return geheilt > 0 ? "heilt " + geheilt + " HP" : null;
        },
      },
    },
    {
      id: "ruestung", name: "Rüstung", farbe: "#7d8796", wert: 5,
      beschreibung: "Würfe von {wert} oder weniger machen keinen Schaden.",
      wirkung: {
        schaden: {
          // Nach "kritisch": ein Fehlschlag bleibt ein Fehlschlag
          kritisch: function (rechnung, kontext) {
            if (!rechnung.fehlschlag && !rechnung.kritisch && rechnung.wurf <= kontext.eigenheit.wert) {
              rechnung.geblockt = true;
              rechnung.wert = 0;
              rechnung.ende = true;
              rechnung.schritte.push("Rüstung blockt");
              rechnung.ausgeloest = "blockt den Wurf";
            }
          },
        },
      },
    },
    {
      id: "nebel", name: "Nebel", farbe: "#8b7fc7", wert: 0,
      beschreibung: "Die Power-up-Felder sind unsichtbar, wirken aber normal.",
      wirkung: { powerupsUnsichtbar: true },
    },
    {
      id: "dieb", name: "Dieb", farbe: "#c77d1d", wert: 5,
      beschreibung: "Stiehlt bei jedem deiner Fehler {wert} Münzen.",
      wirkung: {
        beiFehler: function (spiel) {
          const gestohlen = Math.min(spiel.wert, spiel.zustand.muenzen);
          spiel.zustand.muenzen -= gestohlen;
          return gestohlen > 0 ? "stiehlt " + gestohlen + (gestohlen === 1 ? " Münze" : " Münzen") : null;
        },
      },
    },
  ],

  // Elite-Bosse: jeder "abstand"-te Boss (5, 10, 15 …)
  elite: {
    abstand: 5,             // 0 = keine Elite-Bosse
    hpFaktor: 2,            // so viel mehr HP als ein normaler Boss an dieser Stelle
    muenzen: 50,            // Extra-Münzen für den Sieg (ohne Münzfaktor)
    verbesserungenWaehlen: 2, // so viele der angebotenen Verbesserungen darf man wählen
  },

  // Seltene Eigenschaften: Jeder Elite-Boss bekommt zusätzlich zu seiner
  // normalen Eigenheit eine davon – zufällig nach "gewicht", nie dieselbe
  // wie beim Elite-Boss davor. Aufbau wie bei den Eigenheiten oben, dazu:
  //   rechnung.abwehren(grund, art) – der Treffer macht gar keinen Schaden
  //       (art: "immun" oder "geblockt"); in der Stufe "wurf" geprüft, also
  //       vor kritischem Treffer, Zuschlägen, Doppelschaden und Gift
  //   kontext.eliteTreffer – der wievielte Treffer gegen diesen Elite-Boss
  //   zaehler(treffer, wert) – optional: kurzer Text für das Kampffenster
  seltenEigenschaften: [
    {
      id: "immunGerade", name: "Immun gegen Gerade", farbe: "#a35cff", gewicht: 1, wert: 0,
      beschreibung: "Ist der Würfelwurf gerade, macht der Treffer keinen Schaden.",
      wirkung: {
        schaden: {
          wurf: function (rechnung) {
            if (rechnung.wurf % 2 === 0) rechnung.abwehren("gerade", "immun");
          },
        },
      },
    },
    {
      id: "immunUngerade", name: "Immun gegen Ungerade", farbe: "#a35cff", gewicht: 1, wert: 0,
      beschreibung: "Ist der Würfelwurf ungerade, macht der Treffer keinen Schaden.",
      wirkung: {
        schaden: {
          wurf: function (rechnung) {
            if (rechnung.wurf % 2 === 1) rechnung.abwehren("ungerade", "immun");
          },
        },
      },
    },
    {
      id: "hochmut", name: "Hochmut", farbe: "#c04cff", gewicht: 1, wert: 0.25,
      beschreibung: "Würfe im obersten Viertel der Augenzahlen machen keinen Schaden (beim W20: 16 bis 20).",
      wirkung: {
        schaden: {
          wurf: function (rechnung, kontext) {
            const seiten = kontext.werte.wuerfelSeiten;
            const anzahl = Math.max(1, Math.round(seiten * kontext.selten.wert));
            if (rechnung.wurf > seiten - anzahl) rechnung.abwehren("oberstes Viertel", "immun");
          },
        },
      },
    },
    {
      id: "schildwall", name: "Schildwall", farbe: "#7f6bff", gewicht: 1, wert: 3,
      beschreibung: "Jeder {wert}. Treffer wird vollständig geblockt.",
      wirkung: {
        schaden: {
          wurf: function (rechnung, kontext) {
            if (kontext.eliteTreffer % kontext.selten.wert === 0) {
              rechnung.abwehren(kontext.eliteTreffer + ". Treffer", "geblockt");
            }
          },
        },
      },
      // Wann kommt der nächste Block? (treffer = bisherige Treffer gegen diesen Boss)
      zaehler: function (treffer, wert) {
        const rest = wert - (treffer % wert);
        return rest === 1 ? "Nächster: Block" : "Block in " + rest;
      },
    },
    {
      id: "kombofluch", name: "Kombofluch", farbe: "#d0459b", gewicht: 1, wert: 0,
      beschreibung: "Die Kombo gibt gegen diesen Boss keinen Schadensbonus.",
      wirkung: {
        schaden: {
          // Nimmt den Kombo-Bonus, den die Grundregel gerade gegeben hat, wieder zurück
          kombo: function (rechnung) {
            if (rechnung.komboBonus > 0) {
              rechnung.wert /= 1 + rechnung.komboBonus;
              rechnung.schritte.pop();
              rechnung.komboBonus = 0;
              rechnung.schritte.push("Kombofluch ×1");
            }
          },
        },
      },
    },
  ],
};


const SudokuRPG = (function () {

  // Die Engine liefert die Liste der Schwierigkeitsgrade. Im Browser ist sie
  // schon geladen, in Node.js (für Tests) wird sie hier nachgeladen.
  const Engine = typeof SudokuEngine !== "undefined" ? SudokuEngine : require("./sudoku-engine.js");

  const K = SUDOKU_RPG_KONFIG;
  const SPEICHER_SCHLUESSEL = "ntb-sudoku-abenteuer";
  // Version 1: noch "fehler" statt Leben. Version 2: Leben, Münzen, Power-ups.
  // Version 3: dazu Kombo, Münz-Rest, Verbesserungen und offene Auswahl.
  // Version 4: dazu Elite-Bosse (seltene Eigenschaft, Treffer-Zähler) und
  //            mehrere Wahlen bei einer Auswahl.
  // Version 5: dazu freie Ersatzwahl (entfernte Verbesserungen) und Regenbogenfeld.
  const VERSION = 6;


  /* ------------------------------------------------------------------------
     KLEINE HELFER
     ------------------------------------------------------------------------ */

  function istGanzzahl(wert, min, max) {
    return Number.isInteger(wert) && wert >= min && wert <= max;
  }

  /** Zahl mit Komma und höchstens zwei Nachkommastellen: 1.3 → "1,3" */
  function zahlText(x) {
    return String(Math.round(x * 100) / 100).replace(".", ",");
  }

  /**
   * Aufrunden – aber ohne Rechenfehler des Computers: 10 × 1,1 ergibt dort
   * 11,000000000000002 und würde sonst zu 12.
   */
  function aufrunden(x) {
    return Math.ceil(Math.round(x * 1e6) / 1e6);
  }

  /** Zieht nach Gewicht einen Eintrag aus einer Liste. */
  function ziehe(liste, gewichtVon, zufall) {
    const gewichte = liste.map(gewichtVon);
    const summe = gewichte.reduce(function (a, b) { return a + b; }, 0);
    let wert = zufall() * summe;
    for (let i = 0; i < liste.length; i++) {
      wert -= gewichte[i];
      if (wert < 0) return liste[i];
    }
    return liste[liste.length - 1];
  }

  /** Mischt eine Liste (Fisher-Yates) – gibt eine neue Liste zurück. */
  function mische(liste, zufall) {
    const neu = liste.slice();
    for (let i = neu.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      const tmp = neu[i]; neu[i] = neu[j]; neu[j] = tmp;
    }
    return neu;
  }

  /** Ersetzt {wert} und {prozent} in einer Beschreibung durch die Zahl des Eintrags. */
  function beschreibungVon(eintrag) {
    return eintrag.beschreibung
      .split("{wert}").join(zahlText(eintrag.wert))
      .split("{prozent}").join(String(Math.round(eintrag.wert * 100)));
  }


  /* ------------------------------------------------------------------------
     BOSSE, EIGENHEITEN, SCHWIERIGKEIT, POWER-UPS, VERBESSERUNGEN
     ------------------------------------------------------------------------ */

  /** Ist der Boss mit dieser Nummer ein Elite-Boss (jeder elite.abstand-te)? */
  function istElite(nummer) {
    return K.elite.abstand > 0 && nummer % K.elite.abstand === 0;
  }

  /** In wie vielen Bossen kommt der nächste Elite-Boss? (0 = dieser ist einer, null = gar keiner) */
  function bisElite(nummer) {
    if (!(K.elite.abstand > 0)) return null;
    return (K.elite.abstand - (nummer % K.elite.abstand)) % K.elite.abstand;
  }

  /** Höchste HP des Bosses mit dieser Nummer (1, 2, 3 …) – bei Elite-Bossen × hpFaktor. */
  function maxHp(nummer) {
    const normal = K.startHp + (nummer - 1) * K.hpZuwachs;
    return istElite(nummer) ? Math.round(normal * K.elite.hpFaktor) : normal;
  }

  /** Seltene Eigenschaft über ihre id (oder null). */
  function seltenInfo(id) {
    return K.seltenEigenschaften.find(function (e) { return e.id === id; }) || null;
  }

  /**
   * Seltene Eigenschaft für die Anzeige: mit fertiger Beschreibung und – falls
   * sie einen hat – dem Zählertext (z. B. "Block in 2 Treffern").
   */
  function seltenFuerAnzeige(id, treffer) {
    const s = seltenInfo(id);
    if (!s) return null;
    return Object.assign({}, s, {
      beschreibung: beschreibungVon(s),
      zaehlerText: s.zaehler ? s.zaehler(treffer || 0, s.wert) : null,
    });
  }

  /** Eigenheit über ihre id (oder null). */
  function eigenheitInfo(id) {
    return K.eigenheiten.find(function (e) { return e.id === id; }) || null;
  }

  /** Angriff über seine id (oder null). */
  function angriffInfo(id) {
    return K.angriffe.find(function (a) { return a.id === id; }) || null;
  }

  /** Der Angriff des Bosses mit dieser Nummer (Bosse kehren mit ihrem Angriff zurück). */
  function angriffVonBoss(nummer) {
    return angriffInfo(K.bosse[(nummer - 1) % K.bosse.length].angriff);
  }

  /** Alle so vielen Züge greift dieser Boss an (Elite-Bosse früher, mindestens 1). */
  function angriffsAbstand(nummer) {
    const a = angriffVonBoss(nummer);
    if (!a) return 0;
    return Math.max(1, a.abstand - (istElite(nummer) ? K.gegenangriff.eliteKuerzer : 0));
  }

  /** Beschreibung eines Angriffs mit eingesetzten Zahlen. */
  function angriffBeschreibung(a) {
    return a.beschreibung.split("{dauer}").join(String(a.dauer)).split("{wert}").join(zahlText(a.wert));
  }

  /** Angriff für die Anzeige (ohne Funktionen). */
  function angriffFuerAnzeige(a, nummer) {
    if (!a) return null;
    return { id: a.id, name: a.name, symbol: a.symbol, farbe: a.farbe, dauer: a.dauer,
      abstand: nummer ? angriffsAbstand(nummer) : a.abstand, beschreibung: angriffBeschreibung(a) };
  }

  /** Gegenangriff-Stand für einen frischen Kampf gegen diesen Boss. */
  function neuerGegenangriff(nummer, paraden) {
    return { zaehler: angriffsAbstand(nummer), paraden: paraden || 0, wirkungen: [] };
  }

  /**
   * Was eine laufende Wirkung mit Feld i macht: "versiegelt", "verdeckt" oder null.
   * @param {object[]} wirkungen – [{ id, rest, daten }] aus dem Spielstand (oder der Anzeige)
   */
  function feldWirkung(wirkungen, i) {
    for (const w of wirkungen || []) {
      const a = angriffInfo(w.id);
      const art = a && a.feld ? a.feld(w.daten, i) : null;
      if (art) return art;
    }
    return null;
  }

  /** Was eine laufende Wirkung mit Ziffer z macht: "verflucht" oder null. */
  function zifferWirkung(wirkungen, z) {
    for (const w of wirkungen || []) {
      const a = angriffInfo(w.id);
      const art = a && a.ziffer ? a.ziffer(w.daten, z) : null;
      if (art) return art;
    }
    return null;
  }

  /**
   * Alles über den Boss mit dieser Nummer.
   * Nach dem 5. Boss beginnt eine neue "Runde": gleiche Figuren und
   * Eigenheiten, andere Farbe (runde = 1, 2 … → die Oberfläche färbt um).
   */
  function bossInfo(nummer) {
    const index = (nummer - 1) % K.bosse.length;
    const eigenheit = eigenheitInfo(K.bosse[index].eigenheit);
    return {
      nummer: nummer,
      name: K.bosse[index].name,
      sprite: K.bosse[index].sprite,
      runde: Math.floor((nummer - 1) / K.bosse.length),
      maxHp: maxHp(nummer),
      elite: istElite(nummer),
      bisElite: bisElite(nummer),
      selten: null,          // seltene Eigenschaft – kommt aus dem Spielstand (siehe bossMitStand)
      // Für die Anzeige: { id, name, farbe, wert, beschreibung (fertiger Text), wirkung }
      eigenheit: eigenheit ? Object.assign({}, eigenheit, { beschreibung: beschreibungVon(eigenheit) }) : null,
      // Gegenangriff: { id, name, symbol, farbe, dauer, abstand, beschreibung }
      angriff: angriffFuerAnzeige(angriffVonBoss(nummer), nummer),
    };
  }

  /** Belohnung eines Schwierigkeitsgrads: { gewicht, muenzFaktor, schadensBonus } */
  function belohnung(gradId) {
    return Object.assign({ gewicht: 1, muenzFaktor: 1, schadensBonus: 0 }, K.schwierigkeit[gradId] || {});
  }

  /** Power-up-Typ über seine id (oder undefined). */
  function powerupTyp(id) {
    return K.powerupTypen.find(function (t) { return t.id === id; });
  }

  /** Verbesserung über ihre id (oder undefined). */
  function verbesserungInfo(id) {
    return K.verbesserungen.find(function (v) { return v.id === id; });
  }

  /**
   * Die Spielwerte, die sich durch Verbesserungen ändern.
   * @param {object} stufen – { id: Stufe } der gewählten Verbesserungen
   */
  function werteVon(stufen) {
    const w = {
      wuerfelSeiten: K.wuerfelSeiten,
      kritischeAugen: 1,          // wie viele der höchsten Augenzahlen kritisch sind
      festerSchaden: 0,
      reihenSchaden: 0,           // Extra-Schaden je fertiger Zeile, Spalte, Block
      komboMax: K.kombo.maxBonus,
      muenzenProZahl: K.muenzen.proZahl,
      powerupAnzahl: K.powerupAnzahl,
      maxLeben: K.maxLeben,
    };
    K.verbesserungen.forEach(function (v) {
      const stufe = (stufen && stufen[v.id]) || 0;
      if (stufe > 0) v.wirkung(w, stufe, v.wert);
    });
    return w;
  }

  /**
   * Verbesserungen für die Anzeige (Karten bzw. Symbole im Kampffenster).
   * @param {string[]} ids    – welche
   * @param {object} stufen   – aktuelle Stufen { id: Stufe }
   */
  function verbesserungenFuerAnzeige(ids, stufen) {
    return ids.map(function (id) {
      const v = verbesserungInfo(id);
      return {
        id: v.id, name: v.name, symbol: v.symbol, farbe: v.farbe,
        stufe: (stufen && stufen[id]) || 0, maxStufe: v.maxStufe,
        beschreibung: beschreibungVon(v),
        // Was bringt die nächste Stufe? (nur wenn die Verbesserung es beschreibt)
        naechste: v.naechsteStufe ? v.naechsteStufe((stufen && stufen[id]) || 0, v.wert) : null,
      };
    });
  }

  /** Alle Verbesserungen mit Stufe > 0 (in der Reihenfolge der Liste). */
  function gesammelteVerbesserungen(stufen) {
    return verbesserungenFuerAnzeige(K.verbesserungen.filter(function (v) {
      return stufen && stufen[v.id] > 0;
    }).map(function (v) { return v.id; }), stufen);
  }

  /**
   * Welche Einheiten (Zeile, Spalte, Block) des Felds sind komplett gefüllt?
   * Im Abenteuer stehen nur richtige Zahlen im Gitter – gefüllt heißt also richtig.
   */
  function fertigeEinheiten(r, index) {
    const zeile = Math.floor(index / 9);
    const spalte = index % 9;
    const startZ = zeile - (zeile % 3);
    const startS = spalte - (spalte % 3);
    const gefuellt = function (i) { return r.vorgaben[i] !== 0 || r.eingaben[i] !== 0; };
    let z = true, s = true, b = true;
    for (let k = 0; k < 9; k++) {
      if (!gefuellt(zeile * 9 + k)) z = false;
      if (!gefuellt(k * 9 + spalte)) s = false;
      if (!gefuellt((startZ + Math.floor(k / 3)) * 9 + startS + (k % 3))) b = false;
    }
    return { zeile: z, spalte: s, block: b };
  }


  /* ------------------------------------------------------------------------
     DIE SCHADENSBERECHNUNG – eine Funktion, feste Reihenfolge:

       1. wurf          Würfelwurf
       2. kritisch      höchste Augenzahl → × kritischFaktor; eine 1 → Fehlschlag (0)
       3. zuschlag      feste Zuschläge (Scharfe Klinge)
       4. kombo         × (1 + Kombo-Bonus)
       5. schwierigkeit × (1 + Schadensbonus des Grads)
       6. doppelt       × doppelschadenFaktor, wenn eine Einheit fertig wurde
       7. reihen        + Extra-Schaden je fertiger Einheit (Reihenbrecher) –
                        kommt NACH der Verdopplung und wird nicht mitverdoppelt
       8. gift          Giftanteil des bis hierher berechneten Schadens
       Am Ende wird aufgerundet (Schaden und Gift getrennt).

     Verbesserungen wirken über die Spielwerte (werteVon). Boss-Eigenheiten
     und Erweiterungen hängen sich als MODIFIKATOR in eine Stufe ein:
       { kritisch: function (rechnung, kontext) { … } }
     Ein Modifikator läuft direkt NACH der Grundregel seiner Stufe. Setzt er
     rechnung.ende = true, bleibt es beim aktuellen Wert (z. B. 0).
     ------------------------------------------------------------------------ */

  const SCHADEN_STUFEN = ["wurf", "kritisch", "zuschlag", "kombo", "schwierigkeit", "doppelt", "reihen", "gift"];

  const GRUNDREGELN = {
    wurf: function (r) {
      r.wert = r.wurf;
      r.schritte.push("Wurf " + r.wurf);
    },
    kritisch: function (r) {
      if (r.wurf === 1) {
        r.fehlschlag = true;
        r.wert = 0;
        r.ende = true;
        r.schritte.push("Fehlschlag");
      } else if (r.wurf >= r.kritischAb) {
        r.kritisch = true;
        r.wert = r.wurf * K.kritischFaktor;
        r.schritte.push("Kritisch ×" + zahlText(K.kritischFaktor));
      }
    },
    zuschlag: function (r, k) {
      if (k.werte.festerSchaden > 0) {
        r.wert += k.werte.festerSchaden;
        r.schritte.push("Zuschlag +" + k.werte.festerSchaden);
      }
    },
    kombo: function (r, k) {
      r.komboBonus = Math.min((k.kombo || 0) * K.kombo.proStufe, k.werte.komboMax);
      if (r.komboBonus > 0) {
        r.wert *= 1 + r.komboBonus;
        r.schritte.push("Kombo ×" + zahlText(1 + r.komboBonus));
      }
    },
    schwierigkeit: function (r, k) {
      const bonus = k.grad ? belohnung(k.grad).schadensBonus : 0;
      if (bonus > 0) {
        r.wert *= 1 + bonus;
        r.schritte.push(Engine.gradMitId(k.grad).name + " ×" + zahlText(1 + bonus));
      }
    },
    doppelt: function (r, k) {
      if (k.doppelt) {
        r.wert *= K.doppelschadenFaktor;
        r.schritte.push("Doppelt ×" + zahlText(K.doppelschadenFaktor));
      }
    },
    reihen: function (r, k) {
      // Jede fertige Einheit zählt einzeln (Zeile + Block = 2 × Extra-Schaden)
      const bonus = k.werte.reihenSchaden * (k.einheiten || 0);
      if (bonus > 0) {
        r.wert += bonus;
        r.schritte.push("Reihenbrecher +" + bonus);
      }
    },
    gift: function (r, k) {
      if (k.giftAnteil > 0) r.giftWert = r.wert * k.giftAnteil;
    },
  };

  /**
   * Berechnet den Schaden eines Treffers. Ohne Zufall und ohne Spielstand –
   * deshalb auch einzeln testbar.
   * @param {object} kontext
   *   wurf          – gewürfelte Augenzahl
   *   werte         – Spielwerte (werteVon), Standard: ohne Verbesserungen
   *   kombo         – Kombo-Stufe INKLUSIVE dieser Zahl
   *   grad          – id des Schwierigkeitsgrads (oder null)
   *   doppelt       – true, wenn eine Zeile/Spalte/Block fertig wurde
   *   einheiten     – WIE VIELE Einheiten fertig wurden (0–3, für den Reihenbrecher)
   *   giftAnteil    – 0.5 = die Hälfte als Gift (0 = kein Gift)
   *   modifikatoren – Liste { <stufe>: function (rechnung, kontext) }
   *   eigenheit     – die Eigenheit des Bosses (für ihre Modifikatoren)
   *   selten        – die seltene Eigenschaft eines Elite-Bosses (oder null)
   *   eliteTreffer  – der wievielte Treffer gegen diesen Elite-Boss
   * @returns {object} rechnung: { wurf, schaden, gift, kritisch, fehlschlag,
   *   geblockt, immun, abwehrGrund, abwehrArt, komboBonus, schritte, text, ausgeloest }
   */
  function berechneSchaden(kontext) {
    kontext = Object.assign({ werte: werteVon({}), kombo: 0, grad: null, doppelt: false, einheiten: 0,
      giftAnteil: 0, modifikatoren: [], selten: null, eliteTreffer: 0 }, kontext);
    const w = kontext.werte;
    const r = {
      wurf: kontext.wurf,
      kritischAb: w.wuerfelSeiten - w.kritischeAugen + 1,   // ab dieser Augenzahl kritisch
      wert: 0, giftWert: 0, komboBonus: 0,
      kritisch: false, fehlschlag: false, geblockt: false, ende: false,
      ausgeloest: null,          // Text, wenn eine Eigenheit eingegriffen hat
      immun: false,              // seltene Eigenschaft hat den Treffer abgewehrt
      abwehrGrund: null,         // z. B. "gerade"
      abwehrArt: null,           // "immun" oder "geblockt"
      schritte: [],
    };
    // Für seltene Eigenschaften: Treffer ganz abwehren – kein Schaden, kein
    // kritischer Treffer, keine Zuschläge, kein Doppelschaden, kein Gift
    r.abwehren = function (grund, art) {
      r.immun = true;
      r.abwehrGrund = grund;
      r.abwehrArt = art || "immun";
      r.wert = 0;
      r.ende = true;
      r.schritte.push(grund, r.abwehrArt);
    };
    SCHADEN_STUFEN.forEach(function (stufe) {
      if (r.ende) return;
      GRUNDREGELN[stufe](r, kontext);
      kontext.modifikatoren.forEach(function (m) {
        if (!r.ende && typeof m[stufe] === "function") m[stufe](r, kontext);
      });
    });
    r.schaden = aufrunden(r.wert);
    r.gift = aufrunden(r.giftWert);
    r.text = r.schritte.join(" · ") + " = " + r.schaden;
    return r;
  }


  /* ------------------------------------------------------------------------
     SPIELSTAND
     {
       version, bossNummer, bossHp, leben, muenzen, rekord,
       muenzRest,          ← Nachkommastellen der Münzen (0 bis unter 1)
       kombo,              ← richtige Zahlen in Folge
       verbesserungen,     ← { id: Stufe }
       auswahl,            ← null oder ids der angebotenen Verbesserungen
                             (dann muss erst gewählt werden)
       auswahlAnzahl,      ← wie viele davon noch gewählt werden dürfen (0 = keine Auswahl)
       auswahlGrund,       ← "boss" (nach einem Sieg) oder "frei" (Ersatz für eine
                             entfernte Verbesserung, alle stehen zur Wahl)
       freieWahl,          ← so viele freie Ersatzwahlen stehen noch aus
       elite,              ← null oder { nummer, selten, treffer } für den
                             aktuellen Elite-Boss: seine seltene Eigenschaft
                             und wie oft er schon getroffen wurde
       vorigeSelten,       ← seltene Eigenschaft des letzten Elite-Bosses
                             (der nächste bekommt eine andere)
       gegenangriff: {     ← Angriff des aktuellen Bosses (neu in Version 6)
         zaehler,          ← so viele Züge noch bis zum Angriff
         paraden,          ← vorrätige Paraden (0 bis paradenMax)
         wirkungen: [ { id, rest, daten } ]  ← laufende Wirkungen (rest = Züge)
       },
       raetsel: null | { grad, vorgaben, loesung, eingaben, geloest,
                         powerups: [ { index, typ } ],
                         regenbogen: null | Index des Regenbogenfelds },
       extras: {}          ← frei für spätere Erweiterungen
     }
     raetsel = null bedeutet: Es muss ein neues Sudoku ausgelost werden.
     ------------------------------------------------------------------------ */

  function neuerZustand() {
    return {
      version: VERSION,
      bossNummer: 1,
      bossHp: maxHp(1),
      leben: K.startLeben,
      muenzen: 0,
      muenzRest: 0,
      rekord: 0,            // höchster besiegter Boss
      kombo: 0,
      verbesserungen: {},
      auswahl: null,
      auswahlAnzahl: 0,
      auswahlGrund: "boss",
      freieWahl: 0,
      elite: null,          // Boss 1 ist nie ein Elite-Boss (abstand ≥ 2)
      vorigeSelten: null,
      gegenangriff: neuerGegenangriff(1, 0),
      raetsel: null,
      extras: {},
    };
  }

  /** Lost eine seltene Eigenschaft aus – nach Gewicht, nie dieselbe wie "ausser". */
  function loseSelten(ausser, zufall) {
    let liste = K.seltenEigenschaften.filter(function (e) { return e.id !== ausser; });
    if (liste.length === 0) liste = K.seltenEigenschaften;
    return ziehe(liste, function (e) { return e.gewicht === undefined ? 1 : e.gewicht; }, zufall).id;
  }

  /**
   * Wählt Power-up-Felder: zufällige LEERE Felder, Typ je Feld nach Gewicht.
   * @returns {{index, typ}[]}
   */
  function lostPowerups(r, zufall, anzahl) {
    const leer = [];
    for (let i = 0; i < 81; i++) {
      if (r.vorgaben[i] === 0 && r.eingaben[i] === 0) leer.push(i);
    }
    return mische(leer, zufall).slice(0, anzahl).sort(function (a, b) { return a - b; }).map(function (index) {
      return { index: index, typ: ziehe(K.powerupTypen, function (t) { return t.gewicht; }, zufall).id };
    });
  }

  /**
   * Regenbogenfeld: mit Wahrscheinlichkeit regenbogenfeld.chance (oder immer,
   * wenn der Testschalter an ist) ein zufälliges leeres Feld – möglichst
   * keins, auf dem schon ein Power-up liegt.
   * @returns {number|null} – Index des Felds oder null
   */
  function loseRegenbogen(r, zufall) {
    const rb = K.regenbogenfeld;
    if (!rb.testErzwingen && !(zufall() < rb.chance)) return null;
    const belegt = (r.powerups || []).map(function (p) { return p.index; });
    let leer = [];
    for (let i = 0; i < 81; i++) {
      if (r.vorgaben[i] === 0 && r.eingaben[i] === 0 && belegt.indexOf(i) === -1) leer.push(i);
    }
    if (leer.length === 0) {
      for (let i = 0; i < 81; i++) if (r.vorgaben[i] === 0 && r.eingaben[i] === 0) leer.push(i);
    }
    return leer.length > 0 ? leer[Math.floor(zufall() * leer.length)] : null;
  }

  /**
   * Prüft einen Spielstand (beim Laden und beim Import) und ergänzt ältere
   * Stände: Version 1 ("fehler" statt Leben, keine Münzen/Power-ups),
   * Version 2 (ohne Kombo und Verbesserungen) und Version 3 (ohne Elite-Bosse).
   * @param {function} [zufall] – zum Auslosen fehlender Power-up-Felder (Standard: Math.random)
   * @returns {{ok: true, daten, ergaenzt: boolean} | {ok: false, fehler}}
   */
  function pruefeDaten(roh, zufall) {
    if (!roh || typeof roh !== "object" || !istGanzzahl(roh.version, 1, VERSION)) {
      return { ok: false, fehler: "Kein gültiger Abenteuer-Spielstand." };
    }
    const v1 = roh.version === 1;
    const vorV3 = roh.version < 3;
    const vorV4 = roh.version < 4;
    const vorV5 = roh.version < 5;
    const vorV6 = roh.version < 6;
    const entfernt = function (id) { return K.entfernteVerbesserungen.indexOf(id) !== -1; };
    // Freie Ersatzwahlen (neu in Version 5)
    let freieWahl = !vorV5 && istGanzzahl(roh.freieWahl, 0, 100) ? roh.freieWahl : 0;

    // Leben: in Version 1 aus den Fehlern berechnen (3 − Fehler)
    let leben = roh.leben;
    if (v1) {
      if (!istGanzzahl(roh.fehler, 0, 2)) return { ok: false, fehler: "Abenteuer: ungültige Fehlerzahl." };
      leben = Math.max(1, K.startLeben - roh.fehler);
    }
    const muenzen = v1 && roh.muenzen === undefined ? 0 : roh.muenzen;

    // Neu in Version 3
    const kombo = vorV3 ? 0 : roh.kombo;
    const muenzRest = vorV3 ? 0 : roh.muenzRest;
    const stufen = {};
    if (!vorV3) {
      if (!roh.verbesserungen || typeof roh.verbesserungen !== "object") {
        return { ok: false, fehler: "Abenteuer: ungültige Verbesserungen." };
      }
      for (const id in roh.verbesserungen) {
        const v = verbesserungInfo(id);
        if (!v) {
          // Nicht mehr in der Liste → weglassen. War es eine entfernte
          // Verbesserung (z. B. "Starkes Gift"), gibt es einmalig eine freie Wahl.
          if (entfernt(id) && roh.verbesserungen[id] > 0) freieWahl = Math.max(freieWahl, 1);
          continue;
        }
        if (!istGanzzahl(roh.verbesserungen[id], 0, v.maxStufe)) {
          return { ok: false, fehler: "Abenteuer: ungültige Stufe bei „" + v.name + "“." };
        }
        if (roh.verbesserungen[id] > 0) stufen[id] = roh.verbesserungen[id];
      }
    }
    let auswahl = null;
    const auswahlGrund = !vorV5 && roh.auswahlGrund === "frei" ? "frei" : "boss";
    if (!vorV3 && roh.auswahl !== null && roh.auswahl !== undefined) {
      // Entfernte Verbesserungen fallen aus einem gespeicherten Angebot heraus
      const angebot = Array.isArray(roh.auswahl) ? roh.auswahl.filter(function (id) { return !entfernt(id); }) : roh.auswahl;
      const hoechstens = auswahlGrund === "frei" ? K.verbesserungen.length : K.verbesserungAngebot;
      const gueltig = Array.isArray(angebot) && angebot.length <= hoechstens &&
        angebot.every(function (id, i) {
          const v = verbesserungInfo(id);
          return v && (stufen[id] || 0) < v.maxStufe && angebot.indexOf(id) === i;
        });
      if (!gueltig) return { ok: false, fehler: "Abenteuer: ungültige Auswahl an Verbesserungen." };
      if (angebot.length > 0) {
        auswahl = angebot.slice();
      } else if (roh.auswahl.length > 0) {
        freieWahl = Math.max(freieWahl, 1);   // das ganze Angebot ist weggefallen → freie Wahl
      }
    }
    // Neu in Version 4: wie viele Verbesserungen noch gewählt werden dürfen
    let auswahlAnzahl = auswahl ? 1 : 0;
    if (auswahl && !vorV4) {
      if (!istGanzzahl(roh.auswahlAnzahl, 1, Math.max(1, K.elite.verbesserungenWaehlen))) {
        return { ok: false, fehler: "Abenteuer: ungültige Anzahl an Wahlen." };
      }
      auswahlAnzahl = roh.auswahlAnzahl;
    }
    const werte = werteVon(stufen);

    if (!istGanzzahl(roh.bossNummer, 1, 1e6) ||
        !istGanzzahl(roh.bossHp, 1, maxHp(roh.bossNummer)) ||
        !istGanzzahl(leben, 1, werte.maxLeben) ||
        !istGanzzahl(muenzen, 0, 1e9) ||
        !istGanzzahl(roh.rekord, 0, 1e6) ||
        !istGanzzahl(kombo, 0, 1e6) ||
        typeof muenzRest !== "number" || !(muenzRest >= 0 && muenzRest < 1)) {
      return { ok: false, fehler: "Abenteuer: ungültige Werte für Boss, HP, Leben, Münzen, Kombo oder Rekord." };
    }

    // Elite-Boss: seltene Eigenschaft aus dem Spielstand – fehlt sie (älterer
    // Stand) oder passt sie nicht zum Boss, wird sie jetzt ausgelost
    const vorigeSelten = !vorV4 && seltenInfo(roh.vorigeSelten) ? roh.vorigeSelten : null;
    let elite = null;
    let bossHp = roh.bossHp;
    if (istElite(roh.bossNummer)) {
      const e = vorV4 ? null : roh.elite;
      if (e && e.nummer === roh.bossNummer && seltenInfo(e.selten) && istGanzzahl(e.treffer, 0, 1e6)) {
        elite = { nummer: e.nummer, selten: e.selten, treffer: e.treffer };
      } else {
        elite = { nummer: roh.bossNummer, selten: loseSelten(vorigeSelten, zufall || Math.random), treffer: 0 };
      }
      // Älterer Stand, Kampf noch nicht begonnen: gleich mit den vollen Elite-HP
      const normal = K.startHp + (roh.bossNummer - 1) * K.hpZuwachs;
      if (vorV4 && bossHp === normal) bossHp = maxHp(roh.bossNummer);
    }

    let raetsel = null;
    let ohnePowerups = false;
    if (roh.raetsel) {
      const r = roh.raetsel;
      const istGitter = function (liste) {
        return Array.isArray(liste) && liste.length === 81 &&
          liste.every(function (z) { return istGanzzahl(z, 0, 9); });
      };
      if (!Engine.gradMitId(r.grad) || !istGitter(r.vorgaben) || !istGitter(r.loesung) || !istGitter(r.eingaben)) {
        return { ok: false, fehler: "Abenteuer: das gespeicherte Sudoku ist beschädigt." };
      }
      let powerups = [];
      if (Array.isArray(r.powerups)) {
        const gueltig = r.powerups.every(function (p) {
          return p && istGanzzahl(p.index, 0, 80) && powerupTyp(p.typ) && r.vorgaben[p.index] === 0;
        });
        if (!gueltig) return { ok: false, fehler: "Abenteuer: ungültige Power-up-Felder." };
        powerups = r.powerups.map(function (p) { return { index: p.index, typ: p.typ }; });
      } else {
        ohnePowerups = true;        // älterer Stand → Power-ups werden gleich ergänzt
      }
      // Regenbogenfeld (neu in Version 5): nur auf einem noch leeren Feld
      const regenbogen = istGanzzahl(r.regenbogen, 0, 80) && r.vorgaben[r.regenbogen] === 0 &&
        r.eingaben[r.regenbogen] === 0 ? r.regenbogen : null;
      raetsel = { grad: r.grad, vorgaben: r.vorgaben.slice(), loesung: r.loesung.slice(),
        eingaben: r.eingaben.slice(), geloest: r.geloest === true, powerups: powerups, regenbogen: regenbogen };
      // Gilt auch beim Import einer alten Sicherung (settings.js)
      if (ohnePowerups && !raetsel.geloest) {
        raetsel.powerups = lostPowerups(raetsel, zufall || Math.random, werte.powerupAnzahl);
      }
    }

    // Gegenangriff (neu in Version 6). Fehlt er oder passt er nicht, beginnt
    // der Zähler von vorn. Wirkungen gibt es nur in einem laufenden Sudoku.
    const gegenangriff = neuerGegenangriff(roh.bossNummer, 0);
    const ga = vorV6 ? null : roh.gegenangriff;
    if (ga && typeof ga === "object") {
      const abstand = angriffsAbstand(roh.bossNummer);
      if (istGanzzahl(ga.zaehler, 1, Math.max(1, abstand))) gegenangriff.zaehler = ga.zaehler;
      if (istGanzzahl(ga.paraden, 0, K.gegenangriff.paradenMax)) gegenangriff.paraden = ga.paraden;
      if (Array.isArray(ga.wirkungen) && raetsel && !raetsel.geloest) {
        gegenangriff.wirkungen = ga.wirkungen.filter(function (w) {
          const a = w && angriffInfo(w.id);
          return a && a.dauer > 0 && istGanzzahl(w.rest, 1, a.dauer) && w.daten && typeof w.daten === "object" &&
            (!a.gueltig || a.gueltig(w.daten));
        }).map(function (w) { return { id: w.id, rest: w.rest, daten: Object.assign({}, w.daten) }; });
      }
    }
    return {
      ok: true,
      ergaenzt: vorV6,
      daten: {
        version: VERSION,
        bossNummer: roh.bossNummer,
        bossHp: bossHp,
        leben: leben,
        muenzen: muenzen,
        muenzRest: muenzRest,
        rekord: roh.rekord,
        kombo: kombo,
        verbesserungen: stufen,
        auswahl: auswahl,
        auswahlAnzahl: auswahlAnzahl,
        auswahlGrund: auswahl ? auswahlGrund : "boss",
        freieWahl: freieWahl,
        elite: elite,
        vorigeSelten: vorigeSelten,
        gegenangriff: gegenangriff,
        raetsel: raetsel,
        extras: roh.extras && typeof roh.extras === "object" ? roh.extras : {},
      },
    };
  }

  /** Speicher im Browser (localStorage). Für Tests lässt sich ein anderer übergeben. */
  const BROWSER_SPEICHER = {
    laden: function () {
      try {
        return JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL));
      } catch (fehler) {
        return null;
      }
    },
    speichern: function (daten) {
      try {
        localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
      } catch (fehler) {
        // Speichern nicht möglich (z. B. privater Modus)
      }
    },
  };


  /* ------------------------------------------------------------------------
     EIN ABENTEUER
     ------------------------------------------------------------------------ */

  /**
   * Erzeugt ein Abenteuer – mit dem gespeicherten Stand oder von vorn.
   * @param {object} [optionen]
   *   speicher – { laden(), speichern(daten) }   (Standard: localStorage)
   *   zufall   – Funktion, die eine Zahl in [0, 1) liefert (Standard: Math.random)
   */
  function erstelle(optionen) {
    optionen = optionen || {};
    const speicher = optionen.speicher || BROWSER_SPEICHER;
    // (Math.random bei jedem Aufruf neu holen – so lässt es sich in Tests ersetzen)
    const zufall = optionen.zufall || function () { return Math.random(); };

    // Ein älterer Stand wird dabei ergänzt (Leben, Münzen, Power-ups, Kombo …)
    const geladen = pruefeDaten(speicher.laden(), zufall);
    let zustand = geladen.ok ? geladen.daten : neuerZustand();
    if (!zustand.elite && istElite(zustand.bossNummer)) eliteAuslosen();   // nur bei elite.abstand = 1
    freieWahlStarten();      // z. B. Ersatz für "Starkes Gift" (falls gerade keine andere Wahl offen ist)
    if (geladen.ok) {
      speicher.speichern(zustand);          // ergänzte Werte gleich festhalten
    }

    const hoerer = {};          // Ereignisname → Liste von Funktionen
    const erweiterungen = [];   // eingehängte Zusatzregeln (Modifikatoren)

    function speichern() {
      speicher.speichern(zustand);
    }

    /** Meldet ein Ereignis an alle Zuhörer. */
    function melde(name, daten) {
      (hoerer[name] || []).forEach(function (fn) { fn(daten); });
    }

    function werte() {
      return werteVon(zustand.verbesserungen);
    }

    /**
     * Wie bossInfo, aber mit dem, was nur im Spielstand steht: die seltene
     * Eigenschaft eines Elite-Bosses (mit Zählertext).
     */
    function bossMitStand(nummer) {
      const boss = bossInfo(nummer);
      if (zustand.elite && zustand.elite.nummer === nummer) {
        boss.selten = seltenFuerAnzeige(zustand.elite.selten, zustand.elite.treffer);
      }
      return boss;
    }

    /** Ist der aktuelle Boss ein Elite-Boss, bekommt er seine seltene Eigenschaft. */
    function eliteAuslosen() {
      zustand.elite = istElite(zustand.bossNummer)
        ? { nummer: zustand.bossNummer, selten: loseSelten(zustand.vorigeSelten, zufall), treffer: 0 }
        : null;
    }

    /** Alle Modifikatoren für die Schadensberechnung: Eigenheit, seltene Eigenschaft, Erweiterungen. */
    function modifikatoren(boss) {
      const liste = [];
      if (boss.eigenheit && boss.eigenheit.wirkung.schaden) liste.push(boss.eigenheit.wirkung.schaden);
      if (boss.selten && boss.selten.wirkung.schaden) liste.push(boss.selten.wirkung.schaden);
      erweiterungen.forEach(function (erw) { if (erw.schaden) liste.push(erw.schaden); });
      return liste;
    }

    /** Lost einen Schwierigkeitsgrad nach Gewicht aus (Objekt aus der Engine-Liste). */
    function loseGrad() {
      return ziehe(Engine.SCHWIERIGKEITSGRADE, function (g) { return belohnung(g.id).gewicht; }, zufall);
    }

    /** Lost bis zu verbesserungAngebot verschiedene Verbesserungen aus, die noch nicht voll sind. */
    function loseAngebot() {
      const moeglich = K.verbesserungen.filter(function (v) {
        return (zustand.verbesserungen[v.id] || 0) < v.maxStufe;
      }).map(function (v) { return v.id; });
      const angebot = mische(moeglich, zufall).slice(0, K.verbesserungAngebot);
      return angebot.length > 0 ? angebot : null;
    }

    /** Ein neues Sudoku übernehmen (nachdem die Oberfläche es erzeugt hat) – mit Power-up-Feldern. */
    function starteRaetsel(gradId, vorgaben, loesung) {
      zustand.raetsel = {
        grad: gradId,
        vorgaben: vorgaben.slice(),
        loesung: loesung.slice(),
        eingaben: new Array(81).fill(0),
        geloest: false,
        powerups: [],
        regenbogen: null,
      };
      zustand.raetsel.powerups = lostPowerups(zustand.raetsel, zufall, werte().powerupAnzahl);
      zustand.raetsel.regenbogen = loseRegenbogen(zustand.raetsel, zufall);
      // Wirkungen enden mit dem Sudoku, der Angriffszähler läuft weiter
      zustand.gegenangriff.wirkungen = [];
      speichern();
    }

    /**
     * Freie Ersatzwahl: Steht eine aus und ist gerade keine andere Auswahl
     * offen, stehen ALLE Verbesserungen zur Wahl, die noch nicht voll sind.
     * @returns {boolean} – true, wenn jetzt eine freie Wahl offen ist
     */
    function freieWahlStarten() {
      if (!(zustand.freieWahl > 0) || zustand.auswahl) return false;
      zustand.freieWahl--;
      const moeglich = K.verbesserungen.filter(function (v) {
        return (zustand.verbesserungen[v.id] || 0) < v.maxStufe;
      }).map(function (v) { return v.id; });
      if (moeglich.length === 0) return false;
      zustand.auswahl = moeglich;
      zustand.auswahlAnzahl = 1;
      zustand.auswahlGrund = "frei";
      return true;
    }

    /** Daten für das Ereignis "neuerBoss" (auch nach dem Wählen einer Verbesserung). */
    function neuerBossDaten() {
      const boss = bossMitStand(zustand.bossNummer);
      return { boss: boss, hp: zustand.bossHp, leben: zustand.leben, maxLeben: werte().maxLeben, rekord: zustand.rekord,
        gegenangriff: gegenangriffAnzeige() };
    }

    /* ---------- Gegenangriff ---------- */

    /** Der Gegenangriff-Stand für die Anzeige (eine Kopie – Ereignisse bleiben unverändert). */
    function gegenangriffAnzeige() {
      const ga = zustand.gegenangriff;
      return {
        angriff: angriffFuerAnzeige(angriffVonBoss(zustand.bossNummer), zustand.bossNummer),
        zaehler: ga.zaehler,
        warnung: ga.zaehler <= K.gegenangriff.warnungAb,
        paraden: ga.paraden,
        paradenMax: K.gegenangriff.paradenMax,
        wirkungen: ga.wirkungen.map(function (w) {
          const a = angriffInfo(w.id);
          return { id: w.id, name: a.name, symbol: a.symbol, farbe: a.farbe, rest: w.rest, daten: Object.assign({}, w.daten) };
        }),
      };
    }

    /** Ist Feld i gerade versiegelt (dort kann man nichts setzen)? */
    function istVersiegelt(i) {
      return feldWirkung(zustand.gegenangriff.wirkungen, i) === "versiegelt";
    }

    /**
     * Ein Zug ist vorbei (richtige oder falsche Zahl): Wirkungen laufen ab,
     * der Zähler sinkt. Bei 0 greift der Boss an.
     * @returns {object|null} – Daten für das Ereignis "angriff" (oder null)
     */
    function zugVorbei(boss) {
      const ga = zustand.gegenangriff;
      const r = zustand.raetsel;
      ga.wirkungen.forEach(function (w) { w.rest--; });
      ga.wirkungen = ga.wirkungen.filter(function (w) { return w.rest > 0; });
      // Sind alle leeren Felder versiegelt, bricht das Siegel – sonst ginge es nicht weiter
      if (r && !r.geloest) {
        let frei = false, leer = false;
        for (let i = 0; i < 81; i++) {
          if (r.vorgaben[i] === 0 && r.eingaben[i] === 0) { leer = true; if (!istVersiegelt(i)) frei = true; }
        }
        if (leer && !frei) {
          ga.wirkungen = ga.wirkungen.filter(function (w) { const a = angriffInfo(w.id); return !a.feld; });
        }
      }
      const angriff = angriffVonBoss(zustand.bossNummer);
      if (!angriff) return null;
      ga.zaehler--;
      if (ga.zaehler > 0) return null;
      return angreifen(angriff, boss);
    }

    /** Der Boss greift an: Parade wehrt ab, sonst wirkt der Angriff (oder verpufft). */
    function angreifen(angriff, boss) {
      const ga = zustand.gegenangriff;
      const r = zustand.raetsel;
      ga.zaehler = angriffsAbstand(zustand.bossNummer);
      const vorher = { leben: zustand.leben, kombo: zustand.kombo };
      const ereignis = {
        boss: boss, angriff: angriffFuerAnzeige(angriff, zustand.bossNummer),
        pariert: false, verpufft: false, text: "", wirkung: null, niederlage: false,
        lebenVorher: vorher.leben, komboVorher: vorher.kombo,
      };
      if (ga.paraden > 0) {
        ga.paraden--;
        ereignis.pariert = true;
        ereignis.text = "Pariert!";
      } else if (angriff.dauer > 0 && (!r || r.geloest)) {
        ereignis.verpufft = true;                 // ohne laufendes Sudoku gibt es nichts zu treffen
      } else {
        const a = {
          zustand: zustand, raetsel: r, wert: angriff.wert, dauer: angriff.dauer, zufall: zufall,
          waehle: function (liste) { return liste[Math.floor(zufall() * liste.length)]; },
          leer: function (i) { return r.vorgaben[i] === 0 && r.eingaben[i] === 0; },
          blockFelder: function (b) {
            const felder = [];
            for (let k = 0; k < 9; k++) felder.push((Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3));
            return felder;
          },
        };
        const ergebnis = angriff.wirkung(a);
        if (!ergebnis) {
          ereignis.verpufft = true;
        } else {
          ereignis.text = ergebnis.text;
          if (angriff.dauer > 0 && ergebnis.daten) {
            // Gleicher Angriff noch aktiv? Dann wird er ersetzt.
            ga.wirkungen = ga.wirkungen.filter(function (w) { return w.id !== angriff.id; });
            ga.wirkungen.push({ id: angriff.id, rest: angriff.dauer, daten: ergebnis.daten });
            ereignis.wirkung = { id: angriff.id, rest: angriff.dauer, daten: Object.assign({}, ergebnis.daten) };
          }
        }
      }
      if (ereignis.verpufft) ereignis.text = angriff.name + " verpufft";
      ereignis.leben = zustand.leben;
      ereignis.kombo = zustand.kombo;
      ereignis.komboBonus = Math.min(zustand.kombo * K.kombo.proStufe, werte().komboMax);
      ereignis.maxLeben = werte().maxLeben;
      return ereignis;
    }

    /**
     * Niederlage: gleicher Boss mit vollen HP, Leben wieder auf Start, neues
     * Sudoku nötig. Münzen, Verbesserungen und Paraden bleiben, der Zähler
     * des Gegenangriffs beginnt von vorn.
     * @returns {object} – Daten für das Ereignis "niederlage"
     */
    function niederlageAnwenden(boss) {
      const niederlage = {
        boss: boss, schadenGemacht: boss.maxHp - zustand.bossHp, rekord: zustand.rekord,
        muenzen: zustand.muenzen,
      };
      zustand.bossHp = boss.maxHp;
      zustand.leben = K.startLeben;
      zustand.raetsel = null;
      if (zustand.elite) zustand.elite.treffer = 0;   // seltene Eigenschaft bleibt, der Zähler beginnt neu
      zustand.gegenangriff = neuerGegenangriff(zustand.bossNummer, zustand.gegenangriff.paraden);
      return niederlage;
    }

    /** Falsche Zahl → Leben weg, Kombo weg, Eigenheit des Bosses (Zahl und Power-up bleiben). */
    function falscheZahl(index, ziffer) {
      const boss = bossMitStand(zustand.bossNummer);
      const komboVorher = zustand.kombo;
      const hpVorher = zustand.bossHp;
      const muenzenVorher = zustand.muenzen;
      zustand.leben--;
      zustand.kombo = 0;

      // Eigenheit (z. B. Regeneration, Dieb)
      let eigenheit = null;
      if (boss.eigenheit && boss.eigenheit.wirkung.beiFehler) {
        const text = boss.eigenheit.wirkung.beiFehler({ zustand: zustand, boss: boss, wert: boss.eigenheit.wert });
        if (text) eigenheit = { id: boss.eigenheit.id, name: boss.eigenheit.name, farbe: boss.eigenheit.farbe, text: text };
      }

      const ereignis = {
        index: index, ziffer: ziffer, boss: boss,
        leben: Math.max(0, zustand.leben), startLeben: K.startLeben, maxLeben: werte().maxLeben,
        komboVorher: komboVorher,
        eigenheit: eigenheit,
        hpVorher: hpVorher, hp: zustand.bossHp,
        muenzenVorher: muenzenVorher, muenzen: zustand.muenzen,
      };

      if (zustand.leben <= 0) {
        // Niederlage – der Boss greift dann nicht mehr an
        ereignis.gegenangriff = gegenangriffAnzeige();
        const niederlage = niederlageAnwenden(boss);
        speichern();
        melde("fehler", ereignis);
        melde("niederlage", niederlage);
        return { art: "fehler", niederlage: true, eigenheit: eigenheit, angriff: null };
      }
      // Gegenangriff: Der Zug zählt. Ein Hieb kann das letzte Leben kosten.
      const angriff = zugVorbei(boss);
      ereignis.gegenangriff = angriffAnzeigeVorAngriff(angriff);
      let niederlage = null;
      if (angriff) {
        angriff.stand = gegenangriffAnzeige();
        if (zustand.leben <= 0) {
          angriff.niederlage = true;
          niederlage = niederlageAnwenden(boss);
          angriff.stand = gegenangriffAnzeige();
        }
      }
      speichern();
      melde("fehler", ereignis);
      if (angriff) melde("angriff", angriff);
      if (niederlage) melde("niederlage", niederlage);
      return { art: "fehler", niederlage: Boolean(niederlage), eigenheit: eigenheit, angriff: angriff };
    }

    /**
     * Stand für die Anzeige direkt nach dem Zug, aber VOR einem Angriff
     * (Zähler auf 0, damit "jetzt" angezeigt wird, bis der Angriff abgespielt ist).
     */
    function angriffAnzeigeVorAngriff(angriff) {
      const stand = gegenangriffAnzeige();
      if (angriff) {
        stand.zaehler = 0;
        stand.warnung = true;
        stand.paraden = angriff.pariert ? stand.paraden + 1 : stand.paraden;
        // Die neue Wirkung erscheint erst mit dem Angriff
        if (angriff.wirkung) stand.wirkungen = stand.wirkungen.filter(function (w) { return w.id !== angriff.wirkung.id; });
      }
      return stand;
    }

    /**
     * DIE KERNREGEL: Eine Zahl in ein Feld setzen.
     * Der Spielstand ist danach SOFORT aktuell und gespeichert – die
     * Ereignisse werden währenddessen gemeldet.
     * @returns {object} { art: "richtig" | "fehler" | "gesperrt" | "kein-raetsel" | "auswahl-offen", … }
     */
    function setzeZahl(index, ziffer) {
      const r = zustand.raetsel;
      if (zustand.auswahl) return { art: "auswahl-offen" };     // erst eine Verbesserung wählen
      if (!r || r.geloest) return { art: "kein-raetsel" };
      // Vorgaben und schon richtig gesetzte Zahlen sind gesperrt
      if (r.vorgaben[index] !== 0 || r.eingaben[index] !== 0) return { art: "gesperrt" };
      if (!istGanzzahl(ziffer, 1, 9)) return { art: "gesperrt" };
      // Siegel des Bosses: Hier kann gerade nichts gesetzt werden (zählt nicht als Zug)
      if (istVersiegelt(index)) return { art: "versiegelt" };

      if (ziffer !== r.loesung[index]) return falscheZahl(index, ziffer);

      // ---- Richtige Zahl → eintragen (gesperrt), Kombo +1
      r.eingaben[index] = ziffer;
      zustand.kombo++;
      // Elite-Boss: Treffer zählen (z. B. für "Schildwall")
      const eliteTreffer = zustand.elite ? ++zustand.elite.treffer : 0;
      const w = werte();
      const bossVorher = bossMitStand(zustand.bossNummer);
      const hpVorher = zustand.bossHp;

      // 1. Fertige Einheiten → Doppelschaden und Münzen
      const einheiten = fertigeEinheiten(r, index);
      const doppelt = einheiten.zeile || einheiten.spalte || einheiten.block;

      // 2. Power-up auf diesem Feld?
      const effekt = { leben: 0, muenzen: 0, giftAnteil: 0 };
      const pIndex = r.powerups.findIndex(function (p) { return p.index === index; });
      let powerup = null;
      if (pIndex !== -1) {
        const typ = powerupTyp(r.powerups[pIndex].typ);
        r.powerups.splice(pIndex, 1);       // ausgelöst → Markierung weg
        typ.wirkung(effekt, { zustand: zustand, boss: bossVorher });
        powerup = { index: index, typ: typ.id, name: typ.name };
      }

      // 3. Schaden – alles in der zentralen Berechnung.
      //    Regenbogenfeld: kein Wurf – der Boss ist sofort besiegt, egal wie
      //    viele HP er hat und welche Eigenheiten er besitzt (auch Elite).
      const regenbogen = r.regenbogen === index;
      if (regenbogen) r.regenbogen = null;
      const wurf = regenbogen ? null : 1 + Math.floor(zufall() * w.wuerfelSeiten);
      //    Fluch des Bosses: Diese Ziffer macht keinen Schaden (vor allem anderen,
      //    also auch kein kritischer Treffer). Das Regenbogenfeld wirkt trotzdem.
      const verflucht = zifferWirkung(zustand.gegenangriff.wirkungen, ziffer) === "verflucht";
      const mods = modifikatoren(bossVorher);
      if (verflucht) {
        mods.unshift({ wurf: function (rech) {
          rech.verflucht = true;
          rech.wert = 0;
          rech.ende = true;
          rech.schritte.push("Fluch ×0");
        } });
      }
      const rechnung = regenbogen ? {
        regenbogen: true, wurf: null, schaden: hpVorher, gift: 0, komboBonus: 0,
        kritisch: false, fehlschlag: false, geblockt: false, immun: false, ausgeloest: null,
        schritte: ["Regenbogenschlag"], text: "Regenbogenschlag = " + hpVorher,
      } : berechneSchaden({
        wurf: wurf, werte: w, kombo: zustand.kombo, grad: r.grad, doppelt: doppelt,
        einheiten: (einheiten.zeile ? 1 : 0) + (einheiten.spalte ? 1 : 0) + (einheiten.block ? 1 : 0),
        giftAnteil: effekt.giftAnteil,
        modifikatoren: mods, eigenheit: bossVorher.eigenheit,
        selten: bossVorher.selten, eliteTreffer: eliteTreffer,
      });
      if (!regenbogen) rechnung.regenbogen = false;
      rechnung.verflucht = Boolean(rechnung.verflucht);
      const spruch = rechnung.fehlschlag
        ? K.fehlschlagSprueche[Math.floor(zufall() * K.fehlschlagSprueche.length)]
        : null;
      const hpNachSchaden = Math.max(0, hpVorher - rechnung.schaden);
      const hpNachher = Math.max(0, hpNachSchaden - rechnung.gift);
      zustand.bossHp = hpNachher;

      // 4. Münzen: (je Zahl + je fertige Zeile/Spalte + je Block + Power-up) × Münzfaktor.
      //    Nachkommastellen werden in muenzRest gesammelt.
      const grundMuenzen = w.muenzenProZahl +
        (einheiten.zeile ? K.muenzen.proZeileOderSpalte : 0) +
        (einheiten.spalte ? K.muenzen.proZeileOderSpalte : 0) +
        (einheiten.block ? K.muenzen.proBlock : 0) +
        effekt.muenzen;
      const muenzFaktor = belohnung(r.grad).muenzFaktor;
      const mitRest = Math.round((grundMuenzen * muenzFaktor + zustand.muenzRest) * 1e6) / 1e6;
      const muenzenPlus = Math.floor(mitRest);
      zustand.muenzRest = Math.round((mitRest - muenzenPlus) * 1e6) / 1e6;
      zustand.muenzen += muenzenPlus;

      // 5. Leben (Power-up), höchstens bis zur Obergrenze
      const lebenVorher = zustand.leben;
      zustand.leben = Math.min(w.maxLeben, zustand.leben + effekt.leben);
      const lebenPlus = zustand.leben - lebenVorher;

      // 5b. Parade: Eine fertige Zeile, Spalte oder ein fertiger Block lädt eine
      //     Parade auf (höchstens paradenMax vorrätig)
      const ga = zustand.gegenangriff;
      const paradeNeu = doppelt && ga.paraden < K.gegenangriff.paradenMax;
      if (paradeNeu) ga.paraden++;

      // 6. Boss besiegt? → Rekord, nächster Boss, Leben auffüllen, Verbesserungen anbieten.
      //    Elite-Boss: Extra-Münzen und mehrere Verbesserungen zur Wahl.
      const besiegt = hpNachher === 0;
      let eliteBonus = 0;
      if (besiegt) {
        if (bossVorher.elite) {
          eliteBonus = K.elite.muenzen;
          zustand.muenzen += eliteBonus;
          if (zustand.elite) zustand.vorigeSelten = zustand.elite.selten;
        }
        zustand.rekord = Math.max(zustand.rekord, bossVorher.nummer);
        zustand.bossNummer++;
        eliteAuslosen();
        zustand.bossHp = maxHp(zustand.bossNummer);
        zustand.leben = Math.max(zustand.leben, K.lebenNachBoss);
        zustand.auswahl = loseAngebot();
        zustand.auswahlAnzahl = zustand.auswahl
          ? Math.min(zustand.auswahl.length, bossVorher.elite ? Math.max(1, K.elite.verbesserungenWaehlen) : 1)
          : 0;
        // Der neue Boss beginnt seinen Angriffszähler von vorn; Paraden
        // und laufende Wirkungen verfallen mit dem besiegten Boss
        zustand.gegenangriff = neuerGegenangriff(zustand.bossNummer, 0);
      }

      // 7. Sudoku komplett?
      const geloest = r.vorgaben.every(function (v, i) { return (v || r.eingaben[i]) === r.loesung[i]; });
      if (geloest) {
        r.geloest = true;
      }

      // 8. Gegenangriff: Der Zug zählt (nicht, wenn der Boss gerade besiegt wurde).
      //    Wirkungen enden mit dem Sudoku. Ein Hieb kann das letzte Leben kosten.
      const angriff = besiegt ? null : zugVorbei(bossVorher);
      if (geloest) zustand.gegenangriff.wirkungen = [];
      const gegenangriff = besiegt ? null : angriffAnzeigeVorAngriff(angriff);
      let niederlage = null;
      if (angriff) {
        angriff.stand = gegenangriffAnzeige();
        if (zustand.leben <= 0) {
          angriff.niederlage = true;
          niederlage = niederlageAnwenden(bossVorher);
          angriff.stand = gegenangriffAnzeige();
        }
      }
      speichern();

      // Alles, was diese Zahl bewirkt hat, in EINEM Ereignis
      const treffer = {
        index: index, ziffer: ziffer, boss: bossVorher,
        wurf: wurf, wuerfelSeiten: w.wuerfelSeiten, rechnung: rechnung, regenbogen: regenbogen,
        kritisch: rechnung.kritisch, fehlschlag: rechnung.fehlschlag, spruch: spruch,
        doppelt: doppelt, einheiten: einheiten,
        schaden: rechnung.schaden, gift: rechnung.gift,
        kombo: zustand.kombo, komboBonus: rechnung.komboBonus,
        eigenheit: rechnung.ausgeloest ? {
          id: bossVorher.eigenheit.id, name: bossVorher.eigenheit.name,
          farbe: bossVorher.eigenheit.farbe, text: rechnung.ausgeloest,
        } : null,
        // Seltene Eigenschaft hat den Treffer abgewehrt ("immun" oder "geblockt")
        immun: rechnung.immun,
        selten: rechnung.immun ? {
          id: bossVorher.selten.id, name: bossVorher.selten.name, farbe: bossVorher.selten.farbe,
          grund: rechnung.abwehrGrund, art: rechnung.abwehrArt,
        } : null,
        eliteBonus: eliteBonus,
        hpVorher: hpVorher, hpNachSchaden: hpNachSchaden, hpNachher: hpNachher,
        powerup: powerup,
        muenzenPlus: muenzenPlus, muenzen: zustand.muenzen, muenzFaktor: muenzFaktor,   // muenzen inkl. eliteBonus
        lebenGewuenscht: effekt.leben, lebenPlus: lebenPlus,
        leben: lebenVorher + lebenPlus, maxLeben: w.maxLeben,
        verflucht: rechnung.verflucht,
        paradeNeu: paradeNeu,
        // Gegenangriff-Stand nach diesem Zug (vor einem Angriff); null, wenn der Boss besiegt ist
        gegenangriff: gegenangriff,
      };
      melde("richtig", treffer);
      if (powerup) {
        melde("powerup", { index: index, typ: powerup.typ, effekt: effekt, treffer: treffer });
      }
      if (angriff) melde("angriff", angriff);
      if (niederlage) melde("niederlage", niederlage);
      if (besiegt) {
        melde("bossBesiegt", { boss: bossVorher, rekord: zustand.rekord, elite: bossVorher.elite, eliteBonus: eliteBonus });
        if (zustand.auswahl) {
          // Der nächste Boss erscheint erst nach der Wahl (waehleVerbesserung)
          melde("auswahl", auswahlInfo());
        } else {
          melde("neuerBoss", neuerBossDaten());
        }
      }
      if (geloest && !niederlage) {
        // Neues Sudoku nötig – Boss (HP) und Leben bleiben, wie sie sind.
        // Das Rätsel bleibt bis zum nächsten starteRaetsel() zum Anschauen stehen.
        melde("sudokuGeloest", { grad: r.grad, boss: bossMitStand(zustand.bossNummer), hp: zustand.bossHp });
      }
      return {
        art: "richtig", wurf: wurf, schaden: rechnung.schaden, gift: rechnung.gift,
        kritisch: rechnung.kritisch, fehlschlag: rechnung.fehlschlag, doppelt: doppelt, immun: rechnung.immun,
        eliteBonus: eliteBonus, regenbogen: regenbogen,
        powerup: powerup, muenzenPlus: muenzenPlus, lebenPlus: lebenPlus,
        besiegt: besiegt, geloest: geloest && !niederlage, auswahl: Boolean(zustand.auswahl),
        verflucht: rechnung.verflucht, paradeNeu: paradeNeu, angriff: angriff, niederlage: Boolean(niederlage),
      };
    }

    /** Die gerade angebotenen Verbesserungen für die Karten (leer, wenn keine Wahl offen ist). */
    function angebote() {
      return zustand.auswahl ? verbesserungenFuerAnzeige(zustand.auswahl, zustand.verbesserungen) : [];
    }

    /**
     * Alles zur offenen Auswahl: { angebote, rest (noch zu wählen), elite (nach einem Elite-Boss) }
     */
    function auswahlInfo() {
      return {
        angebote: angebote(),
        rest: zustand.auswahlAnzahl,
        grund: zustand.auswahlGrund,       // "boss" oder "frei"
        elite: zustand.auswahlGrund === "boss" && zustand.bossNummer > 1 && istElite(zustand.bossNummer - 1),
      };
    }

    /**
     * Eine der angebotenen Verbesserungen wählen. Danach erscheint der nächste Boss.
     * @returns {boolean} – false, wenn gerade keine Wahl offen ist oder die id nicht angeboten wurde
     */
    function waehleVerbesserung(id) {
      if (!zustand.auswahl || zustand.auswahl.indexOf(id) === -1) return false;
      const v = verbesserungInfo(id);
      zustand.verbesserungen[id] = (zustand.verbesserungen[id] || 0) + 1;
      // Darf noch eine weitere gewählt werden (Elite-Boss)? Dann bleiben die
      // übrigen Angebote stehen – sofern sie nicht schon voll sind.
      zustand.auswahlAnzahl--;
      const uebrig = zustand.auswahl.filter(function (a) {
        return a !== id && (zustand.verbesserungen[a] || 0) < verbesserungInfo(a).maxStufe;
      });
      const grund = zustand.auswahlGrund;
      if (zustand.auswahlAnzahl > 0 && uebrig.length > 0) {
        zustand.auswahl = uebrig;
      } else {
        zustand.auswahl = null;
        zustand.auswahlAnzahl = 0;
        zustand.auswahlGrund = "boss";
      }
      const w = werte();
      const lebenVorher = zustand.leben;
      if (v.beimWaehlen) v.beimWaehlen(zustand, w, v.wert);
      speichern();
      melde("verbesserung", {
        id: id, name: v.name, stufe: zustand.verbesserungen[id], maxStufe: v.maxStufe,
        leben: zustand.leben, lebenPlus: zustand.leben - lebenVorher, maxLeben: w.maxLeben,
        gesammelt: gesammelteVerbesserungen(zustand.verbesserungen),
      });
      if (zustand.auswahl) {
        melde("auswahl", auswahlInfo());      // die nächste Wahl
        return true;
      }
      // Nach einem Sieg erscheint jetzt der nächste Boss (eine freie Ersatzwahl
      // ändert am Boss nichts). Steht noch eine freie Wahl aus, kommt sie danach.
      if (grund === "boss") melde("neuerBoss", neuerBossDaten());
      if (freieWahlStarten()) {
        speichern();
        melde("auswahl", auswahlInfo());
      }
      return true;
    }

    /** Muss vor dem Weiterspielen ein neues Sudoku ausgelost werden? */
    function brauchtRaetsel() {
      return !zustand.raetsel || zustand.raetsel.geloest;
    }

    /** Alles auf Anfang: Boss 1, Startleben, 0 Münzen, keine Kombo, keine Verbesserungen, kein Rekord. */
    function zuruecksetzen() {
      zustand = neuerZustand();
      if (istElite(1)) eliteAuslosen();       // nur bei elite.abstand = 1
      speichern();
      melde("zurueckgesetzt", { boss: bossInfo(1) });
    }

    return {
      /** Der aktuelle Spielstand (nur lesen!) */
      get zustand() { return zustand; },
      boss: function () { return bossMitStand(zustand.bossNummer); },
      werte: werte,
      gesammelt: function () { return gesammelteVerbesserungen(zustand.verbesserungen); },
      gegenangriff: gegenangriffAnzeige,
      angebote: angebote,
      auswahlInfo: auswahlInfo,
      an: function (name, fn) { (hoerer[name] = hoerer[name] || []).push(fn); },
      erweitere: function (erweiterung) { erweiterungen.push(erweiterung); },
      loseGrad: loseGrad,
      starteRaetsel: starteRaetsel,
      setzeZahl: setzeZahl,
      waehleVerbesserung: waehleVerbesserung,
      brauchtRaetsel: brauchtRaetsel,
      zuruecksetzen: zuruecksetzen,
    };
  }


  /* ------------------------------------------------------------------------
     SICHERUNG (für settings.js – Export/Import aller Daten)
     ------------------------------------------------------------------------ */

  /** Gespeicherter Stand als Objekt oder null, wenn noch keiner existiert. */
  function alsObjekt() {
    const geprueft = pruefeDaten(BROWSER_SPEICHER.laden());
    return geprueft.ok ? geprueft.daten : null;
  }

  /** Ersetzt den Spielstand (geprüfte Daten) – oder löscht ihn bei null. */
  function ersetzen(daten) {
    if (daten) {
      BROWSER_SPEICHER.speichern(daten);
    } else {
      try { localStorage.removeItem(SPEICHER_SCHLUESSEL); } catch (fehler) { /* egal */ }
    }
  }


  return {
    KONFIG: K,
    SCHADEN_STUFEN: SCHADEN_STUFEN,
    bossInfo: bossInfo,
    maxHp: maxHp,
    istElite: istElite,
    seltenFuerAnzeige: seltenFuerAnzeige,
    angriffsAbstand: angriffsAbstand,
    feldWirkung: feldWirkung,
    zifferWirkung: zifferWirkung,
    belohnung: belohnung,
    powerupTyp: powerupTyp,
    werteVon: werteVon,
    gesammelteVerbesserungen: gesammelteVerbesserungen,
    berechneSchaden: berechneSchaden,
    zahlText: zahlText,
    erstelle: erstelle,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = SudokuRPG;
}
