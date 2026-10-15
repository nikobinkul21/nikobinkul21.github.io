/* ==========================================================================
   home.js – die Startseite als Tunnel
   Eine nasse Straße führt in den Bildschirm hinein. An den Tunnelwänden
   hängen sechs leuchtende Werbetafeln – das sind die Abschnitte der Seite.
   Am Ende des Tunnels liegt der helle Ausgang mit Begrüßung und Datum.
   Darunter steht "Heute" als schlichte Leiste.

   Die Startseite speichert selbst NICHTS. Sie liest bei jedem Öffnen alles
   frisch aus den vorhandenen Stores:
     EventsStore  (js/events-store.js)  – Termine und Vorlesungen
     TodoStore    (js/todo-store.js)    – Aufgaben
     MediaStore   (js/media-store.js)   – Filme/Serien
     sudokuSpielstandLesen() (js/sudoku-ui.js) – laufendes Sudoku

   Aufbau der Szene (Aussehen und alle Maße: css/home.css):
     .tunnel-buehne  – Deko (für Screenreader ausgeblendet): Straße, Wände,
                       Decke mit Lampen, Ausgang, alle Spiegelungen
     .tunnel-ziel    – Begrüßung und Datum im Ausgang
     .tunnel-tafeln  – die sechs Tafeln (echte Links)
   Jede dieser Ebenen hat eine eigene ".tunnel-welt". Alle drei bekommen
   dieselbe Drehung (Parallaxe) bzw. Kamerafahrt – so passen sie zusammen.
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
     EINSTELLUNGEN DER SZENE
     (Maße, Winkel und Farben stehen als CSS-Variablen in css/home.css
      bzw. css/style.css – hier nur, was JavaScript wissen muss)
     ------------------------------------------------------------------------ */
  const SZENE = {
    lampen: 9,            // Deckenlampen hintereinander
    pfuetzen: [           // Pfützen auf der Straße: Lage quer (%), Tiefe (%), Größe
      { x: 30, tiefe: 78, b: 220, h: 120 },
      { x: 62, tiefe: 52, b: 260, h: 140 },
      { x: 44, tiefe: 30, b: 200, h: 110 },
    ],
    // Häuser der Stadt im Ausgang (nur im dunklen Design sichtbar):
    // Breite und Höhe in Prozent des Ausgangs
    stadt: [[7, 14], [5, 22], [8, 17], [6, 30], [9, 19], [5, 36], [7, 24], [8, 15], [6, 27], [9, 18], [7, 32], [6, 13], [8, 21]],
    fahrtMs: 500,         // Dauer der Kamerafahrt bis zum Öffnen des Abschnitts
    glaettung: 0.12,      // Parallaxe: Anteil, um den sie pro Bild dem Ziel folgt
    // Sicherheitsnetz für langsame Geräte: Braucht ein Bild während der
    // Parallaxe im Schnitt länger als zeitGrenzeMs – gemessen über
    // zeitBilder Bilder, und das zeitFenster-mal hintereinander –, schaltet
    // sich die Parallaxe für diese Sitzung ab. Der Tunnel bleibt dann stehen.
    zeitGrenzeMs: 40,
    zeitBilder: 30,
    zeitFenster: 2,
  };

  /* ------------------------------------------------------------------------
     SYMBOLE für die Tafeln (Inline-SVG, Strichzeichnungen in currentColor)
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

  // Die sechs Tafeln. seite: Wand ("links" = Studium, "rechts" = Freizeit),
  // platz: 1 = vorne … 3 = hinten. Reihenfolge = Tab-Reihenfolge.
  // Der Leuchtton steht in css/style.css (--tafel-<id>).
  const TAFELN = [
    { id: "kalender", href: "#kalender", name: "Kalender", seite: "links", platz: 1, info: infoKalender },
    { id: "stundenplan", href: "#schedule", name: "Stundenplan/Termine", seite: "links", platz: 2, info: infoStundenplan },
    { id: "todo", href: "#todo", name: "Zu erledigen", seite: "links", platz: 3, info: infoTodo },
    { id: "media", href: "#media", name: "Filme/Serien", seite: "rechts", platz: 1, info: infoMedia },
    { id: "games", href: "#games/sudoku", name: "Games", seite: "rechts", platz: 2, info: infoGames },
    { id: "customising", href: "#customising", name: "Customising", seite: "rechts", platz: 3, info: infoCustomising },
  ];

  const el = {};
  let minutenTimer = null;

  // Bewegung
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Parallaxe nur mit echter Maus und nur, wenn die Tafeln an den Wänden hängen
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
          // Deko: für Screenreader unsichtbar
          '<div class="tunnel-buehne" aria-hidden="true">' +
            '<div class="tunnel-welt">' +
              '<div class="t-flaeche t-boden">' +
                '<div class="t-asphalt"></div>' +
                '<div class="t-randlinie t-randlinie--links"></div>' +
                '<div class="t-randlinie t-randlinie--rechts"></div>' +
                '<div class="t-mittellinie"></div>' +
                '<div class="t-spiegel-ausgang"></div>' +
                '<div class="t-pfuetzen"></div>' +
                '<div class="t-spiegel-lampen"></div>' +
                '<div class="t-spiegel-tafeln"></div>' +
                '<div class="t-schimmer"></div>' +
              "</div>" +
              '<div class="t-flaeche t-decke"><div class="t-lampen"></div></div>' +
              '<div class="t-flaeche t-wand t-wand--links"><div class="t-wandschein"></div></div>' +
              '<div class="t-flaeche t-wand t-wand--rechts"><div class="t-wandschein"></div></div>' +
              '<div class="t-ausgang"><div class="t-himmel"></div><div class="t-stadt"></div><div class="t-ausgang-licht"></div></div>' +
            "</div>" +
          "</div>" +
          // Begrüßung im Ausgang
          '<div class="tunnel-ziel"><div class="tunnel-welt"><div class="tunnel-gruss"><p class="home-datum"></p></div></div></div>' +
          // Die Tafeln
          '<nav class="tunnel-tafeln" aria-label="Bereiche"><div class="tunnel-welt"></div></nav>' +
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
    el.welten = container.querySelectorAll(".tunnel-welt");
    el.gruss = document.getElementById("titel-home");
    el.datum = container.querySelector(".home-datum");
    el.heute = container.querySelector(".home-heute-inhalt");

    // Die Begrüßung (h1 aus index.html) wandert in den Ausgang – vor das Datum.
    // Sie behält ihre ID: app.js setzt den Fokus und den Seitentitel darüber.
    container.querySelector(".tunnel-gruss").insertBefore(el.gruss, el.datum);

    baueDeko(container);
    baueTafeln(container.querySelector(".tunnel-tafeln .tunnel-welt"));
    bewegungEinrichten();
  }

  /** Lampen, Pfützen, Stadt und die Spiegelungen der Tafeln anlegen. */
  function baueDeko(container) {
    const lampen = container.querySelector(".t-lampen");
    const lampenSpiegel = container.querySelector(".t-spiegel-lampen");
    for (let i = 0; i < SZENE.lampen; i++) {
      lampen.appendChild(deko("t-lampe", { "--i": i }));
      lampenSpiegel.appendChild(deko("t-lampe-spiegel", { "--i": i }));
    }

    const pfuetzen = container.querySelector(".t-pfuetzen");
    SZENE.pfuetzen.forEach(function (p) {
      pfuetzen.appendChild(deko("t-pfuetze", { "--x": p.x + "%", "--tiefe-anteil": p.tiefe / 100, "--b": p.b + "px", "--h": p.h + "px" }));
    });

    const stadt = container.querySelector(".t-stadt");
    SZENE.stadt.forEach(function (haus, i) {
      stadt.appendChild(deko("t-haus", { "--b": haus[0] + "%", "--h": haus[1] + "%", "--i": i }));
    });

    // Je Tafel: Spiegelung auf der Straße und Lichtschein auf der Wand
    const tafelSpiegel = container.querySelector(".t-spiegel-tafeln");
    const schein = {
      links: container.querySelector(".t-wand--links .t-wandschein"),
      rechts: container.querySelector(".t-wand--rechts .t-wandschein"),
    };
    TAFELN.forEach(function (t) {
      const stil = { "--tafel-ton": "var(--tafel-" + t.id + ")" };
      const spiegel = deko("t-tafel-spiegel t-tafel-spiegel--" + t.seite, stil);
      spiegel.dataset.tafel = t.id;
      spiegel.dataset.platz = t.platz;
      tafelSpiegel.appendChild(spiegel);
      const licht = deko("t-tafel-schein", stil);
      licht.dataset.tafel = t.id;
      licht.dataset.platz = t.platz;
      schein[t.seite].appendChild(licht);
    });
  }

  /** Die sechs Tafeln als echte Links. Name und Infozeile bilden die Beschriftung. */
  function baueTafeln(ziel) {
    TAFELN.forEach(function (t) {
      const link = document.createElement("a");
      link.className = "tafel tafel--" + t.seite;
      link.href = t.href;
      link.dataset.tafel = t.id;
      link.dataset.platz = t.platz;
      link.style.setProperty("--tafel-ton", "var(--tafel-" + t.id + ")");
      link.innerHTML =
        // Leuchtfläche: dunkle Grundfläche, darüber das Licht (an/aus) und
        // der hellere Schein beim Hovern – animiert wird nur deren Deckkraft
        '<span class="tafel-flaeche" aria-hidden="true"><span class="tafel-licht"></span><span class="tafel-hell"></span></span>' +
        '<svg class="tafel-symbol" viewBox="0 0 24 24" aria-hidden="true">' + SYMBOLE[t.id] + "</svg>" +
        '<span class="tafel-text"><span class="tafel-name"></span><span class="tafel-info"></span></span>' +
        // Kurze Spiegelung unter der Tafel (nur in der Smartphone-Liste sichtbar)
        '<span class="tafel-spiegel" aria-hidden="true"></span>';
      link.querySelector(".tafel-name").textContent = t.name;
      link.addEventListener("click", function (event) { tafelGeklickt(event, t, link); });
      t.element = link;
      ziel.appendChild(link);
    });
  }

  /** Dekoratives <div> mit Klasse und CSS-Variablen. */
  function deko(klasse, variablen) {
    const d = document.createElement("div");
    d.className = klasse;
    Object.keys(variablen || {}).forEach(function (name) {
      d.style.setProperty(name, variablen[name]);
    });
    return d;
  }

  /**
   * Wird von app.js bei JEDEM Öffnen der Startseite aufgerufen:
   * alles frisch aus den Stores lesen, zeichnen und das Licht einschalten.
   */
  function zeige() {
    zeichne();
    kameraZurueck();
    einschalten();
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
    TAFELN.forEach(function (t) {
      t.element.querySelector(".tafel-info").textContent = t.info(jetzt);
    });
  }


  /* ==========================================================================
     BEWEGUNG: Einschalten, Parallaxe, Kamerafahrt
     Animiert werden nur transform und opacity.
     ========================================================================== */

  /** Lampen und Tafeln gehen von vorne nach hinten nacheinander an (CSS-Animation). */
  function einschalten() {
    el.tunnel.classList.remove("geht-an");
    if (ruhigAbfrage.matches) return;
    void el.tunnel.offsetWidth;            // Neustart der Animation erzwingen
    el.tunnel.classList.add("geht-an");
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
    // Wechsel zu reduzierter Bewegung oder schmalem Fenster: Szene gerade stellen
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
      // Bildzeiten messen (Sicherheitsnetz, siehe SZENE.zeitGrenzeMs)
      if (letztes) {
        summe += zeit - letztes;
        bilder++;
        if (bilder === SZENE.zeitBilder) {
          parallaxe.langsameFenster = summe / bilder > SZENE.zeitGrenzeMs ? parallaxe.langsameFenster + 1 : 0;
          if (parallaxe.langsameFenster >= SZENE.zeitFenster) {
            parallaxe.zuLangsam = true;     // dauerhaft zu langsam: Tunnel bleibt ab jetzt stehen
            parallaxe.laeuft = false;
            setzeWelt("");
            return;
          }
          summe = 0;
          bilder = 0;
        }
      }
      letztes = zeit;
      parallaxe.x += (parallaxe.zielX - parallaxe.x) * SZENE.glaettung;
      parallaxe.y += (parallaxe.zielY - parallaxe.y) * SZENE.glaettung;
      // Maus nach rechts → Szene dreht leicht, der Fluchtpunkt wandert etwas
      // zur Gegenseite; Tafeln, Spiegelungen und Ausgang bewegen sich mit.
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

  /** Dieselbe Bewegung für alle drei Ebenen (Deko, Begrüßung, Tafeln). */
  function setzeWelt(transform) {
    el.welten.forEach(function (w) { w.style.transform = transform; });
  }

  /**
   * Klick auf eine Tafel: Die Kamera fährt die Straße entlang auf die Tafel
   * zu (etwa 500 ms), dann öffnet sich der Abschnitt.
   * Bei "Bewegung reduzieren" (oder Klick mit Strg/Cmd/Mitteltaste) öffnet
   * der Link sofort wie gewohnt.
   */
  function tafelGeklickt(event, tafel, link) {
    if (ruhigAbfrage.matches || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (faehrt) return;
    faehrt = true;

    // Ziel der Fahrt: Tiefe der Tafel (aus CSS) und ihre Wand.
    // Auf dem Smartphone (Tafeln als Liste) fährt die Kamera nur geradeaus.
    const stil = getComputedStyle(link);
    const anDerWand = mausAbfrage.matches || window.matchMedia("(min-width: 700px)").matches;
    const tiefe = parseFloat(stil.getPropertyValue("--z")) || 0;
    const maxFahrt = parseFloat(getComputedStyle(el.tunnel).getPropertyValue("--fahrt-max")) || 400;
    const vor = Math.min(tiefe + 260, maxFahrt);   // ein Stück die Straße entlang, höchstens --fahrt-max
    const richtung = tafel.seite === "links" ? 1 : -1;
    const seitlich = anDerWand ? richtung * 0.22 * el.tunnel.clientWidth : 0;
    const drehung = anDerWand ? richtung * 10 : 0;

    el.tunnel.classList.add("faehrt");
    link.classList.add("ist-ziel");
    setzeWelt("translate3d(" + seitlich.toFixed(1) + "px, 0, " + vor.toFixed(1) + "px) rotateY(" + drehung + "deg)");

    setTimeout(function () {
      faehrt = false;
      window.location.hash = tafel.href;
    }, SZENE.fahrtMs);
  }

  /** Nach der Rückkehr zur Startseite steht die Kamera wieder am Anfang. */
  function kameraZurueck() {
    faehrt = false;
    el.tunnel.classList.remove("faehrt");
    TAFELN.forEach(function (t) { t.element.classList.remove("ist-ziel"); });
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
     INFO-ZEILEN DER TAFELN
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
