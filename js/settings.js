/* ==========================================================================
   settings.js – Einstellungen
   - Sicherung ALLER Daten der Seite (Filme/Serien, Termine, Abenteuer)
     als eine JSON-Datei – Export und Import
   - Sudoku-Abenteuer: Tempo der Kampfanimationen (Würfel und Schadensaufbau)

   Aufbau einer Sicherungsdatei:
   {
     format:      "ntb-sicherung",
     version:     1,
     erstellt:    "2026-10-10T14:03:00.000Z",
     filmeSerien: { … }    ← Daten aus MediaStore  (js/media-store.js)
     termine:     { … }    ← Daten aus EventsStore (js/events-store.js)
     sudokuAbenteuer: { … } oder null ← Spielstand aus SudokuRPG (js/sudoku-rpg.js)
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
      '<section class="karte einstellungen-block" aria-labelledby="sicherung-titel">' +
        '<h2 id="sicherung-titel">Daten sichern</h2>' +
        "<p>Deine Daten liegen nur in diesem Browser. Mit einer Sicherung kannst du sie " +
          "auf einem anderen Gerät oder nach dem Löschen der Browserdaten wiederherstellen. " +
          "Die Datei enthält <strong>Filme/Serien</strong>, <strong>Stundenplan/Termine</strong> und den Spielstand des <strong>Sudoku-Abenteuers</strong>.</p>" +
        '<div class="einstellungen-knoepfe">' +
          '<button type="button" class="knopf" data-aktion="exportieren">Daten exportieren</button>' +
          '<button type="button" class="knopf" data-aktion="importieren">Daten importieren</button>' +
          // Unsichtbares Datei-Auswahlfeld – wird über den Import-Button geöffnet
          '<input type="file" class="einstellungen-datei" accept=".json,application/json" hidden>' +
        "</div>" +
        '<p class="einstellungen-hinweis" role="status"></p>' +
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

    el.datei = container.querySelector(".einstellungen-datei");
    el.hinweis = container.querySelector(".einstellungen-hinweis");

    container.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      if (knopf.dataset.aktion === "exportieren") exportieren();
      if (knopf.dataset.aktion === "importieren") el.datei.click();
    });
    el.datei.addEventListener("change", importieren);
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
      sudokuAbenteuer: SudokuRPG.alsObjekt(),
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
        abenteuerText = "• Sudoku-Abenteuer: Boss " + geprueft.daten.bossNummer +
          ", Rekord " + geprueft.daten.rekord +
          ", " + geprueft.daten.muenzen + " Münzen, " +
          Object.keys(geprueft.daten.verbesserungen).length + " Verbesserungen\n";
      }
    }

    const erstellt = typeof roh.erstellt === "string" ? new Date(roh.erstellt) : null;
    const vom = erstellt && !isNaN(erstellt) ? " vom " + erstellt.toLocaleString("de-DE") : "";
    return {
      ok: true, media: media, termine: termine, abenteuer: abenteuer,
      frage: "Sicherung" + vom + ":\n" +
        "• " + media.anzahl + " Filme/Serien-Einträge\n" +
        "• " + termine.daten.eintraege.length + " Termine/Vorlesungen\n" +
        abenteuerText + "\n" +
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
      if (pruefung.termine) {
        EventsStore.ersetzen(pruefung.termine.daten);
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
