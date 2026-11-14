/* ==========================================================================
   chess/spiel.js – Ablauf der Partie und die Oberfläche (#games/chess)
   Ich spiele gegen einen Bot mit zufälliger, zunächst verdeckter Spielstärke.
   Claudy hilft auf Wunsch (Tipps in vier Stufen), bewertet meine Züge und
   erklärt, was besser gewesen wäre. Nach der Partie: Ergebnis, aufgedeckte
   Stärke, Übersicht meiner Züge, teuerste Fehler, Durchblättern, Statistik.

   Zusammenspiel:
     SchachBrett   zeigt die Stellung, meldet meine Züge       (brett.js)
     SchachBot     wählt den Zug des Gegners                   (bot.js)
     SchachEngine  Stockfish: Analyse und Bot                  (engine.js)
     SchachMuster  Muster, Einstufung, Claudys Sätze           (muster.js)
     SchachClaudy  Figur und Sprechblase                       (claudy.js)
     SchachSpeicher Einstellungen, Partie, Statistik           (speicher.js)

   Bewertung eines meiner Züge (gespeichert in partie.bewertungen[Halbzug]):
     klasse    "sehrgut" | "gut" | "ungenau" | "fehler" | "grob"
     verlust   verlorene Gewinnchance in Prozentpunkten
     cp        Bewertung des besten Zugs vor meinem Zug (meine Sicht, 1/100 Bauern)
     cpDanach  Bewertung nach meinem Zug (meine Sicht)
     matt      Matt in n Zügen, das der beste Zug erzwungen hätte (0 = keins)
     bester    der beste Zug laut Engine, z. B. "g1f3"
     antwort   die beste Antwort des Gegners auf meinen Zug

   Asynchrones: Engine und Bot antworten später. Jede neue Partie, jedes
   Zurücknehmen und jedes Ende erhöht den Zähler "lauf"; Antworten, die zu
   einem älteren Lauf gehören, werden verworfen.
   Texte kommen per textContent in die Seite, nie als HTML.
   ========================================================================== */

/**
 * Baut das Schachspiel auf. Wird von games.js EINMAL aufgerufen.
 * @param {HTMLElement} container – Inhaltsbereich des Spiels
 * @returns {{zeige: function}} – zeige() läuft bei jedem Öffnen
 */
