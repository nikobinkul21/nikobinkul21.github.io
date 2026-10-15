/* ==========================================================================
   home.js – die Startseite als Karten-Tunnel
   Die Abschnitte der Seite stehen als große, abgerundete Karten in zwei
   Reihen links und rechts. Beide Reihen sind schräg in die Tiefe gedreht
   und laufen auf einen gemeinsamen Fluchtpunkt in der Mitte zu – dort
   steht die Begrüßung. Der Tunnel entsteht nur durch die Karten selbst.
   Darunter steht "Heute" als schlichte Leiste.

   Jede Karte zeigt nur ihren Titel. Der Tunnel steht still – bewegt
   werden nur die einzelne Karte beim Hovern, der Aufbau beim Öffnen und
   die Fahrt beim Klick.

   Die Startseite speichert selbst NICHTS. "Heute" liest bei jedem Öffnen
   frisch aus EventsStore (js/events-store.js) – Termine und Vorlesungen.

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
  };

  // Die Karten je Reihe, jeweils von vorne nach hinten. Reihenfolge = Tab-Reihenfolge.
  // Neue Karte? Hier ergänzen und in css/home.css --karten-pro-seite anpassen
  // (die Karten werden dann schmaler, die Reihe bleibt gleich lang).
  const REIHEN = {
    links: [   // Studium
      { id: "kalender", href: "#kalender", name: "Kalender" },
      { id: "stundenplan", href: "#schedule", name: "Stundenplan/Termine" },
      { id: "todo", href: "#todo", name: "Zu erledigen" },
    ],
    rechts: [  // Freizeit
      { id: "media", href: "#media", name: "Filme/Serien" },
      { id: "games", href: "#games/sudoku", name: "Games" },
      { id: "customising", href: "#customising", name: "Customising" },
    ],
  };
  const KARTEN = REIHEN.links.concat(REIHEN.rechts);

  const el = {};
  let minutenTimer = null;

  // Bewegung
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");
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
          // Die "Welt": alles darin liegt im selben 3D-Raum. Die Fahrt
          // beim Klick bewegt nur sie.
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
  }

  /**
   * Eine Karte als echter Link. Sie zeigt nur ihren Titel – er ist zugleich
   * die Beschriftung für Screenreader (z. B. "Games, Link").
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
    link.innerHTML = '<span class="tunnel-karte-name"></span>';
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
   * Begrüßung und "Heute" frisch zeichnen und die Karten aufbauen.
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
  }


  /* ==========================================================================
     BEWEGUNG: Aufbau beim Öffnen und Fahrt beim Klick
     (Der Hover-Effekt der einzelnen Karte steht ganz in css/home.css.)
     Animiert werden nur transform und opacity.
     ========================================================================== */

  /** Die Karten bauen sich von hinten nach vorn nacheinander auf (CSS-Animation). */
  function aufbauen() {
    el.tunnel.classList.remove("baut-auf");
    if (ruhigAbfrage.matches) return;
    void el.tunnel.offsetWidth;            // Neustart der Animation erzwingen
    el.tunnel.classList.add("baut-auf");
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
