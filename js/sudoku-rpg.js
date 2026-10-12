/* ==========================================================================
   sudoku-rpg.js – Regeln und Spielstand des Sudoku-Abenteuers
   KEIN Zugriff auf die Seite (kein document, kein DOM). Darstellung:
   js/sudoku-battle-ui.js und js/sudoku-ui.js.

   Grundidee:
     - Jede richtige Zahl wirft einen Würfel. Der Schaden entsteht in EINER
       Funktion (berechneSchaden) in fester Reihenfolge: Wurf, Immunität/
       Block, kritisch/Fehlschlag, Zuschläge, Buch-Bonus, Schwierigkeit,
       Doppelschaden, Reihenbrecher, Gift.
     - Jede falsche Zahl kostet ein Leben. Bei 0 Leben ist der Durchlauf
       vorbei – es geht wieder bei Welt 1, Level 1 los (Münzen und Rekorde bleiben).
     - Richtige Zahlen und fertige Einheiten bringen Münzen (× Münzfaktor
       des Schwierigkeitsgrads).
     - Power-up-Felder im Sudoku lösen beim richtigen Ausfüllen eine
       Wirkung aus (Leben, Gift, Münzen …).
     - Nach jedem besiegten Boss wählt man eine von drei Verbesserungen –
       höchstens fünf verschiedene (Bücher zählen mit), danach nur noch
       Stufenaufstiege oder ein Münzbeutel.
     - Jeder Boss hat genau eine Fähigkeit (Finsternis, Fluch, Siegel,
       Tick, Tick, Verwirrung). Ein Zähler kündigt sie an; bei 0 setzt er
       sie ein.
     - Jeder fünfte Boss ist ein Elite-Boss: doppelte HP, dazu eine seltene
       Eigenschaft (Immunität, Schildwall …), als Belohnung Extra-Münzen und
       zwei Verbesserungen.

   Die Regeln MELDEN, was passiert (Ereignisse), statt selbst etwas
   anzuzeigen. Die Oberfläche hört zu und spielt Animationen ab:
     "richtig"        – richtige Zahl: Wurf, Rechnung, Schaden, Gift, Münzen …
                        (alles, was diese eine Zahl bewirkt, in EINEM Ereignis)
     "powerup"        – ein Power-up-Feld wurde ausgelöst
     "fehler"         – falsche Zahl: ein Leben weniger
     "faehigkeit"     – der Boss setzt seine Fähigkeit ein (oder sie wird pariert)
     "timer"          – der Timer von "Tick, Tick" ist abgelaufen (ein Leben weniger)
     "bossBesiegt"    – HP auf 0
     "auswahl"        – Verbesserungen stehen zur Wahl (bis gewählt ist, zählt keine Zahl)
     "behalten"       – älterer Spielstand mit mehr Verbesserungen als Plätzen:
                        erst auswählen, welche bleiben
     "verbesserung"   – eine Verbesserung wurde gewählt
     "buchschlag"     – ein Buch löst aus (alle neun Felder seiner Ziffer gefüllt)
     "neuerBoss"      – der nächste Boss steht bereit
     "sudokuGeloest"  – alle Felder richtig
     "niederlage"     – keine Leben mehr: der Durchlauf ist vorbei
     "aufgegeben"     – Durchlauf aufgegeben
     "neuerDurchlauf" – nach der Zusammenfassung geht es von vorn los
     "zurueckgesetzt" – alle Fortschritte gelöscht

   ERWEITERN ohne die Grundregeln umzuschreiben:
     1. Auf Ereignisse hören:     spiel.an("bossBesiegt", function (e) { … })
     2. Den Schaden verändern:    spiel.erweitere({ schaden: {
                                    zuschlag: function (rechnung) { rechnung.wert += 2; }
                                  } })
        (ein Modifikator für eine Stufe der Schadensberechnung, siehe unten)
     3. Neue Power-up-Typen, Verbesserungen, Fähigkeiten: je ein weiterer
        Eintrag in der Konfiguration
     4. Eigene Daten im Spielstand: zustand.extras.meinItem = …
        ("extras" wird mitgespeichert und bleibt sonst unangetastet)
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Zahlenwerte an EINER Stelle
   -------------------------------------------------------------------------- */
const SUDOKU_RPG_KONFIG = {
  // HP der Bosse – eine Formel je Level:
  //   HP = (start + (Level − 1) × proLevel) × (1 + (Durchlauf − 1) × durchlaufZuschlag)
  //        × eliteFaktor (Level 5, 10, 15 jeder Welt) bzw. × weltbossFaktor (Level 20)
  // "Level" zählt über alle Welten (Welt 2 beginnt mit Level 21).
  hp: {
    start: 80,              // Level 1
    proLevel: 20,           // jedes weitere Level so viel mehr
    durchlaufZuschlag: 1,   // je weiterem Durchlauf +100 % (Durchlauf 2: doppelte HP)
    eliteFaktor: 2,         // Elite-Bosse
    weltbossFaktor: 3,      // Weltboss (Level 20 jeder Welt)
  },

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

  // Leben
  startLeben: 3,        // so viele Leben zu Beginn jedes Durchlaufs
  maxLeben: 5,          // mehr geht nicht (Zähes Herz erhöht das)
  lebenNachBoss: 3,     // nach einem besiegten Boss wird darauf aufgefüllt
                        // (wer mehr hat, behält sie)

  // Durchlauf: Eine Niederlage beendet ihn – es geht wieder bei Welt 1,
  // Level 1 los (mit Buch-Spin). Münzen und Rekorde bleiben.
  durchlauf: {
    // Satz eines Bosses, der keinen eigenen Siegessatz ("sieg") hat
    siegSatz: "Das war's für heute, kleiner Held.",
  },

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

  // Plätze: so viele VERSCHIEDENE Verbesserungen kann man gleichzeitig
  // besitzen – Bücher zählen mit (zusätzlich gilt buchGrundwirkung.maxBuecher).
  // Stufenaufstiege belegen keinen neuen Platz. Sind alle belegt, werden nur
  // noch Stufenaufstiege angeboten.
  plaetze: 5,

  // Münzbeutel: füllt die Auswahl auf, wenn es weniger als
  // verbesserungAngebot mögliche Karten gibt (ist alles ausgereizt, gibt es nur ihn)
  muenzbeutel: { id: "muenzbeutel", name: "Münzbeutel", muenzen: 25 },

  // BÜCHER – Teil der Verbesserungen: Neun Bücher, eins pro Ziffer. Zu
  // Beginn eines Abenteuers wird eins ausgelost (Buch-Spin), danach kommen
  // Bücher als Karten in der Verbesserungsauswahl nach einem Boss.
  //
  // Grundwirkung, für alle Bücher gleich:
  //   Buch-Bonus – jede richtig gesetzte Ziffer des Buchs erhöht einen eigenen
  //                Schadensbonus (Prozentpunkte, gesammelt im laufenden Sudoku);
  //                er bleibt bei Fehlern, beginnt mit jedem Sudoku bei 0
  //   Buchschlag – sind alle neun Felder der Ziffer gefüllt (die letzte selbst
  //                gesetzt): fester Schaden, ohne Würfel, durch nichts verändert,
  //                einmal pro Buch und Sudoku, nach dem normalen Treffer
  buchGrundwirkung: {
    bonusStufe1: 0.05,      // Buch-Bonus je Ziffer auf Stufe 1 (0.05 = 5 Prozentpunkte)
    bonusProStufe: 0.01,    // jede weitere Stufe: +1 Prozentpunkt (Stufe 10: 14)
    schadenStufe1: 200,     // Buchschlag auf Stufe 1
    schadenProStufe: 100,   // jede weitere Stufe: +100 (Stufe 10: 1100)
    maxStufe: 10,
    maxBuecher: 3,          // so viele verschiedene Bücher kann man besitzen
  },

  // Seltenheit: wie oft ein Buch angeboten wird, Rahmenfarbe der Karte.
  //   spin    – Gewicht der Seltenheit beim Buch-Spin (innerhalb gleich verteilt)
  //   angebot – Gewicht eines NEUEN Buchs dieser Seltenheit in der Auswahl
  buchSeltenheiten: {
    gewoehnlich: { name: "Gewöhnlich", farbe: "#8a8f99", spin: 60, angebot: 6 },
    selten: { name: "Selten", farbe: "#3d8bfd", spin: 25, angebot: 4 },
    mythisch: { name: "Mythisch", farbe: "#a35cff", spin: 12, angebot: 2 },
    legendaer: { name: "Legendär", farbe: "#f0a020", spin: 3, angebot: 1 },
  },

  // Gewichte in der Verbesserungsauswahl nach einem Boss (neue Bücher: siehe Seltenheit)
  auswahlGewichte: {
    verbesserung: 10,       // jede normale Verbesserung
    buchAufstieg: 10,       // Stufenaufstieg eines Buchs, das man schon hat
  },

  // Zusatzwirkungen – gelten nur für Treffer mit der Ziffer des Buchs und
  // ändern sich nicht mit der Stufe. Ein Buch verweist mit "zusatz" auf eine
  // davon. Mögliche Stellen:
  //   wuerfel  – { anzahl, modus }: mehrere Würfel; "hoechster" = der höhere
  //              zählt, "summe" = alle zählen (jeder Würfel wird einzeln auf
  //              Immunität und kritischen Treffer geprüft, dann addiert)
  //   mindestwurf  – der Wurf zählt mindestens als diese Zahl
  //   immerKritisch – der Treffer ist automatisch kritisch (auch bei einer 1)
  //   giftAnteil   – zusätzlich dieser Anteil des Schadens als Gift
  //   muenzen      – so viele Münzen extra (ohne Münzfaktor)
  //   faehigkeit   – um so viele Züge wird der Fähigkeitszähler des Bosses zurückgesetzt
  buchZusaetze: {
    keine: {},
    hoechsterVonZwei: { wuerfel: { anzahl: 2, modus: "hoechster" } },
    muenzen: { muenzen: 3 },
    faehigkeitZurueck: { faehigkeit: 1 },
    mindestwurf: { mindestwurf: 10 },
    gift: { giftAnteil: 0.5 },
    kritisch: { immerKritisch: true },
    zweiWuerfel: { wuerfel: { anzahl: 2, modus: "summe" } },
    dreiWuerfel: { wuerfel: { anzahl: 3, modus: "summe" } },
  },

  // Die neun Bücher. Neues Buch? Ein weiterer Eintrag:
  //   id, name, ziffer – Kennung, Anzeige, Ziffer, für die es wirkt
  //   seltenheit – Eintrag in buchSeltenheiten
  //   zusatz     – Eintrag in buchZusaetze, zusatzText für Karten und Tipps
  buecher: [
    { id: "buch1", name: "Das Buch des Ersten", ziffer: 1, seltenheit: "gewoehnlich", zusatz: "keine", zusatzText: "Keine Zusatzwirkung." },
    { id: "buch2", name: "Das Buch des Zweiten", ziffer: 2, seltenheit: "gewoehnlich", zusatz: "hoechsterVonZwei", zusatzText: "Zwei Würfel, der höhere zählt." },
    { id: "buch3", name: "Das Buch des Dritten", ziffer: 3, seltenheit: "gewoehnlich", zusatz: "muenzen", zusatzText: "3 Münzen extra." },
    { id: "buch4", name: "Das Buch des Vierten", ziffer: 4, seltenheit: "selten", zusatz: "faehigkeitZurueck", zusatzText: "Der Fähigkeitszähler des Bosses wird um 1 Zug zurückgesetzt." },
    { id: "buch5", name: "Das Buch des Fünften", ziffer: 5, seltenheit: "selten", zusatz: "mindestwurf", zusatzText: "Der Wurf zählt mindestens als 10." },
    { id: "buch6", name: "Das Buch des Sechsten", ziffer: 6, seltenheit: "mythisch", zusatz: "gift", zusatzText: "Zusätzlich die Hälfte des Schadens als Gift." },
    { id: "buch7", name: "Das Buch des Siebten", ziffer: 7, seltenheit: "mythisch", zusatz: "kritisch", zusatzText: "Automatisch ein kritischer Treffer." },
    { id: "buch8", name: "Das Buch des Achten", ziffer: 8, seltenheit: "legendaer", zusatz: "zweiWuerfel", zusatzText: "Zwei Würfel, beide zählen." },
    { id: "buch9", name: "Das Buch des Neunten", ziffer: 9, seltenheit: "legendaer", zusatz: "dreiWuerfel", zusatzText: "Drei Würfel, alle zählen." },
  ],

  // Die Verbesserungen. Neue? Einfach einen weiteren Eintrag:
  //   id, name, symbol, farbe – Kennung und Aussehen (Symbole: SYMBOLE in sudoku-battle-ui.js)
  //   maxStufe     – so oft kann man sie höchstens wählen
  //   wert         – Stärke pro Stufe; in "beschreibung" steht {wert} bzw.
  //                  {prozent} (= wert × 100) für diese Zahl
  //   wirkung(w, stufe, wert) – verändert die Spielwerte w (siehe werteVon):
  //       w.wuerfelSeiten, w.kritischeAugen, w.festerSchaden, w.reihenSchaden,
  //       w.muenzenProZahl, w.powerupAnzahl, w.maxLeben
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
  entfernteVerbesserungen: ["gift", "kombo"],   // "Starkes Gift", "Kombo-Meister"

  // Regenbogenfeld: sehr selten, besiegt den aktuellen Boss sofort
  regenbogenfeld: {
    chance: 0.01,           // Wahrscheinlichkeit pro neuem Sudoku (0.01 = 1 %)
    testErzwingen: false,   // true: in JEDEM Sudoku ein Regenbogenfeld (zum Ausprobieren)
  },

  // Welten und Level: Jeder Boss ist ein Level. Die Welten liegen in
  // js/worlds/welt1.js … welt4.js (Name, Hintergrund, Farbstimmung, Bosse).
  // Eine Welt ohne Bosse wird übersprungen; nach der letzten gebauten Welt
  // beginnt der nächste Durchlauf bei Welt 1 (mit höheren HP, siehe hp).
  welten: {
    levelProWelt: 20,       // so viele Level (Bosse) hat jede Welt
    eliteLevel: [5, 10, 15], // Elite-Bosse (Level innerhalb der Welt)
    weltbossLevel: 20,      // der Weltboss: Elite-Regeln, aber weltbossFaktor statt eliteFaktor
  },

  // Fähigkeiten der Bosse: Jeder Boss hat genau eine (Feld "faehigkeit" in
  // den Welt-Dateien). Über ihm steht ein Zähler mit Ansage: Jede gesetzte
  // Zahl (richtig oder falsch) senkt ihn um 1, bei 0 setzt der Boss seine
  // Fähigkeit ein und der Zähler beginnt von vorn. Besiegt der Treffer den
  // Boss, setzt er sie nicht mehr ein.
  // Parade: Vervollständigt GENAU der Zug, in dem der Boss seine Fähigkeit
  // einsetzt, eine Zeile, Spalte oder einen 3×3-Block, wehrt der Held sie ab.
  // Alle Wirkungen enden spätestens mit dem Sudoku oder dem Sieg über den Boss.
  faehigkeit: {
    abstand: 8,             // Startwert des Zählers
    abstandElite: 6,        // … bei Elite-Bossen (und dem Weltboss)
    warnungAb: 2,           // in den letzten so vielen Zügen pulsiert die Anzeige
  },

  // Die Fähigkeiten. Neue Fähigkeit? Einfach ein weiterer Eintrag:
  //   id, name, symbol, farbe – Kennung und Anzeige (Symbole: SYMBOLE in js/sudoku-battle-ui.js)
  //   dauer        – so viele Züge hält die Wirkung an (null = nicht nach Zügen,
  //                  z. B. ein Timer – dann endet sie selbst)
  //   abLevel      – frühestens ab diesem Level einer Welt (optional, wird beim Laden geprüft)
  //   beschreibung – {dauer}, {sekunden} und {leben} werden ersetzt
  //   wirkung(a)   – passiert beim Einsatz. a = { zustand, raetsel, zufall,
  //                  waehle(liste), leer(i), frei(i), blockFelder(b), eintrag }
  //                  (leer: Feld ohne Zahl; frei: leer und gerade von keiner
  //                  Wirkung betroffen). Gibt { text, daten } zurück – oder
  //                  null: Die Fähigkeit verpufft. "daten" merkt sich die
  //                  laufende Wirkung (z. B. welcher Block).
  //   Wirkungen auf das Spielfeld (alle optional):
  //     feld(daten, i)    – "versiegelt" (dort kann man nichts setzen),
  //                         "verdeckt" (Zahl wird als "?" gezeigt) oder
  //                         "timer" (Feld mit dem Timer) – sonst null
  //     ziffer(daten, z)  – "verflucht": diese Ziffer kann man nicht setzen
  //     gueltig(daten)    – prüft gespeicherte Daten beim Laden
  faehigkeiten: [
    {
      id: "finsternis", name: "Finsternis", symbol: "finsternis", farbe: "#3b3561",
      dauer: 5,
      beschreibung: "Verdeckt für {dauer} Züge alle Zahlen in einer Zeile und einer Spalte. Sie zeigen „?“.",
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
      dauer: 5,
      beschreibung: "Verflucht für {dauer} Züge eine Ziffer, die im Sudoku noch fehlt. Sie kann in der Zeit nicht gesetzt werden.",
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
      id: "siegel", name: "Siegel", symbol: "siegel", farbe: "#8b5cff",
      dauer: 4,
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
      // Ein leeres Feld bekommt einen Timer. Die richtige Zahl dort entschärft
      // ihn; läuft er ab, kostet das ein Leben. Die Zeit vergeht nur, solange
      // das Spiel sichtbar ist (die Oberfläche meldet sie: timerVergeht).
      id: "tickTick", name: "Tick, Tick", symbol: "tickTick", farbe: "#e2541b",
      dauer: null, abLevel: 5,
      sekunden: 120,          // so lange läuft der Timer
      warnungSekunden: 20,    // in den letzten so vielen Sekunden: rot und pulsierend
      leben: 1,               // so viele Leben kostet der Ablauf
      beschreibung: "Ein leeres Feld bekommt einen Timer von {sekunden} Sekunden. Setzt du dort rechtzeitig die richtige Zahl, ist er entschärft – sonst kostet er {leben} Leben.",
      wirkung: function (a) {
        // Höchstens ein Timer gleichzeitig – nie auf einem versiegelten oder verdeckten Feld
        if (a.zustand.faehigkeit.wirkungen.some(function (w) { return w.id === a.eintrag.id; })) return null;
        const felder = [];
        for (let i = 0; i < 81; i++) if (a.frei(i)) felder.push(i);
        if (felder.length === 0) return null;
        const feld = a.waehle(felder);
        const z = Math.floor(feld / 9), s = feld % 9;
        return { text: "Timer in Zeile " + (z + 1) + ", Spalte " + (s + 1), daten: { feld: feld, restMs: a.eintrag.sekunden * 1000 } };
      },
      feld: function (daten, i) { return i === daten.feld ? "timer" : null; },
      gueltig: function (daten, eintrag) {
        return Number.isInteger(daten.feld) && daten.feld >= 0 && daten.feld <= 80 &&
          typeof daten.restMs === "number" && daten.restMs > 0 && daten.restMs <= eintrag.sekunden * 1000;
      },
    },
    {
      // Alle Ziffern werden zu Buchstaben eines Worts: 1 → erster Buchstabe,
      // 2 → zweiter … Jedes Wort braucht genau 9 verschiedene Buchstaben
      // (A–Z), sonst wäre eine Ziffer nicht eindeutig – geprüft beim Laden.
      id: "verwirrung", name: "Verwirrung", symbol: "verwirrung", farbe: "#d13f9a",
      dauer: 4,
      beschreibung: "Für {dauer} Züge werden alle Ziffern zu Buchstaben eines Worts: 1 ist der erste Buchstabe, 2 der zweite und so weiter.",
      woerter: [
        "SPIDERMAN",    // Film
        "MINECRAFT",    // Game
        "CYBERPUNK",    // Game
        "DUCKTALES",    // Serie
        "LIGHTYEAR",    // Film (Buzz)
        "DAVYJONES",    // Film (Fluch der Karibik)
        "GHOSTFACE",    // Film (Scream)
        "SLYTHERIN",    // Film (Harry Potter)
        "DRAGONITE",    // Anime und Games (Pokémon)
        "HARLEQUIN",    // Comics, Film und Games
      ],
      wirkung: function (a) {
        const wort = a.waehle(a.eintrag.woerter);
        return { text: "Ziffern werden zu Buchstaben", daten: { wort: wort } };
      },
      gueltig: function (daten, eintrag) { return eintrag.woerter.indexOf(daten.wort) !== -1; },
    },
  ],

  // Elite-Bosse (welche Level: welten.eliteLevel, HP: hp.eliteFaktor) – auch der Weltboss folgt diesen Regeln
  elite: {
    muenzen: 50,            // Extra-Münzen für den Sieg (ohne Münzfaktor)
    verbesserungenWaehlen: 2, // so viele der angebotenen Verbesserungen darf man wählen
  },

  // Seltene Eigenschaften: Jeder Elite-Boss bekommt zusätzlich zu seiner
  // Fähigkeit eine davon – zufällig nach "gewicht", nie dieselbe wie beim
  // Elite-Boss davor. Aufbau:
  //   id, name, farbe, gewicht, wert, beschreibung ({wert} wird ersetzt)
  //   wirkung.schaden: { <stufe>: function (rechnung, kontext) } – hängt sich
  //       in die Schadensberechnung ein (Stufen: siehe SCHADEN_STUFEN)
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
  ],
};


