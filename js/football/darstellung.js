/* ==========================================================================
   football/darstellung.js – Oberfläche des Fußball-Duells
   Vor jedem Match: Auslosung – dir werden zwei Spieler aus dem Kader
   zugelost, ein Slot nach dem anderen; danach zeigen die Slots als
   Spielerkarten Werte und Fähigkeit, darunter steht der Gegner.
   Im Spiel: oben die Pixel-Szene (football/szene.js), darunter die
   Zonenleiste mit dem Ball, Spielstand und Spielzug-Zähler, unten drei
   große Knöpfe: Angriff (Passen, Dribbeln, Schießen) oder Verteidigung
   (Zweikampf, Pass blockieren, Tor blockieren) – im Elfmeterduell Links,
   Mitte, Rechts. Die Teamnamen öffnen die Teamkarten (Hovern/Antippen).
   Ablauf nach jeder Wahl: beide Aktionen werden aufgedeckt → löst eine
   Fähigkeit aus, kurzes Standbild mit ihrem Namen → die Szene spielt den
   Ausgang → bei Tor oder Ballgewinn ein Standbild der Figur → ein Satz
   erklärt, was passiert ist. Ein Klick (oder eine Taste) kürzt alles ab.
   Start: initFootball(container) aus js/games.js.
   ========================================================================== */

