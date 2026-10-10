/* ==========================================================================
   home.js – die Startseite
   Begrüßung, "Heute" (Termine des Tages) und Kacheln zu allen Bereichen.

   Die Startseite speichert selbst NICHTS. Sie liest bei jedem Öffnen alles
   frisch aus den vorhandenen Stores:
     EventsStore  (js/events-store.js)  – Termine und Vorlesungen
     MediaStore   (js/media-store.js)   – Filme/Serien
     sudokuSpielstandLesen() (js/sudoku-ui.js) – laufendes Sudoku
   Aussehen: css/home.css
   ========================================================================== */

// Optionaler Name für die Begrüßung, z. B. "Niko" → "Guten Morgen, Niko".
// Leer lassen für eine Begrüßung ohne Namen.
const BEGRUESSUNG_NAME = "";

const StartseiteAnsicht = (function () {

  const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
    "August", "September", "Oktober", "November", "Dezember"];

  // Wie lange (Tage) nach dem nächsten Eintrag gesucht wird, wenn heute nichts ansteht
  const SUCHE_TAGE = 366;

  /* ------------------------------------------------------------------------
     SYMBOLE für die Kacheln (Inline-SVG, Strichzeichnungen in currentColor –
     sie übernehmen also automatisch die Textfarbe, hell wie dunkel)
     ------------------------------------------------------------------------ */
  const SYMBOLE = {
    kalender:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    stundenplan:
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    games:
      '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="13.5" r="1"/>',
    media:
      '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 6l2 4M12 6l2 4M17 6l2 4"/>',
  };

  // Die Kacheln: Ziel-Adresse, Name, Symbol und eine Funktion für die Info-Zeile.
  // Neue Kachel? Hier einen Eintrag ergänzen.
  const KACHELN = [
    { href: "#kalender", name: "Kalender", symbol: "kalender", info: infoKalender },
    { href: "#schedule", name: "Stundenplan/Termine", symbol: "stundenplan", info: infoStundenplan },
    { href: "#games/sudoku", name: "Games", symbol: "games", info: infoGames },
    { href: "#media", name: "Filme/Serien", symbol: "media", info: infoMedia },
  ];

  const el = {};
  let minutenTimer = null;


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  /**
   * Baut die Startseite auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="home-root">
   */
  function init(container) {
    container.innerHTML =
      '<div class="home">' +
        '<p class="home-datum"></p>' +

        '<section class="home-heute" aria-labelledby="home-heute-titel">' +
          '<div class="home-abschnitt-kopf">' +
            '<h2 id="home-heute-titel">Heute</h2>' +
            '<a class="home-mehr" href="#schedule">Stundenplan →</a>' +
          "</div>" +
          '<div class="home-heute-inhalt"></div>' +
        "</section>" +

        '<nav class="home-kacheln" aria-label="Bereiche"></nav>' +
      "</div>";

    el.gruss = document.getElementById("titel-home");
    el.datum = container.querySelector(".home-datum");
    el.heute = container.querySelector(".home-heute-inhalt");
    el.kacheln = container.querySelector(".home-kacheln");

    // Kacheln einmal anlegen – die Info-Zeilen werden bei jedem Öffnen neu gefüllt
    KACHELN.forEach(function (k) {
      const link = document.createElement("a");
      link.className = "home-kachel";
      link.href = k.href;
      link.innerHTML =
        '<svg class="home-kachel-symbol" viewBox="0 0 24 24" aria-hidden="true">' + SYMBOLE[k.symbol] + "</svg>" +
        '<span class="home-kachel-name"></span>' +
        '<span class="home-kachel-info"></span>';
      link.querySelector(".home-kachel-name").textContent = k.name;
      k.element = link;
      el.kacheln.appendChild(link);
    });
  }

  /**
   * Wird von app.js bei JEDEM Öffnen der Startseite aufgerufen:
   * alles frisch aus den Stores lesen und zeichnen.
   */
  function zeige() {
    zeichne();
    // Solange die Startseite offen ist, einmal pro Minute auffrischen
    // (Begrüßung, "vergangen"-Markierung, Datum nach Mitternacht)
    clearInterval(minutenTimer);
    minutenTimer = setInterval(function () {
      if (document.getElementById("view-home").hidden) {
        clearInterval(minutenTimer);      // Startseite verlassen → Timer beenden
        return;
      }
      zeichne();
    }, 60 * 1000);
    return null;
  }

  function zeichne() {
    const jetzt = new Date();
    el.gruss.textContent = begruessung(jetzt);
    el.datum.textContent = WOCHENTAGE[jetzt.getDay()] + ", " + jetzt.getDate() + ". " +
      MONATE[jetzt.getMonth()] + " " + jetzt.getFullYear();
    zeichneHeute(jetzt);
    KACHELN.forEach(function (k) {
      k.element.querySelector(".home-kachel-info").textContent = k.info(jetzt);
    });
  }


  /* ==========================================================================
     BEGRÜSSUNG
     ========================================================================== */

  /** "Guten Morgen" (5–10 Uhr), "Guten Tag" (11–17 Uhr), "Guten Abend" (sonst). */
  function begruessung(jetzt) {
    const stunde = jetzt.getHours();
    let gruss = "Guten Abend";
    if (stunde >= 5 && stunde < 11) gruss = "Guten Morgen";
    else if (stunde >= 11 && stunde < 18) gruss = "Guten Tag";
    return BEGRUESSUNG_NAME ? gruss + ", " + BEGRUESSUNG_NAME : gruss;
  }


  /* ==========================================================================
     HEUTE
     ========================================================================== */

  function zeichneHeute(jetzt) {
    const heute = EventsStore.datumText(jetzt);
    const minuten = jetzt.getHours() * 60 + jetzt.getMinutes();
    const eintraege = EventsStore.eintraegeAm(heute);   // schon nach Uhrzeit sortiert
    el.heute.innerHTML = "";

    if (eintraege.length > 0) {
      const liste = document.createElement("ul");
      liste.className = "home-liste";
      eintraege.forEach(function (e) {
        // Vorbei = Endzeit schon erreicht. Ganztägige sind bis Tagesende aktuell.
        const vorbei = !e.ganztaegig && EventsStore.inMinuten(e.ende) <= minuten;
        liste.appendChild(baueEintrag(e, null, vorbei));
      });
      el.heute.appendChild(liste);
      return;
    }

    // Heute nichts → Hinweis und der nächste anstehende Eintrag
    el.heute.appendChild(text("p", "home-leer", "Heute steht nichts an."));
    const naechster = naechsterEintrag(heute);
    if (naechster) {
      el.heute.appendChild(text("p", "home-naechster-titel", "Als Nächstes:"));
      const liste = document.createElement("ul");
      liste.className = "home-liste";
      liste.appendChild(baueEintrag(naechster, tagText(naechster.tag, heute), false));
      el.heute.appendChild(liste);
    } else {
      const hinweis = text("p", "home-leer", "Auch danach ist noch nichts eingetragen. ");
      const link = text("a", "", "Eintrag anlegen");
      link.href = "#schedule";
      hinweis.appendChild(link);
      el.heute.appendChild(hinweis);
    }
  }

  /** Erster Eintrag ab morgen (innerhalb von SUCHE_TAGE Tagen) oder null. */
  function naechsterEintrag(heute) {
    const ab = EventsStore.plusTage(heute, 1);
    const bis = EventsStore.plusTage(heute, SUCHE_TAGE);
    const nachTagen = EventsStore.eintraegeImZeitraum(ab, bis);
    const ersterTag = Object.keys(nachTagen).sort()[0];
    return ersterTag ? nachTagen[ersterTag][0] : null;
  }

  /**
   * Eine Zeile: [Uhrzeit] Titel · Ort
   * @param {string|null} tagHinweis – z. B. "Morgen" oder "Mi, 14. Oktober"
   */
  function baueEintrag(e, tagHinweis, vorbei) {
    const li = document.createElement("li");
    li.className = "home-eintrag art-" + e.art + (vorbei ? " ist-vorbei" : "");

    const zeit = text("span", "home-eintrag-zeit", e.ganztaegig ? "ganztägig" : e.start + "–" + e.ende);
    if (tagHinweis) {
      zeit.textContent = tagHinweis + (e.ganztaegig ? "" : ", " + e.start);
    }
    li.appendChild(zeit);

    const mitte = text("span", "home-eintrag-text", "");
    mitte.appendChild(text("span", "home-eintrag-titel", e.titel));
    if (e.ort) mitte.appendChild(text("span", "home-eintrag-ort", e.ort));
    li.appendChild(mitte);

    if (vorbei) {
      li.appendChild(text("span", "nur-screenreader", "(vorbei)"));
    }
    return li;
  }

  /** "Morgen", "Übermorgen" oder "Mi, 14. Oktober" */
  function tagText(tag, heute) {
    if (tag === EventsStore.plusTage(heute, 1)) return "Morgen";
    if (tag === EventsStore.plusTage(heute, 2)) return "Übermorgen";
    const d = EventsStore.alsDatum(tag);
    return WOCHENTAGE[d.getDay()].slice(0, 2) + ", " + d.getDate() + ". " + MONATE[d.getMonth()] +
      (d.getFullYear() !== EventsStore.alsDatum(heute).getFullYear() ? " " + d.getFullYear() : "");
  }


  /* ==========================================================================
     INFO-ZEILEN DER KACHELN
     Jede Funktion bekommt das aktuelle Datum und gibt einen kurzen Text zurück.
     ========================================================================== */

  /** "KW 41 · noch 82 Tage im Jahr" */
  function infoKalender(jetzt) {
    const heute = EventsStore.datumText(jetzt);
    const kw = EventsStore.kalenderwoche(heute).kw;
    const jahresende = new Date(jetzt.getFullYear(), 11, 31);
    const rest = Math.round((jahresende - EventsStore.alsDatum(heute)) / (24 * 60 * 60 * 1000));
    const restText = rest === 0 ? "letzter Tag des Jahres" : rest === 1 ? "noch 1 Tag im Jahr" : "noch " + rest + " Tage im Jahr";
    return "KW " + kw + " · " + restText;
  }

  /** "3 Einträge diese Woche" */
  function infoStundenplan(jetzt) {
    const heute = EventsStore.datumText(jetzt);
    const montag = EventsStore.plusTage(heute, -EventsStore.wochentag(heute));
    const woche = EventsStore.eintraegeImZeitraum(montag, EventsStore.plusTage(montag, 6));
    let anzahl = 0;
    Object.keys(woche).forEach(function (tag) { anzahl += woche[tag].length; });
    if (anzahl === 0) return "Diese Woche ist nichts eingetragen";
    return anzahl + (anzahl === 1 ? " Eintrag" : " Einträge") + " diese Woche";
  }

  /** "Sudoku fortsetzen · Mittel" oder "Neues Sudoku starten" */
  function infoGames() {
    const spiel = sudokuSpielstandLesen();
    if (spiel && !spiel.geloest) {
      return "Sudoku fortsetzen · " + SudokuEngine.gradMitId(spiel.grad).name;
    }
    return "Neues Sudoku starten";
  }

  /** "4 auf den Watchlists · zuletzt gesehen: Dune" */
  function infoMedia() {
    let watchlist = 0;
    let zuletzt = null;
    MediaStore.KATEGORIEN.forEach(function (k) {
      watchlist += MediaStore.anzahl(k.id, "watchlist");
      MediaStore.liste(k.id, "watched").forEach(function (e) {
        if (!zuletzt || e.hinzugefuegt > zuletzt.hinzugefuegt) zuletzt = e;
      });
    });
    if (watchlist === 0 && !zuletzt) return "Noch keine Titel eingetragen";
    const teile = [watchlist + " Titel auf den Watchlists"];
    teile.push(zuletzt ? "zuletzt gesehen: " + zuletzt.titel : "noch nichts gesehen");
    return teile.join(" · ");
  }


  /* ==========================================================================
     HELFER
     ========================================================================== */

  /** Element mit Klasse und reinem Text (nie HTML). */
  function text(tag, klasse, inhalt) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    e.textContent = inhalt;
    return e;
  }


  return {
    init: init,
    zeige: zeige,
  };
})();
