/* ==========================================================================
   settings.js – Einstellungen
   - Darstellung: Startseite – Kachelgrößen nach Nutzung an/aus,
     Nutzungsdaten zurücksetzen (früher eigener Abschnitt "Customising" –
     #customising leitet hierher weiter, siehe js/app.js)
   - Sicherung ALLER Daten der Seite (Filme/Serien, Termine, Zu erledigen, Abenteuer, Klettern-Rekord,
     Worträtsel)
     als eine JSON-Datei – Export und Import
   - Sudoku-Abenteuer: Tempo der Kampfanimationen (Würfel und Schadensaufbau)
   - Zu erledigen: Verbindung zur Oracle-Datenbank (js/todo-db.js)

   Aufbau einer Sicherungsdatei:
   {
     format:      "ntb-sicherung",
     version:     1,
     erstellt:    "2026-10-10T14:03:00.000Z",
     filmeSerien: { … }    ← Daten aus MediaStore  (js/media-store.js)
     termine:     { … }    ← Daten aus EventsStore (js/events-store.js)
     zuErledigen: { … }    ← Aufgaben aus TodoStore (js/todo-store.js)
     sudokuAbenteuer: { … } oder null ← Spielstand aus SudokuRPG (js/sudoku-rpg.js)
     klettern:    { … } oder null ← Rekord des Kletterspiels (js/climb/speicher.js)
     woerter:     { … } oder null ← Worträtsel: laufendes Wort, Streaks, Statistik (js/words/speicher.js)
   }
   Neue Bereiche mit eigenen Daten? Hier in exportieren() und importieren()
   ergänzen – die Stores selbst bleiben für die Speicherung zuständig.
   ========================================================================== */