function initFootball(container) {
  const K = FootballKonfig;
  const KADER = FootballKader;
  const ARENA = FootballArenen[K.arena];
  let F = {};                     // Figuren des laufenden Matches (mit Teamfarben)

  // ------------------------------------------------------------------
  // Symbole (eigene, schlichte Symbole als SVG): Aktionen, Ecken, Fähigkeiten
  // ------------------------------------------------------------------
  const SYMBOLE = {
    passen: '<path d="M3 15c3-7 10-9 15-6" /><path d="M15 5l4 4-5 2" /><circle cx="5" cy="17" r="2.2" class="voll" />',
    dribbeln: '<path d="M3 18l4-5 4 4 4-6 3 3" /><path d="M15 6h5v5" /><circle cx="4" cy="20" r="1.8" class="voll" />',
    schiessen: '<circle cx="15" cy="12" r="5" /><path d="M15 7l2 3-2 3-3-1v-3z" class="voll" /><path d="M2 9h6M3 12h6M2 15h6" />',
    zweikampf: '<path d="M3 17l7-3 4 3 7-2" /><path d="M10 14l2-7 4 1" /><circle cx="19" cy="18" r="2" class="voll" />',
    passBlockieren: '<path d="M7 20V9a2 2 0 0 1 4 0v-3a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v6c0 3-2 5-5 5h-2c-3 0-5-2-5-5" /><path d="M2 6l5 4" />',
    torBlockieren: '<path d="M2 20V6h20v14" /><path d="M2 10h20M8 6v14M14 6v14M20 6" class="duenn" /><rect x="9" y="9" width="6" height="7" rx="1" class="voll" />',
    links: '<path d="M14 5l-7 7 7 7" /><path d="M7 12h12" />',
    mitte: '<circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.8" class="voll" />',
    rechts: '<path d="M10 5l7 7-7 7" /><path d="M5 12h12" />',
    // Fähigkeiten
    auge: '<path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" /><circle cx="12" cy="12" r="3.2" class="voll" />',
    funke: '<path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" class="voll" />',
    kanone: '<circle cx="9" cy="14" r="6" /><path d="M14 10l7-5M15 13h7M14 17l7 4" /><circle cx="9" cy="14" r="2" class="voll" />',
    stern: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" class="voll" /><path d="M4 21l3-3" />',
    schild: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /><path d="M12 6v12M7 11h10" class="duenn" />',
    blitz: '<path d="M13 2L4 14h7l-2 8 9-12h-7z" class="voll" />',
    salto: '<path d="M5 15a7 7 0 1 1 3 5" /><path d="M8 20l-3-1 1-3" /><circle cx="12" cy="9" r="2.2" class="voll" />',
  };
  function symbol(id) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (SYMBOLE[id] || "") + "</svg>";
  }

  // Was eine ausgelöste Fähigkeit in diesem Zug bewirkt (Untertitel des Standbilds)
  function wirkungText(f) {
    if (f.torwartHalbiert) return "Torwart-Wert halbiert";
    switch (f.id) {
      case "uebersicht": return "Pass über " + f.zonen + " Zonen";
      case "ballzauber": return "Dribbling über " + f.zonen + " Zonen";
      case "kanone": return "Schuss aus der Hälfte ohne Abzug";
      case "traumannahme": return "Nächster Schuss: Torwart halbiert";
      case "mauer": return "Ball trotz falscher Wahl erobert";
      case "sologang": return "Lauf über das ganze Feld";
      case "akrobatik": return f.schussArt || "Akrobatischer Abschluss";
      default: return "";
    }
  }

  // Pose im Standbild einer Fähigkeit
  function faehigkeitPose(f) {
    if (f.schussArt) return { "Fallrückzieher": "fallrueckzieher", "Seitfallzieher": "seitfallzieher", "Scherenschlag": "scherenschlag" }[f.schussArt];
    return { uebersicht: "passen", ballzauber: "laufen", kanone: "schiessen", traumannahme: "annahme",
      mauer: "zweikampf", sologang: "laufen" }[f.id] || "stehen";
  }

  const WERTE = [
    ["passen", "Passen"], ["dribbeln", "Dribbeln"], ["schiessen", "Schießen"],
    ["zweikampf", "Zweikampf"], ["passBlockieren", "Pass blockieren"], ["torBlockieren", "Tor blockieren"],
  ];

  // ------------------------------------------------------------------
  // Grundgerüst
  // ------------------------------------------------------------------
  container.innerHTML =
    '<div class="fb">' +
      '<div class="fb-kopf">' +
        '<button type="button" class="fb-team fb-team--du" data-team="0" aria-expanded="false" title="Teamkarte"></button>' +
        '<span class="fb-stand" aria-live="polite"><span class="fb-tore">0 : 0</span><span class="fb-zug"></span></span>' +
        '<button type="button" class="fb-team fb-team--gegner" data-team="1" aria-expanded="false" title="Teamkarte"></button>' +
      "</div>" +
      '<div class="fb-teamkarte" hidden role="dialog" aria-label="Teamkarte"></div>' +
      '<div class="fb-buehne" title="Klicken: Szene abkürzen">' +
        '<canvas class="fb-szene" aria-label="Spielszene"></canvas>' +
        '<div class="fb-ballinfo"></div>' +
        '<div class="fb-aufdecken" hidden>' +
          '<div class="fb-wahl fb-wahl--du"><span class="fb-wahl-wer">Du</span><span class="fb-wahl-symbol"></span><span class="fb-wahl-name"></span></div>' +
          '<span class="fb-wahl-gegen">gegen</span>' +
          '<div class="fb-wahl fb-wahl--gegner"><span class="fb-wahl-wer">Gegner</span><span class="fb-wahl-symbol"></span><span class="fb-wahl-name"></span></div>' +
        "</div>" +
        '<div class="fb-standbild" hidden>' +
          '<canvas class="fb-standbild-figur"></canvas>' +
          '<div class="fb-standbild-text"><span class="fb-standbild-symbol"></span><span class="fb-standbild-titel"></span>' +
            '<span class="fb-standbild-name"></span><span class="fb-standbild-info"></span></div>' +
        "</div>" +
        '<div class="fb-ende" hidden>' +
          '<p class="fb-ende-titel"></p><p class="fb-ende-text"></p>' +
          '<button type="button" class="fb-neu">Neues Match</button>' +
        "</div>" +
      "</div>" +
      '<ol class="fb-zonen" aria-label="Zonen"></ol>' +
      '<div class="fb-elfmeter" hidden aria-label="Elfmeterschießen">' +
        '<div class="fb-elfmeter-reihe" data-team="0"><span class="fb-elfmeter-name"></span><span class="fb-elfmeter-punkte"></span></div>' +
        '<div class="fb-elfmeter-reihe" data-team="1"><span class="fb-elfmeter-name"></span><span class="fb-elfmeter-punkte"></span></div>' +
      "</div>" +
      '<p class="fb-text" aria-live="polite"><span class="fb-text-satz"></span><span class="fb-text-detail"></span></p>' +
      '<p class="fb-hinweis"></p>' +
      '<div class="fb-knoepfe" role="group" aria-label="Aktionen">' +
        [0, 1, 2].map(function (i) {
          return '<button type="button" class="fb-knopf" data-index="' + i + '">' +
            '<span class="fb-knopf-symbol"></span><span class="fb-knopf-name"></span><kbd class="fb-knopf-taste">' + (i + 1) + "</kbd>" +
          "</button>";
        }).join("") +
      "</div>" +
      // Auslosung: liegt über allem, bis "Anpfiff!" gedrückt ist
      '<div class="fb-los" hidden aria-live="polite">' +
        '<p class="fb-los-titel">Auslosung</p>' +
        '<div class="fb-los-slots">' +
          '<div class="fb-slot" data-slot="0"></div>' +
          '<div class="fb-slot" data-slot="1"></div>' +
        "</div>" +
        '<div class="fb-los-unten" hidden>' +
          '<p class="fb-los-gegner"></p>' +
          '<button type="button" class="fb-anpfiff">Anpfiff!</button>' +
        "</div>" +
      "</div>" +
    "</div>";

  const $ = function (s) { return container.querySelector(s); };
  const el = {
    wurzel: $(".fb"),
    tore: $(".fb-tore"), zug: $(".fb-zug"),
    teams: [$(".fb-team--du"), $(".fb-team--gegner")], teamkarte: $(".fb-teamkarte"),
    buehne: $(".fb-buehne"), canvas: $(".fb-szene"), ballinfo: $(".fb-ballinfo"),
    aufdecken: $(".fb-aufdecken"), standbild: $(".fb-standbild"), standbildFigur: $(".fb-standbild-figur"),
    standbildTitel: $(".fb-standbild-titel"), standbildName: $(".fb-standbild-name"),
    standbildSymbol: $(".fb-standbild-symbol"), standbildInfo: $(".fb-standbild-info"),
    ende: $(".fb-ende"), endeTitel: $(".fb-ende-titel"), endeText: $(".fb-ende-text"), neu: $(".fb-neu"),
    zonen: $(".fb-zonen"), elfmeter: $(".fb-elfmeter"),
    satz: $(".fb-text-satz"), detail: $(".fb-text-detail"), hinweis: $(".fb-hinweis"),
    knoepfe: Array.prototype.slice.call(container.querySelectorAll(".fb-knopf")),
    los: $(".fb-los"), slots: Array.prototype.slice.call(container.querySelectorAll(".fb-slot")),
    losUnten: $(".fb-los-unten"), losGegner: $(".fb-los-gegner"), anpfiff: $(".fb-anpfiff"),
  };
  el.zonen.innerHTML = K.regeln.zonen.map(function (name, i) {
    return '<li class="fb-zone" data-zone="' + i + '"><span class="fb-zone-name">' + name + '</span><span class="fb-zone-ball" aria-hidden="true"></span></li>';
  }).join("");
  el.wurzel.style.setProperty("--fb-farbe-du", K.kader.trikots[0].trikot);
  el.wurzel.style.setProperty("--fb-farbe-gegner", K.kader.trikots[1].trikot);
  el.wurzel.style.setProperty("--fb-halle", ARENA.hintergrund.wand);

  const szene = FootballSzene.erstelle(el.canvas, { konfig: K, arena: ARENA });

  let regeln = null;
  let beschaeftigt = false;     // ein Spielzug (oder die Auslosung) wird gerade gezeigt
  let eilig = false;            // Klick: alles Restliche sofort
  let auslosungOffen = false;   // die Auslosung wartet auf "Anpfiff!"
  let auslosungGestartet = false;
  let generation = 0;           // jedes neue Match zählt hoch – alte Abläufe brechen dann ab
  const wartende = new Set();   // offene Wartezeiten (für eilig)

  // ------------------------------------------------------------------
  // Zeit und Abkürzen
  // ------------------------------------------------------------------
  function ruhig() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function dauer(name) {
    if (eilig) return 0;
    if (ruhig()) return name === "szene" || name === "elfmeter" ? 0 : K.zeiten.ruhig;
    return K.zeiten[name];
  }

  /** Warten, das ein Klick sofort beendet. */
  function warte(ms) {
    if (eilig || ms <= 0) return Promise.resolve();
    return new Promise(function (fertig) {
      const ende = function () { clearTimeout(id); wartende.delete(ende); fertig(); };
      const id = setTimeout(ende, ms);
      wartende.add(ende);
    });
  }

  function beschleunige() {
    if (!beschaeftigt) return;
    eilig = true;
    szene.abkuerzen();
    Array.from(wartende).forEach(function (f) { f(); });
  }

  // ------------------------------------------------------------------
  // Figuren und Karten
  // ------------------------------------------------------------------

  /** Figuren des Matches: Kaderspieler in den Trikots ihres Teams, dazu die Torhüter. */
  function figurenFuer(teams) {
    const figuren = {};
    teams.forEach(function (team, t) {
      team.spieler.forEach(function (id) { figuren[id] = FootballSprites.spielfigur(KADER[id], K.kader.trikots[t]); });
      figuren[team.torwart] = FootballFiguren[team.torwart];
    });
    return figuren;
  }

  /** Ein Sprite auf einen kleinen Canvas zeichnen (das CSS vergrößert ihn pixelgenau). */
  function zeichneSprite(c, figurId, figur, pose, bild) {
    const r = FootballSprites.raster(figur, pose, bild || 0);
    c.width = r[0].length;
    c.height = r.length;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    FootballSprites.zeichneFigur(ctx, figurId, figur, pose, bild || 0, 8, r.length, 1);
  }

  function figurText(id) {
    return F[id].name + " (" + F[id].nummer + ")";
  }

  /**
   * Spielerkarte: Sprite, Name, Nummer, Rolle, die sechs Werte (mit
   * Zuschlag der Fähigkeit) und die Fähigkeit mit Symbol und Beschreibung.
   */
  function karteHtml(id, team) {
    const s = KADER[id];
    const fa = FootballFaehigkeiten.holen(s.faehigkeit);
    const werte = WERTE.map(function (w) {
      const gesamt = regeln.wert(id, w[0]);
      const plus = gesamt - s.werte[w[0]];
      return '<li><span class="fb-wert-name">' + w[1] + '</span>' +
        '<span class="fb-balken"><i style="width:' + Math.min(100, gesamt * 10) + '%"></i>' +
        (plus ? '<i class="fb-balken-plus" style="left:' + s.werte[w[0]] * 10 + '%;width:' + plus * 10 + '%"></i>' : "") + "</span>" +
        '<b class="fb-wert-zahl">' + gesamt + "</b>" + (plus ? '<small class="fb-wert-plus">+' + plus + "</small>" : "") + "</li>";
    }).join("");
    const traum = regeln.zustand.traumannahme === id;
    return '<div class="fb-karte" data-team="' + team + '" data-id="' + id + '">' +
      '<div class="fb-karte-kopf"><canvas class="fb-karte-bild" data-figur="' + id + '"></canvas>' +
        '<div><b class="fb-karte-name">' + s.name + '</b><span class="fb-karte-rolle">' + s.nummer + " · " + s.rolle + "</span></div></div>" +
      '<ul class="fb-karte-werte">' + werte + "</ul>" +
      '<div class="fb-karte-faehigkeit">' + symbol(fa.symbol) + '<div><b>' + fa.name + (traum ? ' <span class="fb-aktiv">aktiv</span>' : "") +
        "</b><p>" + fa.beschreibung + "</p></div></div>" +
    "</div>";
  }

  function zeichneKarten(wurzel) {
    Array.prototype.forEach.call(wurzel.querySelectorAll("canvas[data-figur]"), function (c) {
      const id = c.dataset.figur;
      zeichneSprite(c, id, F[id], "stehen", 0);
    });
  }

  // ------------------------------------------------------------------
  // Teamkarten im Spiel (Hovern oder Antippen der Teamnamen)
  // ------------------------------------------------------------------
  let karteTeam = null;
  let karteZu = null;

  function oeffneTeamkarte(t) {
    clearTimeout(karteZu);
    if (!regeln) return;
    karteTeam = t;
    const team = regeln.teams[t];
    el.teamkarte.dataset.team = t;
    el.teamkarte.innerHTML = '<p class="fb-teamkarte-titel">' + team.name + (t === 0 ? " · dein Team" : " · Gegner") + "</p>" +
      '<div class="fb-teamkarte-spieler">' + team.spieler.map(function (id) { return karteHtml(id, t); }).join("") + "</div>";
    zeichneKarten(el.teamkarte);
    el.teamkarte.hidden = false;
    el.teams.forEach(function (b, i) { b.setAttribute("aria-expanded", String(i === t)); });
  }

  function schliesseTeamkarte() {
    karteTeam = null;
    el.teamkarte.hidden = true;
    el.teams.forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }

  el.teams.forEach(function (b, t) {
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (karteTeam === t) schliesseTeamkarte(); else oeffneTeamkarte(t);
    });
    // Hovern nur mit echter Maus (auf dem Handy öffnet das Antippen)
    b.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") oeffneTeamkarte(t); });
    b.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse") karteZu = setTimeout(schliesseTeamkarte, 250);
    });
  });
  el.teamkarte.addEventListener("pointerenter", function () { clearTimeout(karteZu); });
  el.teamkarte.addEventListener("pointerleave", function (ev) {
    if (ev.pointerType === "mouse") karteZu = setTimeout(schliesseTeamkarte, 250);
  });
  el.teamkarte.addEventListener("click", schliesseTeamkarte);
  document.addEventListener("click", function (ev) {
    if (karteTeam !== null && !ev.target.closest(".fb-teamkarte, .fb-team")) schliesseTeamkarte();
  });

  // ------------------------------------------------------------------
  // Anzeige
  // ------------------------------------------------------------------
  function lage() {
    const z = regeln.zustand;
    return { zone: z.zone, ballTeam: z.ballTeam, traeger: z.traeger };
  }

  function zeigeStand() {
    const z = regeln.zustand;
    el.tore.textContent = z.tore[0] + " : " + z.tore[1];
    el.zug.textContent = z.phase === "elfmeter" ? "Elfmeterschießen"
      : "Spielzug " + Math.min(z.zug + 1, K.regeln.maxZuege) + "/" + K.regeln.maxZuege;
    if (z.phase === "ende") el.zug.textContent = "Abpfiff";
  }

  function zeigeZonen() {
    const z = regeln.zustand;
    const elfmeter = z.phase === "elfmeter" || (z.phase === "ende" && z.elfmeter);
    el.zonen.hidden = Boolean(elfmeter);
    el.elfmeter.hidden = !elfmeter;
    if (elfmeter) {
      zeigeElfmeterStand();
      return;
    }
    el.zonen.dataset.team = z.ballTeam === 0 ? "du" : "gegner";
    Array.prototype.forEach.call(el.zonen.children, function (li, i) {
      const hier = i === z.zone;
      li.classList.toggle("ist-ball", hier);
      li.querySelector(".fb-zone-ball").textContent = hier ? (z.ballTeam === 0 ? "▶" : "◀") : "";
      if (hier) li.setAttribute("aria-current", "true"); else li.removeAttribute("aria-current");
    });
    el.zonen.setAttribute("aria-label", "Ball in Zone " + (z.zone + 1) + " von 5: " + K.regeln.zonen[z.zone] +
      (z.ballTeam === 0 ? ", du greifst an" : ", der Gegner greift an"));
  }

  function zeigeElfmeterStand() {
    const el2 = regeln.zustand.elfmeter;
    Array.prototype.forEach.call(el.elfmeter.querySelectorAll(".fb-elfmeter-reihe"), function (reihe) {
      const t = Number(reihe.dataset.team);
      reihe.querySelector(".fb-elfmeter-name").textContent = regeln.teams[t].name;
      const schuesse = el2.schuesse[t];
      const anzahl = Math.max(K.regeln.elfmeter.runden, schuesse.length);
      let html = "";
      for (let i = 0; i < anzahl; i++) {
        const s = schuesse[i];
        html += '<span class="fb-punkt' + (s === true ? " ist-tor" : s === false ? " ist-gehalten" : "") + '" title="' +
          (s === true ? "Tor" : s === false ? "Gehalten" : "Offen") + '"></span>';
      }
      reihe.querySelector(".fb-elfmeter-punkte").innerHTML = html;
    });
  }

  /** Knöpfe, Hinweis und "Am Ball" passend zur Lage. */
  function zeigeKnoepfe() {
    const wahl = regeln.meineWahl();
    el.wurzel.dataset.art = wahl.art || "ende";
    const z = regeln.zustand;
    el.knoepfe.forEach(function (k, i) {
      const a = wahl.aktionen[i];
      k.hidden = !a;
      if (!a) return;
      k.dataset.aktion = a.id;
      k.querySelector(".fb-knopf-symbol").innerHTML = symbol(a.id);
      k.querySelector(".fb-knopf-name").textContent = a.name;
      k.disabled = !a.erlaubt || beschaeftigt;
      k.classList.toggle("ist-gesperrt", !a.erlaubt);
      k.title = a.erlaubt ? a.name + " (Taste " + a.taste + ")" : a.grund;
      k.setAttribute("aria-label", a.name + (a.erlaubt ? "" : " – " + a.grund));
    });
    if (wahl.art === "angriff") {
      el.hinweis.textContent = "Angriff: " + figurText(regeln.ballfuehrer()) + " hat den Ball. Was machst du?";
    } else if (wahl.art === "verteidigung") {
      el.hinweis.textContent = "Verteidigung: " + figurText(regeln.verteidigerFuer()) + " stellt sich " +
        F[regeln.ballfuehrer()].name + " entgegen. Was plant der Gegner?";
    } else if (wahl.art === "elfmeterSchuss") {
      const l = regeln.elfmeterLage();
      el.hinweis.textContent = "Elfmeter: " + figurText(l.schuetze) + " schießt. Wohin?";
    } else if (wahl.art === "elfmeterHalten") {
      const l = regeln.elfmeterLage();
      el.hinweis.textContent = "Elfmeter für den Gegner: " + F[l.schuetze].name + " läuft an. In welche Ecke hechtest du?";
    } else {
      el.hinweis.textContent = "";
    }
    const traum = z.traumannahme && z.traumannahme === regeln.ballfuehrer();
    el.ballinfo.textContent = z.phase === "spiel" ? "Am Ball: " + figurText(regeln.ballfuehrer()) + (traum ? " ✦ Traumannahme" : "") : "";
    el.ballinfo.dataset.team = z.ballTeam === 0 ? "du" : "gegner";
    el.ballinfo.classList.toggle("ist-traum", Boolean(traum));
    szene.setzeTraum(z.phase === "spiel" ? z.traumannahme : null);
  }

  function zeigeText(satz, detail) {
    el.satz.textContent = satz || "";
    el.detail.textContent = detail || "";
  }

  function alles() {
    zeigeStand();
    zeigeZonen();
    zeigeKnoepfe();
  }

  // ------------------------------------------------------------------
  // Aufdecken, Standbild, Ende
  // ------------------------------------------------------------------
  function aktionInfo(id) {
    const alle = K.aktionen.angriff.concat(K.aktionen.verteidigung);
    const a = alle.find(function (x) { return x.id === id; });
    if (a) return a.name;
    return { links: "Links", mitte: "Mitte", rechts: "Rechts" }[id] || id;
  }

  /** Beide Wahlen nebeneinander; passt die Verteidigung, leuchtet die Mitte. */
  function aufdecken(meine, seine, passt) {
    const du = el.aufdecken.querySelector(".fb-wahl--du"), geg = el.aufdecken.querySelector(".fb-wahl--gegner");
    du.querySelector(".fb-wahl-symbol").innerHTML = symbol(meine);
    du.querySelector(".fb-wahl-name").textContent = aktionInfo(meine);
    geg.querySelector(".fb-wahl-symbol").innerHTML = symbol(seine);
    geg.querySelector(".fb-wahl-name").textContent = aktionInfo(seine);
    el.aufdecken.classList.toggle("passt", Boolean(passt));
    el.aufdecken.querySelector(".fb-wahl-gegen").textContent = passt ? "gegen – getroffen!" : "gegen";
    el.aufdecken.hidden = false;
    return warte(dauer("aufdecken")).then(function () { el.aufdecken.hidden = true; });
  }

  /**
   * Kurzes Standbild einer Figur.
   * @param {object} [extra] – { symbol, info, zeit } (Fähigkeit: Symbol und Wirkung)
   */
  function standbild(figurId, pose, titel, art, extra) {
    extra = extra || {};
    const f = F[figurId];
    zeichneSprite(el.standbildFigur, figurId, f, pose, pose === "jubel" ? 1 : 0);
    el.standbildTitel.textContent = titel;
    el.standbildName.textContent = f.name + " · " + f.nummer;
    el.standbildSymbol.innerHTML = extra.symbol ? symbol(extra.symbol) : "";
    el.standbildInfo.textContent = extra.info || "";
    el.standbild.dataset.art = art;
    el.standbild.style.setProperty("--fb-standbild-farbe", f.palette.trikot);
    el.standbild.hidden = false;
    return warte(dauer(extra.zeit || "standbild")).then(function () { el.standbild.hidden = true; });
  }

  /** Alle in diesem Zug ausgelösten Fähigkeiten nacheinander als Standbild. */
  function faehigkeitStandbilder(liste) {
    let kette = Promise.resolve();
    liste.forEach(function (f) {
      kette = kette.then(function () {
        return standbild(f.figur, faehigkeitPose(f), f.name + "!", "faehigkeit", { symbol: f.symbol, info: wirkungText(f), zeit: "faehigkeit" });
      });
    });
    return kette;
  }

  function zeigeEnde() {
    const z = regeln.zustand;
    const sieg = z.ende.sieger === 0;
    el.endeTitel.textContent = sieg ? "Sieg!" : "Niederlage";
    let text = regeln.teams[0].name + " " + z.tore[0] + " : " + z.tore[1] + " " + regeln.teams[1].name;
    if (z.ende.grund === "elfmeter") {
      const t0 = z.elfmeter.schuesse[0].filter(Boolean).length, t1 = z.elfmeter.schuesse[1].filter(Boolean).length;
      text += " · Elfmeter " + t0 + " : " + t1;
    } else if (z.ende.grund === "tore") {
      text += " · " + K.regeln.siegTore + " Tore erreicht";
    } else {
      text += " · nach " + K.regeln.maxZuege + " Spielzügen";
    }
    el.endeText.textContent = text;
    el.ende.dataset.sieg = sieg ? "ja" : "nein";
    el.ende.hidden = false;
    el.neu.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------
  // Auslosung
  // ------------------------------------------------------------------

  /** Ein Spieler im Slot: Sprite und Name (während der Slot dreht). */
  function slotZeigen(slot, id, t) {
    const s = KADER[id];
    const figur = FootballSprites.spielfigur(s, K.kader.trikots[t]);
    slot.innerHTML = '<canvas class="fb-slot-bild"></canvas><span class="fb-slot-name">' + s.name + '</span><span class="fb-slot-rolle">' + s.rolle + "</span>";
    zeichneSprite(slot.querySelector("canvas"), id, figur, "stehen", 0);
  }

  /** Ein Slot dreht durch den Kader und hält beim gelosten Spieler. */
  function dreheSlot(slot, ziel, gen) {
    const ids = Object.keys(KADER);
    const gesamt = dauer("slot");
    slot.classList.add("dreht");
    slot.classList.remove("steht");
    let i = Math.floor(Math.random() * ids.length);
    let vergangen = 0, schritt = 55;
    return new Promise(function (fertig) {
      const weiter = function () {
        if (gen !== generation) return;                   // ein neues Match hat begonnen
        if (eilig || vergangen >= gesamt) {
          slot.classList.remove("dreht");
          slot.classList.add("steht");
          slot.innerHTML = karteHtml(ziel, 0);
          zeichneKarten(slot);
          fertig();
          return;
        }
        i = (i + 1) % ids.length;
        if (ids[i] === ziel && vergangen < gesamt * 0.6) i = (i + 1) % ids.length;
        slotZeigen(slot, ids[i], 0);
        vergangen += schritt;
        schritt = Math.min(220, schritt * 1.12);          // wird langsamer
        warte(schritt).then(weiter);
      };
      weiter();
    });
  }

  /** Die Auslosung zeigen: Slot für Slot, dann die Karten und der Gegner. */
  function starteAuslosung() {
    if (auslosungGestartet) return;
    auslosungGestartet = true;
    beschaeftigt = true;
    eilig = false;
    const gen = generation;
    const gezogen = regeln.auslosung.gezogen[0];
    el.slots.forEach(function (s) { s.innerHTML = '<span class="fb-slot-frage">?</span>'; s.classList.remove("steht", "dreht"); });
    el.losUnten.hidden = true;
    dreheSlot(el.slots[0], gezogen[0], gen).then(function () {
      return warte(dauer("slotPause"));
    }).then(function () {
      return gen === generation ? dreheSlot(el.slots[1], gezogen[1], gen) : null;
    }).then(function () {
      if (gen !== generation) return;
      const g = regeln.teams[1];
      el.losGegner.innerHTML = "Gegner " + g.name + ": " + g.spieler.map(function (id) {
        return "<b>" + KADER[id].name + "</b> (" + KADER[id].rolle + ", " + FootballFaehigkeiten.holen(KADER[id].faehigkeit).name + ")";
      }).join(" und ");
      el.losUnten.hidden = false;
      beschaeftigt = false;
      eilig = false;
      el.anpfiff.focus({ preventScroll: true });
    });
  }

  function anpfiff() {
    if (!auslosungOffen || beschaeftigt) return;
    auslosungOffen = false;
    el.los.hidden = true;
    alles();
  }

  // ------------------------------------------------------------------
  // Spielablauf
  // ------------------------------------------------------------------
  /** Neues Match: Teams auslosen (oder fest vorgegeben – nur für Tests). */
  function neuesMatch(teams) {
    // Laufende Abläufe (z. B. eine Auslosung) beenden
    generation++;
    if (beschaeftigt) beschleunige();
    beschaeftigt = false;
    eilig = false;
    regeln = FootballRegeln.erstelle(Array.isArray(teams) ? { teams: teams } : undefined);
    F = figurenFuer(regeln.teams);
    szene.setzeMatch(regeln.teams, F);
    el.teams[0].textContent = regeln.teams[0].name;
    el.teams[1].textContent = regeln.teams[1].name;
    el.ende.hidden = true;
    el.standbild.hidden = true;
    el.aufdecken.hidden = true;
    schliesseTeamkarte();
    szene.setzeLage(lage());
    zeigeText("Anpfiff! " + regeln.teams[K.regeln.anstossTeam].name + " hat Anstoß.",
      "Bis " + K.regeln.siegTore + " Tore oder " + K.regeln.maxZuege + " Spielzüge – bei Gleichstand Elfmeterschießen.");
    alles();
    // Auslosung: sobald das Spiel sichtbar ist
    auslosungOffen = Boolean(regeln.auslosung);
    auslosungGestartet = false;
    el.los.hidden = !auslosungOffen;
    if (auslosungOffen && el.wurzel.offsetParent !== null) starteAuslosung();
  }

  /** Eine Wahl (Index 0–2 der Knöpfe). */
  function waehle(index) {
    if (beschaeftigt) { beschleunige(); return; }
    if (auslosungOffen || !regeln || regeln.zustand.phase === "ende") return;
    const wahl = regeln.meineWahl();
    const a = wahl.aktionen[index];
    if (!a || !a.erlaubt) return;
    beschaeftigt = true;
    eilig = false;
    schliesseTeamkarte();
    zeigeKnoepfe();
    const ablauf = wahl.art === "angriff" || wahl.art === "verteidigung" ? spieleZug(a.id) : spieleElfmeter(a.id);
    ablauf.catch(function (fehler) { console.error(fehler); }).then(function () {
      beschaeftigt = false;
      eilig = false;
      alles();
      if (regeln.zustand.phase === "ende") zeigeEnde();
    });
  }

  /** "Übersicht · Pass über 2 Zonen" usw. – die Fähigkeiten des Zugs in einer Zeile. */
  function faehigkeitDetail(e) {
    return (e.faehigkeiten || []).map(function (f) { return f.name + ": " + wirkungText(f); }).join(" · ");
  }

  function spieleZug(id) {
    const e = regeln.spieleZug(id);
    const ich = e.angriffTeam === 0;
    const meine = ich ? e.angriff : e.verteidigung, seine = ich ? e.verteidigung : e.angriff;
    zeigeText("", "");
    el.zug.textContent = "Spielzug " + e.zug + "/" + K.regeln.maxZuege;
    return aufdecken(meine, seine, e.passt).then(function () {
      // Fähigkeiten: erst das Standbild mit ihrem Namen, dann die Animation
      return faehigkeitStandbilder(e.faehigkeiten || []);
    }).then(function () {
      szene.setzeTraum(null);
      return szene.spieleZug(e, dauer("szene"));
    }).then(function () {
      zeigeText(e.text, [faehigkeitDetail(e), e.detail].filter(Boolean).join(" · "));
      zeigeStand();
      zeigeZonen();
      szene.setzeTraum(regeln.zustand.traumannahme);
      if (e.tor) {
        const ichTor = e.angriffTeam === 0;
        return standbild(e.angreifer, "jubel", ichTor ? "TOR!" : "Gegentor", ichTor ? "tor" : "gegentor");
      }
      if (e.ballgewinn) {
        const meinGewinn = e.angriffTeam === 1;
        const titel = e.ausgang === "geblockt" ? "Geblockt!" : meinGewinn ? "Ballgewinn!" : "Ball verloren";
        return standbild(e.verteidiger, "zweikampf", titel, meinGewinn ? "konter" : "verlust");
      }
      return null;
    }).then(function () {
      if (e.tor && regeln.zustand.phase === "spiel") {
        return szene.uebergang(lage(), eilig ? 0 : 600);
      }
      if (regeln.zustand.phase === "elfmeter") {
        zeigeText("Abpfiff nach " + K.regeln.maxZuege + " Spielzügen – unentschieden! Elfmeterschießen.",
          "Je " + K.regeln.elfmeter.runden + " Schüsse, danach Schuss um Schuss. Hier zählen nur die Werte, keine Fähigkeiten.");
        szene.setzeElfmeter(regeln.elfmeterLage());
      }
      return null;
    });
  }

  function spieleElfmeter(richtung) {
    const lageVorher = regeln.elfmeterLage();
    const e = regeln.spieleElfmeter(richtung);
    const ich = e.schuetzeTeam === 0;
    zeigeText("", "");
    return aufdecken(richtung, ich ? e.torwartRichtung : e.schussRichtung, e.schussRichtung === e.torwartRichtung).then(function () {
      return szene.spieleElfmeter(e, lageVorher, dauer("elfmeter"));
    }).then(function () {
      zeigeText(e.text, e.detail);
      zeigeElfmeterStand();
      if (e.tor && ich) return standbild(e.schuetze, "jubel", "TOR!", "tor");
      if (!e.tor && !ich) return standbild(e.torwart, "jubel", "Gehalten!", "konter");
      return null;
    }).then(function () {
      if (regeln.zustand.phase === "elfmeter") szene.setzeElfmeter(regeln.elfmeterLage());
    });
  }

  // ------------------------------------------------------------------
  // Eingaben: Klick, Antippen, Tasten 1–3
  // ------------------------------------------------------------------
  el.knoepfe.forEach(function (k, i) {
    k.addEventListener("click", function () { waehle(i); });
  });
  el.buehne.addEventListener("click", function (ev) {
    if (ev.target.closest(".fb-neu")) return;
    beschleunige();
  });
  el.neu.addEventListener("click", function () { neuesMatch(); });
  el.los.addEventListener("click", function (ev) {
    if (ev.target.closest(".fb-anpfiff")) return;
    beschleunige();                                   // Slots sofort anhalten
  });
  el.anpfiff.addEventListener("click", anpfiff);

  document.addEventListener("keydown", function (ev) {
    if (el.wurzel.offsetParent === null) return;                 // Spiel nicht sichtbar
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const ziel = ev.target;
    if (ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName))) return;
    if (ev.key === "Escape" && karteTeam !== null) { schliesseTeamkarte(); return; }
    if (auslosungOffen) {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        if (beschaeftigt) beschleunige(); else anpfiff();
      }
      return;
    }
    if (ev.key === "1" || ev.key === "2" || ev.key === "3") {
      ev.preventDefault();
      waehle(Number(ev.key) - 1);
    } else if (beschaeftigt && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) {
      ev.preventDefault();
      beschleunige();
    }
  });

  // Höhe: das Spiel füllt den Platz unter der Kopfzeile, ohne zu scrollen
  function passeHoeheAn() {
    if (el.wurzel.offsetParent === null) return;
    const oben = el.wurzel.getBoundingClientRect().top + window.scrollY;
    const unten = parseFloat(getComputedStyle(document.querySelector(".hauptbereich") || document.body).paddingBottom) || 0;
    el.wurzel.style.setProperty("--fb-hoehe", Math.max(420, window.innerHeight - oben - unten) + "px");
    // danach die Szene an die Bühne anpassen (ganzzahlige Pixel)
    szene.passeGroesseAn(el.buehne.clientWidth, el.buehne.clientHeight);
  }
  window.addEventListener("resize", passeHoeheAn);

  neuesMatch();

  return {
    // bei jedem Öffnen von #games/football
    zeige: function () {
      requestAnimationFrame(function () {
        passeHoeheAn();
        szene.starte();
        if (auslosungOffen && !auslosungGestartet) starteAuslosung();
      });
    },
    // Für Tests: Regeln und Szene, Anzeige nach einer von außen gesetzten Lage auffrischen
    regeln: function () { return regeln; },
    szene: szene,
    neuesMatch: neuesMatch,
    aktualisiere: function () {
      if (regeln.zustand.phase === "elfmeter") szene.setzeElfmeter(regeln.elfmeterLage());
      else szene.setzeLage(lage());
      alles();
    },
  };
}
