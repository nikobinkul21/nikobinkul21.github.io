/* ==========================================================================
   media.js – Darstellung und Bedienung von "Filme/Serien"
   Die Daten kommen ausschließlich aus js/media-store.js (MediaStore).

   Adressen (URL-Hash):
     #media                    → Übersicht mit einer Karte pro Kategorie
     #media/anime              → Kategorie "Anime", Unterseite Watchlist
     #media/anime/watchlist    → dasselbe
     #media/anime/watched      → Kategorie "Anime", Unterseite Watched
   Alle Kategorien benutzen denselben Code – nur die id ist anders.

   Alles steckt in "MediaAnsicht", damit die Hilfsfunktionen (knopf,
   exportieren …) nicht mit gleichnamigen Funktionen anderer Dateien
   zusammenstoßen. Nach außen sichtbar sind nur init und zeige.
   ========================================================================== */

const MediaAnsicht = (function () {

  // Die beiden Unterseiten jeder Kategorie
  const MEDIA_LISTEN = [
    { id: "watchlist", name: "Watchlist" },
    { id: "watched", name: "Watched" },
  ];

  // Was gerade angezeigt wird
  const mediaZustand = {
    kategorie: null,      // z. B. { id: "anime", name: "Anime" } – null = Übersicht
    liste: "watchlist",   // "watchlist" oder "watched"
    bearbeitung: null,    // { id, modus: "bearbeiten" | "geschaut" } – oder null
  };

  // Häufig gebrauchte Elemente (werden in initMedia gefüllt)
  const mediaEl = {};


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  /**
   * Baut die Ansicht auf: Übersicht + EIN Bereich für die Kategorien
   * (der für jede Kategorie wiederverwendet wird).
   * Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="media-root">
   */
  function initMedia(container) {
    let html = '<div class="media-uebersicht">';

    // Eine Karte pro Kategorie
    html += '<div class="karten-raster">';
    MediaStore.KATEGORIEN.forEach(function (k) {
      html +=
        '<a class="karte link-karte" href="#media/' + k.id + '">' +
          "<h2>" + k.name + "</h2>" +
          '<p class="media-zaehler" data-kategorie="' + k.id + '"></p>' +
        "</a>";
    });
    html += "</div>";

    // Export / Import
    html +=
      '<section class="karte media-daten" aria-labelledby="media-daten-titel">' +
        '<h2 id="media-daten-titel">Daten</h2>' +
        "<p>Sichere alle Listen als Datei oder spiele eine Sicherung wieder ein.</p>" +
        '<div class="media-daten-knoepfe">' +
          '<button type="button" class="media-knopf" data-aktion="exportieren">Daten exportieren</button>' +
          '<button type="button" class="media-knopf" data-aktion="importieren">Daten importieren</button>' +
          // Unsichtbares Datei-Auswahlfeld – wird über den Import-Button geöffnet
          '<input type="file" class="media-datei" accept=".json,application/json" hidden>' +
        "</div>" +
        '<p class="media-hinweis" role="status"></p>' +
      "</section>";
    html += "</div>";

    // Der Kategorie-Bereich (Inhalt wird beim Anzeigen gefüllt)
    html +=
      '<div class="media-kategorie" hidden>' +
        '<div class="unterseite-kopf">' +
          '<a class="zurueck-link" href="#media">← Übersicht</a>' +
          '<h2 class="unterseite-titel" tabindex="-1"></h2>' +
        "</div>" +
        '<nav class="media-tabs" aria-label="Liste wählen"></nav>' +
        '<form class="media-formular">' +
          '<label class="nur-screenreader" for="media-titel-eingabe">Titel</label>' +
          '<input type="text" id="media-titel-eingabe" class="media-eingabe" placeholder="Titel" autocomplete="off">' +
          '<select class="media-auswahl media-formular-bewertung" aria-label="Bewertung"></select>' +
          '<button type="submit" class="media-knopf media-knopf--haupt">Hinzufügen</button>' +
        "</form>" +
        '<p class="media-hinweis" role="status"></p>' +
        '<ul class="media-liste"></ul>' +
      "</div>";

    container.innerHTML = html;

    mediaEl.uebersicht = container.querySelector(".media-uebersicht");
    mediaEl.datenHinweis = container.querySelector(".media-daten .media-hinweis");
    mediaEl.datei = container.querySelector(".media-datei");
    mediaEl.kategorie = container.querySelector(".media-kategorie");
    mediaEl.titel = container.querySelector(".media-kategorie .unterseite-titel");
    mediaEl.tabs = container.querySelector(".media-tabs");
    mediaEl.formular = container.querySelector(".media-formular");
    mediaEl.eingabe = container.querySelector(".media-eingabe");
    mediaEl.formularBewertung = container.querySelector(".media-formular-bewertung");
    mediaEl.hinweis = container.querySelector(".media-kategorie .media-hinweis");
    mediaEl.liste = container.querySelector(".media-liste");

    // Bewertungs-Auswahl im Formular füllen
    fuelleBewertungen(mediaEl.formularBewertung, null);

    // Ereignisse
    mediaEl.formular.addEventListener("submit", function (event) {
      event.preventDefault();             // sonst lädt der Browser die Seite neu
      hinzufuegen();
    });
    mediaEl.liste.addEventListener("click", klickInListe);
    mediaEl.liste.addEventListener("submit", absendenInListe);
    mediaEl.liste.addEventListener("keydown", function (event) {
      // Escape bricht Bearbeiten / Geschaut ab
      if (event.key === "Escape" && mediaZustand.bearbeitung) {
        const id = mediaZustand.bearbeitung.id;
        mediaZustand.bearbeitung = null;
        zeichneListe();
        fokusAufEintrag(id);
      }
    });
    mediaEl.uebersicht.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      if (knopf.dataset.aktion === "exportieren") exportieren();
      if (knopf.dataset.aktion === "importieren") mediaEl.datei.click();
    });
    mediaEl.datei.addEventListener("change", importieren);
  }

  /**
   * Zeigt Übersicht oder Kategorie – je nach Adresse.
   * Wird von app.js bei JEDEM Öffnen aufgerufen.
   * @param {string} unterseite – z. B. "" oder "anime" oder "anime/watched"
   * @returns {HTMLElement|null} – Element, das den Fokus bekommen soll
   */
  function zeigeMedia(unterseite) {
    const teile = unterseite.split("/");
    const kategorie = MediaStore.KATEGORIEN.find(function (k) { return k.id === teile[0]; });
    const liste = teile[1] === "watched" ? "watched" : "watchlist"; // Unbekanntes → Watchlist

    // Große Überschrift "Filme/Serien" nur auf der Übersicht zeigen
    document.getElementById("view-media").classList.toggle("zeigt-unterseite", Boolean(kategorie));
    mediaEl.uebersicht.hidden = Boolean(kategorie);
    mediaEl.kategorie.hidden = !kategorie;

    if (!kategorie) {
      mediaZustand.kategorie = null;
      zeichneUebersicht();
      return null;
    }

    // War dieselbe Kategorie schon offen und es wurde nur die Liste gewechselt,
    // bleibt der Fokus auf dem Umschalter statt zur Überschrift zu springen
    const nurListeGewechselt = mediaZustand.kategorie === kategorie;

    mediaZustand.kategorie = kategorie;
    mediaZustand.liste = liste;
    mediaZustand.bearbeitung = null;
    zeigeHinweis(mediaEl.hinweis, "");
    zeichneKategorie();

    return nurListeGewechselt
      ? mediaEl.tabs.querySelector('[aria-current="page"]')
      : mediaEl.titel;
  }


  /* ==========================================================================
     ZEICHNEN
     Wichtig: Titel werden immer mit textContent eingesetzt, nie als HTML –
     so kann ein Titel wie "<b>Test</b>" die Seite nicht verändern.
     ========================================================================== */

  /** Zahlen auf den Übersichts-Karten aktualisieren. */
  function zeichneUebersicht() {
    MediaStore.KATEGORIEN.forEach(function (k) {
      const zaehler = mediaEl.uebersicht.querySelector('[data-kategorie="' + k.id + '"]');
      zaehler.textContent =
        MediaStore.anzahl(k.id, "watchlist") + " auf der Watchlist · " +
        MediaStore.anzahl(k.id, "watched") + " gesehen";
    });
  }

  /** Titel, Umschalter, Formular und Liste der aktuellen Kategorie zeichnen. */
  function zeichneKategorie() {
    const k = mediaZustand.kategorie;
    mediaEl.titel.textContent = k.name;

    // Umschalter Watchlist / Watched (mit Anzahl)
    mediaEl.tabs.innerHTML = "";
    MEDIA_LISTEN.forEach(function (l) {
      const link = document.createElement("a");
      link.className = "media-tab";
      link.href = "#media/" + k.id + "/" + l.id;
      link.textContent = l.name + " (" + MediaStore.anzahl(k.id, l.id) + ")";
      if (l.id === mediaZustand.liste) {
        link.setAttribute("aria-current", "page");
      }
      mediaEl.tabs.appendChild(link);
    });

    // Bewertungs-Auswahl nur bei Watched
    const istWatched = mediaZustand.liste === "watched";
    mediaEl.formularBewertung.hidden = !istWatched;
    mediaEl.eingabe.placeholder = istWatched ? "Gesehenen Titel eintragen" : "Titel für die Watchlist";

    zeichneListe();
  }

  /** Die Liste der aktuellen Unterseite zeichnen. */
  function zeichneListe() {
    const k = mediaZustand.kategorie;
    const art = mediaZustand.liste;
    const eintraege = MediaStore.liste(k.id, art);

    mediaEl.liste.innerHTML = "";

    // Leere Liste: kurzer Hinweis statt leerer Fläche
    if (eintraege.length === 0) {
      const leer = document.createElement("li");
      leer.className = "media-leer";
      leer.textContent = art === "watched"
        ? "Noch nichts bewertet. Trag oben einen gesehenen Titel mit Bewertung ein."
        : "Deine Watchlist ist leer. Füge oben einen Titel hinzu.";
      mediaEl.liste.appendChild(leer);
      return;
    }

    eintraege.forEach(function (eintrag) {
      mediaEl.liste.appendChild(baueEintrag(eintrag, art));
    });
  }

  /** Baut ein <li> für einen Eintrag – normal, im Bearbeiten- oder Geschaut-Modus. */
  function baueEintrag(eintrag, art) {
    const li = document.createElement("li");
    li.className = "media-eintrag";
    li.dataset.id = eintrag.id;

    const b = mediaZustand.bearbeitung;
    const modus = b && b.id === eintrag.id ? b.modus : null;

    // Bewertung links (nur Watched)
    if (art === "watched" && modus !== "bearbeiten") {
      li.appendChild(element("span", "media-bewertung", formatiereBewertung(eintrag.bewertung)));
    }

    if (modus === "bearbeiten") {
      // Formular: Titel (+ Bewertung) ändern
      const form = document.createElement("form");
      form.className = "media-eintrag-formular";
      form.dataset.modus = "bearbeiten";
      const eingabe = document.createElement("input");
      eingabe.type = "text";
      eingabe.className = "media-eingabe";
      eingabe.value = eintrag.titel;
      eingabe.setAttribute("aria-label", "Titel");
      form.appendChild(eingabe);
      if (art === "watched") {
        const auswahl = document.createElement("select");
        auswahl.className = "media-auswahl";
        auswahl.setAttribute("aria-label", "Bewertung");
        fuelleBewertungen(auswahl, eintrag.bewertung);
        form.appendChild(auswahl);
      }
      form.appendChild(knopf("Speichern", "speichern", "media-knopf--haupt", "submit"));
      form.appendChild(knopf("Abbrechen", "abbrechen"));
      li.appendChild(form);
      return li;
    }

    li.appendChild(element("span", "media-titel", eintrag.titel));

    if (modus === "geschaut") {
      // Formular: Bewertung abfragen, dann nach Watched verschieben
      const form = document.createElement("form");
      form.className = "media-eintrag-formular";
      form.dataset.modus = "geschaut";
      const auswahl = document.createElement("select");
      auswahl.className = "media-auswahl";
      auswahl.setAttribute("aria-label", "Bewertung für " + eintrag.titel);
      fuelleBewertungen(auswahl, null);
      form.appendChild(auswahl);
      form.appendChild(knopf("Nach Watched", "verschieben", "media-knopf--haupt", "submit"));
      form.appendChild(knopf("Abbrechen", "abbrechen"));
      li.appendChild(form);
      return li;
    }

    // Normale Ansicht: Aktions-Buttons
    const aktionen = element("div", "media-aktionen", "");
    if (art === "watchlist") {
      aktionen.appendChild(knopf("Geschaut", "geschaut", "media-knopf--haupt", "button", eintrag.titel));
    }
    aktionen.appendChild(knopf("Bearbeiten", "bearbeiten", "", "button", eintrag.titel));
    aktionen.appendChild(knopf("Löschen", "loeschen", "media-knopf--gefahr", "button", eintrag.titel));
    li.appendChild(aktionen);
    return li;
  }


  /* ==========================================================================
     AKTIONEN
     ========================================================================== */

  /** Formular oben: neuen Titel hinzufügen (Button oder Enter). */
  function hinzufuegen() {
    const k = mediaZustand.kategorie;
    const titel = mediaEl.eingabe.value;
    let ergebnis;

    if (mediaZustand.liste === "watched") {
      const bewertung = leseBewertung(mediaEl.formularBewertung);
      ergebnis = bewertung === null
        ? { ok: false, grund: "bewertung" }
        : MediaStore.zuWatched(k.id, titel, bewertung);
    } else {
      ergebnis = MediaStore.zurWatchlist(k.id, titel);
    }

    if (!ergebnis.ok) {
      zeigeFehler(ergebnis, titel);
      mediaEl.eingabe.focus();
      return;
    }

    zeigeHinweis(mediaEl.hinweis, "„" + titel.trim() + "“ hinzugefügt.", "erfolg");
    mediaEl.eingabe.value = "";
    mediaEl.formularBewertung.value = "";
    zeichneKategorie();
    mediaEl.eingabe.focus();
  }

  /** Klicks auf Buttons in der Liste (Geschaut, Bearbeiten, Löschen, Abbrechen). */
  function klickInListe(event) {
    const knopfEl = event.target.closest("button[data-aktion]");
    if (!knopfEl || knopfEl.type === "submit") return;   // Speichern läuft über "submit"
    const li = knopfEl.closest(".media-eintrag");
    const id = li.dataset.id;
    const k = mediaZustand.kategorie;
    const art = mediaZustand.liste;

    switch (knopfEl.dataset.aktion) {
      case "bearbeiten":
      case "geschaut":
        mediaZustand.bearbeitung = { id: id, modus: knopfEl.dataset.aktion };
        zeigeHinweis(mediaEl.hinweis, "");
        zeichneListe();
        // Fokus ins erste Feld des kleinen Formulars
        mediaEl.liste.querySelector('[data-id="' + id + '"] input, [data-id="' + id + '"] select').focus();
        break;

      case "abbrechen":
        mediaZustand.bearbeitung = null;
        zeichneListe();
        fokusAufEintrag(id);
        break;

      case "loeschen": {
        const titel = li.querySelector(".media-titel").textContent;
        if (window.confirm("„" + titel + "“ wirklich löschen?")) {
          MediaStore.loesche(k.id, art, id);
          zeigeHinweis(mediaEl.hinweis, "„" + titel + "“ gelöscht.", "erfolg");
          zeichneKategorie();
          mediaEl.eingabe.focus();
        }
        break;
      }
    }
  }

  /** Absenden der kleinen Formulare in der Liste (Speichern / Nach Watched). */
  function absendenInListe(event) {
    event.preventDefault();
    const form = event.target;
    const id = form.closest(".media-eintrag").dataset.id;
    const k = mediaZustand.kategorie;
    const art = mediaZustand.liste;
    const auswahl = form.querySelector("select");
    let ergebnis;
    let titel;

    if (form.dataset.modus === "bearbeiten") {
      titel = form.querySelector("input").value;
      const aenderung = { titel: titel };
      if (art === "watched") {
        aenderung.bewertung = leseBewertung(auswahl);
      }
      ergebnis = MediaStore.aendere(k.id, art, id, aenderung);
    } else {
      titel = form.closest(".media-eintrag").querySelector(".media-titel").textContent;
      const bewertung = leseBewertung(auswahl);
      ergebnis = bewertung === null
        ? { ok: false, grund: "bewertung" }
        : MediaStore.alsGeschautMarkieren(k.id, id, bewertung);
    }

    if (!ergebnis.ok) {
      zeigeFehler(ergebnis, titel);
      return;
    }

    mediaZustand.bearbeitung = null;
    if (form.dataset.modus === "geschaut") {
      zeigeHinweis(mediaEl.hinweis,
        "„" + titel + "“ mit " + formatiereBewertung(leseBewertung(auswahl)) + " nach Watched verschoben.", "erfolg");
      zeichneKategorie();
      mediaEl.eingabe.focus();
    } else {
      zeigeHinweis(mediaEl.hinweis, "Gespeichert.", "erfolg");
      zeichneKategorie();
      fokusAufEintrag(id);
    }
  }

  /** Alle Daten als JSON-Datei herunterladen. */
  function exportieren() {
    const datei = new Blob([MediaStore.exportieren()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(datei);
    link.download = "ntb-filme-serien-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();                       // startet den Download
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    zeigeHinweis(mediaEl.datenHinweis, "Export gestartet: " + link.download, "erfolg");
  }

  /** Eine gewählte JSON-Datei prüfen und nach Rückfrage einspielen. */
  function importieren() {
    const datei = mediaEl.datei.files[0];
    mediaEl.datei.value = "";           // damit dieselbe Datei erneut gewählt werden kann
    if (!datei) return;

    datei.text().then(function (text) {
      const pruefung = MediaStore.pruefeImport(text);
      if (!pruefung.ok) {
        zeigeHinweis(mediaEl.datenHinweis, "Import abgebrochen: " + pruefung.fehler, "fehler");
        return;
      }
      const frage = "Die Datei enthält " + pruefung.anzahl + " Einträge.\n" +
        "Alle aktuellen Filme/Serien-Daten werden dadurch ERSETZT. Fortfahren?";
      if (!window.confirm(frage)) {
        zeigeHinweis(mediaEl.datenHinweis, "Import abgebrochen.");
        return;
      }
      MediaStore.importieren(pruefung.daten);
      zeichneUebersicht();
      zeigeHinweis(mediaEl.datenHinweis, "Import erfolgreich: " + pruefung.anzahl + " Einträge.", "erfolg");
    });
  }


  /* ==========================================================================
     KLEINE HELFER
     ========================================================================== */

  /** Erzeugt ein Element mit Klasse und Text. */
  function element(tag, klasse, text) {
    const el = document.createElement(tag);
    el.className = klasse;
    el.textContent = text;
    return el;
  }

  /**
   * Erzeugt einen Button.
   * @param {string} titelFuerScreenreader – (optional) z. B. "Dune" → "Löschen: Dune"
   */
  function knopf(text, aktion, extraKlasse, typ, titelFuerScreenreader) {
    const b = element("button", ("media-knopf " + (extraKlasse || "")).trim(), text);
    b.type = typ || "button";
    b.dataset.aktion = aktion;
    if (titelFuerScreenreader) {
      b.setAttribute("aria-label", text + ": " + titelFuerScreenreader);
    }
    return b;
  }

  /** Füllt eine Auswahl mit 10, 9,5, 9 … 1 (und optional einem Startwert). */
  function fuelleBewertungen(auswahl, startwert) {
    auswahl.innerHTML = "";
    const leer = document.createElement("option");
    leer.value = "";
    leer.textContent = "Bewertung";
    auswahl.appendChild(leer);
    for (let wert = MediaStore.BEWERTUNG_MAX; wert >= MediaStore.BEWERTUNG_MIN; wert -= 0.5) {
      const option = document.createElement("option");
      option.value = String(wert);
      option.textContent = formatiereBewertung(wert);
      auswahl.appendChild(option);
    }
    auswahl.value = startwert === null ? "" : String(startwert);
  }

  /** Liest die gewählte Bewertung als Zahl (oder null, wenn keine gewählt). */
  function leseBewertung(auswahl) {
    return auswahl.value === "" ? null : Number(auswahl.value);
  }

  /** 8.5 → "8,5" und 8 → "8" (deutsche Schreibweise). */
  function formatiereBewertung(wert) {
    return String(wert).replace(".", ",");
  }

  /** Zeigt einen Hinweis. art: "" (neutral), "erfolg" oder "fehler". */
  function zeigeHinweis(ziel, text, art) {
    ziel.textContent = text;
    ziel.dataset.art = art || "";
  }

  /** Übersetzt ein Fehler-Ergebnis aus dem MediaStore in einen Hinweistext. */
  function zeigeFehler(ergebnis, titel) {
    let text = "Das hat nicht geklappt.";
    if (ergebnis.grund === "leer") {
      text = "Bitte einen Titel eingeben.";
    } else if (ergebnis.grund === "doppelt") {
      const wo = ergebnis.wo === "watched" ? "in Watched" : "auf der Watchlist";
      text = "„" + titel.trim() + "“ steht in " + mediaZustand.kategorie.name + " schon " + wo + ".";
    } else if (ergebnis.grund === "bewertung") {
      text = "Bitte eine Bewertung von 1 bis 10 wählen.";
    }
    zeigeHinweis(mediaEl.hinweis, text, "fehler");
  }

  /** Setzt den Fokus auf den ersten Button eines Eintrags (nach Abbrechen/Speichern). */
  function fokusAufEintrag(id) {
    const ziel = mediaEl.liste.querySelector('[data-id="' + id + '"] button');
    if (ziel) ziel.focus();
  }


  // Nur diese beiden Funktionen braucht app.js
  return {
    init: initMedia,
    zeige: zeigeMedia,
  };
})();