const EinstellungenAnsicht = (function () {

  const FORMAT = "ntb-sicherung";
  const VERSION = 1;

  const el = {};

  /**
   * Baut die Ansicht auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="settings-root">
   */
  function init(container) {
    container.innerHTML =
      // Darstellung (früher "Customising"): Startseite (Werte in js/home.js)
      '<section class="karte einstellungen-block" aria-labelledby="darstellung-titel">' +
        '<h2 id="darstellung-titel">Darstellung</h2>' +
        "<p>Hell oder dunkel stellst du mit dem Schalter oben rechts ein.</p>" +
        '<h3 class="einstellungen-unter">Startseite</h3>' +
        '<label class="einstellungen-feld einstellungen-feld--haken">' +
          '<input type="checkbox" class="einstellungen-nutzung">' +
          "<span>Kachelgrößen nach Nutzung</span>" +
        "</label>" +
        "<p>Die Abschnitte, die du am häufigsten öffnest, bekommen die größeren Kacheln. " +
          "Gezählt wird nur in diesem Browser; Aufrufe älter als 30 Tage zählen nicht mehr. " +
          "Ausgeschaltet gilt die feste Startanordnung.</p>" +
        '<div class="einstellungen-knoepfe">' +
          '<button type="button" class="knopf knopf--gefahr" data-aktion="nutzung-zuruecksetzen">Nutzungsdaten zurücksetzen</button>' +
        "</div>" +
        '<p class="einstellungen-hinweis einstellungen-hinweis--nutzung" role="status"></p>' +
      "</section>" +
      '<section class="karte einstellungen-block" aria-labelledby="sicherung-titel">' +
        '<h2 id="sicherung-titel">Daten sichern</h2>' +
        "<p>Deine Daten liegen nur in diesem Browser. Mit einer Sicherung kannst du sie " +
          "auf einem anderen Gerät oder nach dem Löschen der Browserdaten wiederherstellen. " +
          "Die Datei enthält <strong>Filme/Serien</strong>, <strong>Stundenplan/Termine</strong>, <strong>Zu erledigen</strong> den Spielstand des <strong>Sudoku-Abenteuers</strong>, den Rekord im <strong>Klettern</strong> und Streaks und Statistik des <strong>Worträtsels</strong>.</p>" +
        '<div class="einstellungen-knoepfe">' +
          '<button type="button" class="knopf" data-aktion="exportieren">Daten exportieren</button>' +
          '<button type="button" class="knopf" data-aktion="importieren">Daten importieren</button>' +
          // Unsichtbares Datei-Auswahlfeld – wird über den Import-Button geöffnet
          '<input type="file" class="einstellungen-datei" accept=".json,application/json" hidden>' +
        "</div>" +
        '<p class="einstellungen-hinweis" role="status"></p>' +
      "</section>" +
      // Zu erledigen: Zugangsdaten für die Datenbank (OAuth-Client aus Database Actions)
      '<section class="karte einstellungen-block" aria-labelledby="datenbank-titel">' +
        '<h2 id="datenbank-titel">Datenbank für „Zu erledigen“</h2>' +
        '<p class="einstellungen-db-status"></p>' +
        '<form class="einstellungen-db-formular" autocomplete="off">' +
          '<label class="einstellungen-feld einstellungen-feld--text"><span>Client-ID</span>' +
            '<input type="text" name="clientId" spellcheck="false"></label>' +
          '<label class="einstellungen-feld einstellungen-feld--text"><span>Client-Secret</span>' +
            '<input type="password" name="secret" spellcheck="false"></label>' +
          "<p>Die Zugangsdaten werden nur in diesem Browser gespeichert. Trage sie nur auf deinen eigenen Geräten ein.</p>" +
          '<div class="einstellungen-knoepfe">' +
            '<button type="submit" class="knopf">Verbinden</button>' +
          "</div>" +
        "</form>" +
        '<div class="einstellungen-db-verbunden">' +
          '<div class="einstellungen-knoepfe">' +
            '<button type="button" class="knopf" data-aktion="db-uebertragen">Lokale Aufgaben übertragen</button>' +
            '<button type="button" class="knopf knopf--gefahr" data-aktion="db-trennen">Trennen</button>' +
          "</div>" +
        "</div>" +
        '<p class="einstellungen-hinweis einstellungen-hinweis--db" role="status"></p>' +
      "</section>" +
      // Sudoku-Abenteuer: Tempo von Würfel und Schadensaufbau (Werte in js/sudoku-battle-ui.js)
      '<section class="karte einstellungen-block" aria-labelledby="abenteuer-titel">' +
        '<h2 id="abenteuer-titel">Sudoku-Abenteuer</h2>' +
        '<label class="einstellungen-feld">' +
          "<span>Kampfanimationen</span>" +
          '<select class="einstellungen-wuerfel"></select>' +
        "</label>" +
        "<p>Würfelwurf und Schadensaufbau. Normal: Würfel 2 Sekunden, danach höchstens etwa 1,5 Sekunden. " +
          "Schnell: alles deutlich kürzer. Aus: das Ergebnis erscheint sofort.</p>" +
        '<p class="einstellungen-hinweis einstellungen-hinweis--wuerfel" role="status"></p>' +
        // Alles löschen – auch Münzen und Rekorde (doppelte Rückfrage)
        '<h3 class="einstellungen-unter">Fortschritt</h3>' +
        "<p>Eine Niederlage oder „Durchlauf aufgeben“ beginnt nur den Durchlauf von vorn – Münzen und Rekorde bleiben. " +
          "Hier löschst du wirklich alles, auch Münzen und Rekorde.</p>" +
        '<div class="einstellungen-knoepfe">' +
          '<button type="button" class="knopf knopf--gefahr" data-aktion="abenteuer-loeschen">Alle Fortschritte löschen</button>' +
        "</div>" +
        '<p class="einstellungen-hinweis einstellungen-hinweis--loeschen" role="status"></p>' +
      "</section>";

    // Auswahl aus der Liste der Stufen erzeugen und die gespeicherte vorwählen
    const wuerfelAuswahl = container.querySelector(".einstellungen-wuerfel");
    SudokuKampf.WUERFEL.stufen.forEach(function (stufe) {
      const option = document.createElement("option");
      option.value = stufe.id;
      option.textContent = stufe.name;
      wuerfelAuswahl.appendChild(option);
    });
    wuerfelAuswahl.value = SudokuKampf.wuerfelEinstellung().id;
    wuerfelAuswahl.addEventListener("change", function () {
      SudokuKampf.setzeWuerfelEinstellung(wuerfelAuswahl.value);
      container.querySelector(".einstellungen-hinweis--wuerfel").textContent =
        "Gespeichert: " + SudokuKampf.wuerfelEinstellung().name;
    });

    // Startseite: Kachelgrößen nach Nutzung
    const nutzung = container.querySelector(".einstellungen-nutzung");
    const nutzungHinweis = container.querySelector(".einstellungen-hinweis--nutzung");
    nutzung.checked = StartseiteAnsicht.nachNutzung();
    nutzung.addEventListener("change", function () {
      StartseiteAnsicht.setzeNachNutzung(nutzung.checked);
      nutzungHinweis.textContent = nutzung.checked
        ? "Gespeichert: Kachelgrößen nach Nutzung."
        : "Gespeichert: feste Startanordnung.";
    });

    el.datei = container.querySelector(".einstellungen-datei");
    el.hinweis = container.querySelector(".einstellungen-hinweis");
    el.dbStatus = container.querySelector(".einstellungen-db-status");
    el.dbFormular = container.querySelector(".einstellungen-db-formular");
    el.dbVerbunden = container.querySelector(".einstellungen-db-verbunden");
    el.dbHinweis = container.querySelector(".einstellungen-hinweis--db");
    el.dbFormular.addEventListener("submit", datenbankVerbinden);
    zeigeDatenbank();

    container.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      if (knopf.dataset.aktion === "exportieren") exportieren();
      if (knopf.dataset.aktion === "importieren") el.datei.click();
      if (knopf.dataset.aktion === "abenteuer-loeschen") fortschritteLoeschen(container);
      if (knopf.dataset.aktion === "db-trennen") datenbankTrennen();
      if (knopf.dataset.aktion === "db-uebertragen") datenbankUebertragen(knopf);
      if (knopf.dataset.aktion === "nutzung-zuruecksetzen") {
        StartseiteAnsicht.nutzungZuruecksetzen();
        container.querySelector(".einstellungen-hinweis--nutzung").textContent =
          "Nutzungsdaten gelöscht – die Startseite zeigt wieder die Startanordnung.";
      }
    });
    el.datei.addEventListener("change", importieren);
  }


  /* ------------------------------------------------------------------------
     DATENBANK FÜR "ZU ERLEDIGEN"
     ------------------------------------------------------------------------ */

  /** Formular oder Verbunden-Ansicht zeigen, je nachdem ob Zugangsdaten da sind. */
  function zeigeDatenbank() {
    const verbunden = TodoDb.verbunden();
    el.dbFormular.hidden = verbunden;
    el.dbVerbunden.hidden = !verbunden;
    const lokal = TodoStore.lokaleAufgaben().length;
    el.dbStatus.textContent = verbunden
      ? "Verbunden: Die Aufgaben liegen in der Oracle-Datenbank und sind auf allen verbundenen Geräten gleich. " +
        "In diesem Browser liegen außerdem noch " + lokal + (lokal === 1 ? " lokale Aufgabe" : " lokale Aufgaben") + "."
      : "Nicht verbunden: Die Aufgaben liegen nur in diesem Browser. Mit der Client-ID und dem Secret " +
        "des OAuth-Clients aus Database Actions speicherst du sie in der Datenbank.";
  }

  /** Zugangsdaten speichern und sofort ausprobieren – bei Fehler wieder entfernen. */
  function datenbankVerbinden(event) {
    event.preventDefault();
    const f = el.dbFormular.elements;
    if (!f.clientId.value.trim() || !f.secret.value.trim()) {
      zeigeDbHinweis("Bitte Client-ID und Secret eintragen.", "fehler");
      return;
    }
    TodoDb.setzeZugang(f.clientId.value, f.secret.value);
    zeigeDbHinweis("Verbinde …");
    TodoDb.testen().then(function (anzahl) {
      f.clientId.value = "";
      f.secret.value = "";
      zeigeDatenbank();
      TodoStore.aktualisieren();
      zeigeDbHinweis("Verbunden. In der Datenbank liegen " + anzahl + (anzahl === 1 ? " Aufgabe." : " Aufgaben."), "erfolg");
    }, function (fehler) {
      TodoDb.trennen();
      zeigeDatenbank();
      zeigeDbHinweis("Verbindung fehlgeschlagen: " + fehler.message, "fehler");
    });
  }

  function datenbankTrennen() {
    if (!window.confirm("Verbindung zur Datenbank trennen? Die Aufgaben in der Datenbank bleiben erhalten; " +
      "dieser Browser zeigt danach wieder seine lokalen Aufgaben.")) return;
    TodoDb.trennen();
    zeigeDatenbank();
    zeigeDbHinweis("Getrennt.");
  }

  function datenbankUebertragen(knopf) {
    const anzahl = TodoStore.lokaleAufgaben().length;
    if (!anzahl) {
      zeigeDbHinweis("In diesem Browser liegen keine lokalen Aufgaben.");
      return;
    }
    if (!window.confirm(anzahl + (anzahl === 1 ? " lokale Aufgabe" : " lokale Aufgaben") + " in die Datenbank übertragen? " +
      "Aufgaben, die dort schon liegen, werden übersprungen. Die lokalen Daten bleiben unverändert.")) return;
    knopf.disabled = true;
    zeigeDbHinweis("Übertrage …");
    TodoStore.uebertragen().then(function (e) {
      const text = e.neu + " übertragen, " + e.vorhanden + " waren schon da." +
        (e.fehler.length ? " Nicht übertragen: " + e.fehler.join("; ") : "");
      zeigeDbHinweis(text, e.fehler.length ? "fehler" : "erfolg");
    }, function (fehler) {
      zeigeDbHinweis("Übertragen fehlgeschlagen: " + fehler.message, "fehler");
    }).then(function () {
      knopf.disabled = false;
    });
  }

  function zeigeDbHinweis(text, art) {
    el.dbHinweis.textContent = text;
    el.dbHinweis.dataset.art = art || "";
  }


  /**
   * Sudoku-Abenteuer: alle Fortschritte löschen – nach zwei Rückfragen,
   * denn auch Münzen und Rekorde sind danach weg.
   */
  function fortschritteLoeschen(container) {
    const hinweis = container.querySelector(".einstellungen-hinweis--loeschen");
    if (!window.confirm("Alle Fortschritte im Sudoku-Abenteuer löschen? Auch Münzen und Rekorde gehen verloren.")) return;
    if (!window.confirm("Wirklich? Das lässt sich nicht rückgängig machen.")) {
      hinweis.textContent = "Nichts gelöscht.";
      return;
    }
    SudokuRPG.alleFortschritteLoeschen();
    hinweis.textContent = "Alle Fortschritte gelöscht. Das nächste Abenteuer beginnt ganz von vorn.";
  }


  /* ------------------------------------------------------------------------
     EXPORT
     ------------------------------------------------------------------------ */

  /** Lädt alle Daten als JSON-Datei herunter. */
  function exportieren() {
    const sicherung = {
      format: FORMAT,
      version: VERSION,
      erstellt: new Date().toISOString(),
      filmeSerien: MediaStore.alsObjekt(),
      termine: EventsStore.alsObjekt(),
      zuErledigen: TodoStore.alsObjekt(),
      sudokuAbenteuer: SudokuRPG.alsObjekt(),
      klettern: KletterSpeicher.alsObjekt(),
      woerter: WoerterSpeicher.alsObjekt(),
    };
    const datei = new Blob([JSON.stringify(sicherung, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(datei);
    link.download = "ntb-sicherung-" + EventsStore.datumText(new Date()) + ".json";
    document.body.appendChild(link);
    link.click();                       // startet den Download
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    zeigeHinweis("Export gestartet: " + link.download, "erfolg");
  }


  /* ------------------------------------------------------------------------
     IMPORT
     ------------------------------------------------------------------------ */

  /**
   * Prüft den Inhalt einer Datei, OHNE etwas zu speichern.
   * Versteht auch ältere Dateien, die nur Filme/Serien enthalten
   * (Export aus der Zeit vor den Einstellungen).
   * @returns {{ok: true, media, termine|null, frage} | {ok: false, fehler}}
   */
  function pruefe(text) {
    let roh;
    try {
      roh = JSON.parse(text);
    } catch (fehler) {
      return { ok: false, fehler: "Die Datei enthält kein gültiges JSON." };
    }

    // Ältere Filme/Serien-Sicherung
    if (roh && roh.kategorien && !roh.format) {
      const media = MediaStore.pruefeDaten(roh);
      if (!media.ok) return { ok: false, fehler: media.fehler };
      return {
        ok: true, media: media, termine: null,
        frage: "Das ist eine ältere Sicherung, die nur Filme/Serien enthält (" + media.anzahl + " Einträge).\n" +
          "Deine Filme/Serien werden dadurch ERSETZT, deine Termine bleiben unverändert. Fortfahren?",
      };
    }

    if (!roh || roh.format !== FORMAT) {
      return { ok: false, fehler: "Das ist keine NTB-Sicherungsdatei." };
    }
    if (roh.version !== VERSION) {
      return { ok: false, fehler: "Unbekannte Version der Sicherung (" + roh.version + ")." };
    }
    const media = MediaStore.pruefeDaten(roh.filmeSerien);
    if (!media.ok) return { ok: false, fehler: "Filme/Serien: " + media.fehler };
    const termine = EventsStore.pruefeDaten(roh.termine);
    if (!termine.ok) return { ok: false, fehler: termine.fehler };

    // Sudoku-Abenteuer: in älteren Sicherungen fehlt es → bleibt dann unverändert
    let abenteuer = { vorhanden: false };
    let abenteuerText = "• Sudoku-Abenteuer: nicht enthalten (bleibt unverändert)\n";
    if ("sudokuAbenteuer" in roh) {
      if (roh.sudokuAbenteuer === null) {
        abenteuer = { vorhanden: true, daten: null };
        abenteuerText = "• Sudoku-Abenteuer: noch nicht begonnen\n";
      } else {
        const geprueft = SudokuRPG.pruefeDaten(roh.sudokuAbenteuer);
        if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };
        abenteuer = { vorhanden: true, daten: geprueft.daten };
        abenteuerText = "• Sudoku-Abenteuer: Level " + geprueft.daten.bossNummer +
          ", Rekord Level " + geprueft.daten.rekorde.level +
          ", " + geprueft.daten.muenzen + " Münzen, " +
          Object.keys(geprueft.daten.verbesserungen).length + " Verbesserungen\n";
      }
    }

    // Kletterspiel: in älteren Sicherungen fehlt es → bleibt dann unverändert
    let klettern = { vorhanden: false };
    let kletternText = "• Klettern: nicht enthalten (bleibt unverändert)\n";
    if ("klettern" in roh) {
      if (roh.klettern === null) {
        klettern = { vorhanden: true, daten: null };
        kletternText = "• Klettern: noch nicht gespielt\n";
      } else {
        const geprueft = KletterSpeicher.pruefeDaten(roh.klettern);
        if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };
        klettern = { vorhanden: true, daten: geprueft.daten };
        kletternText = "• Klettern: Rekord " + geprueft.daten.rekord + " m\n";
      }
    }

    // Worträtsel: in älteren Sicherungen fehlt es → bleibt dann unverändert
    let woerter = { vorhanden: false };
    let woerterText = "• Worträtsel: nicht enthalten (bleibt unverändert)\n";
    if ("woerter" in roh) {
      if (roh.woerter === null) {
        woerter = { vorhanden: true, daten: null };
        woerterText = "• Worträtsel: noch nicht gespielt\n";
      } else {
        const geprueft = WoerterSpeicher.pruefeDaten(roh.woerter);
        if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };
        woerter = { vorhanden: true, daten: geprueft.daten };
        const st = geprueft.daten.stats;
        woerterText = "• Worträtsel: bester Streak Deutsch " + st.de.bester + ", Englisch " + st.en.bester + "\n";
      }
    }

    // Zu erledigen: in älteren Sicherungen fehlt es → bleibt dann unverändert
    let aufgaben = null;
    let aufgabenText = "• Zu erledigen: nicht enthalten (bleibt unverändert)\n";
    if ("zuErledigen" in roh) {
      const geprueft = TodoStore.pruefeDaten(roh.zuErledigen);
      if (!geprueft.ok) return { ok: false, fehler: "Zu erledigen: " + geprueft.fehler };
      aufgaben = geprueft.daten;
      const erledigt = aufgaben.aufgaben.filter(function (a) { return a.erledigt; }).length;
      aufgabenText = "• " + aufgaben.aufgaben.length + " Aufgaben (davon " + erledigt + " erledigt)\n";
    }

    const erstellt = typeof roh.erstellt === "string" ? new Date(roh.erstellt) : null;
    const vom = erstellt && !isNaN(erstellt) ? " vom " + erstellt.toLocaleString("de-DE") : "";
    return {
      ok: true, media: media, termine: termine, abenteuer: abenteuer, aufgaben: aufgaben, klettern: klettern, woerter: woerter,
      frage: "Sicherung" + vom + ":\n" +
        "• " + media.anzahl + " Filme/Serien-Einträge\n" +
        "• " + termine.daten.eintraege.length + " Termine/Vorlesungen\n" +
        aufgabenText +
        abenteuerText +
        kletternText +
        woerterText + "\n" +
        "ALLE aktuellen Daten werden dadurch ersetzt. Fortfahren?",
    };
  }

  /** Eine gewählte Datei prüfen und nach Rückfrage einspielen. */
  function importieren() {
    const datei = el.datei.files[0];
    el.datei.value = "";                // damit dieselbe Datei erneut gewählt werden kann
    if (!datei) return;

    datei.text().then(function (text) {
      const pruefung = pruefe(text);
      if (!pruefung.ok) {
        zeigeHinweis("Import abgebrochen: " + pruefung.fehler, "fehler");
        return;
      }
      if (!window.confirm(pruefung.frage)) {
        zeigeHinweis("Import abgebrochen.");
        return;
      }
      MediaStore.ersetzen(pruefung.media.daten);
      if (pruefung.abenteuer && pruefung.abenteuer.vorhanden) {
        SudokuRPG.ersetzen(pruefung.abenteuer.daten);
      }
      if (pruefung.klettern && pruefung.klettern.vorhanden) {
        KletterSpeicher.ersetzen(pruefung.klettern.daten);
      }
      if (pruefung.woerter && pruefung.woerter.vorhanden) {
        WoerterSpeicher.ersetzen(pruefung.woerter.daten);
      }
      if (pruefung.termine) {
        EventsStore.ersetzen(pruefung.termine.daten);
      }
      if (pruefung.aufgaben) {
        TodoStore.ersetzen(pruefung.aufgaben);
      }
      zeigeHinweis("Import erfolgreich. Alle Bereiche zeigen jetzt die wiederhergestellten Daten.", "erfolg");
    });
  }

  /** art: "" (neutral), "erfolg" oder "fehler" */
  function zeigeHinweis(text, art) {
    el.hinweis.textContent = text;
    el.hinweis.dataset.art = art || "";
  }


  return {
    init: init,
  };
})();
