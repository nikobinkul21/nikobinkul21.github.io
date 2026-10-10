/* ==========================================================================
   sudoku-battle-ui.js – Kampffenster, Slot-Walze und Animationen
   für das Sudoku-Abenteuer. Die REGELN stehen in js/sudoku-rpg.js –
   diese Datei zeigt nur an, was die Regeln melden.
   Aussehen: css/sudoku-rpg.css

   Wichtig: Animationen laufen nacheinander über eine Warteschlange.
   Setzt man schnell mehrere Zahlen, werden die Würfe der Reihe nach
   abgespielt – der Spielstand selbst ist aber längst aktuell.
   Nur die Verbesserungsauswahl hält die Schlange an, bis gewählt ist.
   ========================================================================== */

const SudokuKampf = (function () {

  // Dauer der einzelnen Animationen (Millisekunden)
  const DAUER = {
    wuerfeln: 380,
    schlag: 260,
    treffer: 420,
    angriff: 380,
    sieg: 900,
    erscheinen: 450,
    kritisch: 560,     // Wackeln bei kritischem Treffer
    stolpern: 520,
    banner: 1100,      // Hinweis, wenn eine Boss-Eigenheit auslöst
    walze: 1900,       // Slot-Walze bis zum Stillstand
    walzePause: 550,   // kurz stehen lassen, bevor das Sudoku startet
    walzeSpecial: 900, // bei Special Grade etwas länger
  };

  /** Bei "Bewegung reduzieren" fallen alle Animationen weg. */
  function ohneBewegung() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function warte(ms) {
    if (ohneBewegung() || ms <= 0) return Promise.resolve();
    return new Promise(function (fertig) { setTimeout(fertig, ms); });
  }

  /** Setzt eine CSS-Klasse für eine Animation – startet sie auch neu, falls sie gerade läuft. */
  function animiere(element, klasse, ms) {
    if (ohneBewegung()) return Promise.resolve();
    element.classList.remove(klasse);
    void element.offsetWidth;            // Browser "bemerkt" das Entfernen → Neustart möglich
    element.classList.add(klasse);
    return warte(ms).then(function () { element.classList.remove(klasse); });
  }

  /* ------------------------------------------------------------------------
     SYMBOLE als kleine Pixel-SVGs (harte Kanten). Werden im Kampffenster
     UND auf den Power-up-Feldern im Gitter benutzt (sudoku-ui.js).
     Neuer Power-up-Typ oder neue Verbesserung mit neuem Symbol? Hier ein
     weiteres Symbol ergänzen und in SUDOKU_RPG_KONFIG den Namen eintragen.
     ------------------------------------------------------------------------ */
  const SYMBOLE = {
    herz: '<path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/>',
    muenze: '<path d="M2 0h3v1h1v1h1v3H6v1H5v1H2V6H1V5H0V2h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M3 2h1v3H3z"/>',
    tropfen: '<path d="M3 0h1v1h1v2h1v3H5v1H2V6H1V3h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M2 4h1v1H2z"/>',
    stern: '<path d="M3 0h1v2h3v1H6v1h1v3H6V6H5V5H2v1H1v1H0V4h1V3H0V2h3z"/>',
    blitz: '<path d="M3 0h3v2H5v1h2v1H6v1H5v1H4v1H3V5h1V4H1V3h1V2h1z"/>',
    wuerfel: '<path d="M1 0h5v1h1v5H6v1H1V6H0V1h1z"/><path fill="#fff" d="M1 1h1v1H1zM5 1h1v1H5zM3 3h1v1H3zM1 5h1v1H1zM5 5h1v1H5z"/>',
    klinge: '<path d="M5 0h2v2H6v1H5v1H4v1H3v1H2V5H1V4h1V3h1V2h1V1h1z"/><path d="M0 6h1v1H0zM1 5h1v1H1zM0 4h1v1H0zM2 6h1v1H2z"/>',
    karte: '<path d="M0 1h7v5H0z"/><path fill="rgba(0,0,0,.55)" d="M3 2h1v1H3zM5 2h1v1H5zM4 3h1v1H4zM3 4h1v1H3zM5 4h1v1H5zM1 4h1v1H1z"/>',
    pilz: '<path d="M2 0h3v1h1v1h1v2H0V2h1V1h1z"/><path fill="#f4ead5" d="M2 4h3v3H2z"/><path fill="#fff" d="M2 1h1v1H2zM4 2h1v1H4z"/>',
    magnet: '<path d="M0 0h2v4h3V0h2v5H6v1H5v1H2V6H1V5H0z"/><path fill="#fff" d="M0 0h2v1H0zM5 0h2v1H5z"/>',
  };

  /** Ein Symbol als fertiges SVG (Farbe kommt über CSS: fill). */
  function symbolSvg(name) {
    return '<svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges">' +
      (SYMBOLE[name] || SYMBOLE.stern) + "</svg>";
  }

  // Das Herz für die Lebensanzeige
  const HERZ_SVG = symbolSvg("herz");


  /** Ein Element, das beim Darüberfahren oder Antippen einen Erklärtext zeigt. */
  function tippHtml() {
    return '<span class="kampf-tipp" aria-hidden="true"></span>';
  }

  /**
   * Baut ein Kampffenster.
   * @param {HTMLElement} container – wohin das Fenster gezeichnet wird
   * @param {object} optionen
   *   beimZuruecksetzen – Funktion, die bei Klick auf "Abenteuer zurücksetzen" läuft
   * @returns {object} Steuerung des Fensters (siehe unten "return")
   */
  function erstelle(container, optionen) {
    container.innerHTML =
      '<section class="kampf" aria-label="Kampf">' +
        '<div class="kampf-buehne">' +
          // Boss oben: Infokasten links (mit Eigenheit), Figur rechts
          '<div class="kampf-info kampf-info--boss">' +
            '<div class="kampf-name"><span class="kampf-boss-name"></span> <span class="kampf-boss-nr"></span></div>' +
            '<button type="button" class="kampf-eigenheit hat-tipp">' +
              '<span class="kampf-eigenheit-name"></span>' + tippHtml() +
            "</button>" +
            '<div class="kampf-hp"><span class="kampf-hp-label">HP</span>' +
              '<div class="kampf-hp-balken"><div class="kampf-hp-fuellung"></div></div>' +
            "</div>" +
            '<div class="kampf-hp-zahl"></div>' +
          "</div>" +
          '<div class="kampf-figur kampf-figur--boss"><canvas class="kampf-boss"></canvas></div>' +
          // Held unten: Figur links, Herzen, Münzen und Würfel rechts
          '<div class="kampf-figur kampf-figur--held"><canvas class="kampf-held"></canvas></div>' +
          '<div class="kampf-info kampf-info--held">' +
            '<div class="kampf-herzen" role="img"></div>' +
            '<div class="kampf-info-zeile">' +
              // Münzstand mit Münzsymbol
              '<div class="kampf-muenzen" role="img">' + symbolSvg("muenze") +
                '<span class="kampf-muenzen-zahl">0</span></div>' +
              '<div class="kampf-wuerfel" role="img"><span class="kampf-wuerfel-zahl">–</span></div>' +
            "</div>" +
          "</div>" +
          // Kurzes Aufblitzen bei kritischen Treffern
          '<div class="kampf-blitz" aria-hidden="true"></div>' +
          // Ebene für aufsteigende Zahlen und Hinweise
          '<div class="kampf-effekte" aria-hidden="true"></div>' +
        "</div>" +
        // Leiste unter der Bühne: Kombo und gesammelte Verbesserungen
        '<div class="kampf-leiste">' +
          '<div class="kampf-kombo" data-stufe="0" role="img">' +
            '<span class="kampf-kombo-titel">Kombo</span>' +
            '<span class="kampf-kombo-zahl">0</span>' +
            '<span class="kampf-kombo-bonus"></span>' +
          "</div>" +
          '<div class="kampf-verbesserungen" role="list" aria-label="Deine Verbesserungen"></div>' +
        "</div>" +
        // Textbox mit kurzen Meldungen (wird vorgelesen)
        '<p class="kampf-text" role="status"></p>' +
        '<div class="kampf-fuss">' +
          '<span class="kampf-rekord"></span>' +
          '<button type="button" class="kampf-reset">Abenteuer zurücksetzen</button>' +
        "</div>" +
      "</section>";

    const el = {
      bossName: container.querySelector(".kampf-boss-name"),
      bossNr: container.querySelector(".kampf-boss-nr"),
      eigenheit: container.querySelector(".kampf-eigenheit"),
      eigenheitName: container.querySelector(".kampf-eigenheit-name"),
      eigenheitTipp: container.querySelector(".kampf-eigenheit .kampf-tipp"),
      hpFuellung: container.querySelector(".kampf-hp-fuellung"),
      hpBalken: container.querySelector(".kampf-hp-balken"),
      hpZahl: container.querySelector(".kampf-hp-zahl"),
      bossFigur: container.querySelector(".kampf-figur--boss"),
      bossCanvas: container.querySelector(".kampf-boss"),
      heldFigur: container.querySelector(".kampf-figur--held"),
      heldCanvas: container.querySelector(".kampf-held"),
      herzen: container.querySelector(".kampf-herzen"),
      wuerfel: container.querySelector(".kampf-wuerfel"),
      wuerfelZahl: container.querySelector(".kampf-wuerfel-zahl"),
      blitz: container.querySelector(".kampf-blitz"),
      effekte: container.querySelector(".kampf-effekte"),
      buehne: container.querySelector(".kampf-buehne"),
      muenzen: container.querySelector(".kampf-muenzen"),
      muenzenZahl: container.querySelector(".kampf-muenzen-zahl"),
      kombo: container.querySelector(".kampf-kombo"),
      komboZahl: container.querySelector(".kampf-kombo-zahl"),
      komboBonus: container.querySelector(".kampf-kombo-bonus"),
      verbesserungen: container.querySelector(".kampf-verbesserungen"),
      text: container.querySelector(".kampf-text"),
      rekord: container.querySelector(".kampf-rekord"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Erklärtexte: Darüberfahren zeigt sie (CSS), Antippen/Klicken klappt sie
    // auf und wieder zu. Ein Klick woanders schließt sie.
    container.addEventListener("click", function (event) {
      const knopf = event.target.closest(".hat-tipp");
      container.querySelectorAll(".hat-tipp.offen").forEach(function (k) {
        if (k !== knopf) { k.classList.remove("offen"); k.setAttribute("aria-expanded", "false"); }
      });
      if (knopf && !knopf.disabled) {
        const offen = knopf.classList.toggle("offen");
        knopf.setAttribute("aria-expanded", String(offen));
      }
    });
    document.addEventListener("click", function (event) {
      if (!container.contains(event.target)) {
        container.querySelectorAll(".hat-tipp.offen").forEach(function (k) {
          k.classList.remove("offen");
          k.setAttribute("aria-expanded", "false");
        });
      }
    });

    // Was gerade ANGEZEIGT wird (kann wegen der Warteschlange kurz hinter
    // dem echten Spielstand liegen)
    const anzeige = { bossNummer: 0, muenzen: 0, kombo: 0, maxLeben: SudokuRPG.KONFIG.maxLeben };
    const K = SudokuRPG.KONFIG;

    /* ---------- Warteschlange ---------- */
    let kette = Promise.resolve();
    function einreihen(schritt) {
      kette = kette.then(schritt).catch(function (fehler) { console.error(fehler); });
      return kette;
    }


    /* ---------- Bausteine der Anzeige ---------- */

    function zeigeBoss(boss) {
      if (anzeige.bossNummer !== boss.nummer) {
        SudokuSprites.zeichne(el.bossCanvas, boss.sprite, boss.runde);
        anzeige.bossNummer = boss.nummer;
      }
      el.bossName.textContent = boss.name;
      el.bossNr.textContent = "Nr. " + boss.nummer;
      zeigeEigenheit(boss.eigenheit);
    }

    /** Eigenheit unter dem Bossnamen – mit Erklärung beim Darüberfahren/Antippen. */
    function zeigeEigenheit(eigenheit) {
      el.eigenheit.classList.remove("offen");
      el.eigenheit.disabled = !eigenheit;
      el.eigenheit.classList.toggle("ist-leer", !eigenheit);
      if (!eigenheit) {
        el.eigenheitName.textContent = "Keine Eigenheit";
        el.eigenheitTipp.textContent = "";
        el.eigenheit.removeAttribute("aria-label");
        el.eigenheit.removeAttribute("aria-expanded");
        return;
      }
      el.eigenheit.style.setProperty("--eigenheit-farbe", eigenheit.farbe);
      el.eigenheitName.textContent = "⚠ " + eigenheit.name;
      el.eigenheitTipp.textContent = eigenheit.name + ": " + eigenheit.beschreibung;
      el.eigenheit.setAttribute("aria-label", "Eigenheit " + eigenheit.name + ": " + eigenheit.beschreibung);
      el.eigenheit.setAttribute("aria-expanded", "false");
    }

    function zeigeHp(hp, maxHp) {
      const anteil = Math.max(0, hp) / maxHp;
      el.hpFuellung.style.width = (anteil * 100) + "%";
      // Farbe wie in klassischen Spielen: grün → gelb → rot
      el.hpBalken.dataset.stufe = anteil > 0.5 ? "voll" : anteil > 0.2 ? "mittel" : "knapp";
      el.hpZahl.textContent = Math.max(0, hp) + "/" + maxHp;
      el.hpBalken.setAttribute("aria-label", "HP " + Math.max(0, hp) + " von " + maxHp);
    }

    /**
     * Leben als Herzen. Es gibt immer mindestens so viele Plätze wie
     * Startleben (verlorene sind leer), bei mehr Leben entsprechend mehr.
     */
    function zeigeHerzen(leben, maxLeben) {
      if (maxLeben) anzeige.maxLeben = maxLeben;
      const plaetze = Math.max(K.startLeben, leben);
      if (el.herzen.children.length !== plaetze) {
        el.herzen.innerHTML = "";
        for (let i = 0; i < plaetze; i++) {
          const herz = document.createElement("span");
          herz.className = "kampf-herz";
          herz.innerHTML = HERZ_SVG;
          el.herzen.appendChild(herz);
        }
      }
      Array.from(el.herzen.children).forEach(function (herz, i) {
        herz.classList.toggle("ist-leer", i >= leben);
      });
      el.herzen.setAttribute("aria-label", leben + " Leben (höchstens " + anzeige.maxLeben + ")");
    }

    /**
     * Münzstand. animiert = true: Der Zähler zählt in kleinen Schritten hoch (oder runter).
     */
    function zeigeMuenzen(ziel, animiert) {
      const start = anzeige.muenzen;
      anzeige.muenzen = ziel;
      el.muenzen.setAttribute("aria-label", ziel + " Münzen");
      if (!animiert || ohneBewegung() || ziel === start) {
        el.muenzenZahl.textContent = ziel;
        return Promise.resolve();
      }
      return new Promise(function (fertig) {
        const dauer = 420;
        const t0 = performance.now();
        function schritt(jetzt) {
          const anteil = Math.min(1, (jetzt - t0) / dauer);
          el.muenzenZahl.textContent = Math.round(start + (ziel - start) * anteil);
          if (anteil < 1) {
            requestAnimationFrame(schritt);
          } else {
            fertig();
          }
        }
        requestAnimationFrame(schritt);
      });
    }

    /**
     * Kombo-Zähler. Je höher die Kombo, desto auffälliger (data-stufe 0–4, siehe CSS).
     * pulsieren = true: kurzes Aufpulsen beim Anstieg.
     */
    function zeigeKombo(kombo, bonus, pulsieren) {
      anzeige.kombo = kombo;
      const stufe = kombo === 0 ? 0 : kombo < 3 ? 1 : kombo < 6 ? 2 : kombo < 10 ? 3 : 4;
      el.kombo.dataset.stufe = stufe;
      el.komboZahl.textContent = kombo;
      el.komboBonus.textContent = bonus > 0 ? "+" + Math.round(bonus * 100) + " %" : "";
      el.kombo.setAttribute("aria-label", kombo === 0
        ? "Keine Kombo"
        : "Kombo " + kombo + ", " + Math.round(bonus * 100) + " Prozent mehr Schaden");
      if (pulsieren) animiere(el.kombo, "pulsiert", 300);
    }

    /** Kombo zerbricht: zwei Hälften fallen auseinander, der Zähler steht wieder auf 0. */
    function zerbrichKombo() {
      if (!ohneBewegung()) {
        const rahmen = el.kombo.getBoundingClientRect();
        const leiste = el.kombo.parentNode.getBoundingClientRect();
        ["links", "rechts"].forEach(function (seite) {
          const haelfte = el.kombo.cloneNode(true);
          haelfte.removeAttribute("role");
          haelfte.setAttribute("aria-hidden", "true");
          haelfte.className = "kampf-kombo kampf-kombo-scherbe kampf-kombo-scherbe--" + seite;
          haelfte.style.left = (rahmen.left - leiste.left) + "px";
          haelfte.style.top = (rahmen.top - leiste.top) + "px";
          haelfte.style.width = rahmen.width + "px";
          el.kombo.parentNode.appendChild(haelfte);
          setTimeout(function () { haelfte.remove(); }, 650);
        });
      }
      zeigeKombo(0, 0, false);
      return faerbe(el.kombo, "zerbrochen", 650);
    }

    /** Gesammelte Verbesserungen als kleine Symbole mit Stufe. */
    function zeigeVerbesserungen(liste, neueId) {
      el.verbesserungen.innerHTML = "";
      if (liste.length === 0) {
        const leer = document.createElement("span");
        leer.className = "kampf-verbesserungen-leer";
        leer.textContent = "Noch keine Verbesserungen";
        el.verbesserungen.appendChild(leer);
        return;
      }
      liste.forEach(function (v) {
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "kampf-chip hat-tipp";
        knopf.setAttribute("role", "listitem");
        knopf.style.setProperty("--chip-farbe", v.farbe);
        knopf.innerHTML = symbolSvg(v.symbol) + '<span class="kampf-chip-stufe"></span>' + tippHtml();
        knopf.querySelector(".kampf-chip-stufe").textContent = v.stufe;
        knopf.querySelector(".kampf-tipp").textContent =
          v.name + " – Stufe " + v.stufe + "/" + v.maxStufe + ": " + v.beschreibung + " (je Stufe)";
        knopf.setAttribute("aria-label", v.name + ", Stufe " + v.stufe + " von " + v.maxStufe + ": " + v.beschreibung + " (je Stufe)");
        knopf.setAttribute("aria-expanded", "false");
        el.verbesserungen.appendChild(knopf);
        if (v.id === neueId) animiere(knopf, "ist-neu", 600);
      });
    }

    function zeigeWurf(zahl) {
      el.wuerfelZahl.textContent = zahl === null ? "–" : zahl;
      el.wuerfel.setAttribute("aria-label", zahl === null ? "Noch nicht gewürfelt" : "Letzter Wurf: " + zahl);
    }

    function zeigeRekord(boss, rekord) {
      el.rekord.textContent = "Boss " + boss.nummer + " · Rekord: " +
        (rekord === 0 ? "noch keiner besiegt" : rekord + (rekord === 1 ? " Boss besiegt" : " Bosse besiegt"));
    }

    function meldung(text) {
      el.text.textContent = text;
    }

    /**
     * Aufsteigende Zahl oder kurzes Wort.
     * Bei "Bewegung reduzieren" erscheint sie nur kurz an Ort und Stelle.
     * @param {string} ziel – "boss", "doppelt", "kritisch", "gift", "daneben",
     *                        "geblockt", "heilung", "muenzen" oder "muenzen-weg"
     */
    function schwebeZahl(text, ziel) {
      const zahl = document.createElement("span");
      zahl.className = "kampf-schwebezahl kampf-schwebezahl--" + ziel;
      zahl.textContent = text;
      el.effekte.appendChild(zahl);
      setTimeout(function () { zahl.remove(); }, 900);
    }

    /** Großer Hinweis mitten auf der Bühne (z. B. wenn eine Eigenheit auslöst). */
    function banner(text, farbe, art) {
      const b = document.createElement("div");
      b.className = "kampf-banner" + (art ? " kampf-banner--" + art : "");
      if (farbe) b.style.setProperty("--banner-farbe", farbe);
      b.textContent = text;
      el.effekte.appendChild(b);
      setTimeout(function () { b.remove(); }, DAUER.banner);
    }

    /** Eine Eigenheit hat ausgelöst: Hinweis auf der Bühne, Eigenheit blinkt auf. */
    function eigenheitAusgeloest(e) {
      banner(e.name + "! " + e.text.charAt(0).toUpperCase() + e.text.slice(1), e.farbe, "eigenheit");
      return faerbe(el.eigenheit, "ausgeloest", 900);
    }


    /* ---------- Öffentliche Schritte (laufen über die Warteschlange) ---------- */

    /**
     * Zeigt einen Stand SOFORT (ohne Animation) – z. B. nach dem Laden.
     * @param {object} stand – { boss, hp, leben, maxLeben, muenzen, rekord,
     *                           kombo, komboBonus, verbesserungen }
     */
    function zeigeStand(stand) {
      return einreihen(function () {
        zeigeBoss(stand.boss);
        zeigeHp(stand.hp, stand.boss.maxHp);
        zeigeHerzen(stand.leben, stand.maxLeben);
        zeigeMuenzen(stand.muenzen, false);
        zeigeKombo(stand.kombo, stand.komboBonus, false);
        zeigeVerbesserungen(stand.verbesserungen);
        zeigeRekord(stand.boss, stand.rekord);
        el.bossFigur.classList.remove("ist-besiegt");
      });
    }

    /** Fasst zusammen, was eine richtige Zahl bewirkt hat – mit der Rechnung. */
    function trefferText(e) {
      const teile = [];
      if (e.fehlschlag) {
        teile.push(e.spruch);
      } else {
        let kopf = "";
        if (e.kritisch) kopf = "Kritischer Treffer! ";
        else if (e.eigenheit) kopf = e.eigenheit.name + "! ";
        else if (e.doppelt) kopf = "Doppelter Schaden! ";
        if (e.kritisch && e.doppelt) kopf += "Und doppelt! ";
        teile.push(kopf + e.rechnung.text + (e.gift > 0 ? " · Gift +" + e.gift : "") + ".");
      }
      if (e.powerup && e.lebenGewuenscht > 0) {
        teile.push(e.lebenPlus > 0 ? "+" + e.lebenPlus + " Leben!" : "Leben schon voll (" + e.maxLeben + ").");
      }
      if (e.powerup && e.powerup.typ === "gold") teile.push("Goldfeld!");
      teile.push("+" + e.muenzenPlus + (e.muenzenPlus === 1 ? " Münze." : " Münzen."));
      return teile.join(" ");
    }

    /**
     * Richtige Zahl: würfeln, zuschlagen (oder stolpern), Schaden, Gift,
     * Kombo, Münzen, Leben – kurz nacheinander.
     */
    function treffer(e) {
      return einreihen(function () {
        zeigeBoss(e.boss);
        // 1. Würfel rollt
        let wuerfeln = Promise.resolve();
        if (!ohneBewegung()) {
          el.wuerfel.classList.add("rollt");
          const zufallsAnzeige = setInterval(function () {
            el.wuerfelZahl.textContent = 1 + Math.floor(Math.random() * e.wuerfelSeiten);
          }, 55);
          wuerfeln = warte(DAUER.wuerfeln).then(function () {
            clearInterval(zufallsAnzeige);
            el.wuerfel.classList.remove("rollt");
          });
        }
        return wuerfeln.then(function () {
          zeigeWurf(e.wurf);
          // 2. Held schlägt zu – oder stolpert bei einer 1
          if (e.fehlschlag) return animiere(el.heldFigur, "stolpert", DAUER.stolpern);
          return animiere(el.heldFigur, e.kritisch ? "schlaegt-stark" : "schlaegt", DAUER.schlag);
        }).then(function () {
          // 3. Der Treffer
          meldung(trefferText(e));
          zeigeKombo(e.kombo, e.komboBonus, true);
          if (e.fehlschlag) {
            schwebeZahl("Daneben!", "daneben");
            return null;
          }
          if (e.eigenheit) {
            // Rüstung hat den Wurf geblockt
            schwebeZahl("Geblockt!", "geblockt");
            animiere(el.bossFigur, "blockt", DAUER.treffer);
            return eigenheitAusgeloest(e.eigenheit);
          }
          zeigeHp(e.hpNachSchaden, e.boss.maxHp);
          if (e.kritisch) {
            // Kritisch: riesige Zahl in eigener Farbe, Blitz, starkes Wackeln
            schwebeZahl("−" + e.schaden, "kritisch");
            banner("Kritisch!", null, "kritisch");
            faerbe(el.blitz, "an", 260);
            animiere(el.buehne, "wackelt-stark", DAUER.kritisch);
            return animiere(el.bossFigur, "getroffen-stark", DAUER.kritisch);
          }
          if (e.doppelt) {
            // Doppelschaden: größere Zahl in eigener Farbe, Fenster wackelt
            schwebeZahl("−" + e.schaden, "doppelt");
            animiere(el.buehne, "wackelt", 360);
            return animiere(el.bossFigur, "getroffen-stark", DAUER.treffer);
          }
          schwebeZahl("−" + e.schaden, "boss");
          return animiere(el.bossFigur, "getroffen", DAUER.treffer);
        }).then(function () {
          // 4. Gift (grünes Power-up): eigene grüne Zahl, Boss kurz grün
          if (e.gift <= 0) return null;
          schwebeZahl("−" + e.gift, "gift");
          zeigeHp(e.hpNachher, e.boss.maxHp);
          return faerbe(el.bossFigur, "vergiftet", 520);
        }).then(function () {
          // 5. Münzen und Leben
          schwebeZahl("+" + e.muenzenPlus, "muenzen");
          if (e.lebenPlus > 0) {
            zeigeHerzen(e.leben, e.maxLeben);
            const neuesHerz = el.herzen.children[e.leben - 1];
            if (neuesHerz) animiere(neuesHerz, "verschwindet", 400);   // kurzes "Aufpoppen"
          }
          return zeigeMuenzen(e.muenzen, true);
        });
      });
    }

    /**
     * Färbt ein Element kurz um (z. B. Boss grün bei Gift). Anders als
     * animiere() auch bei "Bewegung reduzieren" – es ist nur eine Farbe.
     */
    function faerbe(element, klasse, ms) {
      element.classList.add(klasse);
      return new Promise(function (fertig) {
        setTimeout(function () { element.classList.remove(klasse); fertig(); }, ms);
      });
    }

    /** Falsche Zahl: Boss greift an, ein Leben geht verloren, die Kombo zerbricht, ggf. Eigenheit. */
    function fehler(e) {
      return einreihen(function () {
        const rest = e.leben;
        let text = e.boss.name + " greift an! Falsche Zahl – " +
          (rest === 0 ? "keine Leben mehr." : "noch " + rest + " Leben.");
        if (e.komboVorher > 0) text += " Kombo verloren (" + e.komboVorher + ").";
        if (e.eigenheit) text += " " + e.eigenheit.name + ": " + e.eigenheit.text + ".";
        meldung(text);
        const angriff = animiere(el.bossFigur, "greift-an", DAUER.angriff);
        return warte(DAUER.angriff / 2).then(function () {
          zeigeHerzen(rest, e.maxLeben);
          const herz = el.herzen.children[rest];
          if (herz) animiere(herz, "verschwindet", 400);
          animiere(el.heldFigur, "wird-getroffen", 300);
          const kombo = e.komboVorher > 0 ? zerbrichKombo() : null;
          return Promise.all([angriff, kombo]);
        }).then(function () {
          if (!e.eigenheit) return null;
          // Regeneration: HP steigen. Dieb: Münzen sinken.
          if (e.hp !== e.hpVorher) {
            schwebeZahl("+" + (e.hp - e.hpVorher), "heilung");
            zeigeHp(e.hp, e.boss.maxHp);
          }
          if (e.muenzen !== e.muenzenVorher) {
            schwebeZahl("−" + (e.muenzenVorher - e.muenzen), "muenzen-weg");
            zeigeMuenzen(e.muenzen, true);
          }
          return eigenheitAusgeloest(e.eigenheit);
        });
      });
    }

    /** Boss besiegt. */
    function sieg(e) {
      return einreihen(function () {
        meldung(e.boss.name + " ist besiegt!");
        zeigeHp(0, e.boss.maxHp);
        if (ohneBewegung()) {
          return Promise.resolve();
        }
        el.bossFigur.classList.add("ist-besiegt");
        return warte(DAUER.sieg);
      });
    }

    /** Der nächste Boss erscheint (volle HP, Leben aufgefüllt) – mit seiner Eigenheit. */
    function neuerBoss(e, rekord) {
      return einreihen(function () {
        el.bossFigur.classList.remove("ist-besiegt");
        zeigeBoss(e.boss);
        zeigeHp(e.hp, e.boss.maxHp);
        zeigeHerzen(e.leben, e.maxLeben);
        zeigeRekord(e.boss, rekord);
        let text = "Boss " + e.boss.nummer + ": " + e.boss.name + " erscheint! (" + e.boss.maxHp + " HP)";
        if (e.boss.eigenheit) {
          text += " Eigenheit " + e.boss.eigenheit.name + ": " + e.boss.eigenheit.beschreibung;
          banner(e.boss.eigenheit.name, e.boss.eigenheit.farbe, "eigenheit");
        }
        meldung(text);
        return animiere(el.bossFigur, "erscheint", DAUER.erscheinen);
      });
    }

    /** Eine Verbesserung wurde gewählt: Symbole und ggf. Herzen aktualisieren. */
    function verbesserung(e) {
      return einreihen(function () {
        zeigeVerbesserungen(e.gesammelt, e.id);
        zeigeHerzen(e.leben, e.maxLeben);
        meldung(e.name + (e.stufe === 1 ? " gelernt!" : " – jetzt Stufe " + e.stufe + "!") +
          (e.lebenPlus > 0 ? " +" + e.lebenPlus + " Leben." : ""));
      });
    }

    /** Text in der Textbox (in der Reihenfolge der Warteschlange). */
    function text(nachricht) {
      return einreihen(function () { meldung(nachricht); });
    }

    /** Wartet, bis alle Animationen in der Schlange abgespielt sind. */
    function fertig() {
      return einreihen(function () {});
    }


    /* ---------- Overlays über dem Sudoku ---------- */

    /** "Münzen ×1,5 · Schaden +20 %" */
    function belohnungText(b) {
      return "Münzen ×" + SudokuRPG.zahlText(b.muenzFaktor) + " · " +
        (b.schadensBonus > 0 ? "Schaden +" + Math.round(b.schadensBonus * 100) + " %" : "kein Schadensbonus");
    }

    /**
     * Slot-Walze: läuft durch die Schwierigkeitsgrade, wird langsamer und
     * bleibt auf dem ausgelosten Grad stehen. Danach steht dort, was er bringt.
     * @param {HTMLElement} rahmen – Bereich, über den die Walze gelegt wird
     * @param {object[]} grade     – alle Grade { id, name }
     * @param {object} ziel        – der ausgeloste Grad (aus den Regeln)
     * @param {object} belohnung   – { muenzFaktor, schadensBonus } des Grads
     * @returns {Promise} – erfüllt, wenn die Walze steht und die Pause vorbei ist
     */
    function losen(rahmen, grade, ziel, belohnung) {
      const overlay = document.createElement("div");
      overlay.className = "slot";
      overlay.innerHTML =
        '<div class="slot-kasten">' +
          '<p class="slot-titel">Schwierigkeit wird ausgelost …</p>' +
          '<div class="slot-fenster"><div class="slot-walze"></div></div>' +
          '<p class="slot-belohnung"></p>' +
        "</div>";
      const walze = overlay.querySelector(".slot-walze");
      const titel = overlay.querySelector(".slot-titel");
      rahmen.appendChild(overlay);
      const special = ziel.id === "special";

      // Die Walze: alle Grade 5× hintereinander, dann bis zum Zielgrad.
      // Ohne Bewegung steht nur der Zielgrad darauf.
      const zielIndex = grade.findIndex(function (g) { return g.id === ziel.id; });
      const eintraege = [];
      if (ohneBewegung()) {
        eintraege.push(ziel);
      } else {
        for (let r = 0; r < 5; r++) grade.forEach(function (g) { eintraege.push(g); });
        eintraege.push.apply(eintraege, grade.slice(0, zielIndex + 1));
      }
      eintraege.forEach(function (g) {
        const zeile = document.createElement("div");
        zeile.className = "slot-eintrag";
        zeile.textContent = g.name;
        walze.appendChild(zeile);
      });

      const fertigText = function () {
        titel.textContent = special ? "★ Special Grade! ★" : "Ausgelost: " + ziel.name;
        overlay.querySelector(".slot-belohnung").textContent = belohnung ? belohnungText(belohnung) : "";
        overlay.classList.add("ist-fertig");
        if (special) overlay.classList.add("ist-special");
      };
      const pause = DAUER.walzePause + (special ? DAUER.walzeSpecial : 0);

      if (ohneBewegung()) {
        fertigText();
        return new Promise(function (ok) { setTimeout(ok, 700 + (special ? 500 : 0)); }).then(function () { overlay.remove(); });
      }

      // Auf den letzten Eintrag fahren – das CSS-"ease-out" macht die
      // Walze am Ende immer langsamer
      const hoehe = walze.firstChild.getBoundingClientRect().height;
      walze.style.transform = "translateY(0)";
      void walze.offsetWidth;
      walze.style.transitionDuration = DAUER.walze + "ms";
      walze.style.transform = "translateY(" + (-(eintraege.length - 1) * hoehe) + "px)";

      return warte(DAUER.walze).then(function () {
        fertigText();
        return warte(pause);
      }).then(function () {
        overlay.remove();
      });
    }

    /**
     * Verbesserungsauswahl: Karten über dem Sudoku. Hält die Warteschlange an,
     * bis eine Karte gewählt ist – erst dann geht es weiter.
     * @param {HTMLElement} rahmen
     * @param {object[]} angebote – { id, name, symbol, farbe, stufe, maxStufe, beschreibung }
     * @param {function} beimWaehlen – bekommt die id der gewählten Verbesserung
     */
    let auswahlNummer = 0;          // nur die zuletzt angeforderte Auswahl wird gezeigt
    let offeneAuswahl = null;       // { overlay, weiter } der gerade sichtbaren Auswahl

    function auswahl(rahmen, angebote, beimWaehlen) {
      schliesseAuswahl();             // eine ältere (z. B. vor dem Neuladen) ist damit erledigt
      const nummer = ++auswahlNummer;
      return einreihen(function () {
        if (nummer !== auswahlNummer) return null;
        meldung("Wähle eine Verbesserung!");
        return new Promise(function (weiter) {
          const overlay = document.createElement("div");
          overlay.className = "auswahl";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-label", "Verbesserung wählen");
          overlay.innerHTML =
            '<div class="auswahl-kasten">' +
              '<p class="auswahl-titel">Boss besiegt! Wähle eine Verbesserung:</p>' +
              '<div class="auswahl-karten"></div>' +
            "</div>";
          const karten = overlay.querySelector(".auswahl-karten");
          angebote.forEach(function (v) {
            const karte = document.createElement("button");
            karte.type = "button";
            karte.className = "auswahl-karte";
            karte.dataset.id = v.id;
            karte.style.setProperty("--chip-farbe", v.farbe);
            karte.innerHTML =
              '<span class="auswahl-symbol">' + symbolSvg(v.symbol) + "</span>" +
              '<span class="auswahl-name"></span>' +
              '<span class="auswahl-text"></span>' +
              '<span class="auswahl-stufe"></span>';
            karte.querySelector(".auswahl-name").textContent = v.name;
            karte.querySelector(".auswahl-text").textContent = v.beschreibung;
            karte.querySelector(".auswahl-stufe").textContent = v.stufe === 0
              ? "Neu · max. Stufe " + v.maxStufe
              : "Stufe " + v.stufe + " → " + (v.stufe + 1) + " (max. " + v.maxStufe + ")";
            karte.addEventListener("click", function () {
              overlay.remove();
              offeneAuswahl = null;
              beimWaehlen(v.id);       // Regeln: Verbesserung anwenden → Ereignisse
              weiter();
            });
            karten.appendChild(karte);
          });
          rahmen.appendChild(overlay);
          offeneAuswahl = { overlay: overlay, weiter: weiter };
          karten.firstChild.focus();
        });
      });
    }

    /** Schließt eine offene Auswahl ohne Wahl (z. B. beim Zurücksetzen). */
    function schliesseAuswahl() {
      auswahlNummer++;                // noch wartende Auswahlen verfallen
      if (offeneAuswahl) {
        offeneAuswahl.overlay.remove();
        offeneAuswahl.weiter();
        offeneAuswahl = null;
      }
    }

    /**
     * Niederlage-Bildschirm: zeigt, wie weit man gekommen ist.
     * @returns {Promise} – erfüllt, wenn "Erneut antreten" gedrückt wurde
     */
    function niederlage(rahmen, e) {
      return einreihen(function () {
        meldung("Niederlage gegen " + e.boss.name + " …");
        zeigeHerzen(0);
        return animiere(el.heldFigur, "faellt", 500);
      }).then(function () {
        return new Promise(function (weiter) {
          const overlay = document.createElement("div");
          overlay.className = "niederlage";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-label", "Niederlage");
          overlay.innerHTML =
            '<div class="niederlage-kasten">' +
              '<p class="niederlage-titel">Niederlage!</p>' +
              '<p class="niederlage-text"></p>' +
              '<p class="niederlage-rekord"></p>' +
              '<button type="button" class="niederlage-knopf">Erneut antreten</button>' +
            "</div>";
          overlay.querySelector(".niederlage-text").textContent =
            "Boss " + e.boss.nummer + " – " + e.boss.name + " war zu stark. Du hast " +
            e.schadenGemacht + " von " + e.boss.maxHp + " HP geschafft. " +
            "Deine Münzen und Verbesserungen bleiben.";
          overlay.querySelector(".niederlage-rekord").textContent = e.rekord === 0
            ? "Rekord: noch kein Boss besiegt."
            : "Rekord: " + e.rekord + (e.rekord === 1 ? " Boss besiegt." : " Bosse besiegt.");
          rahmen.appendChild(overlay);
          const knopf = overlay.querySelector(".niederlage-knopf");
          knopf.addEventListener("click", function () {
            overlay.remove();
            weiter();
          });
          knopf.focus();
        });
      });
    }

    return {
      zeigeStand: zeigeStand,
      zeigeMuenzen: zeigeMuenzen,
      zeigeWurf: zeigeWurf,
      treffer: treffer,
      fehler: fehler,
      sieg: sieg,
      neuerBoss: neuerBoss,
      verbesserung: verbesserung,
      auswahl: auswahl,
      schliesseAuswahl: schliesseAuswahl,
      text: text,
      fertig: fertig,
      losen: losen,
      niederlage: niederlage,
    };
  }

  return {
    erstelle: erstelle,
    symbolSvg: symbolSvg,
  };
})();
