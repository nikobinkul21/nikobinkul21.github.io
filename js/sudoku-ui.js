/* ==========================================================================
   sudoku-ui.js – Darstellung und Bedienung des Sudokus
   Die eigentliche Logik (erzeugen, lösen, prüfen) steckt in sudoku-engine.js.
   Diese Datei zeichnet das Gitter, reagiert auf Klicks und Tasten und
   speichert das laufende Spiel im localStorage.

   Zwei Modi:
     "frei"      – das klassische Sudoku mit freier Wahl der Schwierigkeit
     "abenteuer" – Bosskämpfe: Regeln in sudoku-rpg.js, Kampffenster in
                   sudoku-battle-ui.js
   Adressen: #games/sudoku (Moduswahl), #games/sudoku/frei, #games/sudoku/abenteuer
   ========================================================================== */

// Name des Eintrags im localStorage (freies Spiel)
const SUDOKU_SPEICHER_SCHLUESSEL = "ntb-sudoku";

/**
 * Liest das gespeicherte freie Sudoku (nur lesen, ändert nichts).
 * Wird vom Sudoku selbst und von der Startseite (home.js) benutzt.
 * @returns {object|null} – { grad, vorgaben, loesung, eingaben, geloest }
 *                          oder null, wenn keins da oder es kaputt ist
 */
function sudokuSpielstandLesen() {
  try {
    const daten = JSON.parse(localStorage.getItem(SUDOKU_SPEICHER_SCHLUESSEL));
    const istListe = function (liste) { return Array.isArray(liste) && liste.length === 81; };
    if (daten && SudokuEngine.gradMitId(daten.grad) &&
        istListe(daten.vorgaben) && istListe(daten.loesung) && istListe(daten.eingaben)) {
      return daten;
    }
  } catch (fehler) {
    // kaputte oder fehlende Daten
  }
  return null;
}

/**
 * Startet das Sudoku.
 * Wird von games.js EINMAL aufgerufen, wenn das Sudoku zum ersten Mal
 * geöffnet wird.
 *
 * @param {HTMLElement} container – das Element, in das das Spiel gezeichnet wird
 * @returns {{zeige: function}} – zeige(modus) wechselt zwischen Moduswahl und Modi
 */
