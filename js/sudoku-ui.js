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
  let letzteNiederlage = null;  // Daten der letzten Niederlage (für den Niederlage-Bildschirm)
  let ausgewaehlt = 0;          // Nummer des gewählten Felds (0–80)

  // Wird gerade ein Rätsel erzeugt/ausgelost? (je Modus getrennt)
  const beschaeftigt = { frei: false, abenteuer: false };
  function wirdErzeugt() {
    return Boolean(modus && beschaeftigt[modus]) || waehltVerbesserung();
  }
  /** Im Abenteuer ist gerade eine Verbesserungsauswahl offen → keine Eingabe. */
  function waehltVerbesserung() {
    return modus === "abenteuer" && Boolean(abenteuer && abenteuer.zustand.auswahl);
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
        "nach jedem Boss wählst du eine Verbesserung – verlierst du alle Leben, musst du neu antreten.</p>" +
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
      // Der Rahmen hält Gitter und Statusmeldung zusammen:
      // Die Meldung schwebt ÜBER dem Gitter und braucht so keinen eigenen Platz.
      '<div class="sudoku-brett-rahmen">' +
        '<div class="sudoku-brett" role="group" aria-label="Sudoku-Gitter. Pfeiltasten zum Bewegen, Ziffern zum Eintragen."></div>' +
        // role="status": Screenreader lesen Änderungen dieses Texts automatisch vor
        '<p class="sudoku-status" role="status"></p>' +
      "</div>" +
      '<div class="sudoku-zahlenfeld" role="group" aria-label="Zahlenfeld"></div>' +
    "</div>";

  const modiAuswahl = container.querySelector(".sudoku-modi");
  const sudokuBereich = container.querySelector(".sudoku");
  const auswahl = container.querySelector(".sudoku-auswahl");
  const neuKnopf = container.querySelector(".sudoku-neu");
  const abenteuerGrad = container.querySelector(".sudoku-abenteuer-grad");
  const kampfPlatz = container.querySelector(".sudoku-kampf");
  const rahmen = container.querySelector(".sudoku-brett-rahmen");
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
    modiAuswahl.querySelector(".sudoku-modus-stand").textContent = stand
      ? "Weiter bei Boss " + stand.bossNummer + " (" + SudokuRPG.bossInfo(stand.bossNummer).name + ")" +
        (stand.rekord > 0 ? " · Rekord: " + stand.rekord : "") +
        (stand.muenzen > 0 ? " · " + stand.muenzen + " Münzen" : "")
      : "Neues Abenteuer beginnen";
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
      feld.classList.remove("ist-fehlversuch");

      // "Roving Tabindex": nur das gewählte Feld ist per Tab erreichbar,
      // innerhalb des Gitters bewegt man sich mit den Pfeiltasten
      feld.tabIndex = i === ausgewaehlt ? 0 : -1;

      // Beschreibung für Screenreader, z. B. "Zeile 3, Spalte 5: 7, falsch"
      let beschreibung = "Zeile " + (zeile + 1) + ", Spalte " + (spalte + 1) + ": ";
      beschreibung += wert === 0 ? "leer" : wert;
      if (istVorgabe) beschreibung += ", vorgegeben";
      if (istFalsch) beschreibung += ", falsch";
      const powerup = powerupTypAuf(i);
      if (powerup) beschreibung += ", Power-up: " + powerup.name;
      feld.setAttribute("aria-label", beschreibung);
      zeichnePowerup(feld, powerup);
    }

    brett.classList.toggle("ist-geloest", spiel.geloest);

    zeichneZahlenfeld();
  }

  /**
   * Power-up-Typ auf Feld i (nur im Abenteuer, sonst null).
   * Die Liste steht im Rätsel des Abenteuers (siehe js/sudoku-rpg.js).
   */
  function powerupTypAuf(i) {
    if (modus !== "abenteuer" || !spiel.powerups || powerupsVersteckt()) return null;
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

  /** Boss-Eigenheit "Nebel": Power-up-Felder werden nicht gezeigt (wirken aber). */
  function powerupsVersteckt() {
    const eigenheit = abenteuer && abenteuer.boss().eigenheit;
    return Boolean(eigenheit && eigenheit.wirkung.powerupsUnsichtbar);
  }

  /**
   * Ausgelöstes Power-up: Markierung leuchtet kurz auf und verschwindet.
   * War es im Nebel versteckt, taucht es dafür kurz auf.
   */
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

  /** Graut Gitter und Knöpfe aus, solange im aktuellen Modus ein Rätsel entsteht. */
  function setzeBeschaeftigtAnzeige() {
    const an = wirdErzeugt();
    neuKnopf.disabled = an;
    auswahl.disabled = an;
    brett.classList.toggle("wird-erzeugt", an);
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
    const diesesAbenteuer = abenteuer;

    if (!kampf) {
      kampf = SudokuKampf.erstelle(kampfPlatz, { beimZuruecksetzen: abenteuerZuruecksetzen });
    }

    // Auf die Regeln hören → Kampffenster und Gitter reagieren
    abenteuer.an("richtig", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      // Für die Belohnungszeilen im Panel: Werte zum Zeitpunkt des Treffers
      e.werte = diesesAbenteuer.werte();
      kampf.treffer(e);
    });
    // Das Power-up-Ereignis kommt direkt nach "richtig" – seine Wirkung
    // (z. B. +10 Münzen) gehört zum selben Treffer
    abenteuer.an("powerup", function (e) { e.treffer.powerupEffekt = e.effekt; });
    abenteuer.an("fehler", function (e) { if (abenteuer === diesesAbenteuer) kampf.fehler(e); });
    abenteuer.an("bossBesiegt", function (e) { if (abenteuer === diesesAbenteuer) kampf.sieg(e); });
    abenteuer.an("auswahl", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      setzeBeschaeftigtAnzeige();           // Gitter gesperrt, bis gewählt ist
      zeigeAuswahl(e);
    });
    abenteuer.an("verbesserung", function (e) { if (abenteuer === diesesAbenteuer) kampf.verbesserung(e); });
    abenteuer.an("neuerBoss", function (e) {
      if (abenteuer !== diesesAbenteuer) return;
      // Nach dem Erscheinen neu zeichnen: Ein Boss mit "Nebel" versteckt die Power-ups
      kampf.neuerBoss(e, diesesAbenteuer.zustand.rekord).then(function () {
        if (abenteuer === diesesAbenteuer && spiel) zeichne();
      });
    });
    abenteuer.an("niederlage", function (e) { letzteNiederlage = e; });
    abenteuer.an("sudokuGeloest", function () {
      if (abenteuer === diesesAbenteuer) kampf.text("Sudoku gelöst!");
    });

    kampf.zeigeStand(standFuerAnzeige());
    kampf.text(abenteuer.zustand.raetsel && !abenteuer.zustand.raetsel.geloest
      ? "Der Kampf geht weiter!"
      : "Ein Boss stellt sich dir in den Weg!");
    // Beim letzten Mal wurde nicht mehr gewählt? → Auswahl gleich zeigen
    if (abenteuer.zustand.auswahl) zeigeAuswahl(abenteuer.auswahlInfo());

    if (beschaeftigt.abenteuer) return;      // es wird schon ausgelost
    if (abenteuer.brauchtRaetsel()) {
      neuesAbenteuerRaetsel();
    } else {
      spiel = abenteuer.zustand.raetsel;
      zeigeAbenteuerGrad();
      waehle(ersteLeereZelle(), false);
    }
  }

  function standFuerAnzeige() {
    const z = abenteuer.zustand;
    const werte = abenteuer.werte();
    return {
      boss: abenteuer.boss(), hp: z.bossHp, leben: z.leben, maxLeben: werte.maxLeben,
      muenzen: z.muenzen, rekord: z.rekord,
      kombo: z.kombo, komboBonus: Math.min(z.kombo * SudokuRPG.KONFIG.kombo.proStufe, werte.komboMax),
      verbesserungen: abenteuer.gesammelt(),
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
    const walze = kampf.fertig().then(function () {
      return modus === "abenteuer" ? kampf.losen(rahmen, SudokuEngine.SCHWIERIGKEITSGRADE, grad, SudokuRPG.belohnung(grad.id)) : null;
    });
    const raetsel = SudokuEngine.erzeugeRaetsel(grad.vorgaben);

    Promise.all([raetsel, walze]).then(function (ergebnisse) {
      beschaeftigt.abenteuer = false;
      if (abenteuer !== diesesAbenteuer) return;   // inzwischen neu geladen → verwerfen
      const r = ergebnisse[0];
      abenteuer.starteRaetsel(grad.id, r.raetsel, r.loesung);
      if (modus !== "abenteuer") return;
      spiel = abenteuer.zustand.raetsel;
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

    if (ergebnis.art === "richtig") {
      const nachher = aktuellesGitter();
      if (ergebnis.powerup) loesePowerupAus(index, ergebnis.powerup.typ);   // vor zeichne(): Ebene bleibt für die Animation
      zeichne();
      if (ergebnis.geloest) {
        // Große Welle über das Gitter, danach neue Schwierigkeit auslosen
        beschaeftigt.abenteuer = true;
        setzeBeschaeftigtAnzeige();
        brett.classList.remove("wird-erzeugt");      // die Welle soll man sehen
        SudokuEffekte.spieleSieg(felder, index).then(function () {
          zeigeStatus("Sudoku gelöst!", "erfolg");
          return new Promise(function (ok) { setTimeout(ok, 900); });
        }).then(function () {
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
      if (ergebnis.niederlage) {
        // Eingabe sperren, Niederlage-Bildschirm zeigen, dann neu antreten
        const diesesAbenteuer = abenteuer;
        beschaeftigt.abenteuer = true;
        setzeBeschaeftigtAnzeige();
        kampf.niederlage(rahmen, letzteNiederlage).then(function () {
          if (abenteuer !== diesesAbenteuer) return;
          kampf.zeigeStand(standFuerAnzeige());
          kampf.text("Neuer Versuch gegen " + abenteuer.boss().name + "!");
          beschaeftigt.abenteuer = false;
          neuesAbenteuerRaetsel();
        });
      }
    }
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

  function abenteuerZuruecksetzen() {
    if (!window.confirm("Abenteuer wirklich zurücksetzen? Du beginnst wieder bei Boss 1 mit " + SudokuRPG.KONFIG.startLeben +
      " Leben – Rekord, Münzen, Kombo und Verbesserungen werden gelöscht.")) {
      return;
    }
    abenteuer.zuruecksetzen();
    kampf.schliesseAuswahl();
    setzeBeschaeftigtAnzeige();
    kampf.zeigeStand(standFuerAnzeige());
    kampf.zeigeWurf(null);
    kampf.neuesAbenteuer();
    kampf.text("Ein neues Abenteuer beginnt!");
    if (!beschaeftigt.abenteuer) neuesAbenteuerRaetsel();
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

  neuKnopf.addEventListener("click", neuesFreiesSpiel);

  return {
    zeige: zeige,
  };
}