function initSchach(container) {
  const K = SchachKonfig;
  const M = SchachMuster;
  const S = SchachSpeicher;

  const FARBE = { w: "Weiß", b: "Schwarz" };
  const GRUND = {
    matt: "durch Matt", patt: "durch Patt", wiederholung: "durch dreifache Stellungswiederholung",
    material: "weil das Material nicht zum Mattsetzen reicht", "50zuege": "nach der 50-Züge-Regel",
    aufgabe: "durch Aufgabe", vereinbart: "durch Einigung",
  };
  const ERGEBNIS = { sieg: "Gewonnen!", remis: "Remis", niederlage: "Verloren" };
  const ERGEBNIS_WORT = { sieg: "Sieg", remis: "Remis", niederlage: "Niederlage" };

  let daten = S.laden();
  let schach = null;             // die aktuelle Stellung (chess.js)
  let analysen = {};             // Halbzug → Promise der Analyse der Stellung VOR diesem Halbzug
  let lauf = 0;                  // siehe Kopfkommentar
  let blick = null;              // beim Blättern: so viele Halbzüge sind zu sehen (null = aktuelle Stellung)
  let hinweis = null;            // Claudys Zeichen auf dem Brett: { halbzug, pfeile, schubs }
  let engineBereit = null;       // null = lädt noch, true, false = nicht ladbar
  let botDenkt = false;
  let botAb = 0;                 // ab diesem Zeitpunkt läuft die Bedenkzeit des Bots (mein Zug)
  let fragtUmwandlung = false;
  let meldung = "";              // kurze Zusatzzeile im Status (z. B. "Der Bot lehnt das Remis ab.")
  let brettStand = "";           // was das Brett gerade zeigt – nur bei Änderung neu zeichnen
  let gestartet = false;
  let aufgebenTimer = null;
  const el = {};

  /* ---------- kleine Helfer ---------- */

  /** Element mit Klasse und reinem Text. */
  function neu(tag, klasse, text) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text) e.textContent = text;
    return e;
  }

  function knopf(klasse, text, beimKlick) {
    const k = neu("button", "knopf " + klasse, text);
    k.type = "button";
    k.addEventListener("click", beimKlick);
    return k;
  }

  /** Beschriftetes Kontrollkästchen. */
  function haken(text, beimWechsel) {
    const label = neu("label", "sch-haken");
    const feld = document.createElement("input");
    feld.type = "checkbox";
    feld.addEventListener("change", function () { beimWechsel(feld.checked); });
    label.appendChild(feld);
    label.appendChild(neu("span", "", text));
    return { label: label, feld: feld };
  }

  const E = function () { return daten.einstellungen; };
  const P = function () { return daten.partie; };
  const speichere = function () { S.speichern(daten); };
  const warte = function (ms) { return new Promise(function (f) { setTimeout(f, ms); }); };

  /** Die Stellung nach den ersten n Halbzügen der Partie. */
  function stellungBis(n) {
    const s = P().startFen ? new Chess(P().startFen) : new Chess();
    for (let i = 0; i < n; i++) spiele(s, P().zuege[i]);
    return s;
  }

  /** Führt einen Zug ("e7e8q") auf einer Stellung aus. */
  function spiele(s, uci) {
    return s.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }

  /** Welche Farbe zieht im Halbzug Nummer n (ab 0)? */
  function farbeVon(n) {
    const start = P().startFen ? P().startFen.split(" ")[1] : "w";
    return n % 2 === 0 ? start : start === "w" ? "b" : "w";
  }

  const istMein = function (n) { return farbeVon(n) === P().farbe; };

  /** Alle Züge der Partie in deutscher Kurznotation. */
  function notation() {
    const s = stellungBis(0);
    return P().zuege.map(function (uci) { return M.sanDeutsch(spiele(s, uci).san); });
  }

  /** Claudy plaudert von sich aus – außer er ist ganz abgeschaltet. */
  function plaudere(text, stimmung) {
    if (E().hilfe === "aus" && !E().zugbewertung) return;
    el.claudy.sag(text, stimmung);
  }

  /* ==========================================================================
     AUFBAU DER OBERFLÄCHE
     ========================================================================== */

  function baue() {
    container.textContent = "";
    const wurzel = neu("div", "schach");

    // Hinweis, falls die Engine nicht lädt (z. B. Seite per Doppelklick geöffnet)
    el.engineHinweis = neu("div", "sch-engine-hinweis");
    el.engineHinweis.hidden = true;
    el.engineHinweis.setAttribute("role", "alert");
    wurzel.appendChild(el.engineHinweis);

    const haupt = neu("div", "sch-haupt");

    /* --- linke Spalte: Gegner, Brett, Status, Aktionen --- */
    const links = neu("div", "sch-brett-spalte");
    const gegner = neu("p", "sch-gegner");
    gegner.appendChild(neu("span", "sch-gegner-name", "Bot"));
    el.elo = neu("span", "sch-gegner-elo");
    gegner.appendChild(el.elo);
    links.appendChild(gegner);

    const brettRahmen = neu("div");
    links.appendChild(brettRahmen);
    el.brett = SchachBrett(brettRahmen, { zielFelder: zielFelder, beimZug: meinZug });

    el.status = neu("p", "sch-status");
    el.status.setAttribute("role", "status");
    links.appendChild(el.status);

    const aktionen = neu("div", "sch-aktionen");
    el.zurueck = knopf("sch-zurueck", "", nimmZurueck);
    el.remis = knopf("", "Remis anbieten", bieteRemis);
    el.aufgeben = knopf("", "Aufgeben", gibAuf);
    el.drehen = knopf("", "Brett drehen", function () {
      P().gedreht = !P().gedreht;
      speichere();
      zeichne();
    });
    [el.zurueck, el.remis, el.aufgeben, el.drehen].forEach(function (k) { aktionen.appendChild(k); });
    links.appendChild(aktionen);
    haupt.appendChild(links);

    /* --- rechte Spalte: Claudy, Ende, Zugliste, Einstellungen, Statistik --- */
    const rechts = neu("div", "sch-seite");
    rechts.appendChild(baueClaudy());
    el.ende = neu("section", "sch-karte sch-ende");
    el.ende.hidden = true;
    rechts.appendChild(el.ende);
    rechts.appendChild(baueZugliste());
    rechts.appendChild(baueEinstellungen());
    rechts.appendChild(baueStatistik());
    haupt.appendChild(rechts);

    wurzel.appendChild(haupt);
    container.appendChild(wurzel);

    // Pfeiltasten blättern durch die Partie (nicht in Eingabefeldern)
    wurzel.addEventListener("keydown", function (ereignis) {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(ereignis.target.tagName)) return;
      if (ereignis.key === "ArrowLeft") blaettere(-1);
      else if (ereignis.key === "ArrowRight") blaettere(1);
      else return;
      ereignis.preventDefault();
    });
  }

  function baueClaudy() {
    const karte = neu("section", "sch-karte sch-claudy-karte");
    karte.setAttribute("aria-label", "Claudy, dein Assistent");
    const figur = neu("div");
    karte.appendChild(figur);
    el.claudy = SchachClaudy(figur);

    const regler = neu("div", "sch-hilfe");
    const label = neu("label", "sch-hilfe-wahl");
    label.appendChild(neu("span", "", "Hilfe"));
    el.hilfe = document.createElement("select");
    K.hilfen.forEach(function (h) {
      const o = neu("option", "", h.name);
      o.value = h.id;
      el.hilfe.appendChild(o);
    });
    el.hilfe.addEventListener("change", function () {
      E().hilfe = el.hilfe.value;
      hinweis = null;
      speichere();
      const h = K.hilfen.find(function (x) { return x.id === E().hilfe; });
      if (E().hilfe === "aus") el.claudy.schweig();
      else el.claudy.sag(h.name + ": " + h.text + (E().automatisch ? "" : " Klick auf „Tipp“, wenn du mich brauchst."));
      zeichne();
      if (E().automatisch) gibTipp(true);
    });
    label.appendChild(el.hilfe);
    regler.appendChild(label);
    el.tipp = knopf("knopf--haupt sch-tipp", "Tipp", function () { gibTipp(false); });
    regler.appendChild(el.tipp);
    karte.appendChild(regler);

    const schalter = neu("div", "sch-schalter");
    el.automatisch = haken("automatisch", function (an) {
      E().automatisch = an;
      speichere();
      if (an) gibTipp(true);
    });
    el.zugbewertung = haken("Zugbewertung", function (an) {
      E().zugbewertung = an;
      speichere();
    });
    schalter.appendChild(el.automatisch.label);
    schalter.appendChild(el.zugbewertung.label);
    karte.appendChild(schalter);

    el.besser = knopf("sch-besser", "Was wäre besser gewesen?", function () { erklaere(null); });
    karte.appendChild(el.besser);
    return karte;
  }

  function baueZugliste() {
    const karte = neu("section", "sch-karte sch-zuege-karte");
    const kopf = neu("div", "sch-zuege-kopf");
    kopf.appendChild(neu("h3", "sch-karten-titel", "Züge"));
    const nav = neu("div", "sch-blaettern");
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", "Durch die Partie blättern");
    [["⏮", "Zum Anfang", -Infinity], ["◀", "Ein Zug zurück", -1], ["▶", "Ein Zug vor", 1], ["⏭", "Zur aktuellen Stellung", Infinity]]
      .forEach(function (b) {
        const k = knopf("sch-blaettern-knopf", b[0], function () { blaettere(b[2]); });
        k.setAttribute("aria-label", b[1]);
        k.title = b[1];
        nav.appendChild(k);
      });
    kopf.appendChild(nav);
    karte.appendChild(kopf);
    el.liste = neu("ol", "sch-zuege");
    el.liste.addEventListener("click", function (ereignis) {
      const k = ereignis.target.closest("[data-halbzug]");
      if (!k) return;
      setzeBlick(Number(k.dataset.halbzug));
    });
    karte.appendChild(el.liste);
    return karte;
  }

  function baueEinstellungen() {
    const klappe = neu("details", "sch-karte sch-klappe");
    klappe.appendChild(neu("summary", "sch-karten-titel", "Einstellungen"));
    const inhalt = neu("div", "sch-klappe-inhalt");

    // Elo-Bereich des Bots
    const bereich = neu("fieldset", "sch-feldgruppe");
    bereich.appendChild(neu("legend", "", "Spielstärke des Bots (Elo)"));
    const zeile = neu("div", "sch-bereich");
    const eingabe = function (name) {
      const label = neu("label", "sch-zahl");
      label.appendChild(neu("span", "", name));
      const feld = document.createElement("input");
      feld.type = "number";
      feld.min = K.elo.min;
      feld.max = K.elo.max;
      feld.step = 50;
      feld.inputMode = "numeric";
      feld.addEventListener("change", uebernimmBereich);
      label.appendChild(feld);
      zeile.appendChild(label);
      return feld;
    };
    el.eloMin = eingabe("von");
    el.eloMax = eingabe("bis");
    bereich.appendChild(zeile);
    el.bereichHinweis = neu("p", "sch-klein");
    bereich.appendChild(el.bereichHinweis);
    inhalt.appendChild(bereich);

    el.eloZeigen = haken("Stärke von Anfang an anzeigen", function (an) {
      E().eloZeigen = an;
      speichere();
      zeichne();
    });
    inhalt.appendChild(el.eloZeigen.label);

    const farbe = neu("label", "sch-hilfe-wahl");
    farbe.appendChild(neu("span", "", "Meine Farbe"));
    el.farbe = document.createElement("select");
    [["zufall", "Zufällig"], ["w", "Weiß"], ["b", "Schwarz"]].forEach(function (f) {
      const o = neu("option", "", f[1]);
      o.value = f[0];
      el.farbe.appendChild(o);
    });
    el.farbe.addEventListener("change", function () {
      E().farbe = el.farbe.value;
      speichere();
    });
    farbe.appendChild(el.farbe);
    inhalt.appendChild(farbe);

    el.zuruecknehmen = haken("Züge zurücknehmen erlauben", function (an) {
      E().zuruecknehmen = an;
      speichere();
      zeichne();
    });
    inhalt.appendChild(el.zuruecknehmen.label);
    inhalt.appendChild(neu("p", "sch-klein", "Elo-Bereich und Farbe gelten ab der nächsten Partie."));
    klappe.appendChild(inhalt);
    return klappe;
  }

  function baueStatistik() {
    const klappe = neu("details", "sch-karte sch-klappe");
    klappe.appendChild(neu("summary", "sch-karten-titel", "Statistik"));
    el.statistik = neu("div", "sch-klappe-inhalt");
    klappe.appendChild(el.statistik);
    return klappe;
  }

  /**
   * Eigenen Elo-Bereich übernehmen. Passt die andere Grenze nicht mehr dazu
   * (Bereich zu schmal oder verdreht), rückt sie mit – so lässt sich der
   * Bereich in beliebiger Reihenfolge verschieben.
   */
  function uebernimmBereich(ereignis) {
    const s = K.elo.schritt, breite = K.elo.mindestBreite;
    const runde = function (feld, ersatz) {
      const n = Math.round(Number(feld.value) / s) * s;
      return Math.max(K.elo.min, Math.min(K.elo.max, feld.value === "" || isNaN(n) ? ersatz : n));
    };
    let min = runde(el.eloMin, E().eloMin), max = runde(el.eloMax, E().eloMax);
    if (max - min < breite) {
      if (ereignis && ereignis.target === el.eloMax) {
        max = Math.max(max, K.elo.min + breite);
        min = Math.min(min, max - breite);
      } else {
        min = Math.min(min, K.elo.max - breite);
        max = Math.max(max, min + breite);
      }
    }
    E().eloMin = min;
    E().eloMax = max;
    speichere();
    el.eloMin.value = min;
    el.eloMax.value = max;
    el.bereichHinweis.textContent = "Gespeichert: " + min + " bis " + max + " Elo (mindestens " + breite + " Elo breit).";
  }

  /* ==========================================================================
     ZEICHNEN
     ========================================================================== */

  /** Bringt die ganze Oberfläche auf den Stand der Partie. */
  function zeichne() {
    const p = P();
    const n = blick === null ? p.zuege.length : blick;
    const live = blick === null;
    const s = live ? schach : stellungBis(n);
    const amZug = !p.ende && live && schach.turn() === p.farbe;
    const bedienbar = Boolean(engineBereit) && amZug && !botDenkt && !fragtUmwandlung;

    // Brett nur neu zeichnen, wenn sich etwas geändert hat (sonst ginge eine Auswahl verloren)
    const gedreht = (p.farbe === "b") !== p.gedreht;
    const stand = [s.fen(), gedreht, bedienbar, n].join("|");
    if (stand !== brettStand) {
      brettStand = stand;
      const figuren = {};
      s.board().forEach(function (reihe) {
        reihe.forEach(function (f) { if (f) figuren[f.square] = { type: f.type, color: f.color }; });
      });
      const letzter = n > 0 ? [p.zuege[n - 1].slice(0, 2), p.zuege[n - 1].slice(2, 4)] : null;
      const koenig = s.isCheck() ? s.findPiece({ type: "k", color: s.turn() })[0] : null;
      el.brett.zeige({ figuren: figuren, gedreht: gedreht, letzter: letzter, schach: koenig, bedienbar: bedienbar, farbe: p.farbe });
    }
    const zeigtHinweis = hinweis && hinweis.halbzug === n;
    el.brett.pfeile(zeigtHinweis ? hinweis.pfeile : []);
    el.brett.markiere(zeigtHinweis ? hinweis.schubs : null);

    // Gegner und Status
    el.elo.textContent = p.ende || E().eloZeigen ? "ca. " + p.elo + " Elo" : "Stärke verdeckt";
    let status;
    if (engineBereit === false) status = "Die Engine fehlt – ohne sie kann der Bot nicht ziehen.";
    else if (!live) status = "Rückblick: Stellung nach " + n + " von " + p.zuege.length + " Halbzügen.";
    else if (p.ende) status = "Partie beendet: " + ERGEBNIS_WORT[p.ende.ergebnis] + " " + (GRUND[p.ende.grund] || "") + ".";
    else if (engineBereit === null) status = "Die Engine wird geladen …";
    else if (botDenkt || !amZug) status = "Der Bot denkt …";
    else status = "Du bist am Zug (" + FARBE[p.farbe] + ")." + (schach.isCheck() ? " Schach!" : "");
    el.status.textContent = status + (meldung && live ? " " + meldung : "");

    // Aktionen
    const laeuft = !p.ende && Boolean(engineBereit);
    el.zurueck.textContent = "Zug zurück" + (p.zurueck ? " (" + p.zurueck + ")" : "");
    el.zurueck.hidden = !E().zuruecknehmen;
    el.zurueck.disabled = !laeuft || !kannZurueck();
    el.remis.disabled = !laeuft || !amZug || botDenkt;
    el.aufgeben.disabled = !laeuft;
    el.tipp.disabled = !laeuft || !amZug || botDenkt || !live;
    el.besser.disabled = letzterEigener(n) < 0;

    // Regler auf den gespeicherten Stand
    el.hilfe.value = E().hilfe;
    el.automatisch.feld.checked = E().automatisch;
    el.zugbewertung.feld.checked = E().zugbewertung;
    el.eloZeigen.feld.checked = E().eloZeigen;
    el.zuruecknehmen.feld.checked = E().zuruecknehmen;
    el.farbe.value = E().farbe;
    if (document.activeElement !== el.eloMin) el.eloMin.value = E().eloMin;
    if (document.activeElement !== el.eloMax) el.eloMax.value = E().eloMax;

    zeichneZugliste(n);
    zeichneEnde();
  }

  /** Die Zugliste: je Zeile ein Zugpaar; eigene Züge tragen ihre Einstufung. */
  function zeichneZugliste(n) {
    const p = P();
    const san = notation();
    el.liste.textContent = "";
    const startWeiss = farbeVon(0) === "w";
    const startNr = p.startFen ? Number(p.startFen.split(" ")[5]) || 1 : 1;
    let zeile = null;
    san.forEach(function (text, i) {
      const weiss = farbeVon(i) === "w";
      if (weiss || !zeile) {
        zeile = neu("li", "sch-zugpaar");
        const nr = startNr + Math.floor((i + (startWeiss ? 0 : 1)) / 2);
        zeile.appendChild(neu("span", "sch-zugnr", nr + (weiss ? "." : "…")));
        el.liste.appendChild(zeile);
      }
      const k = neu("button", "sch-zug", text);
      k.type = "button";
      k.dataset.halbzug = i + 1;
      const b = p.bewertungen[i];
      if (b) {
        const klasse = K.klassen.find(function (x) { return x.id === b.klasse; });
        k.classList.add("ist-" + b.klasse);
        k.title = klasse.name;
        k.appendChild(neu("span", "nur-screenreader", " (" + klasse.name + ")"));
      }
      if (i + 1 === n) {
        k.classList.add("ist-aktuell");
        k.setAttribute("aria-current", "true");
      }
      zeile.appendChild(k);
    });
    if (!san.length) el.liste.appendChild(neu("li", "sch-klein", "Noch kein Zug gespielt."));
    const aktuell = el.liste.querySelector(".ist-aktuell");
    if (aktuell) el.liste.scrollTop = Math.max(0, aktuell.offsetTop - el.liste.clientHeight / 2);
  }

  /** Nach der Partie: Ergebnis, Stärke, Übersicht, teuerste Fehler, Knöpfe. */
  function zeichneEnde() {
    const p = P();
    el.ende.hidden = !p.ende;
    el.ende.textContent = "";
    if (!p.ende) return;
    el.ende.appendChild(neu("h3", "sch-ende-titel", ERGEBNIS[p.ende.ergebnis]));
    el.ende.appendChild(neu("p", "sch-ende-text",
      ERGEBNIS_WORT[p.ende.ergebnis] + " " + (GRUND[p.ende.grund] || "") + ". Du hast gegen etwa " + p.elo + " Elo gespielt."));

    // Übersicht meiner Züge nach Einstufung
    const nummern = Object.keys(p.bewertungen).map(Number).sort(function (a, b) { return a - b; });
    const uebersicht = neu("ul", "sch-uebersicht");
    K.klassen.forEach(function (klasse) {
      const anzahl = nummern.filter(function (i) { return p.bewertungen[i].klasse === klasse.id; }).length;
      const li = neu("li", "sch-uebersicht-zeile ist-" + klasse.id);
      li.appendChild(neu("span", "sch-uebersicht-name", klasse.name));
      li.appendChild(neu("span", "sch-uebersicht-zahl", String(anzahl)));
      uebersicht.appendChild(li);
    });
    el.ende.appendChild(uebersicht);

    // Die drei teuersten Fehler – ein Klick zeigt Claudys Erklärung
    const teuer = nummern.filter(function (i) { return p.bewertungen[i].klasse !== "sehrgut" && p.bewertungen[i].klasse !== "gut"; })
      .sort(function (a, b) { return p.bewertungen[b].verlust - p.bewertungen[a].verlust; }).slice(0, 3);
    if (teuer.length) {
      el.ende.appendChild(neu("h4", "sch-ende-unter", teuer.length === 1 ? "Dein teuerster Fehler" : "Deine " + teuer.length + " teuersten Fehler"));
      const san = notation();
      const liste = neu("ol", "sch-teuer");
      teuer.forEach(function (i) {
        const klasse = K.klassen.find(function (x) { return x.id === p.bewertungen[i].klasse; });
        const li = document.createElement("li");
        const k = neu("button", "sch-teuer-knopf ist-" + klasse.id);
        k.type = "button";
        k.appendChild(neu("span", "sch-teuer-zug", (Math.floor(i / 2) + 1) + ". " + (farbeVon(i) === "w" ? "" : "… ") + san[i]));
        k.appendChild(neu("span", "sch-teuer-art", klasse.name));
        k.addEventListener("click", function () { erklaere(i); });
        li.appendChild(k);
        liste.appendChild(li);
      });
      el.ende.appendChild(liste);
    } else if (nummern.length) {
      el.ende.appendChild(neu("p", "sch-klein", "Keine Ungenauigkeiten und Fehler – stark gespielt!"));
    }

    const knoepfe = neu("div", "sch-ende-knoepfe");
    knoepfe.appendChild(knopf("knopf--haupt sch-naechste", "Nächste Partie", function () { neuePartie(); }));
    el.pgn = knopf("sch-pgn", "PGN kopieren", kopierePgn);
    knoepfe.appendChild(el.pgn);
    el.ende.appendChild(knoepfe);
  }

  /** Statistik: Ergebnisse nach Elo-Bereichen und Fehler pro Partie im Verlauf. */
  function zeichneStatistik() {
    const st = daten.statistik;
    el.statistik.textContent = "";
    if (!st.length) {
      el.statistik.appendChild(neu("p", "sch-klein", "Noch keine beendete Partie."));
      return;
    }
    const tabelle = neu("table", "sch-tabelle");
    const kopf = document.createElement("tr");
    ["Elo des Bots", "Siege", "Remis", "Niederl."].forEach(function (t) {
      const th = neu("th", "", t);
      th.scope = "col";
      kopf.appendChild(th);
    });
    tabelle.appendChild(kopf);
    const summe = { sieg: 0, remis: 0, niederlage: 0 };
    S.nachBereichen(st).forEach(function (b) {
      const tr = document.createElement("tr");
      const th = neu("th", "", b.von + "–" + Math.min(b.bis, K.elo.max));
      th.scope = "row";
      tr.appendChild(th);
      ["sieg", "remis", "niederlage"].forEach(function (e) {
        summe[e] += b[e];
        tr.appendChild(neu("td", b[e] ? "" : "ist-null", String(b[e])));
      });
      tabelle.appendChild(tr);
    });
    const fuss = neu("tr", "sch-tabelle-summe");
    const th = neu("th", "", "Gesamt");
    th.scope = "row";
    fuss.appendChild(th);
    ["sieg", "remis", "niederlage"].forEach(function (e) { fuss.appendChild(neu("td", "", String(summe[e]))); });
    tabelle.appendChild(fuss);
    el.statistik.appendChild(tabelle);

    // Verlauf: ein Balken je Partie, Höhe = Fehler und grobe Fehler
    const letzte = st.slice(-K.statistik.verlauf);
    const hoechste = Math.max(1, Math.max.apply(null, letzte.map(function (e) { return e.fehler; })));
    el.statistik.appendChild(neu("h4", "sch-ende-unter", "Fehler pro Partie"));
    const verlauf = neu("div", "sch-verlauf");
    verlauf.setAttribute("role", "img");
    verlauf.setAttribute("aria-label", "Fehler pro Partie, älteste links: " + letzte.map(function (e) { return e.fehler; }).join(", "));
    letzte.forEach(function (e) {
      const balken = neu("span", "sch-balken ist-" + e.ergebnis);
      balken.style.height = Math.max(4, Math.round(e.fehler / hoechste * 100)) + "%";
      balken.title = new Date(e.datum).toLocaleDateString("de-DE") + ": " + e.fehler + " Fehler gegen " + e.elo + " Elo (" + ERGEBNIS[e.ergebnis].replace("!", "") + ")";
      verlauf.appendChild(balken);
    });
    el.statistik.appendChild(verlauf);
    const schnitt = function (liste) {
      return liste.length ? String(Math.round(liste.reduce(function (a, e) { return a + e.fehler; }, 0) / liste.length * 10) / 10).replace(".", ",") : "–";
    };
    el.statistik.appendChild(neu("p", "sch-klein",
      st.length + (st.length === 1 ? " Partie" : " Partien") + ". Fehler im Schnitt: " + schnitt(st) +
      (st.length > 10 ? ", in den letzten 10 Partien: " + schnitt(st.slice(-10)) : "") + ". Höchster Balken: " + hoechste + "."));
  }

  /* ==========================================================================
     ABLAUF DER PARTIE
     ========================================================================== */

  /**
   * Beginnt eine neue Partie mit frisch gezogener Spielstärke.
   * @param {object} [wunsch] – für Tests: { elo, farbe, startFen }
   */
  function neuePartie(wunsch) {
    wunsch = wunsch || {};
    lauf++;
    SchachEngine.neuePartie();
    analysen = {};
    hinweis = null;
    blick = null;
    botDenkt = false;
    meldung = "";
    const farbe = wunsch.farbe || (E().farbe === "zufall" ? (Math.random() < 0.5 ? "w" : "b") : E().farbe);
    daten.partie = {
      id: "s" + Date.now().toString(36),
      start: new Date().toISOString(),
      elo: wunsch.elo || SchachBot.zieheElo(E().eloMin, E().eloMax),
      farbe: farbe,
      startFen: wunsch.startFen || null,
      zuege: [], bewertungen: {}, zurueck: 0, gedreht: false, ende: null,
    };
    schach = stellungBis(0);
    speichere();
    plaudere("Neue Partie! Du spielst " + FARBE[farbe] + ". Viel Spaß!", "froh");
    weiter();
  }

  /** Ist die Partie nach den Regeln zu Ende? */
  function regelEnde() {
    if (schach.isCheckmate()) return { ergebnis: schach.turn() === P().farbe ? "niederlage" : "sieg", grund: "matt" };
    if (schach.isStalemate()) return { ergebnis: "remis", grund: "patt" };
    if (schach.isThreefoldRepetition()) return { ergebnis: "remis", grund: "wiederholung" };
    if (schach.isInsufficientMaterial()) return { ergebnis: "remis", grund: "material" };
    if (schach.isDraw()) return { ergebnis: "remis", grund: "50zuege" };
    return null;
  }

  /** Wie geht es weiter? Ende feststellen, den Bot ziehen lassen oder auf mich warten. */
  function weiter() {
    if (P().ende) {
      zeichne();
      return;
    }
    const ende = regelEnde();
    if (ende) {
      beende(ende);
      return;
    }
    if (!engineBereit) {
      zeichne();
      return;
    }
    if (schach.turn() !== P().farbe) {
      botZieht();
      return;
    }
    botDenkt = false;
    analysiere(P().zuege.length);            // läuft im Hintergrund, während ich überlege
    zeichne();
    if (E().automatisch && E().hilfe !== "aus") gibTipp(true);
  }

  /**
   * Analyse der Stellung vor dem Halbzug n (volle Stärke, mehrere Linien).
   * Jede Stellung wird nur einmal untersucht.
   */
  function analysiere(n) {
    if (!analysen[n]) {
      const fen = n === P().zuege.length ? schach.fen() : stellungBis(n).fen();
      analysen[n] = SchachEngine.suche({ fen: fen, tiefe: K.analyse.tiefe, zeit: K.analyse.zeit, linien: K.analyse.linien });
      analysen[n].catch(function () { delete analysen[n]; });     // abgebrochen: beim nächsten Mal neu
    }
    return analysen[n];
  }

  /** Für das Brett: erlaubte Zielfelder der Figur auf einem Feld. */
  function zielFelder(feld) {
    return schach.moves({ square: feld, verbose: true }).map(function (z) { return z.to; });
  }

  /** Ich ziehe (vom Brett gemeldet). Bei einer Umwandlung wird erst die Figur erfragt. */
  function meinZug(von, nach) {
    const moeglich = schach.moves({ square: von, verbose: true }).filter(function (z) { return z.to === nach; });
    if (!moeglich.length || P().ende || botDenkt) return;
    const umwandlung = moeglich[0].promotion
      ? (fragtUmwandlung = true, zeichne(), el.brett.frageUmwandlung(P().farbe))
      : Promise.resolve(undefined);
    const meinLauf = lauf;
    umwandlung.then(function (figur) {
      fragtUmwandlung = false;
      if (meinLauf !== lauf) return;
      if (figur === null) {                  // Auswahl abgebrochen
        zeichne();
        return;
      }
      const n = P().zuege.length;
      schach.move({ from: von, to: nach, promotion: figur });
      P().zuege.push(von + nach + (figur || ""));
      hinweis = null;
      meldung = "";
      botDenkt = !regelEnde();               // der Bot ist dran – das Brett ist gesperrt
      botAb = Date.now();
      speichere();
      zeichne();
      // Erst meinen Zug bewerten, dann geht es weiter (die Engine arbeitet beides nacheinander ab)
      bewerte(n, meinLauf).then(function () {
        if (meinLauf !== lauf) return;
        const b = P().bewertungen[n];
        if (b && E().zugbewertung) {
          const u = M.urteil(b, stellungBis(n).fen(), P().zuege[n]);
          el.claudy.sag(u.text, u.stimmung);
        }
        weiter();
      });
    });
  }

  /**
   * Bewertet meinen Halbzug n: Wie viel Gewinnchance hat er gegenüber dem
   * besten Zug gekostet? Ergebnis landet in partie.bewertungen[n].
   */
  function bewerte(n, meinLauf) {
    const uci = P().zuege[n];
    const danach = stellungBis(n + 1);
    return analysiere(n).then(function (a) {
      if (meinLauf !== lauf || !a.linien.length) return null;
      const beste = a.linien[0];
      const gleiche = a.linien.find(function (l) { return l.zug === uci; });
      if (danach.isCheckmate()) return { beste: beste, cpDanach: 10000, antwort: "" };
      if (danach.isDraw()) return { beste: beste, cpDanach: 0, antwort: "" };
      if (gleiche) return { beste: beste, cpDanach: M.cpVon(gleiche), antwort: gleiche.pv[1] || "" };
      // Mein Zug war nicht unter den besten: die Stellung danach eigens bewerten (Sicht des Gegners)
      return SchachEngine.suche({ fen: danach.fen(), tiefe: K.analyse.tiefe - 2, zeit: K.analyse.zeit }).then(function (e) {
        return { beste: beste, cpDanach: e.linien.length ? -M.cpVon(e.linien[0]) : 0, antwort: e.zug };
      });
    }).then(function (r) {
      if (!r || meinLauf !== lauf) return;
      const cp = M.cpVon(r.beste);
      const verlust = uci === r.beste.zug ? 0 : Math.max(0, M.gewinnChance(cp) - M.gewinnChance(r.cpDanach));
      P().bewertungen[n] = {
        klasse: M.klasseVon(verlust).id,
        verlust: Math.round(verlust * 10) / 10,
        cp: cp,
        cpDanach: r.cpDanach,
        matt: r.beste.matt > 0 ? r.beste.matt : 0,
        bester: r.beste.zug,
        antwort: r.antwort || "",
      };
      speichere();
    }).catch(function () { /* abgebrochen oder Engine ausgefallen: dann eben ohne Bewertung */ });
  }

  /** Der Bot ist am Zug: Zug wählen, kurz "nachdenken", ziehen. */
  function botZieht() {
    botDenkt = true;
    zeichne();
    const meinLauf = lauf;
    // Die Bedenkzeit zählt ab meinem Zug – das Bewerten meines Zugs gehört schon dazu
    const beginn = botAb || Date.now();
    botAb = 0;
    const erlaubt = schach.moves({ verbose: true }).map(function (z) { return z.lan; });
    SchachBot.waehleZug(schach.fen(), erlaubt, P().elo).then(function (zug) {
      return warte(Math.max(0, SchachBot.denkzeit(P().elo) - (Date.now() - beginn))).then(function () { return zug; });
    }).then(function (zug) {
      if (meinLauf !== lauf) return;
      if (erlaubt.indexOf(zug) < 0) zug = erlaubt[0];
      spiele(schach, zug);
      P().zuege.push(zug);
      botDenkt = false;
      speichere();
      weiter();
    }).catch(function (fehler) {
      if (meinLauf !== lauf || (fehler && fehler.message === "abgebrochen")) return;
      botDenkt = false;
      engineFehlt();
    });
  }

  /** Die Partie ist zu Ende: festhalten, in die Statistik schreiben, zeigen. */
  function beende(ende) {
    lauf++;
    SchachEngine.abbrechen();
    botDenkt = false;
    hinweis = null;
    meldung = "";
    const p = P();
    p.ende = ende;
    const klassen = Object.keys(p.bewertungen).map(function (i) { return p.bewertungen[i].klasse; });
    daten.statistik.push({
      datum: new Date().toISOString(),
      elo: p.elo,
      ergebnis: ende.ergebnis,
      grund: ende.grund,
      zuege: p.zuege.length,
      fehler: klassen.filter(function (k) { return K.fehlerKlassen.indexOf(k) >= 0; }).length,
      ungenau: klassen.filter(function (k) { return k === "ungenau"; }).length,
      zurueck: p.zurueck,
    });
    daten.statistik = daten.statistik.slice(-K.statistik.hoechstens);
    speichere();
    const satz = {
      sieg: "Gewonnen, stark gespielt! Dein Gegner hatte etwa " + p.elo + " Elo.",
      remis: "Remis gegen etwa " + p.elo + " Elo. Ordentlich gekämpft!",
      niederlage: "Kopf hoch! Das waren etwa " + p.elo + " Elo. Schau dir deine teuersten Fehler an, daraus lernst du am meisten.",
    }[ende.ergebnis];
    plaudere(satz, ende.ergebnis === "niederlage" ? "ruhig" : "froh");
    zeichneStatistik();
    zeichne();
  }

  /* ---------- Aktionen während der Partie ---------- */

  /** Gibt es einen eigenen Zug, den ich zurücknehmen kann? */
  function kannZurueck() {
    const p = P();
    for (let i = 0; i < p.zuege.length; i++) if (istMein(i)) return true;
    return false;
  }

  /** Nimmt meinen letzten Zug zurück (und die Antwort des Bots, falls schon gespielt). */
  function nimmZurueck() {
    const p = P();
    if (!E().zuruecknehmen || p.ende || !kannZurueck()) return;
    lauf++;
    SchachEngine.abbrechen();
    let n = p.zuege.length;
    while (n > 0 && !istMein(n - 1)) n--;    // Antwort des Bots weg …
    n--;                                     // … und mein Zug
    p.zuege.length = n;
    Object.keys(p.bewertungen).forEach(function (i) { if (Number(i) >= n) delete p.bewertungen[i]; });
    Object.keys(analysen).forEach(function (i) { if (Number(i) > n) delete analysen[i]; });
    p.zurueck++;
    schach = stellungBis(n);
    botDenkt = false;
    hinweis = null;
    blick = null;
    meldung = "";
    speichere();
    plaudere("Zurückgenommen. Zweiter Versuch!", "ruhig");
    weiter();
  }

  /** Remis anbieten: Der Bot entscheidet nach der Stellung. */
  function bieteRemis() {
    const p = P();
    if (p.ende || botDenkt || schach.turn() !== p.farbe) return;
    const meinLauf = lauf, n = p.zuege.length;
    meldung = "Der Bot überlegt sich dein Angebot …";
    zeichne();
    analysiere(n).then(function (a) {
      if (meinLauf !== lauf || P().zuege.length !== n) return;
      const botCp = a.linien.length ? -M.cpVon(a.linien[0]) : 0;       // aus Sicht des Bots
      const annahme = botCp <= K.remis.schlechterAls ||
        (botCp <= K.remis.ausgeglichenBis && schach.moveNumber() >= K.remis.abZug);
      if (annahme) {
        beende({ ergebnis: "remis", grund: "vereinbart" });
      } else {
        meldung = "Der Bot lehnt das Remis ab.";
        plaudere("Kein Remis – der Bot will weiterspielen.", "ruhig");
        zeichne();
      }
    }).catch(function () {
      meldung = "";
      zeichne();
    });
  }

  /** Aufgeben: erst nachfragen (zweiter Klick innerhalb weniger Sekunden bestätigt). */
  function gibAuf() {
    if (P().ende) return;
    if (!aufgebenTimer) {
      el.aufgeben.textContent = "Wirklich aufgeben?";
      el.aufgeben.classList.add("knopf--gefahr");
      aufgebenTimer = setTimeout(setzeAufgebenZurueck, 4000);
      return;
    }
    setzeAufgebenZurueck();
    beende({ ergebnis: "niederlage", grund: "aufgabe" });
  }

  function setzeAufgebenZurueck() {
    clearTimeout(aufgebenTimer);
    aufgebenTimer = null;
    el.aufgeben.textContent = "Aufgeben";
    el.aufgeben.classList.remove("knopf--gefahr");
  }

  /* ---------- Blättern ---------- */

  /** Zeigt die Stellung nach n Halbzügen (die letzte = wieder live). */
  function setzeBlick(n) {
    const gesamt = P().zuege.length;
    n = Math.max(0, Math.min(gesamt, n));
    blick = n === gesamt ? null : n;
    zeichne();
  }

  function blaettere(schritt) {
    const jetzt = blick === null ? P().zuege.length : blick;
    setzeBlick(schritt === -Infinity ? 0 : schritt === Infinity ? P().zuege.length : jetzt + schritt);
  }

  /* ==========================================================================
     CLAUDY: TIPPS UND ERKLÄRUNGEN
     ========================================================================== */

  /**
   * Hilfe in der gewählten Stufe zur aktuellen Stellung.
   * @param {boolean} vonSelbst – true: automatische Hilfe (dann keine Rückfragen)
   */
  function gibTipp(vonSelbst) {
    const p = P();
    if (E().hilfe === "aus") {
      if (!vonSelbst) el.claudy.sag("Ich bin gerade auf stumm. Wähl eine Hilfestufe, dann helfe ich dir gern.");
      return;
    }
    if (p.ende || blick !== null || botDenkt || !engineBereit || schach.turn() !== p.farbe) return;
    const meinLauf = lauf, n = p.zuege.length, fen = schach.fen();
    if (!vonSelbst) el.claudy.sag("Moment, ich schau mir das an …", "denkt");
    analysiere(n).then(function (a) {
      if (meinLauf !== lauf || P().zuege.length !== n || !a.linien.length) return;
      const beste = a.linien[0];
      const m = M.motiv(fen, beste.zug, beste);
      const pfeil = function (l, art) { return { von: l.zug.slice(0, 2), nach: l.zug.slice(2, 4), art: art }; };
      hinweis = { halbzug: n, pfeile: [], schubs: null };
      switch (E().hilfe) {
        case "schubs":
          hinweis.schubs = beste.zug.slice(0, 2);
          el.claudy.sag("Schau dir mal " + M.NAME[m.figur].deinen + " auf " + m.von + " an.", "ruhig");
          break;
        case "idee":
          el.claudy.sag(M.ideeText(m), "denkt");
          break;
        case "kandidaten": {
          const gut = a.linien.filter(function (l) { return M.cpVon(beste) - M.cpVon(l) <= K.kandidatenToleranz; }).slice(0, 3);
          hinweis.pfeile = gut.map(function (l, i) { return pfeil(l, i ? "neben" : "haupt"); });
          const namen = gut.map(function (l) { return M.sanVon(fen, l.zug); });
          el.claudy.sag(gut.length === 1
            ? "Hier gibt es nur einen wirklich guten Zug: " + namen[0] + "."
            : "Diese Züge sehen gut aus: " + namen.slice(0, -1).join(", ") + " und " + namen[namen.length - 1] + ".", "ruhig");
          break;
        }
        default:
          hinweis.pfeile = [pfeil(beste, "haupt")];
          el.claudy.sag(M.loesungText(m), "froh");
      }
      zeichne();
    }).catch(function () { /* abgebrochen */ });
  }

  /** Der letzte eigene Zug, der zur Stellung nach n Halbzügen geführt hat (oder davor); -1 = keiner. */
  function letzterEigener(n) {
    for (let i = Math.min(n, P().zuege.length) - 1; i >= 0; i--) {
      if (istMein(i) && P().bewertungen[i]) return i;
    }
    return -1;
  }

  /**
   * "Was wäre besser gewesen?" – zeigt die Stellung vor meinem Zug, den
   * besseren Zug als Pfeil und Claudys Erklärung.
   * @param {number|null} halbzug – welcher meiner Züge; null = der letzte vor der gezeigten Stellung
   */
  function erklaere(halbzug) {
    const p = P();
    const n = halbzug === null ? letzterEigener(blick === null ? p.zuege.length : blick) : halbzug;
    if (n < 0 || !p.bewertungen[n]) {
      el.claudy.sag("Zu diesem Zug habe ich noch keine Analyse.", "denkt");
      return;
    }
    const fen = stellungBis(n).fen();
    const r = M.besserText(fen, p.zuege[n], p.bewertungen[n]);
    blick = n;                               // die Stellung vor meinem Zug
    hinweis = { halbzug: n, schubs: null, pfeile: [] };
    if (r.pfeil) hinweis.pfeile.push({ von: r.pfeil.slice(0, 2), nach: r.pfeil.slice(2, 4), art: "haupt" });
    hinweis.pfeile.push({ von: p.zuege[n].slice(0, 2), nach: p.zuege[n].slice(2, 4), art: "neben" });
    el.claudy.sag(r.text, r.stimmung);
    zeichne();
  }

  /* ---------- PGN ---------- */

  /** Die Partie als PGN (englische Standardnotation, wie Schachprogramme sie lesen). */
  function pgn() {
    const p = P();
    const s = stellungBis(p.zuege.length);
    const bot = "Bot (ca. " + p.elo + " Elo)";
    const ergebnis = !p.ende ? "*" : p.ende.ergebnis === "remis" ? "1/2-1/2"
      : (p.ende.ergebnis === "sieg") === (p.farbe === "w") ? "1-0" : "0-1";
    s.setHeader("Event", "NTB Schach");
    s.setHeader("Site", "NTB");
    s.setHeader("Date", p.start.slice(0, 10).replace(/-/g, "."));
    s.setHeader("White", p.farbe === "w" ? "Ich" : bot);
    s.setHeader("Black", p.farbe === "b" ? "Ich" : bot);
    s.setHeader("Result", ergebnis);
    return s.pgn();
  }

  function kopierePgn() {
    const text = pgn();
    const fertig = function (ok) {
      el.pgn.textContent = ok ? "Kopiert!" : "Kopieren nicht möglich";
      setTimeout(function () { el.pgn.textContent = "PGN kopieren"; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { fertig(true); }, function () { fertig(false); });
      return;
    }
    // Ersatz für ältere Browser: über ein unsichtbares Textfeld
    const feld = document.createElement("textarea");
    feld.value = text;
    feld.className = "nur-screenreader";
    document.body.appendChild(feld);
    feld.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (fehler) { /* bleibt false */ }
    feld.remove();
    fertig(ok);
  }

  /* ==========================================================================
     ENGINE LADEN
     ========================================================================== */

  /** Zeigt, warum die Engine fehlt und wie man die Seite lokal startet. */
  function engineFehlt() {
    engineBereit = false;
    const h = el.engineHinweis;
    h.textContent = "";
    h.hidden = false;
    h.appendChild(neu("h3", "sch-karten-titel", "Die Schach-Engine konnte nicht geladen werden"));
    if (location.protocol === "file:") {
      h.appendChild(neu("p", "", "Du hast die Seite per Doppelklick geöffnet. Die Engine (Stockfish) läuft aber nur, " +
        "wenn die Seite über einen Webserver kommt. So startest du sie lokal:"));
      const schritte = neu("ol", "sch-schritte");
      ["Öffne ein Terminal im Ordner des Projekts.", "Gib ein: python3 -m http.server 8000",
        "Öffne im Browser: http://localhost:8000/#games/chess"].forEach(function (t) { schritte.appendChild(neu("li", "", t)); });
      h.appendChild(schritte);
    } else {
      h.appendChild(neu("p", "", "Lade die Seite neu. Bleibt der Fehler, fehlen vermutlich die Dateien in js/chess/vendor/stockfish/."));
      h.appendChild(knopf("", "Erneut versuchen", ladeEngine));
    }
    zeichne();
  }

  function ladeEngine() {
    engineBereit = null;
    el.engineHinweis.hidden = true;
    zeichne();
    SchachEngine.starte().then(function () {
      engineBereit = true;
      weiter();
    }, engineFehlt);
  }

  /* ---------- Start ---------- */

  /** Wird von games.js bei JEDEM Öffnen des Spiels aufgerufen. */
  function zeige() {
    if (gestartet) {
      zeichne();
      return;
    }
    gestartet = true;
    baue();
    zeichneStatistik();
    if (!daten.partie) {
      neuePartie();                          // zeichnet; der Bot wartet, bis die Engine da ist
    } else {
      // Gespeicherte Partie fortsetzen – ist sie nicht mehr spielbar, beginnt eine neue
      try {
        schach = stellungBis(P().zuege.length);
        if (!P().ende) plaudere("Willkommen zurück! Deine Partie geht weiter.", "froh");
      } catch (fehler) {
        neuePartie();
      }
    }
    ladeEngine();
  }

  return { zeige: zeige, neuePartie: neuePartie };
}
