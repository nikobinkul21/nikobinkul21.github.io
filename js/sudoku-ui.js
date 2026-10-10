/* ==========================================================================
   sudoku-ui.js – Darstellung und Bedienung des Sudokus
   Die eigentliche Logik (erzeugen, lösen, prüfen) steckt in sudoku-engine.js.
   Diese Datei zeichnet das Gitter, reagiert auf Klicks und Tasten und
   speichert das laufende Spiel im localStorage.
   ========================================================================== */

// Name des Eintrags im localStorage
const SUDOKU_SPEICHER_SCHLUESSEL = "ntb-sudoku";

/**
 * Liest das gespeicherte Sudoku (nur lesen, ändert nichts).
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
 */
function initSudoku(container) {

  /* ------------------------------------------------------------------------
     ZUSTAND DES SPIELS
     spiel = {
       grad:     id des Schwierigkeitsgrads, z. B. "mittel"
       vorgaben: 81 Zahlen – die vorgegebenen Zahlen (0 = leer)
       loesung:  81 Zahlen – die komplette Lösung
       eingaben: 81 Zahlen – was du selbst eingetragen hast (0 = nichts)
       geloest:  true, sobald alles richtig ist
     }
     ------------------------------------------------------------------------ */
  let spiel = null;
  let ausgewaehlt = 0;          // Nummer des gewählten Felds (0–80)
  let wirdErzeugt = false;      // true, während ein neues Rätsel berechnet wird


  /* ------------------------------------------------------------------------
     HTML-GERÜST AUFBAUEN
     ------------------------------------------------------------------------ */

  container.innerHTML =
    '<div class="sudoku">' +
      '<div class="sudoku-steuerung">' +
        '<label class="sudoku-label">' +
          // Der Text ist auf dem Handy versteckt (Platz sparen), bleibt aber für Screenreader da
          '<span class="sudoku-label-text">Schwierigkeit</span>' +
          '<select class="sudoku-auswahl"></select>' +
        "</label>" +
        '<button type="button" class="sudoku-knopf sudoku-neu">Neues Spiel</button>' +
      "</div>" +
      // Der Rahmen hält Gitter und Statusmeldung zusammen:
      // Die Meldung schwebt ÜBER dem Gitter und braucht so keinen eigenen Platz.
      '<div class="sudoku-brett-rahmen">' +
        '<div class="sudoku-brett" role="group" aria-label="Sudoku-Gitter. Pfeiltasten zum Bewegen, Ziffern zum Eintragen."></div>' +
        // role="status": Screenreader lesen Änderungen dieses Texts automatisch vor
        '<p class="sudoku-status" role="status"></p>' +
      "</div>" +
      '<div class="sudoku-zahlenfeld" role="group" aria-label="Zahlenfeld"></div>' +
    "</div>";

  const auswahl = container.querySelector(".sudoku-auswahl");
  const neuKnopf = container.querySelector(".sudoku-neu");
  const status = container.querySelector(".sudoku-status");
  const brett = container.querySelector(".sudoku-brett");
  const zahlenfeld = container.querySelector(".sudoku-zahlenfeld");

  // Auswahl der Schwierigkeitsgrade aus der Liste in der Engine erzeugen
  SudokuEngine.SCHWIERIGKEITSGRADE.forEach(function (grad) {
    const option = document.createElement("option");
    option.value = grad.id;
    option.textContent = grad.name;
    auswahl.appendChild(option);
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
    taste.textContent = ziffer;
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
     SPEICHERN UND LADEN
     ------------------------------------------------------------------------ */

  function speichern() {
    try {
      localStorage.setItem(SUDOKU_SPEICHER_SCHLUESSEL, JSON.stringify(spiel));
    } catch (fehler) {
      // Speichern nicht möglich (z. B. privater Modus) – Spiel läuft trotzdem
    }
  }

  /** Lädt ein gespeichertes Spiel. Gibt null zurück, wenn keins da oder es kaputt ist. */
  function laden() {
    // Fehlt das Spiel oder ist es kaputt, kommt null → neues Spiel
    return sudokuSpielstandLesen();
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
    const zeileA = Math.floor(ausgewaehlt / 9);
    const spalteA = ausgewaehlt % 9;
    const blockA = SudokuEngine.blockVon(ausgewaehlt);
    const wertA = wertVon(ausgewaehlt);

    for (let i = 0; i < 81; i++) {
      const feld = felder[i];
      const wert = wertVon(i);
      const zeile = Math.floor(i / 9);
      const spalte = i % 9;
      const istVorgabe = spiel.vorgaben[i] !== 0;
      const istFalsch = !istVorgabe && wert !== 0 && wert !== spiel.loesung[i];

      feld.firstChild.textContent = wert === 0 ? "" : wert;

      // CSS-Klassen für die Optik (Farben stehen in css/sudoku.css)
      feld.classList.toggle("ist-vorgabe", istVorgabe);
      feld.classList.toggle("ist-eingabe", !istVorgabe && wert !== 0);
      feld.classList.toggle("ist-falsch", istFalsch);
      feld.classList.toggle("ist-ausgewaehlt", i === ausgewaehlt);
      feld.classList.toggle("ist-verwandt",
        i !== ausgewaehlt &&
        (zeile === zeileA || spalte === spalteA || SudokuEngine.blockVon(i) === blockA));
      feld.classList.toggle("ist-gleich", i !== ausgewaehlt && wertA !== 0 && wert === wertA);

      // "Roving Tabindex": nur das gewählte Feld ist per Tab erreichbar,
      // innerhalb des Gitters bewegt man sich mit den Pfeiltasten
      feld.tabIndex = i === ausgewaehlt ? 0 : -1;

      // Beschreibung für Screenreader, z. B. "Zeile 3, Spalte 5: 7, falsch"
      let beschreibung = "Zeile " + (zeile + 1) + ", Spalte " + (spalte + 1) + ": ";
      beschreibung += wert === 0 ? "leer" : wert;
      if (istVorgabe) beschreibung += ", vorgegeben";
      if (istFalsch) beschreibung += ", falsch";
      feld.setAttribute("aria-label", beschreibung);
    }

    brett.classList.toggle("ist-geloest", spiel.geloest);

    zeichneZahlenfeld();
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

    for (let ziffer = 1; ziffer <= 9; ziffer++) {
      const taste = zahlenfeld.querySelector('[data-ziffer="' + ziffer + '"]');
      const fertig = richtig[ziffer] === 9;
      taste.classList.toggle("ist-fertig", fertig);
      // disabled: Die Taste ist nicht mehr anklickbar – es gibt für die
      // Ziffer ja keinen freien Platz mehr
      taste.disabled = fertig;
      taste.setAttribute("aria-label", fertig
        ? "Ziffer " + ziffer + ": alle gesetzt"
        : "Ziffer " + ziffer + " eintragen");
    }
  }


  /* ------------------------------------------------------------------------
     SPIELZÜGE
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
    if (wirdErzeugt || spiel.geloest || spiel.vorgaben[ausgewaehlt] !== 0) {
      return;                   // vorgegebene Felder sind gesperrt
    }
    const index = ausgewaehlt;
    const vorher = aktuellesGitter();
    spiel.eingaben[index] = ziffer;
    const nachher = aktuellesGitter();

    // Alles richtig ausgefüllt?
    const jetztGeloest = SudokuEngine.istGeloest(nachher, spiel.loesung);
    if (jetztGeloest) {
      spiel.geloest = true;
    }

    speichern();
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

  /** Läuft gerade ein Spiel, in dem man schon etwas eingetragen hat? */
  function spielLaeuft() {
    return spiel && !spiel.geloest && spiel.eingaben.some(function (z) { return z !== 0; });
  }

  /** Zeigt einen Text über dem Gitter. art: "" (normal) oder "erfolg" */
  function zeigeStatus(text, art) {
    status.textContent = text;
    status.dataset.art = art || "";
  }

  /** Erzeugt ein neues Rätsel im gewählten Schwierigkeitsgrad. */
  function neuesSpiel() {
    if (spielLaeuft() &&
        !window.confirm("Das laufende Spiel geht verloren. Neues Spiel starten?")) {
      return;
    }

    const grad = SudokuEngine.gradMitId(auswahl.value);
    wirdErzeugt = true;
    neuKnopf.disabled = true;
    auswahl.disabled = true;
    brett.classList.add("wird-erzeugt");
    zeigeStatus("Rätsel wird erzeugt …");

    // Die Engine rechnet in kleinen Häppchen, damit die Seite nicht einfriert.
    // ".then" läuft, sobald das Rätsel fertig ist.
    SudokuEngine.erzeugeRaetsel(grad.vorgaben).then(function (ergebnis) {
      spiel = {
        grad: grad.id,
        vorgaben: ergebnis.raetsel,
        loesung: ergebnis.loesung,
        eingaben: new Array(81).fill(0),
        geloest: false,
      };
      wirdErzeugt = false;
      neuKnopf.disabled = false;
      auswahl.disabled = false;
      brett.classList.remove("wird-erzeugt");
      zeigeStatus("");
      speichern();
      waehle(ersteLeereZelle(), false);
    });
  }

  /** Nummer des ersten leeren Felds – dort startet die Auswahl. */
  function ersteLeereZelle() {
    const i = spiel.vorgaben.indexOf(0);
    return i === -1 ? 0 : i;
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

  neuKnopf.addEventListener("click", neuesSpiel);


  /* ------------------------------------------------------------------------
     START: gespeichertes Spiel fortsetzen oder ein neues erzeugen
     ------------------------------------------------------------------------ */

  spiel = laden();
  if (spiel) {
    auswahl.value = spiel.grad;
    if (spiel.geloest) {
      zeigeStatus("Geschafft! Alle Zahlen sind richtig.", "erfolg");
    }
    waehle(ersteLeereZelle(), false);
  } else {
    // Beim allerersten Mal: der erste Grad aus der Liste
    auswahl.value = SudokuEngine.SCHWIERIGKEITSGRADE[0].id;
    neuesSpiel();
  }
}