const SudokuRPG = (function () {

  // Die Engine liefert die Liste der Schwierigkeitsgrade. Im Browser ist sie
  // schon geladen, in Node.js (für Tests) wird sie hier nachgeladen.
  const Engine = typeof SudokuEngine !== "undefined" ? SudokuEngine : require("./sudoku-engine.js");

  const K = SUDOKU_RPG_KONFIG;

  // Die Welten (js/worlds/welt1.js …): im Browser schon geladen, in Node.js hier nachgeladen
  const WELTEN = typeof window !== "undefined" && window.SUDOKU_WELTEN
    ? window.SUDOKU_WELTEN
    : [1, 2, 3, 4].map(function (n) { return require("./worlds/welt" + n + ".js"); });
  if (!WELTEN.some(function (w) { return w && w.bosse && w.bosse.length > 0; })) {
    throw new Error("Sudoku-Abenteuer: Keine Welt mit Bossen gefunden (js/worlds/welt1.js).");
  }
  // Beim Laden prüfen (Fehler in Konfiguration oder Welt-Dateien fallen sofort
  // auf): Wörter der Verwirrung (genau 9 verschiedene Buchstaben – sonst wäre
  // eine Ziffer nicht eindeutig; ungültige fliegen raus), jeder Boss hat eine
  // bekannte Fähigkeit, und keine kommt vor ihrem "abLevel".
  (function pruefeFaehigkeiten() {
    K.faehigkeiten.forEach(function (f) {
      if (!f.woerter) return;
      const falsch = f.woerter.filter(function (w) { return !wortGueltigRoh(w); });
      if (falsch.length > 0) {
        console.warn("Sudoku-Abenteuer: Wörter ohne genau 9 verschiedene Buchstaben: " + falsch.join(", "));
        f.woerter = f.woerter.filter(wortGueltigRoh);
      }
    });
    WELTEN.forEach(function (welt) {
      if (!welt) return;
      welt.bosse.forEach(function (b, i) {
        const f = K.faehigkeiten.find(function (x) { return x.id === b.faehigkeit; });
        if (!f) console.warn("Sudoku-Abenteuer: " + b.name + " hat keine bekannte Fähigkeit („" + b.faehigkeit + "“).");
        else if (f.abLevel && i + 1 < f.abLevel) console.warn("Sudoku-Abenteuer: „" + f.name + "“ erst ab Level " + f.abLevel + " (" + b.name + ").");
      });
    });
    function wortGueltigRoh(w) { return typeof w === "string" && /^[A-Z]{9}$/.test(w) && new Set(w.split("")).size === 9; }
  })();

  const SPEICHER_SCHLUESSEL = "ntb-sudoku-abenteuer";
  // Version 1: noch "fehler" statt Leben. Version 2: Leben, Münzen, Power-ups.
  // Version 3: dazu Münz-Rest, Verbesserungen und offene Auswahl (damals auch eine Kombo).
  // Version 4: dazu Elite-Bosse (seltene Eigenschaft, Treffer-Zähler) und
  //            mehrere Wahlen bei einer Auswahl.
  // Version 5: dazu freie Ersatzwahl (entfernte Verbesserungen) und Regenbogenfeld.
  // Version 9: Welten und Level – bossNummer bleibt, die HP folgen der neuen Formel.
  // Version 10: ohne Kombo; höchstens K.plaetze Verbesserungen (Reihenfolge in
  //             "plaetze"), Einschüchtern statt Schrei.
  // Version 11: Durchläufe – eine Niederlage beendet den Durchlauf ("ende"
  //             hält die Zusammenfassung fest), dauerhafte "rekorde", Werte
  //             des laufenden Durchlaufs in "lauf".
  // Version 12: Fähigkeiten statt Eigenheiten und Angriffen – "faehigkeit"
  //             statt "gegenangriff", ohne "eingeschuechtert".
  const VERSION = 12;


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
     BOSSE, FÄHIGKEITEN, SCHWIERIGKEIT, POWER-UPS, VERBESSERUNGEN
     ------------------------------------------------------------------------ */

  /* ---------- Welten und Level ----------
     zustand.bossNummer zählt alle Bosse eines Abenteuers fortlaufend (1, 2, 3 …).
     Daraus ergeben sich Durchlauf, Welt und Level: Die gebauten Welten
     (mit Bossen) folgen aufeinander, danach beginnt der nächste Durchlauf. */

  /** Die gebauten Welten (mit Bossen) in ihrer Reihenfolge. */
  function gebauteWelten() {
    return WELTEN.filter(function (w) { return w && Array.isArray(w.bosse) && w.bosse.length > 0; });
  }

  /**
   * Wo steht der Boss mit dieser fortlaufenden Nummer?
   * @returns {{ durchlauf, welt, weltLevel (1–20), level (über alle Welten, 1–80), weltboss, elite }}
   */
  function position(nummer) {
    const pro = K.welten.levelProWelt;
    const welten = gebauteWelten();
    const proDurchlauf = welten.length * pro;
    const i = (nummer - 1) % proDurchlauf;
    const welt = welten[Math.floor(i / pro)];
    const weltLevel = (i % pro) + 1;
    const weltboss = weltLevel === K.welten.weltbossLevel;
    return {
      durchlauf: Math.floor((nummer - 1) / proDurchlauf) + 1,
      welt: welt,
      weltLevel: weltLevel,
      level: (welt.nummer - 1) * pro + weltLevel,
      weltboss: weltboss,
      elite: weltboss || K.welten.eliteLevel.indexOf(weltLevel) !== -1,
    };
  }

  /** Ist der Boss mit dieser Nummer ein Elite-Boss (Level 5, 10, 15 – und der Weltboss)? */
  function istElite(nummer) {
    return position(nummer).elite;
  }

  /** Ist der Boss mit dieser Nummer ein Weltboss? */
  function istWeltboss(nummer) {
    return position(nummer).weltboss;
  }

  /** In wie vielen Bossen kommt der nächste Elite-Boss? (0 = dieser ist einer, null = gar keiner) */
  function bisElite(nummer) {
    const pro = K.welten.levelProWelt;
    for (let k = 0; k <= pro; k++) {
      if (istElite(nummer + k)) return k;
    }
    return null;
  }

  /** HP-Formel (siehe KONFIG.hp) für ein Level in einem Durchlauf. */
  function hpFuer(level, durchlauf, art) {
    const h = K.hp;
    const normal = (h.start + (level - 1) * h.proLevel) * (1 + (durchlauf - 1) * h.durchlaufZuschlag);
    const faktor = art === "weltboss" ? h.weltbossFaktor : art === "elite" ? h.eliteFaktor : 1;
    return Math.round(normal * faktor);
  }

  /** Höchste HP des Bosses mit dieser Nummer (1, 2, 3 …). */
  function maxHp(nummer) {
    const p = position(nummer);
    return hpFuer(p.level, p.durchlauf, p.weltboss ? "weltboss" : p.elite ? "elite" : "normal");
  }

  /** HP nach der alten Formel (bis Spielstand-Version 8) – nur zum Übernehmen alter Stände. */
  function alteMaxHp(nummer) {
    const normal = 80 + (nummer - 1) * 20;
    return nummer % 5 === 0 ? normal * 2 : normal;
  }

  /** Der Boss-Eintrag der Weltdatei (Name, Sprite, Fähigkeit, Sätze). */
  function bossEintrag(nummer) {
    const p = position(nummer);
    return p.welt.bosse[p.weltLevel - 1];
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

  /** Fähigkeit über ihre id (oder null). */
  function faehigkeitInfo(id) {
    return K.faehigkeiten.find(function (f) { return f.id === id; }) || null;
  }

  /** Die Fähigkeit des Bosses mit dieser Nummer (Bosse kehren mit ihrer Fähigkeit zurück). */
  function faehigkeitVonBoss(nummer) {
    return faehigkeitInfo(bossEintrag(nummer).faehigkeit);
  }

  /** Startwert des Zählers: alle so vielen Züge setzt dieser Boss seine Fähigkeit ein (0 = keine). */
  function faehigkeitAbstand(nummer) {
    if (!faehigkeitVonBoss(nummer)) return 0;
    return Math.max(1, istElite(nummer) ? K.faehigkeit.abstandElite : K.faehigkeit.abstand);
  }

  /** Beschreibung einer Fähigkeit mit eingesetzten Zahlen. */
  function faehigkeitBeschreibung(f) {
    return f.beschreibung.split("{dauer}").join(String(f.dauer))
      .split("{sekunden}").join(String(f.sekunden)).split("{leben}").join(String(f.leben));
  }

  /** Fähigkeit für die Anzeige (ohne Funktionen). */
  function faehigkeitFuerAnzeige(f, nummer) {
    if (!f) return null;
    const anzeige = { id: f.id, name: f.name, symbol: f.symbol, farbe: f.farbe, dauer: f.dauer,
      abstand: nummer ? faehigkeitAbstand(nummer) : K.faehigkeit.abstand, beschreibung: faehigkeitBeschreibung(f) };
    if (f.sekunden) {
      anzeige.sekunden = f.sekunden;
      anzeige.warnungSekunden = f.warnungSekunden;
    }
    return anzeige;
  }

  /** Stand der Fähigkeit für einen frischen Kampf gegen diesen Boss. */
  function neueFaehigkeit(nummer) {
    return { zaehler: faehigkeitAbstand(nummer), wirkungen: [] };
  }

  /**
   * Was eine laufende Wirkung mit Feld i macht: "versiegelt", "verdeckt", "timer" oder null.
   * @param {object[]} wirkungen – [{ id, rest, daten }] aus dem Spielstand (oder der Anzeige)
   */
  function feldWirkung(wirkungen, i) {
    for (const w of wirkungen || []) {
      const f = faehigkeitInfo(w.id);
      const art = f && f.feld ? f.feld(w.daten, i) : null;
      if (art) return art;
    }
    return null;
  }

  /** Was eine laufende Wirkung mit Ziffer z macht: "verflucht" (nicht setzbar) oder null. */
  function zifferWirkung(wirkungen, z) {
    for (const w of wirkungen || []) {
      const f = faehigkeitInfo(w.id);
      const art = f && f.ziffer ? f.ziffer(w.daten, z) : null;
      if (art) return art;
    }
    return null;
  }

  /** Das Wort einer laufenden Verwirrung (oder null): Ziffer z wird zum z-ten Buchstaben. */
  function verwirrungsWort(wirkungen) {
    const w = (wirkungen || []).find(function (x) { return x.id === "verwirrung"; });
    return w ? w.daten.wort : null;
  }

  /** Taugt ein Wort für die Verwirrung? Genau 9 verschiedene Buchstaben A–Z. */
  function wortGueltig(wort) {
    return typeof wort === "string" && /^[A-Z]{9}$/.test(wort) && new Set(wort.split("")).size === 9;
  }

  /** Buch über seine id (oder null). */
  function buchInfo(id) {
    return K.buecher.find(function (b) { return b.id === id; }) || null;
  }

  /** Ist diese id ein Buch (statt einer normalen Verbesserung)? */
  function istBuch(id) {
    return Boolean(buchInfo(id));
  }

  /** Buch-Bonus je gesetzter Ziffer auf dieser Stufe (Anteil, 0.05 = 5 Prozentpunkte). */
  function buchBonusFuer(stufe) {
    const g = K.buchGrundwirkung;
    return Math.round((g.bonusStufe1 + (stufe - 1) * g.bonusProStufe) * 1e6) / 1e6;
  }

  /** Schaden des Buchschlags auf dieser Stufe. */
  function buchSchadenFuer(stufe) {
    const g = K.buchGrundwirkung;
    return g.schadenStufe1 + (stufe - 1) * g.schadenProStufe;
  }

  /** Grundwirkung als Text (mindestens Stufe 1). */
  function buchGrundText(b, stufe) {
    const s = Math.max(1, stufe);
    return "Jede richtig gesetzte " + b.ziffer + ": Buch-Bonus +" + Math.round(buchBonusFuer(s) * 100) +
      " %-Punkte auf den Schaden (im laufenden Sudoku). Alle neun " + b.ziffer + "en gesetzt, die letzte von dir: Buchschlag mit " +
      buchSchadenFuer(s) + " Schaden.";
  }

  /**
   * Ein Buch für die Anzeige (Karte, Leiste, Buch-Spin).
   * naechste: Text für den Stufenaufstieg, z. B. "Stufe 3 auf 4: 7 auf 8 % und 400 auf 500 Schaden"
   */
  function buchFuerAnzeige(id, stufe) {
    const b = buchInfo(id);
    const selten = K.buchSeltenheiten[b.seltenheit];
    const g = K.buchGrundwirkung;
    return {
      art: "buch", id: b.id, name: b.name, ziffer: b.ziffer, symbol: "buch",
      seltenheit: b.seltenheit, seltenheitName: selten.name, farbe: selten.farbe,
      stufe: stufe, maxStufe: g.maxStufe,
      grundText: buchGrundText(b, stufe), zusatzText: b.zusatzText,
      beschreibung: buchGrundText(b, stufe) + " Zusatz: " + b.zusatzText,
      naechste: stufe > 0 && stufe < g.maxStufe
        ? "Stufe " + stufe + " auf " + (stufe + 1) + ": " + Math.round(buchBonusFuer(stufe) * 100) + " auf " +
          Math.round(buchBonusFuer(stufe + 1) * 100) + " % und " + buchSchadenFuer(stufe) + " auf " + buchSchadenFuer(stufe + 1) + " Schaden"
        : null,
    };
  }

  /** Alle Bücher, die man besitzt (in der Reihenfolge der Liste). */
  function gesammelteBuecher(buecher) {
    return K.buecher.filter(function (b) { return buecher && buecher[b.id] > 0; })
      .map(function (b) { return buchFuerAnzeige(b.id, buecher[b.id]); });
  }

  /** Der Münzbeutel als Karte. */
  function muenzbeutelFuerAnzeige() {
    const m = K.muenzbeutel;
    return { art: "muenzbeutel", id: m.id, name: m.name, symbol: "muenze", farbe: "#e0a43a",
      stufe: 0, maxStufe: 0, muenzen: m.muenzen, beschreibung: m.muenzen + " Münzen sofort.", naechste: null };
  }

  /**
   * Angebotene Karten (normale Verbesserungen, Bücher, Münzbeutel) für die Anzeige.
   * Neue Verbesserungen sagen, welchen Platz sie belegen würden ("Platz 4 von 5").
   * @param {number} [belegt] – so viele Plätze sind schon belegt
   */
  function angeboteFuerAnzeige(ids, stufen, buecher, belegt) {
    return ids.map(function (id) {
      if (id === K.muenzbeutel.id) return muenzbeutelFuerAnzeige();
      const karte = istBuch(id)
        ? buchFuerAnzeige(id, (buecher && buecher[id]) || 0)
        : Object.assign({ art: "verbesserung" }, verbesserungenFuerAnzeige([id], stufen)[0]);
      karte.plaetze = K.plaetze;
      karte.platz = karte.stufe === 0 && typeof belegt === "number" ? belegt + 1 : null;
      return karte;
    });
  }

  /**
   * Hat ein Spielstand mehr Bücher als erlaubt, bleiben die mit der höchsten
   * Stufe (bei gleicher Stufe die mit der kleineren Ziffer).
   */
  function buecherBegrenzen(buecher) {
    const ids = Object.keys(buecher).sort(function (a, b) {
      return buecher[b] - buecher[a] || buchInfo(a).ziffer - buchInfo(b).ziffer;
    }).slice(0, K.buchGrundwirkung.maxBuecher);
    const neu = {};
    ids.forEach(function (id) { neu[id] = buecher[id]; });
    return neu;
  }

  /**
   * Buch-Spin: zuerst die Seltenheit nach ihrem Gewicht, dann ein Buch dieser
   * Seltenheit (gleich verteilt).
   */
  function ziehBuchSpin(zufall) {
    const seltenheiten = Object.keys(K.buchSeltenheiten).filter(function (id) {
      return K.buecher.some(function (b) { return b.seltenheit === id; });
    });
    const selten = ziehe(seltenheiten, function (id) { return K.buchSeltenheiten[id].spin; }, zufall);
    const kandidaten = K.buecher.filter(function (b) { return b.seltenheit === selten; });
    return kandidaten[Math.floor(zufall() * kandidaten.length)];
  }

  /** Welt für die Anzeige (ohne Bossliste). */
  function weltFuerAnzeige(welt) {
    return { nummer: welt.nummer, id: welt.id, name: welt.name, hintergrund: welt.hintergrund,
      farben: Object.assign({}, welt.farben) };
  }

  /**
   * Alles über den Boss mit dieser Nummer: Welt, Level, Name, Sprite,
   * Sätze und Fähigkeit. Im 2., 3. … Durchlauf kommen dieselben
   * Bosse wieder – mit mehr HP und anderer Farbe (runde = Durchlauf − 1).
   */
  function bossInfo(nummer) {
    const p = position(nummer);
    const b = p.welt.bosse[p.weltLevel - 1];
    return {
      nummer: nummer,
      name: b.name,
      sprite: b.sprite,
      runde: p.durchlauf - 1,
      durchlauf: p.durchlauf,
      welt: weltFuerAnzeige(p.welt),
      level: p.level,                       // über alle Welten (Welt 2 beginnt bei 21)
      weltLevel: p.weltLevel,               // innerhalb der Welt: 1 bis levelProWelt
      levelProWelt: K.welten.levelProWelt,
      eliteLevel: K.welten.eliteLevel.slice(),
      weltbossLevel: K.welten.weltbossLevel,
      erscheinen: b.erscheinen || "",
      niederlage: b.niederlage || "",
      sieg: b.sieg || K.durchlauf.siegSatz,   // Satz, wenn der Held gegen ihn verliert
      maxHp: maxHp(nummer),
      elite: p.elite,
      weltboss: p.weltboss,
      bisElite: bisElite(nummer),
      selten: null,          // seltene Eigenschaft – kommt aus dem Spielstand (siehe bossMitStand)
      // Fähigkeit: { id, name, symbol, farbe, dauer, abstand, beschreibung (, sekunden) }
      faehigkeit: faehigkeitFuerAnzeige(faehigkeitVonBoss(nummer), nummer),
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

       1. wurf          Würfelwurf – danach (als Modifikatoren dieser Stufe)
                        die Prüfung auf Immunität oder Block
       2. kritisch      höchste Augenzahl → × kritischFaktor; eine 1 → Fehlschlag (0)
       3. zuschlag      feste Zuschläge (Scharfe Klinge)
       4. buch          × (1 + Buch-Bonus des laufenden Sudokus)
       5. schwierigkeit × (1 + Schadensbonus des Grads)
       6. doppelt       × doppelschadenFaktor, wenn eine Einheit fertig wurde
       7. reihen        + Extra-Schaden je fertiger Einheit (Reihenbrecher) –
                        kommt NACH der Verdopplung und wird nicht mitverdoppelt
       8. gift          Giftanteil des bis hierher berechneten Schadens
       Am Ende wird aufgerundet (Schaden und Gift getrennt).

     Verbesserungen wirken über die Spielwerte (werteVon). Seltene
     Eigenschaften der Elite-Bosse und Erweiterungen hängen sich als
     MODIFIKATOR in eine Stufe ein:
       { kritisch: function (rechnung, kontext) { … } }
     Ein Modifikator läuft direkt NACH der Grundregel seiner Stufe. Setzt er
     rechnung.ende = true, bleibt es beim aktuellen Wert (z. B. 0).
     ------------------------------------------------------------------------ */

  const SCHADEN_STUFEN = ["wurf", "kritisch", "zuschlag", "buch", "schwierigkeit", "doppelt", "reihen", "gift"];

  // Diese Stufen gelten für JEDEN Würfel einzeln (bei mehreren Würfeln)
  const WUERFEL_STUFEN = ["wurf", "kritisch"];

  const GRUNDREGELN = {
    wurf: function (r, k) {
      r.wert = r.wurf;
      r.schritte.push("Wurf " + r.wurf);
      // Buch des Fünften: Der Wurf zählt mindestens als … (auch für Immunität
      // und kritischen Treffer – er zählt eben als diese Zahl)
      if (k.mindestwurf && r.wurf < k.mindestwurf) {
        r.schritte.push("Mindestwurf +" + (k.mindestwurf - r.wurf));
        r.wurf = k.mindestwurf;
        r.wert = r.wurf;
      }
    },
    kritisch: function (r, k) {
      if (k.immerKritisch) {
        // Buch des Siebten: automatisch kritisch – auch eine 1 ist dann kein Fehlschlag
        r.kritisch = true;
        r.wert = r.wurf * K.kritischFaktor;
        r.schritte.push("Kritisch ×" + zahlText(K.kritischFaktor));
      } else if (r.wurf === 1) {
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
    // Buch-Bonus: eigener Schadensbonus (Prozentpunkte aus den Ziffern der Bücher)
    buch: function (r, k) {
      r.buchBonus = k.buchBonus || 0;
      if (r.buchBonus > 0) {
        r.wert *= 1 + r.buchBonus;
        r.schritte.push("Buch-Bonus +" + Math.round(r.buchBonus * 100) + " %");
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
   *   buchBonus     – Buch-Bonus des laufenden Sudokus INKLUSIVE dieser Zahl (0.15 = +15 %)
   *   wuerfe        – mehrere Würfel (Augenzahlen), die alle zählen (sonst: wurf)
   *   mindestwurf   – der Wurf zählt mindestens als diese Zahl (Buch des Fünften)
   *   immerKritisch – der Treffer ist automatisch kritisch (Buch des Siebten)
   *   grad          – id des Schwierigkeitsgrads (oder null)
   *   doppelt       – true, wenn eine Zeile/Spalte/Block fertig wurde
   *   einheiten     – WIE VIELE Einheiten fertig wurden (0–3, für den Reihenbrecher)
   *   giftAnteil    – 0.5 = die Hälfte als Gift (0 = kein Gift)
   *   modifikatoren – Liste { <stufe>: function (rechnung, kontext) }
   *   selten        – die seltene Eigenschaft eines Elite-Bosses (oder null)
   *   eliteTreffer  – der wievielte Treffer gegen diesen Elite-Boss
   * @returns {object} rechnung: { wurf, schaden, gift, kritisch, fehlschlag,
   *   immun, abwehrGrund, abwehrArt, buchBonus, schritte, text }
   */
  /** Eine leere Rechnung für einen Würfel. */
  function neueRechnung(wurf, w) {
    const r = {
      wurf: wurf,
      kritischAb: w.wuerfelSeiten - w.kritischeAugen + 1,   // ab dieser Augenzahl kritisch
      wert: 0, giftWert: 0, buchBonus: 0,
      kritisch: false, fehlschlag: false, ende: false,
      immun: false,              // seltene Eigenschaft hat den Treffer abgewehrt
      abwehrGrund: null,         // z. B. "gerade"
      abwehrArt: null,           // "immun" oder "geblockt"
      wuerfel: null,             // bei mehreren Würfeln: je Würfel { wurf, wert, kritisch, … }
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
    return r;
  }

  /** Lässt Stufen (Grundregel, dann Modifikatoren) über eine Rechnung laufen. */
  function laufeStufen(r, kontext, stufen) {
    stufen.forEach(function (stufe) {
      if (r.ende) return;
      GRUNDREGELN[stufe](r, kontext);
      kontext.modifikatoren.forEach(function (m) {
        if (!r.ende && typeof m[stufe] === "function") m[stufe](r, kontext);
      });
    });
  }

  function berechneSchaden(kontext) {
    kontext = Object.assign({ werte: werteVon({}), grad: null, doppelt: false, einheiten: 0,
      giftAnteil: 0, modifikatoren: [], selten: null, eliteTreffer: 0, wuerfe: null }, kontext);
    const w = kontext.werte;
    let r;
    if (!kontext.wuerfe || kontext.wuerfe.length < 2) {
      // Ein Würfel: alle Stufen nacheinander
      r = neueRechnung(kontext.wuerfe ? kontext.wuerfe[0] : kontext.wurf, w);
      laufeStufen(r, kontext, SCHADEN_STUFEN);
      r.basis = r.wurf;
    } else {
      // Mehrere Würfel (Bücher des Achten und Neunten): Jeder Würfel läuft
      // einzeln durch "wurf" und "kritisch" (Immunität, kritischer Treffer,
      // Fehlschlag), dann werden die Werte addiert und die Rechnung
      // läuft mit der Summe normal weiter.
      const teile = kontext.wuerfe.map(function (wurf) {
        const t = neueRechnung(wurf, w);
        laufeStufen(t, Object.assign({}, kontext, { wurf: wurf }), WUERFEL_STUFEN);
        return t;
      });
      r = neueRechnung(kontext.wuerfe[0], w);
      r.wuerfel = teile.map(function (t) {
        return { wurf: t.wurf, wert: t.wert, kritisch: t.kritisch, fehlschlag: t.fehlschlag,
          immun: t.immun, abwehrArt: t.abwehrArt };
      });
      r.wert = teile.reduce(function (summe, t) { return summe + t.wert; }, 0);
      r.basis = r.wert;
      r.kritisch = teile.some(function (t) { return t.kritisch; });
      // Nur wenn ALLE Würfel nichts bewirken, endet der Treffer wie bei einem Würfel
      const alle = function (feld) { return teile.every(function (t) { return t[feld]; }); };
      r.fehlschlag = alle("fehlschlag");
      if (alle("immun")) {
        r.immun = true; r.abwehrGrund = teile[0].abwehrGrund; r.abwehrArt = teile[0].abwehrArt;
      }
      r.schritte.push("Würfel " + teile.map(function (t) { return t.wert; }).join(" + ") + " = " + r.wert);
      if (r.wert === 0) {
        r.ende = true;
      } else {
        laufeStufen(r, kontext, SCHADEN_STUFEN.filter(function (s) { return WUERFEL_STUFEN.indexOf(s) === -1; }));
      }
    }
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
       verbesserungen,     ← { id: Stufe }
       plaetze,            ← ids aller Verbesserungen UND Bücher in der Reihenfolge,
                             in der sie dazukamen (höchstens K.plaetze; ein älterer
                             Stand mit mehr → erst auswählen, was bleibt)
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
       faehigkeit: {       ← Fähigkeit des aktuellen Bosses (Version 12; davor "gegenangriff")
         zaehler,          ← so viele Züge noch bis zum Einsatz
         wirkungen: [ { id, rest, daten } ]  ← laufende Wirkungen: rest = Züge
                             (null bei Tick, Tick – daten.restMs ist die Restzeit
                             des Timers, daten.feld sein Feld); Verwirrung:
                             daten.wort ist das aktuelle Wort
       },
       buecher,            ← { id: Stufe } der Bücher (höchstens buchGrundwirkung.maxBuecher);
                             leer → beim nächsten Öffnen findet der Buch-Spin statt
       buchBonus,          ← Buch-Bonus des laufenden Sudokus (0.15 = +15 %)
       buchSchlaege,       ← ids der Bücher, die in diesem Sudoku schon ausgelöst haben
       buchSchlagOffen,    ← [ { id, schaden, felder } ]: Buchschläge für den nächsten Boss
                             (der normale Treffer hat den Boss schon besiegt)
       raetsel: null | { grad, vorgaben, loesung, eingaben, geloest,
                         powerups: [ { index, typ } ],
                         regenbogen: null | Index des Regenbogenfelds },
       rekorde: {         ← dauerhaft, überstehen jedes Ende eines Durchlaufs
         level,           ← höchstes erreichtes Level (Bossnummer, über alle Welten)
         treffer,         ← höchster Einzeltreffer (Würfeltreffer inkl. Gift)
         bosse,           ← meiste besiegte Bosse in einem Durchlauf
         durchlaeufe,     ← Anzahl begonnener Durchläufe (der laufende zählt mit)
         regenbogen       ← Anzahl gefundener Regenbogenfelder
       },
       lauf: {            ← Werte des laufenden Durchlaufs
         treffer,         ← höchster Einzeltreffer in diesem Durchlauf
         muenzenStart,    ← Münzen zu Beginn (gesammelt = jetzt − Start)
         vorher: { level, treffer, bosse }  ← Rekorde zu Beginn (für "Neuer Rekord!")
       },
       ende,              ← null oder die Zusammenfassung des gerade beendeten
                            Durchlaufs (Niederlage oder aufgegeben). Solange sie
                            da ist, ruht das Spiel – erst neuerDurchlauf() geht
                            weiter. Der Rest des Spielstands ist dann schon
                            auf Anfang (Level 1, ohne Verbesserungen und Bücher).
       extras: {}          ← frei für spätere Erweiterungen
     }
     raetsel = null bedeutet: Es muss ein neues Sudoku ausgelost werden.
     ------------------------------------------------------------------------ */

  /** Rekorde eines ganz neuen Abenteuers (der erste Durchlauf läuft schon). */
  function neueRekorde() {
    return { level: 1, treffer: 0, bosse: 0, durchlaeufe: 1, regenbogen: 0 };
  }

  /** Werte für einen beginnenden Durchlauf (Rekorde zu Beginn merken). */
  function neuerLauf(muenzen, rekorde) {
    return { treffer: 0, muenzenStart: muenzen,
      vorher: { level: rekorde.level, treffer: rekorde.treffer, bosse: rekorde.bosse } };
  }

  function neuerZustand() {
    return {
      version: VERSION,
      bossNummer: 1,
      bossHp: maxHp(1),
      leben: K.startLeben,
      muenzen: 0,
      muenzRest: 0,
      rekord: 0,            // höchster besiegter Boss
      verbesserungen: {},
      plaetze: [],          // Reihenfolge der belegten Plätze (das Buch aus dem Spin zuerst)
      auswahl: null,
      auswahlAnzahl: 0,
      auswahlGrund: "boss",
      freieWahl: 0,
      elite: null,          // Boss 1 ist nie ein Elite-Boss (abstand ≥ 2)
      vorigeSelten: null,
      faehigkeit: neueFaehigkeit(1),
      buecher: {},            // leer → Buch-Spin (siehe buchSpin)
      buchBonus: 0,
      buchSchlaege: [],
      buchSchlagOffen: [],
      raetsel: null,
      rekorde: neueRekorde(),
      lauf: neuerLauf(0, neueRekorde()),
      ende: null,
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
   * Version 2 (ohne Verbesserungen) und Version 3 (ohne Elite-Bosse). Werte
   * der früheren Kombo (bis Version 9) werden einfach nicht mehr übernommen.
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
    const vorV7 = roh.version < 7;
    const vorV8 = roh.version < 8;
    const vorV9 = roh.version < 9;
    const vorV10 = roh.version < 10;
    const vorV11 = roh.version < 11;
    const vorV12 = roh.version < 12;

    // Bücher (Version 7: eigene Kategorie bis Stufe 5, Version 8: Teil der
    // Verbesserungen bis Stufe 10). Mehr als maxBuecher → die mit der höchsten
    // Stufe bleiben. Keins → beim nächsten Öffnen der Buch-Spin.
    let buecher = {};
    if (!vorV7 && roh.buecher && typeof roh.buecher === "object") {
      for (const id in roh.buecher) {
        if (buchInfo(id) && istGanzzahl(roh.buecher[id], 1, K.buchGrundwirkung.maxStufe)) buecher[id] = roh.buecher[id];
      }
      buecher = buecherBegrenzen(buecher);
    }
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
          if (id === K.muenzbeutel.id) return angebot.indexOf(id) === i;
          if (istBuch(id)) return angebot.indexOf(id) === i;     // Bücher: siehe unten (Grenzen)
          const v = verbesserungInfo(id);
          return v && (stufen[id] || 0) < v.maxStufe && angebot.indexOf(id) === i;
        });
      if (!gueltig) return { ok: false, fehler: "Abenteuer: ungültige Auswahl an Verbesserungen." };
      // Bücher, die nicht mehr gewählt werden können (ausgereizt, schon 3 andere), fallen heraus
      const anzahlBuecher = Object.keys(buecher).length;
      for (let k = angebot.length - 1; k >= 0; k--) {
        const id = angebot[k];
        if (!istBuch(id)) continue;
        const stufe = buecher[id] || 0;
        if (stufe >= K.buchGrundwirkung.maxStufe || (stufe === 0 && anzahlBuecher >= K.buchGrundwirkung.maxBuecher)) angebot.splice(k, 1);
      }
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
        // bis Version 8 galt eine andere HP-Formel (die Bossnummer wird jetzt zum Level)
        !istGanzzahl(roh.bossHp, 1, vorV9 ? alteMaxHp(roh.bossNummer) : maxHp(roh.bossNummer)) ||
        !istGanzzahl(leben, 1, werte.maxLeben) ||
        !istGanzzahl(muenzen, 0, 1e9) ||
        !istGanzzahl(roh.rekord, 0, 1e6) ||
        typeof muenzRest !== "number" || !(muenzRest >= 0 && muenzRest < 1)) {
      return { ok: false, fehler: "Abenteuer: ungültige Werte für Boss, HP, Leben, Münzen oder Rekord." };
    }

    // Elite-Boss: seltene Eigenschaft aus dem Spielstand – fehlt sie (älterer
    // Stand) oder passt sie nicht zum Boss, wird sie jetzt ausgelost
    const vorigeSelten = !vorV4 && seltenInfo(roh.vorigeSelten) ? roh.vorigeSelten : null;
    let elite = null;
    let bossHp = roh.bossHp;
    if (vorV9) {
      // Alter Stand: HP anteilig auf die neue Formel umrechnen – ein voller
      // Boss (auch ein Elite-Boss aus Version 3 mit normalen HP) bleibt voll
      const alt = alteMaxHp(roh.bossNummer);
      const voll = bossHp === alt || (vorV4 && istElite(roh.bossNummer) && bossHp === 80 + (roh.bossNummer - 1) * 20);
      bossHp = voll ? maxHp(roh.bossNummer)
        : Math.max(1, Math.min(maxHp(roh.bossNummer), Math.round(bossHp / alt * maxHp(roh.bossNummer))));
    }
    if (istElite(roh.bossNummer)) {
      const e = vorV4 ? null : roh.elite;
      if (e && e.nummer === roh.bossNummer && seltenInfo(e.selten) && istGanzzahl(e.treffer, 0, 1e6)) {
        elite = { nummer: e.nummer, selten: e.selten, treffer: e.treffer };
      } else {
        elite = { nummer: roh.bossNummer, selten: loseSelten(vorigeSelten, zufall || Math.random), treffer: 0 };
      }
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

    // Fähigkeit des Bosses (Version 12; Version 6 bis 11: "gegenangriff" mit
    // den damaligen Angriffen). Zähler, der nicht passt → von vorn. Laufende
    // Wirkungen nur in einem laufenden Sudoku und nur von der Fähigkeit, die
    // der Boss JETZT hat – alte Eigenheiten und Angriffe fallen weg.
    const faehigkeit = neueFaehigkeit(roh.bossNummer);
    const alt = vorV6 ? null : vorV12 ? roh.gegenangriff : roh.faehigkeit;
    const eigene = faehigkeitVonBoss(roh.bossNummer);
    if (alt && typeof alt === "object") {
      if (istGanzzahl(alt.zaehler, 1, Math.max(1, faehigkeit.zaehler))) faehigkeit.zaehler = alt.zaehler;
      if (eigene && Array.isArray(alt.wirkungen) && raetsel && !raetsel.geloest) {
        faehigkeit.wirkungen = alt.wirkungen.filter(function (w) {
          if (!w || w.id !== eigene.id || !w.daten || typeof w.daten !== "object") return false;
          const rest = eigene.dauer === null ? w.rest === null : istGanzzahl(w.rest, 1, eigene.dauer);
          return rest && (!eigene.gueltig || eigene.gueltig(w.daten, eigene));
        }).slice(0, 1).map(function (w) { return { id: w.id, rest: w.rest, daten: Object.assign({}, w.daten) }; });
      }
    }
    // Plätze: Reihenfolge der Verbesserungen und Bücher (neu in Version 10;
    // ältere Stände: Bücher zuerst – das Buch aus dem Spin –, dann die übrigen)
    const besitzt = function (id) { return istBuch(id) ? buecher[id] > 0 : stufen[id] > 0; };
    let plaetze = !vorV10 && Array.isArray(roh.plaetze) ? roh.plaetze.filter(function (id, i) {
      return typeof id === "string" && besitzt(id) && roh.plaetze.indexOf(id) === i;
    }) : [];
    Object.keys(buecher).concat(Object.keys(stufen)).forEach(function (id) {
      if (plaetze.indexOf(id) === -1) plaetze.push(id);
    });
    // Mehr Verbesserungen als Plätze (z. B. alter Stand)? Dann wählt man beim
    // Laden selbst, welche bleiben (siehe mussBehalten) – und die freie
    // Ersatzwahl für eine entfernte Verbesserung entfällt (kein Platz frei).
    if (plaetze.length > K.plaetze) freieWahl = 0;

    // Laufende Buch-Werte (nur mit Sudoku)
    let buchBonus = 0, buchSchlaege = [], buchSchlagOffen = [];
    if (!vorV7) {
      if (typeof roh.buchBonus === "number" && roh.buchBonus >= 0 && roh.buchBonus < 100 && raetsel) buchBonus = roh.buchBonus;
      if (Array.isArray(roh.buchSchlaege) && raetsel) buchSchlaege = roh.buchSchlaege.filter(function (id) { return buchInfo(id); });
      if (Array.isArray(roh.buchSchlagOffen)) {
        buchSchlagOffen = roh.buchSchlagOffen.filter(function (o) {
          return o && buchInfo(o.id) && istGanzzahl(o.schaden, 1, 1e7) && Array.isArray(o.felder);
        }).map(function (o) { return { id: o.id, schaden: o.schaden, felder: o.felder.filter(function (i) { return istGanzzahl(i, 0, 80); }) }; });
      }
    }

    // Rekorde, laufender Durchlauf, Ende (neu in Version 11). Ältere Stände:
    // Der bisherige Durchlauf läuft einfach weiter; die Rekorde kommen aus
    // dem, was der Stand hergibt (erreichtes Level, besiegte Bosse).
    const rekorde = pruefeRekorde(vorV11 ? null : roh.rekorde, roh.bossNummer, roh.rekord);
    const lauf = pruefeLauf(vorV11 ? null : roh.lauf, muenzen, rekorde);
    const ende = vorV11 ? null : pruefeEnde(roh.ende);

    return {
      ok: true,
      ergaenzt: vorV12,
      daten: {
        version: VERSION,
        bossNummer: roh.bossNummer,
        bossHp: bossHp,
        leben: leben,
        muenzen: muenzen,
        muenzRest: muenzRest,
        rekord: roh.rekord,
        verbesserungen: stufen,
        plaetze: plaetze,
        auswahl: auswahl,
        auswahlAnzahl: auswahlAnzahl,
        auswahlGrund: auswahl ? auswahlGrund : "boss",
        freieWahl: freieWahl,
        elite: elite,
        vorigeSelten: vorigeSelten,
        faehigkeit: faehigkeit,
        buecher: buecher,
        buchBonus: buchBonus,
        buchSchlaege: buchSchlaege,
        buchSchlagOffen: buchSchlagOffen,
        raetsel: raetsel,
        rekorde: rekorde,
        lauf: lauf,
        ende: ende,
        extras: roh.extras && typeof roh.extras === "object" ? roh.extras : {},
      },
    };
  }

  /**
   * Rekorde aus dem Spielstand – fehlen sie (vor Version 11) oder sind sie
   * beschädigt, aus Bossnummer und Rekord (höchster besiegter Boss) ableiten.
   * Nie kleiner als das, was der Stand selbst zeigt.
   */
  function pruefeRekorde(r, bossNummer, rekord) {
    const zahl = function (wert, standard) { return istGanzzahl(wert, 0, 1e9) ? wert : standard; };
    const gueltig = r && typeof r === "object";
    return {
      level: Math.max(bossNummer, rekord + 1, gueltig ? zahl(r.level, 1) : 1),
      treffer: gueltig ? zahl(r.treffer, 0) : 0,
      bosse: Math.max(rekord, gueltig ? zahl(r.bosse, 0) : 0),
      durchlaeufe: Math.max(1, gueltig ? zahl(r.durchlaeufe, 1) : 1),
      regenbogen: gueltig ? zahl(r.regenbogen, 0) : 0,
    };
  }

  /** Werte des laufenden Durchlaufs – fehlen sie, beginnt die Zählung jetzt. */
  function pruefeLauf(l, muenzen, rekorde) {
    const zahl = function (wert) { return istGanzzahl(wert, 0, 1e9); };
    if (!l || typeof l !== "object" || !zahl(l.treffer) || !zahl(l.muenzenStart) ||
        !l.vorher || !zahl(l.vorher.level) || !zahl(l.vorher.treffer) || !zahl(l.vorher.bosse)) {
      // (Älterer Stand: Was er bisher erreicht hat, gilt nicht als "neuer Rekord".)
      return neuerLauf(muenzen, rekorde);
    }
    return { treffer: l.treffer, muenzenStart: Math.min(l.muenzenStart, muenzen),
      vorher: { level: l.vorher.level, treffer: l.vorher.treffer, bosse: l.vorher.bosse } };
  }

  /** Zusammenfassung eines beendeten Durchlaufs – beschädigt → null. */
  function pruefeEnde(e) {
    const zahl = function (wert, min) { return istGanzzahl(wert, min || 0, 1e9); };
    if (!e || typeof e !== "object" || ["niederlage", "aufgegeben"].indexOf(e.grund) === -1 ||
        !zahl(e.bossNummer, 1) || !zahl(e.bosse) || !zahl(e.treffer) || !zahl(e.muenzen) ||
        !zahl(e.durchlauf, 1) || !Array.isArray(e.gesammelt) || !Array.isArray(e.neueRekorde)) {
      return null;
    }
    return {
      grund: e.grund, bossNummer: e.bossNummer, bosse: e.bosse, treffer: e.treffer,
      muenzen: e.muenzen, durchlauf: e.durchlauf,
      gesammelt: e.gesammelt.filter(function (g) {
        if (!g || typeof g.id !== "string" || !zahl(g.stufe, 1)) return false;
        return istBuch(g.id) ? Boolean(buchInfo(g.id)) : Boolean(verbesserungInfo(g.id));
      }).map(function (g) { return { id: g.id, stufe: g.stufe }; }),
      neueRekorde: e.neueRekorde.filter(function (k) { return ["level", "treffer", "bosse"].indexOf(k) !== -1; }),
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

    // Ein älterer Stand wird dabei ergänzt (Leben, Münzen, Power-ups, Plätze …)
    const geladen = pruefeDaten(speicher.laden(), zufall);
    let zustand = geladen.ok ? geladen.daten : neuerZustand();
    if (!zustand.elite && istElite(zustand.bossNummer)) eliteAuslosen();   // nur wenn Level 1 ein Elite-Level wäre
    freieWahlStarten();      // z. B. Ersatz für "Starkes Gift" (falls gerade keine andere Wahl offen ist)
    // Offene Buchschläge (Neuladen, nachdem der nächste Boss schon erschienen ist)
    // treffen ihn jetzt – die Oberfläche hört hier noch nicht zu, sie zeigt den Stand
    offeneBuchschlaegeAusfuehren();
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

    /** Alle Modifikatoren für die Schadensberechnung: seltene Eigenschaft, Erweiterungen. */
    function modifikatoren(boss) {
      const liste = [];
      if (boss.selten && boss.selten.wirkung.schaden) liste.push(boss.selten.wirkung.schaden);
      erweiterungen.forEach(function (erw) { if (erw.schaden) liste.push(erw.schaden); });
      return liste;
    }

    /** Lost einen Schwierigkeitsgrad nach Gewicht aus (Objekt aus der Engine-Liste). */
    function loseGrad() {
      return ziehe(Engine.SCHWIERIGKEITSGRADE, function (g) { return belohnung(g.id).gewicht; }, zufall);
    }

    /* ---------- Plätze ---------- */

    /** Besitzt man diese Verbesserung bzw. dieses Buch? */
    function besitzt(id) {
      return istBuch(id) ? zustand.buecher[id] > 0 : zustand.verbesserungen[id] > 0;
    }

    /** Belegte Plätze in ihrer Reihenfolge (ids von Verbesserungen und Büchern). */
    function belegtePlaetze() {
      const liste = zustand.plaetze.filter(besitzt);
      Object.keys(zustand.buecher).concat(Object.keys(zustand.verbesserungen)).forEach(function (id) {
        if (besitzt(id) && liste.indexOf(id) === -1) liste.push(id);
      });
      return liste;
    }

    /** Älterer Spielstand mit mehr Verbesserungen als Plätzen: erst auswählen, was bleibt. */
    function mussBehalten() {
      return belegtePlaetze().length > K.plaetze;
    }

    /**
     * Kann diese Karte gerade gewählt werden? Stufenaufstieg: nicht ausgereizt.
     * Neu: ein Platz ist frei (bei Büchern außerdem weniger als maxBuecher).
     */
    function istMoeglich(id) {
      if (id === K.muenzbeutel.id) return true;
      if (istBuch(id)) {
        const stufe = zustand.buecher[id] || 0;
        if (stufe > 0) return stufe < K.buchGrundwirkung.maxStufe;
        return belegtePlaetze().length < K.plaetze && Object.keys(zustand.buecher).length < K.buchGrundwirkung.maxBuecher;
      }
      const v = verbesserungInfo(id);
      const stufe = zustand.verbesserungen[id] || 0;
      if (!v || stufe >= v.maxStufe) return false;
      return stufe > 0 || belegtePlaetze().length < K.plaetze;
    }

    /**
     * Was kann gerade angeboten werden – und wie oft? Normale Verbesserungen,
     * Bücher (neu: Gewicht nach Seltenheit; Aufstieg: buchAufstieg). Neues gibt
     * es nur bei freiem Platz, Ausgereiztes fehlt.
     * @returns {{id, gewicht}[]}
     */
    function angebotsPool() {
      const g = K.auswahlGewichte;
      const pool = K.verbesserungen.filter(function (v) { return istMoeglich(v.id); })
        .map(function (v) { return { id: v.id, gewicht: g.verbesserung }; });
      K.buecher.forEach(function (b) {
        if (!istMoeglich(b.id)) return;
        pool.push({ id: b.id, gewicht: zustand.buecher[b.id] > 0 ? g.buchAufstieg : K.buchSeltenheiten[b.seltenheit].angebot });
      });
      return pool.filter(function (e) { return e.gewicht > 0; });
    }

    /**
     * Lost bis zu verbesserungAngebot verschiedene Karten aus (nach Gewicht,
     * ohne Zurücklegen). Reichen die Möglichkeiten nicht, füllt ein Münzbeutel
     * auf – ist alles ausgereizt, gibt es nur ihn.
     */
    function loseAngebot() {
      const pool = angebotsPool();
      const angebot = [];
      while (angebot.length < K.verbesserungAngebot && pool.length > 0) {
        const eintrag = ziehe(pool, function (e) { return e.gewicht; }, zufall);
        angebot.push(eintrag.id);
        pool.splice(pool.indexOf(eintrag), 1);
      }
      if (angebot.length < K.verbesserungAngebot) angebot.push(K.muenzbeutel.id);
      return angebot;
    }

    /**
     * Älterer Spielstand mit zu vielen Verbesserungen: Diese ids bleiben
     * (genau K.plaetze Stück, höchstens maxBuecher Bücher), alle übrigen fallen weg.
     * @returns {boolean} – false, wenn die Auswahl nicht passt
     */
    function behalteVerbesserungen(ids) {
      if (!mussBehalten() || !Array.isArray(ids)) return false;
      const alle = belegtePlaetze();
      const gueltig = ids.length === K.plaetze &&
        ids.every(function (id, i) { return alle.indexOf(id) !== -1 && ids.indexOf(id) === i; }) &&
        ids.filter(istBuch).length <= K.buchGrundwirkung.maxBuecher;
      if (!gueltig) return false;
      alle.forEach(function (id) {
        if (ids.indexOf(id) !== -1) return;
        if (istBuch(id)) delete zustand.buecher[id]; else delete zustand.verbesserungen[id];
      });
      zustand.plaetze = alle.filter(function (id) { return ids.indexOf(id) !== -1; });
      // Weniger Leben möglich (z. B. "Zähes Herz" abgelegt)?
      zustand.leben = Math.min(zustand.leben, werte().maxLeben);
      // Ein gespeichertes Angebot darf nur noch Mögliches enthalten
      if (zustand.auswahl) {
        const rest = zustand.auswahl.filter(istMoeglich);
        zustand.auswahl = rest.length > 0 ? rest : [K.muenzbeutel.id];
      }
      speichern();
      melde("behalten", { gesammelt: gesammeltAlles(), leben: zustand.leben, maxLeben: werte().maxLeben });
      return true;
    }

    /** Was bei einem Treffer gewirkt hat – deren Plätze leuchten in der Anzeige auf. */
    function wirksameVerbesserungen(w, rechnung, einheiten, buchWirkung, powerup) {
      const ids = [];
      if (rechnung.regenbogen) return ids;
      const hat = function (id) { return zustand.verbesserungen[id] > 0; };
      const schritt = function (anfang) { return rechnung.schritte.some(function (t) { return String(t).indexOf(anfang) === 0; }); };
      if (hat("wuerfel")) ids.push("wuerfel");                         // größerer Würfel: jeder Wurf
      if (hat("klinge") && schritt("Zuschlag")) ids.push("klinge");
      // Glückspilz: kritisch mit einer Augenzahl, die ohne ihn nicht kritisch wäre
      if (hat("glueck") && rechnung.kritisch && rechnung.wurf < w.wuerfelSeiten &&
          rechnung.wurf >= w.wuerfelSeiten - w.kritischeAugen + 1) ids.push("glueck");
      if (hat("reihenbrecher") && schritt("Reihenbrecher")) ids.push("reihenbrecher");
      if (hat("magnet")) ids.push("magnet");                           // Münzen je richtiger Zahl
      if (hat("schatzkarte") && powerup) ids.push("schatzkarte");
      if (buchWirkung.buch) ids.push(buchWirkung.buch.id);
      return ids;
    }

    /** Ein neues Sudoku übernehmen (nachdem die Oberfläche es erzeugt hat) – mit Power-up-Feldern. */
    function starteRaetsel(gradId, vorgaben, loesung) {
      if (zustand.ende) return false;          // Durchlauf vorbei: erst "Neuer Durchlauf"
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
      // Wirkungen enden mit dem Sudoku, der Fähigkeitszähler läuft weiter
      zustand.faehigkeit.wirkungen = [];
      // Buch-Bonus und Buchschläge gelten je Sudoku
      zustand.buchBonus = 0;
      zustand.buchSchlaege = [];
      speichern();
    }

    /**
     * Freie Ersatzwahl (für eine entfernte Verbesserung): Steht eine aus und ist
     * gerade keine andere Auswahl offen, stehen alle Verbesserungen zur Wahl, die
     * noch gewählt werden können – bei freiem Platz auch neue, sonst nur
     * Stufenaufstiege (auch der Bücher). Ist alles ausgereizt: der Münzbeutel.
     * @returns {boolean} – true, wenn jetzt eine freie Wahl offen ist
     */
    function freieWahlStarten() {
      if (!(zustand.freieWahl > 0) || zustand.auswahl || mussBehalten()) return false;
      zustand.freieWahl--;
      let moeglich = K.verbesserungen.map(function (v) { return v.id; }).filter(istMoeglich);
      if (belegtePlaetze().length >= K.plaetze) {
        moeglich = moeglich.concat(Object.keys(zustand.buecher).filter(istMoeglich));
      }
      if (moeglich.length === 0) moeglich = [K.muenzbeutel.id];
      zustand.auswahl = moeglich;
      zustand.auswahlAnzahl = 1;
      zustand.auswahlGrund = "frei";
      return true;
    }

    /** Daten für das Ereignis "neuerBoss" (auch nach dem Wählen einer Verbesserung). */
    function neuerBossDaten() {
      const boss = bossMitStand(zustand.bossNummer);
      return { boss: boss, hp: zustand.bossHp, leben: zustand.leben, maxLeben: werte().maxLeben, rekord: zustand.rekord,
        faehigkeitStand: faehigkeitAnzeige() };
    }

    /* ---------- Bücher ---------- */

    /** Alle gesammelten Verbesserungen und Bücher für die Plätze – in ihrer Reihenfolge. */
    function gesammeltAlles() {
      return belegtePlaetze().map(function (id) {
        return istBuch(id)
          ? buchFuerAnzeige(id, zustand.buecher[id])
          : Object.assign({ art: "verbesserung" }, verbesserungenFuerAnzeige([id], zustand.verbesserungen)[0]);
      });
    }

    /** Braucht das Abenteuer noch den Buch-Spin (noch kein Buch)? */
    function brauchtBuchSpin() {
      if (zustand.ende) return false;          // erst nach "Neuer Durchlauf"
      return K.buecher.length > 0 && Object.keys(zustand.buecher).length === 0;
    }

    /**
     * Buch-Spin: lost ein Buch aus (Stufe 1). Die Oberfläche zeigt dazu die
     * Slot-Walze. Gibt es schon ein Buch, passiert nichts.
     * @returns {object|null} – { buch (für die Anzeige), gesammelt }
     */
    function buchSpin() {
      if (!brauchtBuchSpin()) return null;
      const b = ziehBuchSpin(zufall);
      zustand.buecher[b.id] = 1;
      zustand.plaetze = [b.id].concat(zustand.plaetze.filter(function (id) { return id !== b.id; }));   // erster Platz
      speichern();
      return { buch: buchFuerAnzeige(b.id, 1), gesammelt: gesammeltAlles() };
    }

    /**
     * Buch-Wirkungen einer richtig gesetzten Ziffer: das Buch dieser Ziffer
     * (falls man es hat), Anstieg des Buch-Bonus, Zusatzwirkung, Buchschlag?
     * @returns {{ buch, stufe, bonus, zusatz, schlaege: {id, schaden, felder}[] }}
     */
    function buchWirkungenFuer(r, ziffer) {
      const b = K.buecher.find(function (x) { return x.ziffer === ziffer && zustand.buecher[x.id] > 0; });
      if (!b) return { buch: null, stufe: 0, bonus: 0, zusatz: {}, schlaege: [] };
      const stufe = zustand.buecher[b.id];
      let komplett = true;
      const felder = [];
      for (let i = 0; i < 81; i++) {
        if (r.loesung[i] === ziffer) {
          felder.push(i);
          if ((r.vorgaben[i] || r.eingaben[i]) !== ziffer) komplett = false;
        }
      }
      // Buchschlag: diese Zahl hat die Ziffer komplett gemacht (also selbst gesetzt) – einmal je Sudoku
      const schlaege = komplett && zustand.buchSchlaege.indexOf(b.id) === -1
        ? [{ id: b.id, schaden: buchSchadenFuer(stufe), felder: felder }] : [];
      return { buch: b, stufe: stufe, bonus: buchBonusFuer(stufe), zusatz: K.buchZusaetze[b.zusatz] || {}, schlaege: schlaege };
    }

    /** Daten für das Ereignis "buchschlag". */
    function buchschlagEreignis(s, boss, hpVorher, naechsterBoss) {
      const b = buchInfo(s.id);
      return {
        buch: { id: b.id, name: b.name, ziffer: b.ziffer, seltenheit: b.seltenheit, stufe: zustand.buecher[b.id] || 1 },
        schaden: s.schaden, felder: s.felder, boss: boss,
        hpVorher: hpVorher, hpNachher: zustand.bossHp,
        besiegt: zustand.bossHp === 0, naechsterBoss: Boolean(naechsterBoss),
        eliteBonus: 0, muenzen: zustand.muenzen, leben: zustand.leben, maxLeben: werte().maxLeben,
      };
    }

    /**
     * Boss besiegt: Rekord, nächster Boss, Leben auffüllen, Verbesserungen
     * anbieten, neuer Fähigkeitszähler. Elite-Boss: Extra-Münzen, mehr Wahlen.
     * @returns {number} – Elite-Bonus (Münzen)
     */
    function bossBesiegtAnwenden(bossVorher) {
      let eliteBonus = 0;
      if (bossVorher.elite) {
        eliteBonus = K.elite.muenzen;
        zustand.muenzen += eliteBonus;
        if (zustand.elite) zustand.vorigeSelten = zustand.elite.selten;
      }
      zustand.rekord = Math.max(zustand.rekord, bossVorher.nummer);
      zustand.bossNummer++;
      rekordeNachSieg();
      eliteAuslosen();
      zustand.bossHp = maxHp(zustand.bossNummer);
      zustand.leben = Math.max(zustand.leben, K.lebenNachBoss);
      zustand.auswahl = loseAngebot();
      zustand.auswahlAnzahl = zustand.auswahl
        ? Math.min(zustand.auswahl.length, bossVorher.elite ? Math.max(1, K.elite.verbesserungenWaehlen) : 1)
        : 0;
      // Der neue Boss beginnt seinen Fähigkeitszähler von vorn; laufende
      // Wirkungen verfallen mit dem besiegten Boss
      zustand.faehigkeit = neueFaehigkeit(zustand.bossNummer);
      return eliteBonus;
    }

    /**
     * Buchschläge, die auf den nächsten Boss warten, treffen ihn – sobald er
     * erschienen ist (also keine Verbesserungsauswahl mehr offen ist). Besiegt
     * ein Buchschlag auch ihn, geht es mit dem normalen Ablauf weiter.
     */
    function offeneBuchschlaegeAusfuehren() {
      while (zustand.buchSchlagOffen.length > 0 && !zustand.auswahl) {
        const s = zustand.buchSchlagOffen.shift();
        const boss = bossMitStand(zustand.bossNummer);
        const hpVorher = zustand.bossHp;
        zustand.bossHp = Math.max(0, hpVorher - s.schaden);
        const ereignis = buchschlagEreignis(s, boss, hpVorher, true);
        if (ereignis.besiegt) {
          ereignis.eliteBonus = bossBesiegtAnwenden(boss);
          ereignis.muenzen = zustand.muenzen;
          ereignis.leben = zustand.leben;
        }
        speichern();
        melde("buchschlag", ereignis);
        if (ereignis.besiegt) {
          melde("bossBesiegt", { boss: boss, rekord: zustand.rekord, elite: boss.elite, eliteBonus: ereignis.eliteBonus });
          if (zustand.auswahl) melde("auswahl", auswahlInfo());
          else melde("neuerBoss", neuerBossDaten());
        }
      }
    }

    /* ---------- Fähigkeit des Bosses ---------- */

    /** Stand der Fähigkeit für die Anzeige (eine Kopie – Ereignisse bleiben unverändert). */
    function faehigkeitAnzeige() {
      const fs = zustand.faehigkeit;
      return {
        faehigkeit: faehigkeitFuerAnzeige(faehigkeitVonBoss(zustand.bossNummer), zustand.bossNummer),
        zaehler: fs.zaehler,
        warnung: fs.zaehler <= K.faehigkeit.warnungAb,
        // Der nächste Zug löst die Fähigkeit aus: Eine fertige Einheit in diesem Zug pariert
        paradeMoeglich: fs.zaehler === 1,
        wirkungen: fs.wirkungen.map(function (w) {
          const f = faehigkeitInfo(w.id);
          return { id: w.id, name: f.name, symbol: f.symbol, farbe: f.farbe, rest: w.rest,
            sekunden: f.sekunden || null, warnungSekunden: f.warnungSekunden || null,
            daten: Object.assign({}, w.daten) };
        }),
      };
    }

    /** Ist Feld i gerade versiegelt (dort kann man nichts setzen)? */
    function istVersiegelt(i) {
      return feldWirkung(zustand.faehigkeit.wirkungen, i) === "versiegelt";
    }

    /** Der laufende Timer (eine Wirkung mit daten.restMs) oder null. */
    function laufenderTimer() {
      return zustand.faehigkeit.wirkungen.find(function (w) { return w.rest === null && typeof w.daten.restMs === "number"; }) || null;
    }

    /**
     * Ein Zug ist vorbei (richtige oder falsche Zahl): Wirkungen mit Zugdauer
     * laufen ab, der Zähler sinkt. Bei 0 setzt der Boss seine Fähigkeit ein.
     * @param {boolean} einheitFertig – hat dieser Zug eine Zeile, Spalte oder einen Block vervollständigt?
     * @returns {object|null} – Daten für das Ereignis "faehigkeit" (oder null)
     */
    function zugVorbei(boss, einheitFertig) {
      const fs = zustand.faehigkeit;
      const r = zustand.raetsel;
      fs.wirkungen.forEach(function (w) { if (w.rest !== null) w.rest--; });
      fs.wirkungen = fs.wirkungen.filter(function (w) { return w.rest === null || w.rest > 0; });
      // Sind alle leeren Felder versiegelt, bricht das Siegel – sonst ginge es nicht weiter
      if (r && !r.geloest) {
        let frei = false, leer = false;
        for (let i = 0; i < 81; i++) {
          if (r.vorgaben[i] === 0 && r.eingaben[i] === 0) { leer = true; if (!istVersiegelt(i)) frei = true; }
        }
        if (leer && !frei) {
          fs.wirkungen = fs.wirkungen.filter(function (w) {
            for (let i = 0; i < 81; i++) if (feldWirkung([w], i) === "versiegelt") return false;
            return true;
          });
        }
      }
      const f = faehigkeitVonBoss(zustand.bossNummer);
      if (!f) return null;
      fs.zaehler--;
      if (fs.zaehler > 0) return null;
      return einsetzen(f, boss, einheitFertig);
    }

    /**
     * Der Boss setzt seine Fähigkeit ein. Hat derselbe Zug eine Einheit
     * vervollständigt, pariert der Held – sonst wirkt sie (oder verpufft).
     */
    function einsetzen(f, boss, pariert) {
      const fs = zustand.faehigkeit;
      const r = zustand.raetsel;
      fs.zaehler = faehigkeitAbstand(zustand.bossNummer);
      const ereignis = {
        boss: boss, faehigkeit: faehigkeitFuerAnzeige(f, zustand.bossNummer),
        pariert: false, verpufft: false, text: "", wirkung: null,
      };
      if (pariert) {
        ereignis.pariert = true;
        ereignis.text = "Pariert!";
      } else if (!r || r.geloest) {
        ereignis.verpufft = true;                 // ohne laufendes Sudoku gibt es nichts zu treffen
      } else {
        const leer = function (i) { return r.vorgaben[i] === 0 && r.eingaben[i] === 0; };
        const a = {
          zustand: zustand, raetsel: r, zufall: zufall, eintrag: f,
          waehle: function (liste) { return liste[Math.floor(zufall() * liste.length)]; },
          leer: leer,
          frei: function (i) { return leer(i) && feldWirkung(fs.wirkungen, i) === null; },
          blockFelder: function (b) {
            const felder = [];
            for (let k = 0; k < 9; k++) felder.push((Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3));
            return felder;
          },
        };
        const ergebnis = f.wirkung(a);
        if (!ergebnis) {
          ereignis.verpufft = true;
        } else {
          ereignis.text = ergebnis.text;
          // Dieselbe Wirkung läuft noch? Dann wird sie ersetzt (beginnt von vorn).
          fs.wirkungen = fs.wirkungen.filter(function (w) { return w.id !== f.id; });
          fs.wirkungen.push({ id: f.id, rest: f.dauer, daten: ergebnis.daten });
          ereignis.wirkung = { id: f.id, rest: f.dauer, daten: Object.assign({}, ergebnis.daten) };
        }
      }
      if (ereignis.verpufft) ereignis.text = f.name + " verpufft";
      return ereignis;
    }

    /**
     * Tick, Tick: Zeit vergeht (die Oberfläche meldet sie nur, solange das
     * Spiel sichtbar ist und keine Überlagerung offen ist). Gespeichert wird
     * die Restzeit jede volle Sekunde. Läuft der Timer ab, kostet er Leben –
     * beim letzten Leben ist der Durchlauf vorbei.
     * @param {number} ms – vergangene Millisekunden
     * @returns {object|null} – { restMs } solange er läuft, das Ereignis "timer"
     *   beim Ablauf, null ohne laufenden Timer
     */
    function timerVergeht(ms) {
      if (zustand.ende || zustand.auswahl || mussBehalten() || !(ms > 0)) return null;
      const w = laufenderTimer();
      if (!w) return null;
      const sekundeVorher = Math.ceil(w.daten.restMs / 1000);
      w.daten.restMs = Math.max(0, Math.round(w.daten.restMs - ms));
      if (w.daten.restMs > 0) {
        if (Math.ceil(w.daten.restMs / 1000) !== sekundeVorher) speichern();
        return { restMs: w.daten.restMs };
      }
      // Abgelaufen: Timer weg, Leben weg
      const f = faehigkeitInfo(w.id);
      const boss = bossMitStand(zustand.bossNummer);
      zustand.faehigkeit.wirkungen = zustand.faehigkeit.wirkungen.filter(function (x) { return x !== w; });
      const lebenVorher = zustand.leben;
      zustand.leben = Math.max(0, zustand.leben - f.leben);
      const ereignis = {
        boss: boss, faehigkeit: faehigkeitFuerAnzeige(f, zustand.bossNummer), feld: w.daten.feld,
        lebenVorher: lebenVorher, leben: zustand.leben, maxLeben: werte().maxLeben,
        niederlage: zustand.leben <= 0, stand: faehigkeitAnzeige(),
      };
      const niederlage = ereignis.niederlage ? durchlaufBeenden("niederlage", boss) : null;
      speichern();
      melde("timer", ereignis);
      if (niederlage) melde("niederlage", niederlage);
      return ereignis;
    }

    /* ---------- Durchlauf ---------- */

    /** Ist der Durchlauf vorbei (Zusammenfassung offen)? Dann ruht das Spiel bis neuerDurchlauf(). */
    function durchlaufVorbei() {
      return zustand.ende !== null;
    }

    /** Ein neuer Boss ist erreicht: Rekorde für Level und besiegte Bosse nachziehen. */
    function rekordeNachSieg() {
      zustand.rekorde.level = Math.max(zustand.rekorde.level, zustand.bossNummer);
      zustand.rekorde.bosse = Math.max(zustand.rekorde.bosse, zustand.rekord);
    }

    /**
     * Beendet den Durchlauf (Niederlage oder aufgegeben): Die Zusammenfassung
     * wird festgehalten, alles andere geht auf Anfang – Welt 1, Level 1,
     * Boss-HP, Leben und Lebensmaximum, Verbesserungen, Bücher, Fähigkeitszähler,
     * laufende Wirkungen und das Sudoku samt Power-ups. Münzen und Rekorde
     * bleiben. Weiter geht es erst mit neuerDurchlauf() (dann Buch-Spin und
     * Auslosung der Schwierigkeit wie bei einem frischen Abenteuer).
     * @returns {object} – Daten für die Ereignisse "niederlage" / "aufgegeben"
     */
    function durchlaufBeenden(grund, boss) {
      const lauf = zustand.lauf;
      zustand.ende = {
        grund: grund,
        bossNummer: boss.nummer,
        bosse: zustand.rekord,                       // besiegte Bosse in diesem Durchlauf
        treffer: lauf.treffer,
        muenzen: Math.max(0, zustand.muenzen - lauf.muenzenStart),
        durchlauf: zustand.rekorde.durchlaeufe,
        gesammelt: belegtePlaetze().map(function (id) {
          return { id: id, stufe: istBuch(id) ? zustand.buecher[id] : zustand.verbesserungen[id] };
        }),
        // In diesem Durchlauf übertroffen (Durchläufe und Regenbogenfelder sind Zähler)
        neueRekorde: ["level", "treffer", "bosse"].filter(function (k) { return zustand.rekorde[k] > lauf.vorher[k]; }),
      };
      const bleibt = {
        muenzen: zustand.muenzen, muenzRest: zustand.muenzRest,
        rekorde: zustand.rekorde, ende: zustand.ende, extras: zustand.extras,
      };
      zustand = Object.assign(neuerZustand(), bleibt);
      zustand.lauf = neuerLauf(zustand.muenzen, zustand.rekorde);
      if (istElite(1)) eliteAuslosen();          // nur wenn Level 1 ein Elite-Level wäre
      return Object.assign({ boss: boss }, zusammenfassung());
    }

    /**
     * Zusammenfassung des beendeten Durchlaufs für die Anzeige (null, wenn
     * keiner beendet ist): Boss mit seinem Satz, erreichtes Level, besiegte
     * Bosse, höchster Treffer, gesammelte Münzen, Verbesserungen und Bücher
     * zum Schluss, neue Rekorde und alle Rekorde.
     */
    function zusammenfassung() {
      const e = zustand.ende;
      if (!e) return null;
      const boss = bossInfo(e.bossNummer);
      return {
        grund: e.grund,
        boss: boss,
        satz: e.grund === "niederlage" ? boss.sieg : "",
        bosse: e.bosse,
        treffer: e.treffer,
        muenzen: e.muenzen,
        muenzenGesamt: zustand.muenzen,
        durchlauf: e.durchlauf,
        gesammelt: e.gesammelt.map(function (g) {
          if (istBuch(g.id)) return buchFuerAnzeige(g.id, g.stufe);
          const stufen = {}; stufen[g.id] = g.stufe;
          return Object.assign({ art: "verbesserung" }, verbesserungenFuerAnzeige([g.id], stufen)[0]);
        }),
        neueRekorde: e.neueRekorde.slice(),
        rekorde: Object.assign({}, zustand.rekorde),
      };
    }

    /** Nach der Zusammenfassung: Der nächste Durchlauf beginnt (zählt mit). */
    function neuerDurchlauf() {
      if (!zustand.ende) return false;
      zustand.ende = null;
      zustand.rekorde.durchlaeufe++;
      zustand.lauf = neuerLauf(zustand.muenzen, zustand.rekorde);
      speichern();
      melde("neuerDurchlauf", { boss: bossMitStand(zustand.bossNummer), durchlauf: zustand.rekorde.durchlaeufe });
      return true;
    }

    /**
     * "Durchlauf aufgeben": endet wie eine Niederlage (mit Zusammenfassung).
     * @returns {object|null} – die Zusammenfassung (null, wenn schon vorbei)
     */
    function aufgeben() {
      if (zustand.ende) return null;
      const daten = durchlaufBeenden("aufgegeben", bossMitStand(zustand.bossNummer));
      speichern();
      melde("aufgegeben", daten);
      return daten;
    }

    /** Falsche Zahl → ein Leben weg (Zahl und Power-up bleiben), der Zug zählt. */
    function falscheZahl(index, ziffer) {
      const boss = bossMitStand(zustand.bossNummer);
      zustand.leben--;
      const ereignis = {
        index: index, ziffer: ziffer, boss: boss,
        leben: Math.max(0, zustand.leben), startLeben: K.startLeben, maxLeben: werte().maxLeben,
        hp: zustand.bossHp, muenzen: zustand.muenzen,
      };

      if (zustand.leben <= 0) {
        // Niederlage – der Boss setzt seine Fähigkeit dann nicht mehr ein
        ereignis.faehigkeitStand = faehigkeitAnzeige();
        const niederlage = durchlaufBeenden("niederlage", boss);
        speichern();
        melde("fehler", ereignis);
        melde("niederlage", niederlage);
        return { art: "fehler", niederlage: true, faehigkeit: null };
      }
      // Fähigkeit: Auch eine falsche Zahl zählt als Zug
      const einsatz = zugVorbei(boss, false);      // eine falsche Zahl vervollständigt nichts
      ereignis.faehigkeitStand = anzeigeVorEinsatz(einsatz);
      if (einsatz) einsatz.stand = faehigkeitAnzeige();
      speichern();
      melde("fehler", ereignis);
      if (einsatz) melde("faehigkeit", einsatz);
      return { art: "fehler", niederlage: false, faehigkeit: einsatz };
    }

    /**
     * Stand für die Anzeige direkt nach dem Zug, aber VOR dem Einsatz der
     * Fähigkeit (Zähler auf 0, damit "jetzt" angezeigt wird, bis sie abgespielt ist).
     */
    function anzeigeVorEinsatz(einsatz) {
      const stand = faehigkeitAnzeige();
      if (einsatz) {
        stand.zaehler = 0;
        stand.warnung = true;
        // Die neue Wirkung erscheint erst mit dem Einsatz
        if (einsatz.wirkung) stand.wirkungen = stand.wirkungen.filter(function (w) { return w.id !== einsatz.wirkung.id; });
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
      if (zustand.ende) return { art: "durchlauf-vorbei" };    // erst "Neuer Durchlauf"
      const r = zustand.raetsel;
      if (zustand.auswahl) return { art: "auswahl-offen" };     // erst eine Verbesserung wählen
      if (mussBehalten()) return { art: "auswahl-offen" };      // erst wählen, welche Verbesserungen bleiben
      if (!r || r.geloest) return { art: "kein-raetsel" };
      // Vorgaben und schon richtig gesetzte Zahlen sind gesperrt
      if (r.vorgaben[index] !== 0 || r.eingaben[index] !== 0) return { art: "gesperrt" };
      if (!istGanzzahl(ziffer, 1, 9)) return { art: "gesperrt" };
      // Siegel des Bosses: Hier kann gerade nichts gesetzt werden (zählt nicht als Zug)
      if (istVersiegelt(index)) return { art: "versiegelt" };
      // Fluch des Bosses: Diese Ziffer kann gerade nicht gesetzt werden (zählt nicht als Zug)
      if (zifferWirkung(zustand.faehigkeit.wirkungen, ziffer) === "verflucht") return { art: "verflucht", ziffer: ziffer };

      if (ziffer !== r.loesung[index]) return falscheZahl(index, ziffer);

      // ---- Richtige Zahl → eintragen (gesperrt)
      r.eingaben[index] = ziffer;
      // Tick, Tick: Die richtige Zahl im Timerfeld entschärft den Timer
      const timer = laufenderTimer();
      const entschaerft = Boolean(timer && timer.daten.feld === index);
      if (entschaerft) zustand.faehigkeit.wirkungen = zustand.faehigkeit.wirkungen.filter(function (x) { return x !== timer; });
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

      // 2b. Bücher: Buch-Bonus steigt (gilt schon für diese Zahl), Zusatzwirkung, Buchschlag?
      const buchWirkung = buchWirkungenFuer(r, ziffer);
      const zusatz = buchWirkung.zusatz;
      zustand.buchBonus = Math.round((zustand.buchBonus + buchWirkung.bonus) * 1e6) / 1e6;
      zustand.buchSchlaege = zustand.buchSchlaege.concat(buchWirkung.schlaege.map(function (sch) { return sch.id; }));
      if (zusatz.giftAnteil) effekt.giftAnteil += zusatz.giftAnteil;      // Buch des Sechsten

      // 3. Schaden – alles in der zentralen Berechnung.
      //    Regenbogenfeld: kein Wurf – der Boss ist sofort besiegt, egal wie
      //    viele HP er hat und welche seltene Eigenschaft er besitzt (auch Elite).
      const regenbogen = r.regenbogen === index;
      if (regenbogen) r.regenbogen = null;
      //    Würfel: einer – oder mehrere (Zusatzwirkung eines Buchs)
      const anzahlWuerfel = !regenbogen && zusatz.wuerfel ? zusatz.wuerfel.anzahl : 1;
      const wuerfe = [];
      if (!regenbogen) for (let k = 0; k < anzahlWuerfel; k++) wuerfe.push(1 + Math.floor(zufall() * w.wuerfelSeiten));
      const wuerfelModus = anzahlWuerfel > 1 ? zusatz.wuerfel.modus : null;
      // "hoechster": nur der höhere zählt (ein Würfel für die Rechnung)
      const wurf = regenbogen ? null : wuerfelModus === "hoechster" ? Math.max.apply(null, wuerfe) : wuerfe[0];
      const mods = modifikatoren(bossVorher);
      const rechnung = regenbogen ? {
        regenbogen: true, wurf: null, schaden: hpVorher, gift: 0, buchBonus: 0,
        kritisch: false, fehlschlag: false, immun: false,
        schritte: ["Regenbogenschlag"], text: "Regenbogenschlag = " + hpVorher,
      } : berechneSchaden({
        wurf: wurf, wuerfe: wuerfelModus === "summe" ? wuerfe : null,
        mindestwurf: zusatz.mindestwurf || 0, immerKritisch: Boolean(zusatz.immerKritisch),
        werte: w, buchBonus: zustand.buchBonus, grad: r.grad, doppelt: doppelt,
        einheiten: (einheiten.zeile ? 1 : 0) + (einheiten.spalte ? 1 : 0) + (einheiten.block ? 1 : 0),
        giftAnteil: effekt.giftAnteil,
        modifikatoren: mods,
        selten: bossVorher.selten, eliteTreffer: eliteTreffer,
      });
      if (!regenbogen) rechnung.regenbogen = false;
      const spruch = rechnung.fehlschlag
        ? K.fehlschlagSprueche[Math.floor(zufall() * K.fehlschlagSprueche.length)]
        : null;
      // Rekorde: höchster Einzeltreffer (Würfeltreffer samt Gift), gefundene Regenbogenfelder
      if (regenbogen) {
        zustand.rekorde.regenbogen++;
      } else {
        const einzel = rechnung.schaden + rechnung.gift;
        zustand.lauf.treffer = Math.max(zustand.lauf.treffer, einzel);
        zustand.rekorde.treffer = Math.max(zustand.rekorde.treffer, einzel);
      }
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
      //    Buch des Dritten: Münzen extra (ohne Münzfaktor)
      const buchMuenzen = zusatz.muenzen || 0;
      const muenzenPlus = Math.floor(mitRest) + buchMuenzen;
      zustand.muenzRest = Math.round((mitRest - Math.floor(mitRest)) * 1e6) / 1e6;
      zustand.muenzen += muenzenPlus;

      // 5. Leben (Power-up), höchstens bis zur Obergrenze
      const lebenVorher = zustand.leben;
      zustand.leben = Math.min(w.maxLeben, zustand.leben + effekt.leben);
      const lebenPlus = zustand.leben - lebenVorher;

      // 6. Buchschlag – nach dem normalen Treffer, durch nichts verändert.
      //    Hat schon der Treffer den Boss besiegt, trifft er den nächsten Boss,
      //    sobald dieser erschienen ist (buchSchlagOffen).
      const buchschlaege = [];
      buchWirkung.schlaege.forEach(function (sch) {
        if (zustand.bossHp > 0) {
          const hpVorBuch = zustand.bossHp;
          zustand.bossHp = Math.max(0, hpVorBuch - sch.schaden);
          buchschlaege.push(buchschlagEreignis(sch, bossVorher, hpVorBuch, false));
        } else {
          zustand.buchSchlagOffen.push(sch);
        }
      });

      // 7. Boss besiegt? → Rekord, nächster Boss, Leben auffüllen, Verbesserungen anbieten.
      //    Elite-Boss: Extra-Münzen und mehrere Verbesserungen zur Wahl.
      const besiegt = zustand.bossHp === 0;
      const durchBuch = besiegt && hpNachher > 0;       // erst der Buchschlag hat ihn besiegt
      let eliteBonus = 0;
      if (besiegt) eliteBonus = bossBesiegtAnwenden(bossVorher);
      if (durchBuch) {
        // Elite-Bonus und aufgefüllte Leben zeigt dann der Buchschlag
        const letzter = buchschlaege[buchschlaege.length - 1];
        letzter.eliteBonus = eliteBonus;
        letzter.muenzen = zustand.muenzen;
        letzter.leben = zustand.leben;
      }

      // 8. Sudoku komplett? Dann gibt es danach ein neues Buch zur Wahl.
      const geloest = r.vorgaben.every(function (v, i) { return (v || r.eingaben[i]) === r.loesung[i]; });
      if (geloest) {
        r.geloest = true;
      }

      // 9. Fähigkeit: Der Zug zählt – nicht, wenn der Treffer den Boss besiegt
      //    hat (dann setzt er sie nicht mehr ein). Hat dieser Zug eine Einheit
      //    vervollständigt, pariert der Held. Wirkungen enden mit dem Sudoku.
      //    Buch des Vierten: Zähler um 1 Zug zurücksetzen (höchstens auf den vollen Abstand)
      let buchFaehigkeit = 0;
      if (!besiegt && zusatz.faehigkeit && faehigkeitVonBoss(zustand.bossNummer)) {
        const voll = faehigkeitAbstand(zustand.bossNummer);
        const vorher = zustand.faehigkeit.zaehler;
        zustand.faehigkeit.zaehler = Math.min(voll, vorher + zusatz.faehigkeit);
        buchFaehigkeit = zustand.faehigkeit.zaehler - vorher;
      }
      const einsatz = besiegt ? null : zugVorbei(bossVorher, doppelt);
      if (geloest) zustand.faehigkeit.wirkungen = [];
      const faehigkeitStand = besiegt ? null : anzeigeVorEinsatz(einsatz);
      if (einsatz) einsatz.stand = faehigkeitAnzeige();

      // Alles, was diese Zahl bewirkt hat, in EINEM Ereignis
      const treffer = {
        index: index, ziffer: ziffer, boss: bossVorher,
        wurf: wurf, wuerfelSeiten: w.wuerfelSeiten, rechnung: rechnung, regenbogen: regenbogen,
        kritisch: rechnung.kritisch, fehlschlag: rechnung.fehlschlag, spruch: spruch,
        doppelt: doppelt, einheiten: einheiten,
        schaden: rechnung.schaden, gift: rechnung.gift,
        entschaerft: entschaerft,             // Tick, Tick: Timer entschärft
        // Verbesserungen und Bücher, die bei diesem Treffer gewirkt haben (ihr Platz leuchtet auf)
        wirksam: wirksameVerbesserungen(w, rechnung, einheiten, buchWirkung, powerup),
        // Seltene Eigenschaft hat den Treffer abgewehrt ("immun" oder "geblockt")
        immun: rechnung.immun,
        selten: rechnung.immun ? {
          id: bossVorher.selten.id, name: bossVorher.selten.name, farbe: bossVorher.selten.farbe,
          grund: rechnung.abwehrGrund, art: rechnung.abwehrArt,
        } : null,
        // Elite-Bonus nur, wenn der Treffer selbst den Boss besiegt hat (sonst beim Buchschlag)
        eliteBonus: durchBuch ? 0 : eliteBonus,
        hpVorher: hpVorher, hpNachSchaden: hpNachSchaden, hpNachher: hpNachher,
        powerup: powerup,
        muenzenPlus: muenzenPlus, muenzen: zustand.muenzen - (durchBuch ? eliteBonus : 0), muenzFaktor: muenzFaktor,   // muenzen inkl. eliteBonus
        lebenGewuenscht: effekt.leben, lebenPlus: lebenPlus,
        leben: lebenVorher + lebenPlus, maxLeben: w.maxLeben,
        // Stand der Fähigkeit nach diesem Zug (vor ihrem Einsatz); null, wenn der Boss besiegt ist
        faehigkeitStand: faehigkeitStand,
        // Bücher: Bonus nach diesem Zug, Anstieg durch diese Zahl, Buch dieser Ziffer
        buchBonus: zustand.buchBonus, buchBonusPlus: buchWirkung.bonus,
        buch: buchWirkung.buch ? Object.assign(buchFuerAnzeige(buchWirkung.buch.id, buchWirkung.stufe), { zusatz: buchWirkung.buch.zusatz }) : null,
        // alle Würfel (bei Büchern mit mehreren Würfeln) und wie sie zählen
        wuerfe: wuerfe, wuerfelModus: wuerfelModus,
        buchMuenzen: buchMuenzen, buchFaehigkeit: buchFaehigkeit,
      };
      speichern();
      melde("richtig", treffer);
      if (powerup) {
        melde("powerup", { index: index, typ: powerup.typ, effekt: effekt, treffer: treffer });
      }
      buchschlaege.forEach(function (ereignis) { melde("buchschlag", ereignis); });
      if (einsatz) melde("faehigkeit", einsatz);
      if (besiegt) {
        melde("bossBesiegt", { boss: bossVorher, rekord: zustand.rekord, elite: bossVorher.elite, eliteBonus: eliteBonus });
        if (zustand.auswahl) {
          // Der nächste Boss erscheint erst nach der Wahl (waehleVerbesserung)
          melde("auswahl", auswahlInfo());
        } else {
          melde("neuerBoss", neuerBossDaten());
          offeneBuchschlaegeAusfuehren();          // Buchschlag trifft den neuen Boss
        }
      }
      if (geloest) {
        // Neues Sudoku nötig – Boss (HP) und Leben bleiben, wie sie sind.
        // Das Rätsel bleibt bis zum nächsten starteRaetsel() zum Anschauen stehen.
        melde("sudokuGeloest", { grad: r.grad, boss: bossMitStand(zustand.bossNummer), hp: zustand.bossHp });
      }
      return {
        art: "richtig", wurf: wurf, schaden: rechnung.schaden, gift: rechnung.gift,
        kritisch: rechnung.kritisch, fehlschlag: rechnung.fehlschlag, doppelt: doppelt, immun: rechnung.immun,
        eliteBonus: eliteBonus, regenbogen: regenbogen,
        powerup: powerup, muenzenPlus: muenzenPlus, lebenPlus: lebenPlus,
        besiegt: besiegt, geloest: geloest, auswahl: Boolean(zustand.auswahl),
        faehigkeit: einsatz, entschaerft: entschaerft, niederlage: false,
        buchschlag: buchWirkung.schlaege.length > 0,
      };
    }

    /** Die gerade angebotenen Verbesserungen für die Karten (leer, wenn keine Wahl offen ist). */
    function angebote() {
      return zustand.auswahl ? angeboteFuerAnzeige(zustand.auswahl, zustand.verbesserungen, zustand.buecher, belegtePlaetze().length) : [];
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
      if (!zustand.auswahl || zustand.auswahl.indexOf(id) === -1 || mussBehalten()) return false;
      if (!istMoeglich(id)) return false;       // z. B. kein Platz mehr frei
      const beutel = id === K.muenzbeutel.id;
      // Buch: neu (Stufe 1) oder eine Stufe höher – gleicher Ablauf wie eine Verbesserung
      const buch = istBuch(id);
      const v = beutel ? K.muenzbeutel : buch ? buchFuerAnzeige(id, 0) : verbesserungInfo(id);
      if (beutel) {
        zustand.muenzen += K.muenzbeutel.muenzen;
      } else {
        if (!besitzt(id)) zustand.plaetze = belegtePlaetze().concat([id]);   // belegt den nächsten Platz
        if (buch) zustand.buecher[id] = Math.min(K.buchGrundwirkung.maxStufe, (zustand.buecher[id] || 0) + 1);
        else zustand.verbesserungen[id] = (zustand.verbesserungen[id] || 0) + 1;
      }
      // Darf noch eine weitere gewählt werden (Elite-Boss)? Dann bleiben die
      // übrigen Angebote stehen – sofern sie noch wählbar sind. Fällt dabei
      // etwas weg (z. B. ist jetzt kein Platz mehr frei), kommt der Münzbeutel dazu.
      zustand.auswahlAnzahl--;
      const vorher = zustand.auswahl.filter(function (a) { return a !== id; });
      let uebrig = vorher.filter(istMoeglich);
      if ((uebrig.length < vorher.length || uebrig.length === 0) && uebrig.indexOf(K.muenzbeutel.id) === -1) {
        uebrig = uebrig.concat([K.muenzbeutel.id]);
      }
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
      if (!buch && !beutel && v.beimWaehlen) v.beimWaehlen(zustand, w, v.wert);
      speichern();
      melde("verbesserung", {
        id: id, art: beutel ? "muenzbeutel" : buch ? "buch" : "verbesserung", name: v.name,
        stufe: beutel ? 0 : buch ? zustand.buecher[id] : zustand.verbesserungen[id], maxStufe: v.maxStufe || 0,
        muenzenPlus: beutel ? K.muenzbeutel.muenzen : 0, muenzen: zustand.muenzen,
        leben: zustand.leben, lebenPlus: zustand.leben - lebenVorher, maxLeben: w.maxLeben,
        gesammelt: gesammeltAlles(),
      });
      if (zustand.auswahl) {
        melde("auswahl", auswahlInfo());      // die nächste Wahl
        return true;
      }
      // Nach einem Sieg erscheint jetzt der nächste Boss (eine freie Ersatzwahl
      // ändert am Boss nichts). Steht noch eine freie Wahl aus, kommt sie danach.
      if (grund === "boss") {
        melde("neuerBoss", neuerBossDaten());
        offeneBuchschlaegeAusfuehren();          // ein Buchschlag aus dem letzten Zug trifft den neuen Boss
        if (zustand.auswahl) return true;        // … und hat ihn gleich besiegt → neue Auswahl
      }
      if (freieWahlStarten()) {
        speichern();
        melde("auswahl", auswahlInfo());
      }
      return true;
    }

    /** Muss vor dem Weiterspielen ein neues Sudoku ausgelost werden? */
    function brauchtRaetsel() {
      if (zustand.ende) return false;          // Durchlauf vorbei: erst "Neuer Durchlauf"
      return !zustand.raetsel || zustand.raetsel.geloest;
    }

    /**
     * "Alle Fortschritte löschen" (Einstellungen): wirklich alles auf Anfang –
     * auch Münzen und Rekorde. Danach Buch-Spin wie bei einem neuen Abenteuer.
     */
    function allesLoeschen() {
      zustand = neuerZustand();                // ohne Bücher → die Oberfläche startet den Buch-Spin
      if (istElite(1)) eliteAuslosen();       // nur wenn Level 1 ein Elite-Level wäre
      speichern();
      melde("zurueckgesetzt", { boss: bossInfo(1) });
    }

    return {
      /** Der aktuelle Spielstand (nur lesen!) */
      get zustand() { return zustand; },
      boss: function () { return bossMitStand(zustand.bossNummer); },
      werte: werte,
      gesammelt: gesammeltAlles,              // Verbesserungen und Bücher (für die Plätze)
      mussBehalten: mussBehalten,
      behalteVerbesserungen: behalteVerbesserungen,
      faehigkeitStand: faehigkeitAnzeige,
      timerVergeht: timerVergeht,
      buchBonus: function () { return zustand.buchBonus; },
      brauchtBuchSpin: brauchtBuchSpin,
      buchSpin: buchSpin,
      angebote: angebote,
      auswahlInfo: auswahlInfo,
      an: function (name, fn) { (hoerer[name] = hoerer[name] || []).push(fn); },
      erweitere: function (erweiterung) { erweiterungen.push(erweiterung); },
      loseGrad: loseGrad,
      starteRaetsel: starteRaetsel,
      setzeZahl: setzeZahl,
      waehleVerbesserung: waehleVerbesserung,
      brauchtRaetsel: brauchtRaetsel,
      // Durchläufe und Rekorde
      durchlaufVorbei: durchlaufVorbei,
      zusammenfassung: zusammenfassung,
      neuerDurchlauf: neuerDurchlauf,
      aufgeben: aufgeben,
      rekorde: function () { return Object.assign({}, zustand.rekorde); },
      allesLoeschen: allesLoeschen,
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

  /**
   * "Alle Fortschritte löschen" (Einstellungen): Spielstand samt Münzen und
   * Rekorden weg – beim nächsten Öffnen beginnt ein ganz neues Abenteuer.
   */
  function alleFortschritteLoeschen() {
    ersetzen(null);
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
    istWeltboss: istWeltboss,
    position: position,
    hpFuer: hpFuer,
    welten: function () { return WELTEN.filter(Boolean).map(function (w) { return Object.assign(weltFuerAnzeige(w), { gebaut: w.bosse.length > 0 }); }); },
    seltenFuerAnzeige: seltenFuerAnzeige,
    faehigkeitAbstand: faehigkeitAbstand,
    faehigkeitInfo: faehigkeitInfo,
    verwirrungsWort: verwirrungsWort,
    wortGueltig: wortGueltig,
    buchInfo: buchInfo,
    buchFuerAnzeige: buchFuerAnzeige,
    buchBonusFuer: buchBonusFuer,
    buchSchadenFuer: buchSchadenFuer,
    feldWirkung: feldWirkung,
    zifferWirkung: zifferWirkung,
    belohnung: belohnung,
    powerupTyp: powerupTyp,
    werteVon: werteVon,
    gesammelteVerbesserungen: gesammelteVerbesserungen,
    berechneSchaden: berechneSchaden,
    zahlText: zahlText,
    erstelle: erstelle,
    alleFortschritteLoeschen: alleFortschritteLoeschen,
    pruefeDaten: pruefeDaten,
    alsObjekt: alsObjekt,
    ersetzen: ersetzen,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = SudokuRPG;
}
