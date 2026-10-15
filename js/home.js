/* ==========================================================================
   home.js – die Startseite als Karten-Tunnel
   Die Abschnitte der Seite stehen als große, abgerundete Karten in zwei
   Reihen links und rechts. Beide Reihen sind schräg in die Tiefe gedreht
   und laufen auf einen gemeinsamen Fluchtpunkt in der Mitte zu – dort
   steht die Begrüßung. Der Tunnel entsteht nur durch die Karten selbst.
   Darunter steht "Heute" als schlichte Leiste.

   Die Startseite speichert selbst NICHTS. Sie liest bei jedem Öffnen alles
   frisch aus den vorhandenen Stores:
     EventsStore  (js/events-store.js)  – Termine und Vorlesungen
     TodoStore    (js/todo-store.js)    – Aufgaben
     MediaStore   (js/media-store.js)   – Filme/Serien
     sudokuSpielstandLesen() (js/sudoku-ui.js) – laufendes Sudoku

   Aussehen, Winkel, Größen und Abstände: css/home.css (Variablen oben).
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
     EINSTELLUNGEN DER BEWEGUNG
     (Winkel, Größen und Abstände stehen als CSS-Variablen in css/home.css –
      hier nur, was JavaScript wissen muss)
     ------------------------------------------------------------------------ */
  const BEWEGUNG = {
    fahrtMs: 400,         // Fahrt auf die Karte zu, danach öffnet sich der Abschnitt
    fahrtAnteil: 0.55,    // so weit rückt die Karte bei der Fahrt Richtung Bildmitte
    fahrtVor: 260,        // so weit (px) fährt die Ansicht nach vorne
    glaettung: 0.08,      // Parallaxe: Anteil, um den sie pro Bild dem Ziel folgt (klein = ruhig)
    // Sicherheitsnetz für langsame Geräte: Braucht ein Bild während der
    // Parallaxe im Schnitt länger als zeitGrenzeMs – gemessen über
    // zeitBilder Bilder, und das zeitFenster-mal hintereinander –, schaltet
    // sich die Parallaxe für diese Sitzung ab. Die Karten bleiben dann stehen.
    zeitGrenzeMs: 40,
    zeitBilder: 30,
    zeitFenster: 2,
  };

  /* ------------------------------------------------------------------------
     SYMBOLE für die Karten (Inline-SVG, Strichzeichnungen in currentColor)
     ------------------------------------------------------------------------ */
  const SYMBOLE = {
    kalender:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    stundenplan:
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    todo:
      '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    media:
      '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 6l2 4M12 6l2 4M17 6l2 4"/>',
    games:
      '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="13.5" r="1"/>',
    customising:
      '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  };

  // Die Karten je Reihe, jeweils von vorne nach hinten. Reihenfolge = Tab-Reihenfolge.
  // Neue Karte? Hier ergänzen und in css/home.css --karten-pro-seite anpassen
  // (die Karten werden dann schmaler, die Reihe bleibt gleich lang).
  const REIHEN = {
    links: [   // Studium
      { id: "kalender", href: "#kalender", name: "Kalender", info: infoKalender },
      { id: "stundenplan", href: "#schedule", name: "Stundenplan/Termine", info: infoStundenplan },
      { id: "todo", href: "#todo", name: "Zu erledigen", info: infoTodo },
    ],
    rechts: [  // Freizeit
      { id: "media", href: "#media", name: "Filme/Serien", info: infoMedia },
      { id: "games", href: "#games/sudoku", name: "Games", info: infoGames },
      { id: "customising", href: "#customising", name: "Customising", info: infoCustomising },
    ],
  };
  const KARTEN = REIHEN.links.concat(REIHEN.rechts);

  const el = {};
  let minutenTimer = null;

  // Bewegung
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Parallaxe nur mit echter Maus und nur, wenn die Karten in zwei Reihen stehen
  // (dieselbe Grenze wie in css/home.css, Abschnitt "SMARTPHONE")
  const mausAbfrage = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 700px)");
  const parallaxe = { zielX: 0, zielY: 0, x: 0, y: 0, laeuft: false, zuLangsam: false, langsameFenster: 0 };
  let faehrt = false;


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
        '<div class="tunnel">' +
          // Die "Welt": alles darin liegt im selben 3D-Raum. Parallaxe und
          // Fahrt bewegen nur sie.
          '<div class="tunnel-welt">' +
            '<nav class="tunnel-karten" aria-label="Bereiche">' +
              '<div class="karten-reihe karten-reihe--links"></div>' +
              '<div class="karten-reihe karten-reihe--rechts"></div>' +
            "</nav>" +
            // Begrüßung im Fluchtpunkt
            '<div class="tunnel-ziel"><p class="home-datum"></p></div>' +
          "</div>" +
        "</div>" +

        '<section class="home-heute" aria-labelledby="home-heute-titel">' +
          '<div class="home-abschnitt-kopf">' +
            '<h2 id="home-heute-titel">Heute</h2>' +
            '<a class="home-mehr" href="#schedule">Stundenplan →</a>' +
          "</div>" +
          '<div class="home-heute-inhalt"></div>' +
        "</section>" +
      "</div>";

    el.tunnel = container.querySelector(".tunnel");
    el.welt = container.querySelector(".tunnel-welt");
    el.gruss = document.getElementById("titel-home");
    el.datum = container.querySelector(".home-datum");
    el.heute = container.querySelector(".home-heute-inhalt");

    // Die Begrüßung (h1 aus index.html) wandert in den Fluchtpunkt – vor das Datum.
    // Sie behält ihre ID: app.js setzt den Fokus und den Seitentitel darüber.
    container.querySelector(".tunnel-ziel").insertBefore(el.gruss, el.datum);

    ["links", "rechts"].forEach(function (seite) {
      const reihe = container.querySelector(".karten-reihe--" + seite);
      REIHEN[seite].forEach(function (k, i) {
        reihe.appendChild(baueKarte(k, seite, i));
      });
    });
    bewegungEinrichten();
  }

  /**
   * Eine Karte als echter Link. Name und Infozeile bilden die Beschriftung.
   * --i = Platz in der Reihe (0 = vorne); daraus berechnet das CSS, wie
   * blass die Karte ist und wann sie beim Aufbau erscheint.
   */
  function baueKarte(k, seite, i) {
    const link = document.createElement("a");
    link.className = "tunnel-karte";
    link.href = k.href;
    link.dataset.karte = k.id;
    link.dataset.seite = seite;
    link.style.setProperty("--i", i);
    // Platz in der ganzen Liste (Smartphone: alle Karten in einer Spalte)
    link.style.setProperty("--n", (seite === "links" ? 0 : REIHEN.links.length) + i);
    link.innerHTML =
      '<svg class="tunnel-karte-symbol" viewBox="0 0 24 24" aria-hidden="true">' + SYMBOLE[k.id] + "</svg>" +
      '<span class="tunnel-karte-text"><span class="tunnel-karte-name"></span><span class="tunnel-karte-info"></span></span>';
    setzeName(link.querySelector(".tunnel-karte-name"), k.name);
    link.addEventListener("click", function (event) { karteGeklickt(event, k, link); });
    k.element = link;
    return link;
  }

  /**
   * Name als Text; nach jedem "/" darf umbrochen werden (<wbr>), damit
   * "Stundenplan/Termine" sauber auf zwei Zeilen passt statt mitten im Wort.
   */
  function setzeName(ziel, name) {
    name.split("/").forEach(function (teil, i, teile) {
      ziel.appendChild(document.createTextNode(teil + (i < teile.length - 1 ? "/" : "")));
      if (i < teile.length - 1) ziel.appendChild(document.createElement("wbr"));
    });
  }

  /**
   * Wird von app.js bei JEDEM Öffnen der Startseite aufgerufen:
   * alles frisch aus den Stores lesen, zeichnen und die Karten aufbauen.
   */
  function zeige() {
    zeichne();
    fahrtZuruecksetzen();
    aufbauen();
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
    KARTEN.forEach(function (k) {
      k.element.querySelector(".tunnel-karte-info").textContent = k.info(jetzt);
    });
  }


  /* ==========================================================================
     BEWEGUNG: Aufbau, Parallaxe, Fahrt beim Klick
     Animiert werden nur transform und opacity.
     ========================================================================== */

  /** Die Karten bauen sich von hinten nach vorn nacheinander auf (CSS-Animation). */
  function aufbauen() {
    el.tunnel.classList.remove("baut-auf");
    if (ruhigAbfrage.matches) return;
    void el.tunnel.offsetWidth;            // Neustart der Animation erzwingen
    el.tunnel.classList.add("baut-auf");
  }

  function bewegungEinrichten() {
    document.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse" || !parallaxeErlaubt()) return;
      // -1 … 1, Mitte des Fensters = 0
      parallaxe.zielX = (event.clientX / window.innerWidth) * 2 - 1;
      parallaxe.zielY = (event.clientY / window.innerHeight) * 2 - 1;
      starteParallaxe();
    });
    // Maus verlässt das Fenster: sanft zurück in die Mitte
    document.documentElement.addEventListener("mouseleave", function () {
      parallaxe.zielX = 0;
      parallaxe.zielY = 0;
      if (parallaxeErlaubt()) starteParallaxe();
    });
    // Wechsel zu reduzierter Bewegung oder schmalem Fenster: Karten gerade stellen
    [ruhigAbfrage, mausAbfrage].forEach(function (abfrage) {
      abfrage.addEventListener("change", function () {
        if (!parallaxeErlaubt()) setzeWelt("");
      });
    });
  }

  function parallaxeErlaubt() {
    return mausAbfrage.matches && !ruhigAbfrage.matches && !faehrt && !parallaxe.zuLangsam &&
      !document.getElementById("view-home").hidden;
  }

  /** Eine kleine Schleife, die nur läuft, solange sich etwas bewegt. */
  function starteParallaxe() {
    if (parallaxe.laeuft) return;
    parallaxe.laeuft = true;
    const stil = getComputedStyle(el.tunnel);
    const winkelX = parseFloat(stil.getPropertyValue("--parallaxe-dreh")) || 0;
    const winkelY = parseFloat(stil.getPropertyValue("--parallaxe-neig")) || 0;
    let letztes = 0;
    let summe = 0;
    let bilder = 0;

    function schritt(zeit) {
      if (!parallaxeErlaubt()) {
        parallaxe.laeuft = false;
        return;
      }
      // Bildzeiten messen (Sicherheitsnetz, siehe BEWEGUNG.zeitGrenzeMs)
      if (letztes) {
        summe += zeit - letztes;
        bilder++;
        if (bilder === BEWEGUNG.zeitBilder) {
          parallaxe.langsameFenster = summe / bilder > BEWEGUNG.zeitGrenzeMs ? parallaxe.langsameFenster + 1 : 0;
          if (parallaxe.langsameFenster >= BEWEGUNG.zeitFenster) {
            parallaxe.zuLangsam = true;     // dauerhaft zu langsam: Karten bleiben ab jetzt stehen
            parallaxe.laeuft = false;
            setzeWelt("");
            return;
          }
          summe = 0;
          bilder = 0;
        }
      }
      letztes = zeit;

      parallaxe.x += (parallaxe.zielX - parallaxe.x) * BEWEGUNG.glaettung;
      parallaxe.y += (parallaxe.zielY - parallaxe.y) * BEWEGUNG.glaettung;
      // Der Tunnel dreht sich leicht, sodass der Fluchtpunkt ein wenig in
      // Richtung der Maus wandert (Maus rechts → Fluchtpunkt rechts).
      setzeWelt("rotateX(" + (parallaxe.y * winkelY).toFixed(3) + "deg) rotateY(" +
        (-parallaxe.x * winkelX).toFixed(3) + "deg)");
      const fertig = Math.abs(parallaxe.zielX - parallaxe.x) < 0.001 && Math.abs(parallaxe.zielY - parallaxe.y) < 0.001;
      if (fertig) {
        parallaxe.laeuft = false;
        return;
      }
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  function setzeWelt(transform) {
    el.welt.style.transform = transform;
  }

  /**
   * Klick auf eine Karte: Die Ansicht fährt kurz auf die Karte zu (etwa
   * 400 ms), dann öffnet sich der Abschnitt.
   * Bei "Bewegung reduzieren" (oder Klick mit Strg/Cmd/Umschalt/Mitteltaste)
   * öffnet der Link sofort wie gewohnt.
   */
  function karteGeklickt(event, karte, link) {
    if (ruhigAbfrage.matches || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (faehrt) return;
    faehrt = true;

    // Wo steht die Karte gerade auf dem Bildschirm? Die Welt rückt so, dass
    // die Karte Richtung Bildmitte kommt, und fährt dabei nach vorne.
    const tunnel = el.tunnel.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    const dx = (tunnel.left + tunnel.width / 2) - (r.left + r.width / 2);
    const dy = (tunnel.top + tunnel.height / 2) - (r.top + r.height / 2);
    const k = BEWEGUNG.fahrtAnteil;

    el.tunnel.classList.add("faehrt");
    link.classList.add("ist-ziel");
    setzeWelt("translate3d(" + (dx * k).toFixed(1) + "px, " + (dy * k).toFixed(1) + "px, " + BEWEGUNG.fahrtVor + "px)");

    setTimeout(function () {
      faehrt = false;
      window.location.hash = karte.href;
    }, BEWEGUNG.fahrtMs);
  }

  /** Nach der Rückkehr zur Startseite steht alles wieder an seinem Platz. */
  function fahrtZuruecksetzen() {
    faehrt = false;
    el.tunnel.classList.remove("faehrt");
    KARTEN.forEach(function (k) { k.element.classList.remove("ist-ziel"); });
    parallaxe.x = parallaxe.zielX;
    parallaxe.y = parallaxe.zielY;
    setzeWelt("");
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
     INFO-ZEILEN DER KARTEN
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

  /**
   * "3 Aufgaben diese Woche fällig", ggf. mit "1 überfällig".
   * Gezählt werden offene Aufgaben: Abgaben bis Sonntag dieser Woche und alle
   * wöchentlichen (sie sind jede Woche wieder fällig).
   */
  function infoTodo(jetzt) {
    const aufgaben = TodoStore.alle(jetzt).filter(function (a) { return !a.erledigt; });
    if (aufgaben.length === 0) return "Keine offenen Aufgaben";
    const montag = TodoStore.wochenStart(jetzt);
    const naechsterMontag = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + 7);
    let woche = 0;
    let ueberfaellig = 0;
    aufgaben.forEach(function (a) {
      const f = a.faelligkeit;
      if (f.art === "woechentlich") {
        woche++;
        return;
      }
      const t = f.datum.split("-").map(Number);
      const z = (f.zeit || "23:59").split(":").map(Number);
      const faellig = new Date(t[0], t[1] - 1, t[2], z[0], z[1]);
      if (faellig < jetzt) ueberfaellig++;
      else if (faellig < naechsterMontag) woche++;
    });
    const teile = [];
    if (ueberfaellig > 0) teile.push(ueberfaellig + " überfällig");
    if (woche > 0) teile.push(woche + (woche === 1 ? " Aufgabe" : " Aufgaben") + " diese Woche fällig");
    if (teile.length === 0) return aufgaben.length + (aufgaben.length === 1 ? " offene Aufgabe" : " offene Aufgaben") + ", diese Woche nichts fällig";
    return teile.join(" · ");
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

  /** Customising hat noch keine Inhalte */
  function infoCustomising() {
    return "Eigene Anpassungen – kommt bald";
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
