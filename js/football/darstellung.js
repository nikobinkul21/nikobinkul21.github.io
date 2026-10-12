/* ==========================================================================
   football/darstellung.js – Oberfläche des Fußball-Duells
   Oben die Pixel-Szene (football/szene.js), darunter die Zonenleiste mit
   dem Ball, Spielstand und Spielzug-Zähler, unten drei große Knöpfe:
   Angriff (Passen, Dribbeln, Schießen) oder Verteidigung (Zweikampf,
   Pass blockieren, Tor blockieren) – im Elfmeterduell Links, Mitte, Rechts.
   Ablauf nach jeder Wahl: beide Aktionen werden aufgedeckt → die Szene
   spielt den Ausgang → bei Tor oder Ballgewinn ein kurzes Standbild der
   Figur → ein Satz erklärt, was passiert ist. Ein Klick (oder eine
   Taste) kürzt alles ab.
   Start: initFootball(container) aus js/games.js.
   ========================================================================== */

function initFootball(container) {
  const K = FootballKonfig;
  const F = FootballFiguren;
  const ARENA = FootballArenen[K.arena];

  // ------------------------------------------------------------------
  // Symbole der Knöpfe (eigene, schlichte Pixel-Symbole als SVG)
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
  };
  function symbol(id) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (SYMBOLE[id] || "") + "</svg>";
  }

  // ------------------------------------------------------------------
  // Grundgerüst
  // ------------------------------------------------------------------
  container.innerHTML =
    '<div class="fb">' +
      '<div class="fb-kopf">' +
        '<span class="fb-team fb-team--du"></span>' +
        '<span class="fb-stand" aria-live="polite"><span class="fb-tore">0 : 0</span><span class="fb-zug"></span></span>' +
        '<span class="fb-team fb-team--gegner"></span>' +
      "</div>" +
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
          '<div class="fb-standbild-text"><span class="fb-standbild-titel"></span><span class="fb-standbild-name"></span></div>' +
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
    "</div>";

  const $ = function (s) { return container.querySelector(s); };
  const el = {
    wurzel: $(".fb"),
    tore: $(".fb-tore"), zug: $(".fb-zug"),
    du: $(".fb-team--du"), gegner: $(".fb-team--gegner"),
    buehne: $(".fb-buehne"), canvas: $(".fb-szene"), ballinfo: $(".fb-ballinfo"),
    aufdecken: $(".fb-aufdecken"), standbild: $(".fb-standbild"), standbildFigur: $(".fb-standbild-figur"),
    standbildTitel: $(".fb-standbild-titel"), standbildName: $(".fb-standbild-name"),
    ende: $(".fb-ende"), endeTitel: $(".fb-ende-titel"), endeText: $(".fb-ende-text"), neu: $(".fb-neu"),
    zonen: $(".fb-zonen"), elfmeter: $(".fb-elfmeter"),
    satz: $(".fb-text-satz"), detail: $(".fb-text-detail"), hinweis: $(".fb-hinweis"),
    knoepfe: Array.prototype.slice.call(container.querySelectorAll(".fb-knopf")),
  };
  el.du.textContent = K.teams[0].name;
  el.gegner.textContent = K.teams[1].name;
  el.zonen.innerHTML = K.regeln.zonen.map(function (name, i) {
    return '<li class="fb-zone" data-zone="' + i + '"><span class="fb-zone-name">' + name + '</span><span class="fb-zone-ball" aria-hidden="true"></span></li>';
  }).join("");
  el.wurzel.style.setProperty("--fb-farbe-du", F[K.teams[0].spieler[0]].palette.trikot);
  el.wurzel.style.setProperty("--fb-farbe-gegner", F[K.teams[1].spieler[0]].palette.trikot);
  el.wurzel.style.setProperty("--fb-halle", ARENA.hintergrund.wand);

  const szene = FootballSzene.erstelle(el.canvas, { konfig: K, figuren: F, arena: ARENA });

  let regeln = null;
  let beschaeftigt = false;     // ein Spielzug wird gerade gezeigt
  let eilig = false;            // Klick: alles Restliche sofort
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
  // Anzeige
  // ------------------------------------------------------------------
  function lage() {
    const z = regeln.zustand;
    return { zone: z.zone, ballTeam: z.ballTeam, traeger: z.traeger };
  }

  function figurText(id) {
    return F[id].name + " (" + F[id].nummer + ")";
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
      reihe.querySelector(".fb-elfmeter-name").textContent = K.teams[t].name;
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

  /** Knöpfe und Hinweis passend zur Lage. */
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
    el.ballinfo.textContent = z.phase === "spiel" ? "Am Ball: " + figurText(regeln.ballfuehrer()) : "";
    el.ballinfo.dataset.team = z.ballTeam === 0 ? "du" : "gegner";
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

  /** Kurzes Standbild der Figur (Tor, Ballgewinn, gehaltener Elfmeter). */
  function standbild(figurId, pose, titel, art) {
    const f = F[figurId];
    const r = FootballSprites.raster(f, pose, pose === "jubel" ? 1 : 0);
    const c = el.standbildFigur;
    c.width = r[0].length;
    c.height = r.length;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    // Einmal über die Szene zeichnen lassen: dieselbe Funktion wie im Spiel
    FootballSprites.zeichneFigur(ctx, figurId, f, pose, pose === "jubel" ? 1 : 0, 8, r.length, 1);
    el.standbildTitel.textContent = titel;
    el.standbildName.textContent = f.name + " · " + f.nummer;
    el.standbild.dataset.art = art;
    el.standbild.style.setProperty("--fb-standbild-farbe", f.palette.trikot);
    el.standbild.hidden = false;
    return warte(dauer("standbild")).then(function () { el.standbild.hidden = true; });
  }

  function zeigeEnde() {
    const z = regeln.zustand;
    const sieg = z.ende.sieger === 0;
    el.endeTitel.textContent = sieg ? "Sieg!" : "Niederlage";
    let text = K.teams[0].name + " " + z.tore[0] + " : " + z.tore[1] + " " + K.teams[1].name;
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
  // Spielablauf
  // ------------------------------------------------------------------
  function neuesMatch() {
    // Übergang: Die Oberfläche spielt noch mit den festen Teams aus
    // konfig.teams und den bisherigen Figuren (ohne Kader). Auslosung,
    // Teamkarten und die Sprites des Kaders folgen nach der Freigabe der Namen.
    regeln = FootballRegeln.erstelle({ kader: {} });
    el.ende.hidden = true;
    el.standbild.hidden = true;
    el.aufdecken.hidden = true;
    szene.setzeLage(lage());
    zeigeText("Anpfiff! " + K.teams[K.regeln.anstossTeam].name + " hat Anstoß.",
      "Bis " + K.regeln.siegTore + " Tore oder " + K.regeln.maxZuege + " Spielzüge – bei Gleichstand Elfmeterschießen.");
    alles();
  }

  /** Eine Wahl (Index 0–2 der Knöpfe). */
  function waehle(index) {
    if (beschaeftigt) { beschleunige(); return; }
    if (!regeln || regeln.zustand.phase === "ende") return;
    const wahl = regeln.meineWahl();
    const a = wahl.aktionen[index];
    if (!a || !a.erlaubt) return;
    beschaeftigt = true;
    eilig = false;
    zeigeKnoepfe();
    const ablauf = wahl.art === "angriff" || wahl.art === "verteidigung" ? spieleZug(a.id) : spieleElfmeter(a.id);
    ablauf.catch(function (fehler) { console.error(fehler); }).then(function () {
      beschaeftigt = false;
      eilig = false;
      alles();
      if (regeln.zustand.phase === "ende") zeigeEnde();
    });
  }

  function spieleZug(id) {
    const e = regeln.spieleZug(id);
    const ich = e.angriffTeam === 0;
    const meine = ich ? e.angriff : e.verteidigung, seine = ich ? e.verteidigung : e.angriff;
    zeigeText("", "");
    el.zug.textContent = "Spielzug " + e.zug + "/" + K.regeln.maxZuege;
    return aufdecken(meine, seine, e.passt).then(function () {
      return szene.spieleZug(e, dauer("szene"));
    }).then(function () {
      zeigeText(e.text, e.detail);
      zeigeStand();
      zeigeZonen();
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
          "Je " + K.regeln.elfmeter.runden + " Schüsse, danach Schuss um Schuss. Schießen gegen Tor blockieren: links, Mitte oder rechts.");
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
  el.neu.addEventListener("click", neuesMatch);

  document.addEventListener("keydown", function (ev) {
    if (el.wurzel.offsetParent === null) return;                 // Spiel nicht sichtbar
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const ziel = ev.target;
    if (ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName))) return;
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
      });
    },
    // Für Tests: Regeln und Szene, Anzeige nach einer von außen gesetzten Lage auffrischen
    regeln: function () { return regeln; },
    szene: szene,
    aktualisiere: function () {
      if (regeln.zustand.phase === "elfmeter") szene.setzeElfmeter(regeln.elfmeterLage());
      else szene.setzeLage(lage());
      alles();
    },
  };
}