function initSudoku(container) {

  /* ------------------------------------------------------------------------
     ZUSTAND
     Ein Rätsel sieht in beiden Modi gleich aus:
     {
       grad:     id des Schwierigkeitsgrads, z. B. "mittel"
       vorgaben: 81 Zahlen – die vorgegebenen Zahlen (0 = leer)
       loesung:  81 Zahlen – die komplette Lösung
       eingaben: 81 Zahlen – was du selbst eingetragen hast (0 = nichts)
       geloest:  true, sobald alles richtig ist
     }
     ------------------------------------------------------------------------ */
  let modus = null;             // null (Moduswahl), "frei" oder "abenteuer"
  let spiel = null;             // das gerade ANGEZEIGTE Rätsel
  let freiesSpiel = sudokuSpielstandLesen();
  let abenteuer = null;         // ein SudokuRPG-Abenteuer (Regeln + Spielstand)
  let kampf = null;             // das Kampffenster (SudokuKampf)
  let letzteNiederlage = null;  // Zusammenfassung der letzten Niederlage (für den Bildschirm am Ende)
  let ausgewaehlt = 0;          // Nummer des gewählten Felds (0–80)
  let regenbogenLaeuft = false; // Regenbogenschlag läuft → Eingabe gesperrt (nicht abkürzbar)
  let letzterTreffer = null;    // Promise: Animation des letzten Treffers ist fertig
  // Fähigkeit des Bosses, wie sie gerade ANGEZEIGT wird (Siegel, Finsternis,
  // Fluch, Timer, Verwirrung im Gitter). Kommt aus dem Kampffenster, sobald
  // die Animation so weit ist – die Regeln kennen den neuen Stand schon früher.
  let angezeigteFaehigkeit = null;
  let letztesWort = null;       // Wort der zuletzt angezeigten Verwirrung (für "Das Wort war: …")
  let statusZeit = 0;           // Zeitgeber für kurze Hinweise über dem Gitter
  let buchSpinLaeuft = null;    // Promise, solange der Buch-Spin läuft bzw. darauf wartet

  // Wird gerade ein Rätsel erzeugt/ausgelost? (je Modus getrennt)
  const beschaeftigt = { frei: false, abenteuer: false };
  function wirdErzeugt() {
    return Boolean(modus && beschaeftigt[modus]) || waehltVerbesserung() || regenbogenLaeuft;
  }
  /** Im Abenteuer ist gerade eine Verbesserungsauswahl offen → keine Eingabe. */
  function waehltVerbesserung() {
    return modus === "abenteuer" && Boolean(abenteuer && (abenteuer.zustand.auswahl || abenteuer.mussBehalten()));
  }


  /* ------------------------------------------------------------------------
     HTML-GERÜST AUFBAUEN
     ------------------------------------------------------------------------ */

  container.innerHTML =
    // Moduswahl
    '<div class="sudoku-modi" hidden>' +
      '<a class="karte link-karte sudoku-modus" href="#games/sudoku/abenteuer">' +
        '<h3>⚔ Abenteuer</h3>' +
        "<p>Besiege Bosse mit richtigen Zahlen. Jede richtige Zahl wirft einen Würfel, " +
        "nach jedem Boss wählst du eine Verbesserung. Angriff und Verteidigung wechseln sich ab, jeder Boss hat eine " +
        "Fähigkeit – fallen deine HP auf 0, beginnt der Durchlauf von vorn.</p>" +
        '<p class="sudoku-modus-stand"></p>' +
      "</a>" +
      '<a class="karte link-karte sudoku-modus" href="#games/sudoku/frei">' +
        "<h3>Freies Spiel</h3>" +
        "<p>Das klassische Sudoku – mit freier Wahl der Schwierigkeit.</p>" +
        '<p class="sudoku-modus-stand sudoku-modus-stand--frei"></p>' +
      "</a>" +
    "</div>" +
    // Das Spiel
    '<div class="sudoku" hidden>' +
      // Kopfzeile nur auf dem Smartphone (siehe css/sudoku-mobil.css): eine
      // Zeile mit Welt und Level (bzw. "Sudoku"), Schwierigkeit, Münzen und
      // einem Menü. Welt und Münzen hängt das Kampffenster selbst hier ein
      // (SudokuKampf, Handy-Aufbau; die HP des Helden bleiben im Kampfstreifen).
      '<div class="sudoku-kopfzeile">' +
        '<div class="kopf-ort"><span class="kopf-titel nur-frei">Sudoku</span></div>' +
        '<span class="kopf-grad"></span>' +
        '<div class="kopf-stand nur-abenteuer"></div>' +
        '<button type="button" class="kopf-menue-knopf" aria-label="Menü" aria-expanded="false" aria-haspopup="true">' +
          '<span></span><span></span><span></span></button>' +
        '<div class="kopf-menue" role="menu" hidden>' +
          '<a class="kopf-eintrag" role="menuitem" href="#games">← Zurück zu Games</a>' +
          '<label class="kopf-eintrag kopf-eintrag--grad nur-frei">Schwierigkeit <select class="kopf-grad-auswahl"></select></label>' +
          '<button type="button" class="kopf-eintrag" role="menuitem" data-aktion="neu">Neues Spiel</button>' +
          '<a class="kopf-eintrag" role="menuitem" href="#einstellungen">Einstellungen</a>' +
          '<button type="button" class="kopf-eintrag kopf-eintrag--warnung nur-abenteuer" role="menuitem" data-aktion="aufgeben">Durchlauf aufgeben</button>' +
        "</div>" +
      "</div>" +
      '<div class="sudoku-steuerung">' +
        '<a class="sudoku-moduslink" href="#games/sudoku">↺ Modus</a>' +
        '<label class="sudoku-label nur-frei">' +
          // Der Text ist auf dem Handy versteckt (Platz sparen), bleibt aber für Screenreader da
          '<span class="sudoku-label-text">Schwierigkeit</span>' +
          '<select class="sudoku-auswahl"></select>' +
        "</label>" +
        '<button type="button" class="sudoku-knopf sudoku-neu nur-frei">Neues Spiel</button>' +
        '<span class="sudoku-abenteuer-grad nur-abenteuer"></span>' +
      "</div>" +
      // Platz für das Kampffenster (nur im Abenteuer)
      '<div class="sudoku-kampf nur-abenteuer"></div>' +
      // Eigene Fläche für den großen Würfel (nur Abenteuer, nur Desktop – siehe CSS)
      '<div class="sudoku-wuerfel nur-abenteuer"></div>' +
      // Der Rahmen hält Gitter und Statusmeldung zusammen:
      // Die Meldung schwebt ÜBER dem Gitter und braucht so keinen eigenen Platz.
      '<div class="sudoku-brett-rahmen">' +
        '<div class="sudoku-brett" role="group" aria-label="Sudoku-Gitter. Pfeiltasten zum Bewegen, Ziffern zum Eintragen."></div>' +
        // role="status": Screenreader lesen Änderungen dieses Texts automatisch vor
        '<p class="sudoku-status" role="status"></p>' +
        // Smartphone: eigene Ebene für den Würfel mittig über dem Gitter (fängt keine Klicks ab)
        '<div class="sudoku-handy-wuerfel nur-abenteuer" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="sudoku-zahlenfeld" role="group" aria-label="Zahlenfeld"></div>' +
    "</div>";

  const modiAuswahl = container.querySelector(".sudoku-modi");
  const sudokuBereich = container.querySelector(".sudoku");
  const auswahl = container.querySelector(".sudoku-auswahl");
  const neuKnopf = container.querySelector(".sudoku-neu");
  const abenteuerGrad = container.querySelector(".sudoku-abenteuer-grad");
  const kampfPlatz = container.querySelector(".sudoku-kampf");
  const wuerfelPlatz = container.querySelector(".sudoku-wuerfel");
  const handyWuerfelPlatz = container.querySelector(".sudoku-handy-wuerfel");
  const rahmen = container.querySelector(".sudoku-brett-rahmen");
  const status = container.querySelector(".sudoku-status");
  const brett = container.querySelector(".sudoku-brett");
  const zahlenfeld = container.querySelector(".sudoku-zahlenfeld");
  const kopfOrt = container.querySelector(".kopf-ort");
  const kopfStand = container.querySelector(".kopf-stand");
  const kopfGrad = container.querySelector(".kopf-grad");
  const kopfMenueKnopf = container.querySelector(".kopf-menue-knopf");
  const kopfMenue = container.querySelector(".kopf-menue");
  const kopfGradAuswahl = container.querySelector(".kopf-grad-auswahl");

  // Auswahl der Schwierigkeitsgrade aus der Liste in der Engine erzeugen
  SudokuEngine.SCHWIERIGKEITSGRADE.forEach(function (grad) {
    const option = document.createElement("option");
    option.value = grad.id;
    option.textContent = grad.name;
    auswahl.appendChild(option);
    kopfGradAuswahl.appendChild(option.cloneNode(true));
  });

  // Das Gitter: 9 Blöcke mit je 9 Feldern.
  // Die Abstände zwischen Blöcken und Feldern bilden später die Linien (siehe CSS).
  const felder = [];            // felder[i] = Button des Felds Nummer i
  for (let b = 0; b < 9; b++) {
    const block = document.createElement("div");
    block.className = "sudoku-block";
    brett.appendChild(block);
  }
  for (let i = 0; i < 81; i++) {
    const feld = document.createElement("button");
    feld.type = "button";
    feld.className = "sudoku-feld";
    feld.dataset.index = i;
    // Die Ziffer steckt in einem eigenen <span>, damit die Erfolgsanimation
    // nur die Zahl vergrößern kann und nicht das ganze Feld
    const ziffer = document.createElement("span");
    ziffer.className = "sudoku-ziffer";
    feld.appendChild(ziffer);
    felder.push(feld);
  }
  // Felder in ihre Blöcke einsortieren (Zeile für Zeile, damit die Reihenfolge im Block stimmt)
  for (let i = 0; i < 81; i++) {
    brett.children[SudokuEngine.blockVon(i)].appendChild(felder[i]);
  }

  // Zahlenfeld unter dem Gitter: 1–9 und Löschen
  for (let ziffer = 1; ziffer <= 9; ziffer++) {
    const taste = document.createElement("button");
    taste.type = "button";
    taste.className = "sudoku-taste";
    // Eigenes Element für das Zeichen: Bei einer Verwirrung steht dort ein Buchstabe
    taste.innerHTML = '<span class="sudoku-taste-zeichen"></span>';
    taste.firstChild.textContent = ziffer;
    taste.dataset.ziffer = ziffer;
    taste.setAttribute("aria-label", "Ziffer " + ziffer + " eintragen");
    zahlenfeld.appendChild(taste);
  }
  const loeschTaste = document.createElement("button");
  loeschTaste.type = "button";
  loeschTaste.className = "sudoku-taste sudoku-taste--loeschen";
  loeschTaste.textContent = "⌫";
  loeschTaste.dataset.ziffer = 0;
  loeschTaste.setAttribute("aria-label", "Feld löschen");
  zahlenfeld.appendChild(loeschTaste);


  /* ------------------------------------------------------------------------
     MODUS WECHSELN
     ------------------------------------------------------------------------ */

  /**
   * Wird von games.js bei JEDEM Öffnen aufgerufen.
   * @param {string} neuerModus – "" (Moduswahl), "frei" oder "abenteuer"
   */
  function zeige(neuerModus) {
    if (neuerModus !== "frei" && neuerModus !== "abenteuer") {
      modus = null;
      sudokuBereich.hidden = true;
      modiAuswahl.hidden = false;
      zeigeModusStand();
      return;
    }

    modus = neuerModus;
    modiAuswahl.hidden = true;
    sudokuBereich.hidden = false;
    sudokuBereich.classList.toggle("ist-abenteuer", modus === "abenteuer");
    sudokuBereich.classList.toggle("ist-frei", modus === "frei");
    zeigeStatus("");
    setzeBeschaeftigtAnzeige();

    if (modus === "frei") {
      spiel = freiesSpiel;
      if (spiel) {
        auswahl.value = spiel.grad;
        if (spiel.geloest) zeigeStatus("Geschafft! Alle Zahlen sind richtig.", "erfolg");
        waehle(ersteLeereZelle(), false);
      } else if (!beschaeftigt.frei) {
        auswahl.value = SudokuEngine.SCHWIERIGKEITSGRADE[0].id;
        neuesFreiesSpiel();
      }
      return;
    }

    starteAbenteuer();
  }

  /** Kurzer Stand auf den Karten der Moduswahl. */
  function zeigeModusStand() {
    const stand = SudokuRPG.alsObjekt();
    const boss = stand && SudokuRPG.bossInfo(stand.bossNummer);
    modiAuswahl.querySelector(".sudoku-modus-stand").textContent = !stand
      ? "Neues Abenteuer beginnen"
      : stand.ende
      ? "Durchlauf vorbei – Zusammenfassung ansehen" + (stand.muenzen > 0 ? " · " + stand.muenzen + " Münzen" : "")
      : "Weiter bei Level " + boss.weltLevel + " (" + boss.name + ")" +
        (stand.rekorde.level > 1 ? " · Rekord: Level " + SudokuRPG.bossInfo(stand.rekorde.level).weltLevel : "") +
        (stand.muenzen > 0 ? " · " + stand.muenzen + " Münzen" : "");
    const frei = sudokuSpielstandLesen();
    modiAuswahl.querySelector(".sudoku-modus-stand--frei").textContent =
      frei && !frei.geloest ? "Spiel fortsetzen · " + SudokuEngine.gradMitId(frei.grad).name : "";
  }


  /* ------------------------------------------------------------------------
     SPEICHERN (freies Spiel – das Abenteuer speichert sich selbst)
     ------------------------------------------------------------------------ */

  function speichereFreiesSpiel() {
    try {
      localStorage.setItem(SUDOKU_SPEICHER_SCHLUESSEL, JSON.stringify(freiesSpiel));
    } catch (fehler) {
      // Speichern nicht möglich (z. B. privater Modus) – Spiel läuft trotzdem
    }
  }


  /* ------------------------------------------------------------------------
     ZEICHNEN
     Bringt alle 81 Felder auf den aktuellen Stand. Wird nach jeder
     Änderung aufgerufen – einfacher als jedes Feld einzeln zu verwalten.
     ------------------------------------------------------------------------ */

  /** Die Zahl, die in Feld i steht (vorgegeben oder eigene Eingabe, 0 = leer). */
  function wertVon(i) {
    return spiel.vorgaben[i] || spiel.eingaben[i];
  }

  function zeichne() {
    if (!spiel) return;
    // Kopfzeile (Smartphone): Schwierigkeit als kleines Etikett
    const grad = SudokuEngine.gradMitId(spiel.grad);
    kopfGrad.textContent = grad ? grad.name : "";
    const zeileA = Math.floor(ausgewaehlt / 9);
    const spalteA = ausgewaehlt % 9;
    const blockA = SudokuEngine.blockVon(ausgewaehlt);
    const wirkungen = laufendeWirkungen();
    const paradeFelder = modus === "abenteuer" && angezeigteFaehigkeit && angezeigteFaehigkeit.paradeFelder ? angezeigteFaehigkeit.paradeFelder : [];
    // Verwirrung: Ziffern erscheinen als Buchstaben des Worts (1 → erster Buchstabe …)
    const wort = SudokuRPG.verwirrungsWort(wirkungen);
    // Verdeckte Zahlen dürfen sich auch nicht über "gleiche Zahl" verraten
    const wertA = SudokuRPG.feldWirkung(wirkungen, ausgewaehlt) === "verdeckt" ? 0 : wertVon(ausgewaehlt);

    for (let i = 0; i < 81; i++) {
      const feld = felder[i];
      const wert = wertVon(i);
      const zeile = Math.floor(i / 9);
      const spalte = i % 9;
      const istVorgabe = spiel.vorgaben[i] !== 0;
      const istFalsch = !istVorgabe && wert !== 0 && wert !== spiel.loesung[i];

      // Wirkung einer Boss-Fähigkeit: "versiegelt", "verdeckt" (Zahl als "?") oder "timer"
      const wirkung = SudokuRPG.feldWirkung(wirkungen, i);
      const verdeckt = wirkung === "verdeckt" && wert !== 0;
      feld.firstChild.textContent = wert === 0 ? "" : verdeckt ? "?" : zeichenFuer(wert, wort);
      feld.classList.toggle("ist-versiegelt", wirkung === "versiegelt");
      feld.classList.toggle("ist-verdeckt", wirkung === "verdeckt");
      feld.classList.toggle("ist-verwirrt", Boolean(wort) && wert !== 0 && !verdeckt);
      // Parade (Zähler auf 1): dezent markiert, wo die richtige Zahl eine Einheit vervollständigt
      const parade = paradeFelder.indexOf(i) !== -1;
      feld.classList.toggle("ist-parade", parade);
      zeichneTimer(feld, wirkung === "timer" && wert === 0);

      // CSS-Klassen für die Optik (Farben stehen in css/sudoku.css)
      feld.classList.toggle("ist-vorgabe", istVorgabe);
      feld.classList.toggle("ist-eingabe", !istVorgabe && wert !== 0);
      feld.classList.toggle("ist-falsch", istFalsch);
      feld.classList.toggle("ist-ausgewaehlt", i === ausgewaehlt);
      feld.classList.toggle("ist-verwandt",
        i !== ausgewaehlt &&
        (zeile === zeileA || spalte === spalteA || SudokuEngine.blockVon(i) === blockA));
      feld.classList.toggle("ist-gleich", i !== ausgewaehlt && wertA !== 0 && wert === wertA && !verdeckt);
      feld.classList.remove("ist-fehlversuch");

      // "Roving Tabindex": nur das gewählte Feld ist per Tab erreichbar,
      // innerhalb des Gitters bewegt man sich mit den Pfeiltasten
      feld.tabIndex = i === ausgewaehlt ? 0 : -1;

      // Beschreibung für Screenreader, z. B. "Zeile 3, Spalte 5: 7, falsch"
      let beschreibung = "Zeile " + (zeile + 1) + ", Spalte " + (spalte + 1) + ": ";
      beschreibung += wert === 0 ? "leer" : verdeckt ? "verdeckt" : wort ? zeichenFuer(wert, wort) + " (Ziffer " + wert + ")" : wert;
      if (wirkung === "versiegelt") beschreibung += ", versiegelt";
      if (parade) beschreibung += ", hier ist eine Parade möglich";
      if (wirkung === "timer" && wert === 0) beschreibung += ", Timer: noch " + SudokuKampf.zeitText(timerRestMs());
      if (istVorgabe) beschreibung += ", vorgegeben";
      if (istFalsch) beschreibung += ", falsch";
      const powerup = powerupTypAuf(i);
      if (powerup) beschreibung += ", Power-up: " + powerup.name;
      // Regenbogenfeld: besiegt den Boss sofort
      const regenbogen = modus === "abenteuer" && spiel.regenbogen === i;
      if (regenbogen) beschreibung += ", Regenbogenfeld: besiegt den Boss sofort";
      feld.setAttribute("aria-label", beschreibung);
      zeichnePowerup(feld, powerup);
      zeichneRegenbogen(feld, regenbogen);
    }
    zeichneWirkungsMarken(wirkungen);

    brett.classList.toggle("ist-geloest", spiel.geloest);

    zeichneZahlenfeld();
  }

  /** Laufende Wirkungen der Boss-Fähigkeit, wie sie gerade angezeigt werden (nur Abenteuer). */
  function laufendeWirkungen() {
    return modus === "abenteuer" && angezeigteFaehigkeit ? angezeigteFaehigkeit.wirkungen : [];
  }

  /** Zeichen für eine Ziffer: die Ziffer selbst oder (Verwirrung) ihr Buchstabe im Wort. */
  function zeichenFuer(ziffer, wort) {
    return wort ? wort.charAt(ziffer - 1) : String(ziffer);
  }

  /**
   * Zähler der Wirkungen: am ersten betroffenen Feld jeder Wirkung eine
   * kleine Marke mit Symbol und verbleibenden Zügen (z. B. Siegel · 3).
   * Wirkungen ohne Feld (Verwirrung) zeigen ein Band über dem Gitter, der
   * Fluch zählt an seiner Taste im Zahlenfeld, der Timer steht in seinem Feld.
   */
  function zeichneWirkungsMarken(wirkungen) {
    brett.querySelectorAll(".sudoku-wirkung-marke").forEach(function (m) { m.remove(); });
    rahmen.querySelectorAll(".sudoku-wirkung-band").forEach(function (m) { m.remove(); });
    wirkungen.forEach(function (w) {
      if (w.rest === null) return;                 // Timer: die Zeit steht im Feld
      const zuege = w.rest + (w.rest === 1 ? " Zug" : " Züge");
      const erstes = felder.findIndex(function (f, i) { return SudokuRPG.feldWirkung([w], i) !== null; });
      if (erstes !== -1) {
        const marke = document.createElement("span");
        marke.className = "sudoku-wirkung-marke sudoku-wirkung-marke--" + w.id;
        marke.style.setProperty("--faehigkeit-farbe", w.farbe);
        marke.setAttribute("aria-hidden", "true");
        marke.innerHTML = SudokuKampf.symbolSvg(w.symbol) + "<span></span>";
        marke.lastChild.textContent = w.rest;
        marke.title = w.name + ": noch " + zuege;
        felder[erstes].appendChild(marke);
        return;
      }
      const anZiffer = [1, 2, 3, 4, 5, 6, 7, 8, 9].some(function (z) { return SudokuRPG.zifferWirkung([w], z) !== null; });
      if (anZiffer) return;                        // Fluch: Zähler an der Taste
      const band = document.createElement("div");
      band.className = "sudoku-wirkung-band sudoku-wirkung-band--" + w.id;
      band.style.setProperty("--faehigkeit-farbe", w.farbe);
      band.setAttribute("aria-hidden", "true");
      band.innerHTML = SudokuKampf.symbolSvg(w.symbol) + "<span></span>";
      band.lastChild.textContent = w.name + " · noch " + zuege;
      rahmen.appendChild(band);
    });
    brett.setAttribute("aria-description", wirkungen.length === 0 ? "" : wirkungen.map(function (w) {
      if (w.rest === null) return w.name + ": Timer noch " + SudokuKampf.zeitText(timerRestMs());
      return w.name + " noch " + w.rest + (w.rest === 1 ? " Zug" : " Züge") +
        (w.id === "verwirrung" ? " – Ziffern sind Buchstaben" : "");
    }).join(", "));
  }

  /** Restzeit des Timers (Tick, Tick) aus den Regeln – die Anzeige hat nur eine Kopie. */
  function timerRestMs() {
    if (!abenteuer) return 0;
    const w = abenteuer.zustand.faehigkeit.wirkungen.find(function (x) { return x.rest === null && typeof x.daten.restMs === "number"; });
    return w ? w.daten.restMs : 0;
  }

  /**
   * Tick, Tick: der Timer groß im Feld (das Feld leuchtet, damit man es
   * auf einen Blick findet). In den letzten Sekunden rot und pulsierend.
   */
  function zeichneTimer(feld, an) {
    let t = feld.querySelector(".sudoku-timer");
    feld.classList.toggle("hat-timer", an);
    if (!an) {
      if (t) t.remove();
      feld.classList.remove("timer-knapp");
      return;
    }
    if (!t) {
      t = document.createElement("span");
      t.className = "sudoku-timer";
      t.setAttribute("aria-hidden", "true");
      feld.appendChild(t);
    }
    aktualisiereTimer(feld, t);
  }

  /** Zeit im Timerfeld neu schreiben (auch zwischen zwei Zeichnungen, jede Sekunde). */
  function aktualisiereTimer(feld, t) {
    const rest = timerRestMs();
    const w = laufendeWirkungen().find(function (x) { return x.rest === null; });
    const knapp = Boolean(w && w.warnungSekunden) && rest <= w.warnungSekunden * 1000;
    t.textContent = SudokuKampf.zeitText(rest);
    feld.classList.toggle("timer-knapp", knapp);
  }

  /** Verwirrung vorbei: Die Buchstaben im Gitter verwandeln sich zurück in Ziffern. */
  function verwandleZurueck() {
    felder.forEach(function (feld) {
      if (!feld.firstChild.textContent) return;
      feld.classList.remove("verwandelt-zurueck");
      void feld.offsetWidth;
      feld.classList.add("verwandelt-zurueck");
      setTimeout(function () { feld.classList.remove("verwandelt-zurueck"); }, 650);
    });
  }

  /**
   * Power-up-Typ auf Feld i (nur im Abenteuer, sonst null).
   * Die Liste steht im Rätsel des Abenteuers (siehe js/sudoku-rpg.js).
   */
  function powerupTypAuf(i) {
    if (modus !== "abenteuer" || !spiel.powerups) return null;
    const eintrag = spiel.powerups.find(function (p) { return p.index === i; });
    return eintrag ? SudokuRPG.powerupTyp(eintrag.typ) : null;
  }

  /**
   * Getönte Glas-Ebene mit Symbol im Feld anlegen oder entfernen.
   * Eine Ebene, die gerade ihre Auslöse-Animation zeigt, bleibt bis zum Ende stehen.
   */
  function zeichnePowerup(feld, typ) {
    let ebene = feld.querySelector(".sudoku-powerup");
    if (ebene && ebene.classList.contains("loest-aus")) return;
    feld.classList.toggle("hat-powerup", Boolean(typ));
    if (!typ) {
      if (ebene) ebene.remove();
      return;
    }
    if (!ebene) {
      ebene = document.createElement("span");
      ebene.className = "sudoku-powerup";
      ebene.setAttribute("aria-hidden", "true");
      feld.appendChild(ebene);
    }
    if (ebene.dataset.typ !== typ.id) {
      ebene.dataset.typ = typ.id;
      ebene.style.setProperty("--powerup-farbe", typ.farbe);
      ebene.innerHTML = SudokuKampf.symbolSvg(typ.symbol);
    }
  }

  /**
   * Regenbogenfeld: bunte, glänzende Ebene im Feld (Aussehen: css/sudoku-rpg.css).
   * Eine Ebene, die gerade zerspringt, bleibt bis zum Ende ihrer Animation.
   */
  function zeichneRegenbogen(feld, an) {
    let ebene = feld.querySelector(".sudoku-regenbogen");
    if (ebene && ebene.classList.contains("zerspringt")) return;
    feld.classList.toggle("ist-regenbogen", an);
    if (!an) {
      if (ebene) ebene.remove();
      return;
    }
    if (!ebene) {
      ebene = document.createElement("span");
      ebene.className = "sudoku-regenbogen";
      ebene.setAttribute("aria-hidden", "true");
      ebene.innerHTML = '<span class="regenbogen-farben"></span><span class="regenbogen-glanz"></span>';
      feld.appendChild(ebene);
    }
  }

  /** Ausgelöstes Power-up: Markierung leuchtet kurz auf und verschwindet. */
  function loesePowerupAus(index, typId) {
    let ebene = felder[index].querySelector(".sudoku-powerup");
    if (!ebene) {
      zeichnePowerup(felder[index], SudokuRPG.powerupTyp(typId));
      ebene = felder[index].querySelector(".sudoku-powerup");
    }
    ebene.classList.add("loest-aus");
    setTimeout(function () {
      ebene.remove();
      felder[index].classList.remove("hat-powerup");
    }, 500);
  }

  /**
   * Hakt im Zahlenfeld jede Ziffer ab, die schon an ALLEN 9 Stellen
   * richtig im Gitter steht: Taste ausgegraut + grüner Haken (siehe CSS).
   * Wird eine davon wieder gelöscht, ist die Taste wieder normal.
   */
  function zeichneZahlenfeld() {
    // Für jede Ziffer zählen, wie oft sie RICHTIG eingetragen ist
    const richtig = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const wert = wertVon(i);
      if (wert !== 0 && wert === spiel.loesung[i]) {
        richtig[wert]++;
      }
    }

    const wirkungen = laufendeWirkungen();
    // Verwirrung: Die Tasten zeigen die Buchstaben in der Reihenfolge des Worts
    const wort = SudokuRPG.verwirrungsWort(wirkungen);
    zahlenfeld.classList.toggle("ist-verwirrt", Boolean(wort));
    for (let ziffer = 1; ziffer <= 9; ziffer++) {
      const taste = zahlenfeld.querySelector('[data-ziffer="' + ziffer + '"]');
      const fertig = richtig[ziffer] === 9;
      // Fluch des Bosses: diese Ziffer kann gerade nicht gesetzt werden
      const fluch = wirkungen.find(function (w) { return SudokuRPG.zifferWirkung([w], ziffer) === "verflucht"; });
      const verflucht = Boolean(fluch) && !fertig;
      taste.firstChild.textContent = zeichenFuer(ziffer, wort);
      taste.classList.toggle("ist-fertig", fertig);
      // disabled: Die Taste ist nicht anklickbar – alle gesetzt oder verflucht
      taste.disabled = fertig || verflucht;
      const name = wort ? "Buchstabe " + zeichenFuer(ziffer, wort) + " (Ziffer " + ziffer + ")" : "Ziffer " + ziffer;
      taste.setAttribute("aria-label", fertig ? name + ": alle gesetzt" : name + " eintragen");
      // Buch für diese Ziffer: kleines Buch-Symbol und Fortschritt ("6/9")
      const buch = modus === "abenteuer" && abenteuer && SudokuRPG.KONFIG.buecher.find(function (b) {
        return b.ziffer === ziffer && abenteuer.zustand.buecher[b.id] > 0;
      });
      let buchMarke = taste.querySelector(".sudoku-buch-marke");
      if (buch) {
        if (!buchMarke) {
          buchMarke = document.createElement("span");
          buchMarke.className = "sudoku-buch-marke";
          buchMarke.setAttribute("aria-hidden", "true");
          buchMarke.innerHTML = SudokuKampf.symbolSvg("buch") + "<span></span>";
          taste.appendChild(buchMarke);
        }
        buchMarke.lastChild.textContent = richtig[ziffer] + "/9";
        taste.classList.add("hat-buch");
        taste.setAttribute("aria-label", taste.getAttribute("aria-label") + ", " + buch.name + ": " + richtig[ziffer] + " von 9 gesetzt");
      } else {
        if (buchMarke) buchMarke.remove();
        taste.classList.remove("hat-buch");
      }
      taste.classList.toggle("ist-verflucht", verflucht);
      let marke = taste.querySelector(".sudoku-fluch-marke");
      if (verflucht) {
        if (!marke) {
          marke = document.createElement("span");
          marke.className = "sudoku-fluch-marke";
          marke.setAttribute("aria-hidden", "true");
          taste.appendChild(marke);
        }
        marke.textContent = fluch.rest;
        taste.setAttribute("aria-label", name + " – verflucht, noch " + fluch.rest +
          (fluch.rest === 1 ? " Zug" : " Züge") + " gesperrt");
      } else if (marke) {
        marke.remove();
      }
    }
  }


  /* ------------------------------------------------------------------------
     SPIELZÜGE (beide Modi)
     ------------------------------------------------------------------------ */

  /** Wählt Feld i aus und setzt (optional) den Tastaturfokus darauf. */
  function waehle(i, fokus) {
    ausgewaehlt = i;
    zeichne();
    if (fokus) {
      felder[i].focus();
    }
  }

  /** Das komplette aktuelle Gitter: Vorgaben + eigene Eingaben (81 Zahlen). */
  function aktuellesGitter() {
    return spiel.vorgaben.map(function (v, i) { return v || spiel.eingaben[i]; });
  }

  /** Trägt eine Ziffer ins gewählte Feld ein (0 = löschen). */
  function setze(ziffer) {
    if (spiel && wirdErzeugt() && modus === "abenteuer" && kampf && kampf.laeuft()) {
      // Der Zug ist schon entschieden (Boss besiegt, Niederlage, Sudoku gelöst),
      // die Animation läuft aber noch: Sie springt zum Ergebnis, die Eingabe verfällt.
      kampf.beschleunige();
      return;
    }
    if (!spiel || wirdErzeugt() || spiel.geloest || spiel.vorgaben[ausgewaehlt] !== 0) {
      return;                   // vorgegebene Felder sind gesperrt
    }
    if (modus === "abenteuer") {
      setzeImAbenteuer(ausgewaehlt, ziffer);
    } else {
      setzeImFreienSpiel(ausgewaehlt, ziffer);
    }
  }

  /** Freies Spiel: wie gehabt – alles darf eingetragen und gelöscht werden. */
  function setzeImFreienSpiel(index, ziffer) {
    const vorher = aktuellesGitter();
    spiel.eingaben[index] = ziffer;
    const nachher = aktuellesGitter();

    // Alles richtig ausgefüllt?
    const jetztGeloest = SudokuEngine.istGeloest(nachher, spiel.loesung);
    if (jetztGeloest) {
      spiel.geloest = true;
    }

    speichereFreiesSpiel();
    zeichne();

    // Erfolgsanimationen (js/sudoku-effects.js)
    if (jetztGeloest) {
      // Große Welle – die Erfolgsmeldung erscheint erst, wenn sie vorbei ist.
      // Wurde inzwischen ein neues Spiel gestartet, entfällt die Meldung.
      const diesesSpiel = spiel;
      SudokuEffekte.spieleSieg(felder, index).then(function () {
        if (spiel === diesesSpiel) {
          zeigeStatus("Geschafft! Alle Zahlen sind richtig.", "erfolg");
        }
      });
    } else {
      const einheiten = SudokuEffekte.fertigeEinheiten(vorher, nachher, spiel.loesung, index);
      SudokuEffekte.spieleEinheiten(felder, index, einheiten);
    }
  }

  /** Läuft gerade ein freies Spiel, in dem man schon etwas eingetragen hat? */
  function spielLaeuft() {
    return freiesSpiel && !freiesSpiel.geloest && freiesSpiel.eingaben.some(function (z) { return z !== 0; });
  }

  /** Zeigt einen Text über dem Gitter. art: "" (normal) oder "erfolg" */
  function zeigeStatus(text, art) {
    status.textContent = text;
    status.dataset.art = art || "";
  }

  /**
   * Graut Gitter und Knöpfe aus, solange im aktuellen Modus ein Rätsel entsteht
   * oder eine Verbesserung gewählt wird.
   * Zentrale Regel für die Reihenfolge: Die Regeln kennen den Ausgang eines Zugs
   * sofort, sichtbar wird er aber erst in der Abfolge des Kampffensters. Darum
   * wird im Abenteuer das SPERREN als Schritt hinten angestellt (nach Würfel,
   * Treffer, Sieg bzw. Fähigkeit); ENTSPERREN wirkt sofort. Die Eingabe selbst ist
   * trotzdem sofort gesperrt (wirdErzeugt) – siehe setze().
   */
  function setzeBeschaeftigtAnzeige() {
    if (modus === "abenteuer" && kampf && wirdErzeugt() && !regenbogenLaeuft) {
      kampf.danach(zeigeBeschaeftigt);   // prüft beim Ausführen den dann gültigen Stand
    } else {
      zeigeBeschaeftigt();
    }
  }

  function zeigeBeschaeftigt() {
    const an = wirdErzeugt();
    neuKnopf.disabled = an;
    auswahl.disabled = an;
    // Beim Regenbogenschlag wird nur gesperrt, nicht abgedunkelt – man soll ihn sehen
    brett.classList.toggle("wird-erzeugt", an && !regenbogenLaeuft);
    brett.classList.toggle("ist-gesperrt", regenbogenLaeuft);
  }

  /** Erzeugt ein neues freies Rätsel im gewählten Schwierigkeitsgrad. */
  function neuesFreiesSpiel() {
    if (spielLaeuft() &&
        !window.confirm("Das laufende Spiel geht verloren. Neues Spiel starten?")) {
      return;
    }

    const grad = SudokuEngine.gradMitId(auswahl.value);
    beschaeftigt.frei = true;
    setzeBeschaeftigtAnzeige();
    zeigeStatus("Rätsel wird erzeugt …");

    // Die Engine rechnet in kleinen Häppchen, damit die Seite nicht einfriert.
    // ".then" läuft, sobald das Rätsel fertig ist.
    SudokuEngine.erzeugeRaetsel(grad.vorgaben).then(function (ergebnis) {
      freiesSpiel = {
        grad: grad.id,
        vorgaben: ergebnis.raetsel,
        loesung: ergebnis.loesung,
        eingaben: new Array(81).fill(0),
        geloest: false,
      };
      beschaeftigt.frei = false;
      speichereFreiesSpiel();
      if (modus === "frei") {
        spiel = freiesSpiel;
        setzeBeschaeftigtAnzeige();
        zeigeStatus("");
        waehle(ersteLeereZelle(), false);
      }
    });
  }

  /** Nummer des ersten leeren Felds – dort startet die Auswahl. */
  function ersteLeereZelle() {
    const i = spiel.vorgaben.findIndex(function (v, k) { return v === 0 && spiel.eingaben[k] === 0; });
    return i === -1 ? 0 : i;
  }


  /* ------------------------------------------------------------------------
     ABENTEUER
     ------------------------------------------------------------------------ */

  /** Öffnet das Abenteuer: Spielstand laden, Kampffenster zeigen, ggf. auslosen. */
  function starteAbenteuer() {
    // Bei jedem Öffnen frisch aus dem Speicher laden (z. B. nach einem Import)
    abenteuer = SudokuRPG.erstelle();
    angezeigteFaehigkeit = null;
    letztesWort = null;
    const diesesAbenteuer = abenteuer;

    if (!kampf) {
      kampf = SudokuKampf.erstelle(kampfPlatz, {
        // Smartphone: Welt/Level und Münzen wandern in die Kopfzeile
        kopf: { ort: kopfOrt, stand: kopfStand },
        beimAufgeben: durchlaufAufgeben,
        wuerfelPlatz: wuerfelPlatz,
        handyWuerfelPlatz: handyWuerfelPlatz,
        // Herkunft fliegender Boni beim Schadensaufbau (Doppelschaden, Schwierigkeit)
        gitterFeld: function (i) { return felder[i]; },
        gradAnzeige: abenteuerGrad,
        // Stand der Fähigkeit, sobald das Kampffenster ihn zeigt → Wirkungen im Gitter
        beimFaehigkeit: function (stand) {
          angezeigteFaehigkeit = stand;
          // Verwirrung vorbei? Die Buchstaben werden wieder zu Ziffern, die Textbox verrät das Wort
          const wort = SudokuRPG.verwirrungsWort(stand.wirkungen);
          if (letztesWort && !wort && modus === "abenteuer") {
            kampf.text("Das Wort war: " + letztesWort);
            verwandleZurueck();
          }
          letztesWort = wort;
          if (spiel && modus === "abenteuer") zeichne();
        },
      });
    }

    // Auf die Regeln hören → Kampffenster und Gitter reagieren
    abenteuer.an("richtig", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      // Für die Belohnungszeilen im Panel: Werte zum Zeitpunkt des Treffers
      e.werte = diesesAbenteuer.werte();
      letzterTreffer = kampf.treffer(e);
    });
    // Das Power-up-Ereignis kommt direkt nach "richtig" – seine Wirkung
    // (z. B. +10 Münzen) gehört zum selben Treffer
    abenteuer.an("powerup", function (e) { e.treffer.powerupEffekt = e.effekt; });
    abenteuer.an("fehler", function (e) { if (abenteuer === diesesAbenteuer) kampf.fehler(e); });
    // Fähigkeit des Bosses – läuft nach Würfel, Schaden und Treffer dieses Zugs
    abenteuer.an("faehigkeit", function (e) { if (abenteuer === diesesAbenteuer) kampf.faehigkeit(e); });
    abenteuer.an("wirkungEndet", function (e) { if (abenteuer === diesesAbenteuer) kampf.wirkungEndet(e); });
    // Sudoku gelöst: Welle über das Gitter, die Zahlen fliegen ins Schwert, es ist überladen
    abenteuer.an("ueberladung", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      kampf.ueberladung(e, function () {
        brett.classList.remove("wird-erzeugt");    // die Welle soll man sehen
        return SudokuEffekte.spieleSieg(felder, e.index);
      });
    });
    // Schlagabtausch: Ein Verteidigungszug beginnt – der Boss würfelt seinen Angriff
    abenteuer.an("bossAngriff", function (e) { if (abenteuer === diesesAbenteuer) kampf.bossAngriff(e); });
    // Tick, Tick: Timer abgelaufen – HP weniger (fallen sie auf 0, startet die
    // Timer-Schleife die Niederlage, wenn alle Ereignisse da sind)
    abenteuer.an("timer", function (e) { if (abenteuer === diesesAbenteuer) kampf.timerAbgelaufen(e); });
    abenteuer.an("bossBesiegt", function (e) { if (abenteuer === diesesAbenteuer) kampf.sieg(e); });
    abenteuer.an("auswahl", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      setzeBeschaeftigtAnzeige();           // Gitter gesperrt, bis gewählt ist (erst nach der Siegesanimation)
      zeigeAuswahl(e);
    });
    abenteuer.an("verbesserung", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      kampf.verbesserung(e);
      if (e.art === "buch" && spiel) zeichneZahlenfeld();    // Buch-Symbol im Zahlenfeld
    });
    // Bücher: Buchschlag (nach dem Treffer bzw. wenn der nächste Boss erschienen ist)
    abenteuer.an("buchschlag", function (e) { if (abenteuer === diesesAbenteuer) kampf.buchschlag(e); });
    abenteuer.an("neuerBoss", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      // Nach dem Erscheinen neu zeichnen (die Wirkungen des alten Bosses sind vorbei)
      kampf.neuerBoss(e, diesesAbenteuer.rekorde()).then(function () {
        if (abenteuer === diesesAbenteuer && spiel) zeichne();
      });
    });
    abenteuer.an("niederlage", function (e) { letzteNiederlage = e; });
    // Verbesserungen behalten (älterer Stand): Plätze und HP neu zeigen
    abenteuer.an("behalten", function () {
      if (abenteuer !== diesesAbenteuer) return;
      kampf.zeigeStand(standFuerAnzeige());
      if (spiel) zeichneZahlenfeld();
    });
    abenteuer.an("sudokuGeloest", function () {
      if (abenteuer === diesesAbenteuer) kampf.text("Sudoku gelöst!");
    });

    kampf.zeigeStand(standFuerAnzeige());
    // Ganz neues Abenteuer: Einblendung der ersten Welt, der erste Boss spricht
    if (abenteuer.zustand.bossNummer === 1 && abenteuer.zustand.rekord === 0 && abenteuer.brauchtRaetsel() &&
        !abenteuer.durchlaufVorbei()) {
      kampf.auftritt(abenteuer.boss());
    }
    kampf.text(abenteuer.zustand.raetsel && !abenteuer.zustand.raetsel.geloest
      ? "Der Kampf geht weiter!"
      : "Ein Boss stellt sich dir in den Weg!");
    // Älterer Spielstand mit mehr Verbesserungen als Plätzen → erst wählen, was bleibt
    if (abenteuer.mussBehalten()) {
      kampf.behalten(rahmen, abenteuer.gesammelt(), function (ids) {
        if (abenteuer !== diesesAbenteuer) return;
        abenteuer.behalteVerbesserungen(ids);       // → Ereignis "behalten"
        setzeBeschaeftigtAnzeige();
        if (spiel && !beschaeftigt.abenteuer && !waehltVerbesserung()) waehle(ausgewaehlt, true);
      });
    }
    // Durchlauf schon vorbei (z. B. während der Niederlage neu geladen oder
    // zwischendurch ins freie Spiel gewechselt)? → gleich die Zusammenfassung;
    // weiter geht es nur mit "Neuer Durchlauf"
    if (abenteuer.durchlaufVorbei()) {
      spiel = null;
      beschaeftigt.abenteuer = true;
      setzeBeschaeftigtAnzeige();
      kampf.text("Der Durchlauf ist vorbei.");
      kampf.durchlaufEnde(rahmen, abenteuer.zusammenfassung()).then(function () {
        if (abenteuer === diesesAbenteuer) neuenDurchlaufStarten();
      });
      return;
    }
    // Beim letzten Mal wurde nicht mehr gewählt? → Auswahl gleich zeigen
    if (abenteuer.zustand.auswahl) zeigeAuswahl(abenteuer.auswahlInfo());

    if (beschaeftigt.abenteuer) return;      // es wird schon ausgelost
    if (abenteuer.brauchtRaetsel()) {
      neuesAbenteuerRaetsel();               // vorher der Buch-Spin, falls noch kein Buch da ist
    } else {
      spiel = abenteuer.zustand.raetsel;
      zeigeAbenteuerGrad();
      waehle(ersteLeereZelle(), false);
      // Laufendes Sudoku, aber noch kein Buch (älterer Spielstand): erst der Buch-Spin
      if (abenteuer.brauchtBuchSpin()) {
        beschaeftigt.abenteuer = true;
        setzeBeschaeftigtAnzeige();
        buchSpinAbwarten().then(function () {
          beschaeftigt.abenteuer = false;
          setzeBeschaeftigtAnzeige();
          if (spiel) zeichne();
        });
      }
    }
  }

  function standFuerAnzeige() {
    const z = abenteuer.zustand;
    return {
      boss: abenteuer.boss(), hp: z.bossHp, heldHp: z.heldHp, heldMaxHp: z.heldMaxHp, phase: abenteuer.phaseStand(),
      ueberladen: abenteuer.ueberladen(),
      muenzen: z.muenzen, rekorde: abenteuer.rekorde(),
      verbesserungen: abenteuer.gesammelt(),
      faehigkeitStand: abenteuer.faehigkeitStand(),
      buchBonus: abenteuer.buchBonus(),
    };
  }

  /** Karten zur Verbesserungswahl zeigen; die Wahl geht an die Regeln. */
  /**
   * @param {object} info – { angebote, rest (noch zu wählen), elite } aus den Regeln
   */
  function zeigeAuswahl(info) {
    const diesesAbenteuer = abenteuer;
    kampf.auswahl(rahmen, info.angebote, function (id) {
      if (abenteuer !== diesesAbenteuer) return;
      // → Ereignisse "verbesserung" und "neuerBoss" (oder "auswahl" für die nächste Wahl)
      abenteuer.waehleVerbesserung(id);
      setzeBeschaeftigtAnzeige();
      if (spiel && !beschaeftigt.abenteuer && !waehltVerbesserung()) waehle(ausgewaehlt, true);
    }, info);
  }

  /**
   * Buch-Spin (Beginn eines Abenteuers, älterer Spielstand ohne Buch):
   * nach den laufenden Animationen und einer offenen Verbesserungsauswahl.
   * Die Regeln losen das Buch aus, das Kampffenster zeigt die Walze.
   * @returns {Promise} – erfüllt, wenn kein Buch-Spin mehr nötig ist
   */
  function buchSpinAbwarten() {
    if (buchSpinLaeuft) return buchSpinLaeuft;
    const diesesAbenteuer = abenteuer;
    const warten = function () {
      return kampf.fertig().then(function () {
        if (abenteuer !== diesesAbenteuer || modus !== "abenteuer") return null;
        if (abenteuer.zustand.auswahl) return warten();
        if (!abenteuer.brauchtBuchSpin()) return null;
        const ergebnis = abenteuer.buchSpin();
        const buecher = SudokuRPG.KONFIG.buecher.map(function (b) { return SudokuRPG.buchFuerAnzeige(b.id, 1); });
        return kampf.buchSpin(rahmen, buecher, ergebnis).then(function () {
          if (spiel) zeichneZahlenfeld();
        });
      });
    };
    buchSpinLaeuft = warten().then(function () { buchSpinLaeuft = null; }, function () { buchSpinLaeuft = null; });
    return buchSpinLaeuft;
  }

  /** Schwierigkeit über dem Gitter – mit dem, was sie bringt. */
  function zeigeAbenteuerGrad() {
    if (!spiel) {
      abenteuerGrad.textContent = "";
      return;
    }
    const b = SudokuRPG.belohnung(spiel.grad);
    abenteuerGrad.textContent = "Schwierigkeit: " + SudokuEngine.gradMitId(spiel.grad).name;
    const belohnung = document.createElement("span");
    belohnung.className = "sudoku-abenteuer-belohnung";
    belohnung.textContent = "Münzen ×" + SudokuRPG.zahlText(b.muenzFaktor) +
      (b.schadensBonus > 0 ? " · Schaden +" + Math.round(b.schadensBonus * 100) + " %" : "");
    abenteuerGrad.appendChild(belohnung);
  }

  /**
   * Lost die Schwierigkeit aus (Slot-Walze) und erzeugt GLEICHZEITIG das
   * neue Rätsel. Gestartet wird, wenn beides fertig ist.
   */
  function neuesAbenteuerRaetsel() {
    const diesesAbenteuer = abenteuer;
    const grad = abenteuer.loseGrad();
    beschaeftigt.abenteuer = true;
    setzeBeschaeftigtAnzeige();

    // Erst die laufenden Kampf-Animationen abwarten, dann die Walze zeigen
    // Erst der Buch-Spin (Beginn des Abenteuers), dann die Walze der Schwierigkeit
    const walze = buchSpinAbwarten().then(function () { return kampf.fertig(); }).then(function () {
      return modus === "abenteuer" ? kampf.losen(rahmen, SudokuEngine.SCHWIERIGKEITSGRADE, grad, SudokuRPG.belohnung(grad.id)) : null;
    });
    const raetsel = SudokuEngine.erzeugeRaetsel(grad.vorgaben);

    Promise.all([raetsel, walze]).then(function (ergebnisse) {
      if (abenteuer !== diesesAbenteuer) return;   // inzwischen neu geladen → verwerfen
      if (abenteuer.durchlaufVorbei()) return;     // inzwischen aufgegeben → die Zusammenfassung regelt den Rest
      beschaeftigt.abenteuer = false;
      const r = ergebnisse[0];
      abenteuer.starteRaetsel(grad.id, r.raetsel, r.loesung);
      if (modus !== "abenteuer") return;
      spiel = abenteuer.zustand.raetsel;
      kampf.zeigeFaehigkeit(abenteuer.faehigkeitStand());   // Wirkungen enden mit dem alten Sudoku
      kampf.zeigeBuchBonus(abenteuer.buchBonus());          // Buch-Bonus beginnt bei 0
      setzeBeschaeftigtAnzeige();
      zeigeStatus("");
      zeigeAbenteuerGrad();
      kampf.text("Neues Sudoku: " + grad.name);
      waehle(ersteLeereZelle(), false);
    });
  }

  /** Abenteuer: richtige Zahlen bleiben gesperrt, falsche verursachen einen Fehler. */
  function setzeImAbenteuer(index, ziffer) {
    if (waehltVerbesserung()) {
      kampf.text("Wähle zuerst eine Verbesserung!");
      return;
    }
    if (ziffer === 0 || spiel.eingaben[index] !== 0) {
      // Löschen gibt es im Abenteuer nicht: richtige Zahlen bleiben stehen
      if (spiel.eingaben[index] !== 0) kampf.text("Richtige Zahlen bleiben stehen");
      return;
    }

    const vorher = aktuellesGitter();
    const ergebnis = abenteuer.setzeZahl(index, ziffer);   // Regeln → Ereignisse → Kampffenster

    if (ergebnis.art === "versiegelt") {
      // Siegel des Bosses: Hier geht gerade nichts. Läuft noch eine Animation,
      // springt sie zum Ende – dann sieht man auch das Siegel.
      if (kampf.laeuft()) kampf.beschleunige();
      zeigeKurzHinweis("Dieser Block ist versiegelt");
      return;
    }

    if (ergebnis.art === "verflucht") {
      // Fluch des Bosses: Diese Ziffer geht gerade nicht (zählt nicht als Zug)
      if (kampf.laeuft()) kampf.beschleunige();
      const wort = SudokuRPG.verwirrungsWort(laufendeWirkungen());
      zeigeKurzHinweis("Die " + zeichenFuer(ergebnis.ziffer, wort) + " ist verflucht");
      return;
    }

    if (ergebnis.niederlage) {
      // Niederlage – durch die falsche Zahl oder den Treffer des Bosses im
      // Verteidigungszug (ein abgelaufener Timer kommt über timerTakt)
      if (ergebnis.art === "fehler") zeigeFehlversuch(index, ziffer);
      else zeichne();
      starteNiederlage();
      return;
    }

    if (ergebnis.art === "richtig") {
      const nachher = aktuellesGitter();
      if (ergebnis.powerup) loesePowerupAus(index, ergebnis.powerup.typ);   // vor zeichne(): Ebene bleibt für die Animation
      if (ergebnis.regenbogen) starteRegenbogenschlag(index);
      zeichne();
      if (ergebnis.geloest) {
        // Die Welle über das Gitter und die Überladung laufen in der
        // Warteschlange des Kampffensters (Ereignis "ueberladung") – erst
        // nach Wurf und Treffer, vor Sieg und Auswahl. Danach neue
        // Schwierigkeit auslosen. Die Eingabe ist sofort gesperrt, ausgegraut
        // wird erst für die Slot-Walze.
        const diesesAbenteuer = abenteuer;
        beschaeftigt.abenteuer = true;
        kampf.danach(function () {
          zeigeStatus("Sudoku gelöst!", "erfolg");
        }).then(function () {
          return new Promise(function (ok) { setTimeout(ok, 600); });
        }).then(function () {
          if (abenteuer !== diesesAbenteuer) return;
          zeigeStatus("");
          beschaeftigt.abenteuer = false;
          neuesAbenteuerRaetsel();
        });
      } else {
        const einheiten = SudokuEffekte.fertigeEinheiten(vorher, nachher, spiel.loesung, index);
        SudokuEffekte.spieleEinheiten(felder, index, einheiten);
      }
      return;
    }

    if (ergebnis.art === "fehler") {
      zeigeFehlversuch(index, ziffer);
    }
  }

  /**
   * Niederlage: Eingabe sperren, nach den Animationen (Fehler, Timer) die
   * Zusammenfassung zeigen. Der Spielstand ist da schon auf Anfang – lädt man
   * neu, kommt gleich die Zusammenfassung (siehe starteAbenteuer).
   */
  function starteNiederlage() {
    const diesesAbenteuer = abenteuer;
    beschaeftigt.abenteuer = true;
    setzeBeschaeftigtAnzeige();
    kampf.durchlaufEnde(rahmen, letzteNiederlage, { animation: true }).then(function () {
      if (abenteuer === diesesAbenteuer) neuenDurchlaufStarten();
    });
  }

  /* ---------- Tick, Tick: die Zeit des Timers ----------
     Die Zeit vergeht nur, solange das Abenteuer wirklich zu sehen ist: Seite
     sichtbar (kein anderer Tab, App nicht im Hintergrund), dieser Bereich des
     Hubs offen, keine Überlagerung über dem Gitter (Verbesserungsauswahl,
     Walzen, Zusammenfassung) – und erst, wenn das Kampffenster den Timer
     gezeigt hat. Die Restzeit speichern die Regeln (jede volle Sekunde). */
  const TIMER_TAKT = 250;       // so oft wird die Zeit weitergezählt (Millisekunden)
  let timerZuletzt = null;      // Zeitpunkt des letzten gezählten Takts (null = pausiert)

  function timerSichtbar() {
    return modus === "abenteuer" && Boolean(abenteuer) && !abenteuer.durchlaufVorbei() &&
      document.visibilityState === "visible" && brett.offsetParent !== null &&
      !rahmen.querySelector(".auswahl, .slot, .niederlage") &&
      laufendeWirkungen().some(function (w) { return w.rest === null; });
  }

  function timerTakt() {
    const jetzt = performance.now();
    if (!timerSichtbar()) {
      timerZuletzt = null;                     // Pause: die Zeit dazwischen zählt nicht
      return;
    }
    const vergangen = timerZuletzt === null ? 0 : jetzt - timerZuletzt;
    timerZuletzt = jetzt;
    if (vergangen <= 0) return;
    // Höchstens eine Sekunde je Takt – ein gedrosselter Hintergrund-Takt springt nicht
    const ergebnis = abenteuer.timerVergeht(Math.min(vergangen, 1000));
    if (!ergebnis) return;
    if (typeof ergebnis.restMs === "number") {
      const feld = brett.querySelector(".sudoku-feld.hat-timer");
      if (feld) aktualisiereTimer(feld, feld.querySelector(".sudoku-timer"));
      return;
    }
    // Abgelaufen: Das Kampffenster zeigt es (Ereignis "timer"). Fallen die HP
    // auf 0, folgt – nach allen Ereignissen – die normale Niederlagen-Abfolge.
    if (ergebnis.niederlage) starteNiederlage();
  }
  setInterval(timerTakt, TIMER_TAKT);
  document.addEventListener("visibilitychange", function () { timerZuletzt = null; });

  /** "Neuer Durchlauf": Welt 1, Level 1 – erst der Buch-Spin, dann die Schwierigkeit. */
  function neuenDurchlaufStarten() {
    abenteuer.neuerDurchlauf();
    letztesWort = null;                       // kein "Das Wort war" aus dem alten Durchlauf
    spiel = null;
    kampf.schliesseAuswahl();
    kampf.zeigeStand(standFuerAnzeige());
    kampf.zeigeWurf(null);
    kampf.neuesAbenteuer();
    kampf.auftritt(abenteuer.boss());
    kampf.text("Durchlauf " + abenteuer.rekorde().durchlaeufe + " beginnt!");
    beschaeftigt.abenteuer = false;
    neuesAbenteuerRaetsel();                  // vorher der Buch-Spin
  }

  /** Kurzer Hinweis über dem Gitter, der nach gut einer Sekunde verschwindet. */
  function zeigeKurzHinweis(text) {
    zeigeStatus(text, "hinweis");
    clearTimeout(statusZeit);
    statusZeit = setTimeout(function () { if (status.textContent === text) zeigeStatus(""); }, 1400);
  }

  /**
   * Regenbogenschlag: Das Feld zerspringt, die Eingabe ist gesperrt, bis die
   * Animation im Kampffenster vorbei ist (sie lässt sich nicht abkürzen).
   */
  function starteRegenbogenschlag(index) {
    const ebene = felder[index].querySelector(".sudoku-regenbogen");
    if (ebene) {
      ebene.classList.add("zerspringt");
      setTimeout(function () {
        ebene.remove();
        felder[index].classList.remove("ist-regenbogen");
      }, 700);
    }
    regenbogenLaeuft = true;
    setzeBeschaeftigtAnzeige();
    Promise.resolve(letzterTreffer).then(function () {
      regenbogenLaeuft = false;
      setzeBeschaeftigtAnzeige();
    });
  }

  /** Die falsche Zahl blinkt kurz rot im Feld und verschwindet wieder. */
  function zeigeFehlversuch(index, ziffer) {
    const feld = felder[index];
    feld.firstChild.textContent = ziffer;
    feld.classList.remove("ist-fehlversuch");
    void feld.offsetWidth;                  // Animation neu starten
    feld.classList.add("ist-fehlversuch");
    setTimeout(function () {
      if (feld.classList.contains("ist-fehlversuch")) zeichne();
    }, 700);
  }

  /**
   * "Durchlauf aufgeben": nach Rückfrage endet der Durchlauf wie bei einer
   * Niederlage – mit Zusammenfassung. Münzen und Rekorde bleiben.
   */
  function durchlaufAufgeben() {
    if (!abenteuer || abenteuer.durchlaufVorbei()) return;
    if (!window.confirm("Durchlauf wirklich aufgeben? Du beginnst wieder in Welt 1, Level 1 – ohne Verbesserungen " +
      "und Bücher. Münzen und Rekorde bleiben.")) {
      return;
    }
    const diesesAbenteuer = abenteuer;
    const daten = abenteuer.aufgeben();
    if (!daten) return;
    spiel = null;
    beschaeftigt.abenteuer = true;
    setzeBeschaeftigtAnzeige();
    kampf.durchlaufEnde(rahmen, daten).then(function () {
      if (abenteuer === diesesAbenteuer) neuenDurchlaufStarten();
    });
  }


  /* ------------------------------------------------------------------------
     BEDIENUNG: MAUS, TASTATUR, ZAHLENFELD
     ------------------------------------------------------------------------ */

  // Klick auf ein Feld wählt es aus
  brett.addEventListener("click", function (event) {
    const feld = event.target.closest(".sudoku-feld");
    if (feld && spiel) {
      waehle(Number(feld.dataset.index), true);
    }
  });

  // Tastatur im Gitter
  brett.addEventListener("keydown", function (event) {
    if (!spiel) return;
    const zeile = Math.floor(ausgewaehlt / 9);
    const spalte = ausgewaehlt % 9;

    // Pfeiltasten: Auswahl bewegen (am Rand bleibt sie stehen)
    const bewegungen = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (event.key in bewegungen) {
      const [dz, ds] = bewegungen[event.key];
      const neueZeile = Math.min(8, Math.max(0, zeile + dz));
      const neueSpalte = Math.min(8, Math.max(0, spalte + ds));
      waehle(neueZeile * 9 + neueSpalte, true);
      event.preventDefault();   // sonst scrollt die Seite
      return;
    }

    // Ziffern 1–9 eintragen
    if (event.key >= "1" && event.key <= "9") {
      setze(Number(event.key));
      event.preventDefault();
      return;
    }

    // Verwirrung: auch die Buchstaben des Worts (A → die Ziffer an seiner Stelle)
    if (modus === "abenteuer" && /^[a-z]$/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const wort = SudokuRPG.verwirrungsWort(laufendeWirkungen());
      const stelle = wort ? wort.indexOf(event.key.toUpperCase()) : -1;
      if (stelle !== -1) {
        setze(stelle + 1);
        event.preventDefault();
        return;
      }
    }

    // Entf, Backspace oder 0 löschen
    if (event.key === "Delete" || event.key === "Backspace" || event.key === "0") {
      setze(0);
      event.preventDefault();
    }
  });

  // Zahlenfeld (vor allem für das Smartphone)
  zahlenfeld.addEventListener("click", function (event) {
    const taste = event.target.closest(".sudoku-taste");
    if (taste && spiel) {
      setze(Number(taste.dataset.ziffer));
    }
  });

  neuKnopf.addEventListener("click", neuesFreiesSpiel);

  /* ---------- Menü der Kopfzeile (Smartphone) ---------- */
  function menueZeigen(an) {
    kopfMenue.hidden = !an;
    kopfMenueKnopf.setAttribute("aria-expanded", String(an));
    if (an) kopfGradAuswahl.value = auswahl.value;
  }
  kopfMenueKnopf.addEventListener("click", function (event) {
    event.stopPropagation();
    menueZeigen(kopfMenue.hidden);
  });
  kopfMenue.addEventListener("click", function (event) {
    const eintrag = event.target.closest("[data-aktion], a");
    if (!eintrag) return;
    menueZeigen(false);
    if (eintrag.dataset.aktion === "neu") {
      // Freies Spiel: neues Rätsel; Abenteuer: zurück zur Moduswahl
      if (modus === "frei") neuesFreiesSpiel();
      else location.hash = "#games/sudoku";
    } else if (eintrag.dataset.aktion === "aufgeben") {
      durchlaufAufgeben();
    }
  });
  // Schwierigkeit im Menü = die Auswahl des freien Spiels
  kopfGradAuswahl.addEventListener("change", function () {
    auswahl.value = kopfGradAuswahl.value;
    auswahl.dispatchEvent(new Event("change"));
  });
  document.addEventListener("click", function (event) {
    if (!kopfMenue.hidden && !kopfMenue.contains(event.target)) menueZeigen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !kopfMenue.hidden) { menueZeigen(false); kopfMenueKnopf.focus(); }
  });

  return {
    zeige: zeige,
  };
}
