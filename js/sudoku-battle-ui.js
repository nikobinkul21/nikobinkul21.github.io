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
    eliteAuftritt: 1500, // Einblendung "Ein Elite-Boss erscheint"
    eliteSieg: 1500,   // größere Siegesanimation nach einem Elite-Boss
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
    kreuz: '<path d="M0 0h2v1H0zM5 0h2v1H5zM1 1h2v1H1zM4 1h2v1H4zM2 2h3v1H2zM3 3h1v1H3zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z"/>',
    warnung: '<path d="M3 0h1v1h1v2h1v2h1v2H0V5h1V3h1V1h1z"/><path fill="#fff" d="M3 2h1v2H3zM3 5h1v1H3z"/>',
    krone: '<path d="M0 1h1v2h1V2h1V0h1v2h1v1h1V1h1v6H0z"/>',
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
            // Nur bei Elite-Bossen: die seltene Eigenschaft
            '<button type="button" class="kampf-selten hat-tipp" hidden>' +
              '<span class="kampf-selten-marke">Selten</span><span class="kampf-selten-name"></span>' + tippHtml() +
            "</button>" +
            '<div class="kampf-hp"><span class="kampf-hp-label">HP</span>' +
              '<div class="kampf-hp-balken"><div class="kampf-hp-fuellung"></div></div>' +
            "</div>" +
            // Links: wann der nächste Elite-Boss kommt bzw. Zähler der seltenen Eigenschaft
            '<div class="kampf-hp-zeile"><span class="kampf-elite-hinweis"></span><span class="kampf-hp-zahl"></span></div>' +
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
        // Kurze Meldungen für Screenreader (unsichtbar, wird vorgelesen)
        '<p class="kampf-status nur-vorlesen" role="status"></p>' +
        // Das Protokoll: letzter Treffer, Belohnung, Verlauf.
        // Auf schmalen Bildschirmen nur eine kompakte Zeile zum Aufklappen.
        '<div class="kampf-panel ist-leer">' +
          '<button type="button" class="panel-kurz" aria-expanded="false">' +
            '<span class="panel-kurz-titel">Letzter Zug</span>' +
            '<span class="panel-kurz-schaden">Noch kein Zug</span>' +
            '<span class="panel-kurz-muenzen"></span>' +
            '<span class="panel-kurz-pfeil" aria-hidden="true">▾</span>' +
          "</button>" +
          '<div class="panel-details">' +
            '<div class="panel-oben">' +
              '<p class="panel-hinweis">Setze eine Zahl. Hier siehst du dann, wie dein Schaden entsteht und welche Münzen du bekommst.</p>' +
              '<section class="panel-block panel-treffer" aria-label="Letzter Treffer">' +
                '<h3 class="panel-titel">Letzter Treffer</h3>' +
                '<div class="panel-zeilen"></div>' +
                '<div class="panel-summe"><span class="panel-label">Gesamt</span><span class="panel-wert"></span></div>' +
              "</section>" +
              '<section class="panel-block panel-belohnung" aria-label="Belohnung">' +
                '<h3 class="panel-titel">Belohnung</h3>' +
                '<div class="panel-zeilen"></div>' +
                '<div class="panel-summe"><span class="panel-label">Summe</span><span class="panel-wert"></span></div>' +
              "</section>" +
            "</div>" +
            '<section class="panel-block panel-verlauf" aria-label="Verlauf">' +
              '<h3 class="panel-titel">Verlauf</h3>' +
              '<ol class="panel-verlauf-liste"></ol>' +
            "</section>" +
          "</div>" +
        "</div>" +
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
      bossInfo: container.querySelector(".kampf-info--boss"),
      selten: container.querySelector(".kampf-selten"),
      seltenName: container.querySelector(".kampf-selten-name"),
      seltenTipp: container.querySelector(".kampf-selten .kampf-tipp"),
      eliteHinweis: container.querySelector(".kampf-elite-hinweis"),
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
      status: container.querySelector(".kampf-status"),
      panel: container.querySelector(".kampf-panel"),
      kurz: container.querySelector(".panel-kurz"),
      kurzSchaden: container.querySelector(".panel-kurz-schaden"),
      kurzMuenzen: container.querySelector(".panel-kurz-muenzen"),
      trefferZeilen: container.querySelector(".panel-treffer .panel-zeilen"),
      trefferSumme: container.querySelector(".panel-treffer .panel-summe"),
      belohnungZeilen: container.querySelector(".panel-belohnung .panel-zeilen"),
      belohnungSumme: container.querySelector(".panel-belohnung .panel-summe"),
      verlauf: container.querySelector(".panel-verlauf-liste"),
      rekord: container.querySelector(".kampf-rekord"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Smartphone: Antippen der kompakten Zeile klappt die drei Blöcke auf
    el.kurz.addEventListener("click", function () {
      const offen = el.panel.classList.toggle("offen");
      el.kurz.setAttribute("aria-expanded", String(offen));
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
      // Elite-Boss: Zusatz "Elite" am Namen, größere Figur mit Aura, eigener HP-Rahmen (CSS)
      el.bossNr.textContent = boss.elite ? "★ Elite" : "Nr. " + boss.nummer;
      el.bossNr.title = "Boss Nr. " + boss.nummer;
      el.buehne.classList.toggle("ist-elite", boss.elite);
      zeigeEigenheit(boss.eigenheit);
      zeigeSelten(boss.elite ? boss.selten : null);
      // Klein links unter dem HP-Balken: Zähler der seltenen Eigenschaft bzw.
      // bei normalen Bossen, wann der nächste Elite-Boss kommt
      let hinweis = "";
      if (boss.elite) {
        hinweis = boss.selten && boss.selten.zaehlerText ? "🛡 " + boss.selten.zaehlerText : "";
      } else if (boss.bisElite !== null) {
        hinweis = boss.bisElite === 1 ? "Nächster: Elite!" : "Elite in " + boss.bisElite;
      }
      el.eliteHinweis.textContent = hinweis;
      el.eliteHinweis.title = boss.elite ? "" : "So viele Bosse bis zum nächsten Elite-Boss";
    }

    /** Seltene Eigenschaft unter der Eigenheit – mit Kennzeichnung "Selten" und Erklärung. */
    function zeigeSelten(selten) {
      el.selten.classList.remove("offen");
      el.selten.hidden = !selten;
      if (!selten) return;
      el.selten.style.setProperty("--selten-farbe", selten.farbe);
      el.seltenName.textContent = selten.name;
      el.seltenTipp.textContent = "Selten – " + selten.name + ": " + selten.beschreibung;
      el.selten.setAttribute("aria-label", "Seltene Eigenschaft " + selten.name + ": " + selten.beschreibung);
      el.selten.setAttribute("aria-expanded", "false");
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
      // Kurz, damit die Fußzeile in eine Zeile passt (die Bossnummer steht im Kampffenster)
      el.rekord.textContent = "Rekord: " + (rekord === 0 ? "noch keiner" : rekord + (rekord === 1 ? " Boss" : " Bosse"));
      el.rekord.title = "Höchster besiegter Boss";
    }

    /** Kurze Meldung für Screenreader (die sichtbare Darstellung übernimmt das Panel). */
    function meldung(text) {
      el.status.textContent = text;
    }


    /* ---------- Das Panel: letzter Treffer, Belohnung, Verlauf ----------
       Es zeigt immer den NEUESTEN Zug – sofort, ohne auf die Animationen
       in der Warteschlange zu warten. Aktualisiert wird über spaeter():
       erst wenn die Regeln alle Ereignisse dieses Zugs gemeldet haben
       (z. B. "powerup" kommt nach "richtig"), in der richtigen Reihenfolge. */

    const VERLAUF_LAENGE = 5;

    function spaeter(fn) {
      Promise.resolve().then(fn).catch(function (fehler) { console.error(fehler); });
    }

    /** Hebt ein Element kurz hervor (nur Farbe – auch bei "Bewegung reduzieren"). */
    function hervorheben(element) {
      element.classList.remove("panel-neu");
      void element.offsetWidth;
      element.classList.add("panel-neu");
      clearTimeout(element.hervorhebung);
      element.hervorhebung = setTimeout(function () { element.classList.remove("panel-neu"); }, 900);
    }

    /** Eine Zeile "Bezeichnung … Wert" setzen – nur Geändertes wird hervorgehoben. */
    function setzeZeile(zeile, eintrag, immerHervorheben) {
      const label = zeile.querySelector(".panel-label");
      const wert = zeile.querySelector(".panel-wert");
      const geaendert = label.textContent !== eintrag.label || wert.textContent !== eintrag.wert;
      label.textContent = eintrag.label;
      wert.textContent = eintrag.wert;
      zeile.className = zeile.className.split(" ").filter(function (k) {
        return k.indexOf("panel-zeile--") !== 0 && k.indexOf("panel-summe--") !== 0;
      }).join(" ");
      if (eintrag.art) zeile.classList.add((zeile.classList.contains("panel-summe") ? "panel-summe--" : "panel-zeile--") + eintrag.art);
      if (eintrag.farbe) zeile.style.setProperty("--zeilen-farbe", eintrag.farbe);
      else zeile.style.removeProperty("--zeilen-farbe");
      if (geaendert || immerHervorheben) hervorheben(zeile);
    }

    /**
     * Bringt eine Liste von Zeilen auf den neuen Stand. Vorhandene Zeilen
     * (gleicher key) bleiben stehen und werden nur aktualisiert – so springt nichts.
     * @param {object[]} eintraege – { key, label, wert, art, farbe }
     */
    function setzeZeilen(container, eintraege) {
      const alte = {};
      Array.from(container.children).forEach(function (z) { alte[z.dataset.key] = z; });
      eintraege.forEach(function (eintrag) {
        let zeile = alte[eintrag.key];
        if (zeile) {
          delete alte[eintrag.key];
        } else {
          zeile = document.createElement("div");
          zeile.className = "panel-zeile";
          zeile.dataset.key = eintrag.key;
          zeile.innerHTML = '<span class="panel-label"></span><span class="panel-wert"></span>';
        }
        setzeZeile(zeile, eintrag, false);
        container.appendChild(zeile);         // bringt die Zeilen in die richtige Reihenfolge
      });
      Object.keys(alte).forEach(function (key) { alte[key].remove(); });
    }

    /**
     * Zeigt einen Zug im Panel.
     * @param {object} zug – { treffer: [Zeilen], schaden: {wert, art},
     *                         belohnung: [Zeilen], muenzen: {wert, art},
     *                         kurz: {schaden, schadenArt, muenzen} }
     */
    function zeigeZug(zug) {
      el.panel.classList.remove("ist-leer");
      setzeZeilen(el.trefferZeilen, zug.treffer);
      setzeZeile(el.trefferSumme, zug.schaden, true);
      setzeZeilen(el.belohnungZeilen, zug.belohnung);
      setzeZeile(el.belohnungSumme, zug.muenzen, true);
      el.kurzSchaden.textContent = zug.kurz.schaden;
      el.kurzSchaden.dataset.art = zug.kurz.schadenArt || "";
      el.kurzMuenzen.textContent = zug.kurz.muenzen;
      el.kurzMuenzen.dataset.art = zug.kurz.muenzenArt || "";
      hervorheben(el.kurz);
    }

    /**
     * Neuer Eintrag oben im Verlauf; der älteste fällt nach fünf Einträgen weg.
     * @param {object} e – { text, wert, art, symbol, farbe }
     */
    function verlaufEintrag(e) {
      const li = document.createElement("li");
      li.className = "panel-eintrag" + (e.art ? " panel-eintrag--" + e.art : "");
      if (e.farbe) li.style.setProperty("--zeilen-farbe", e.farbe);
      li.innerHTML = '<span class="panel-symbol">' + (e.symbol ? symbolSvg(e.symbol) : "") + "</span>" +
        '<span class="panel-eintrag-text"></span><span class="panel-eintrag-wert"></span>';
      li.querySelector(".panel-eintrag-text").textContent = e.text;
      li.querySelector(".panel-eintrag-wert").textContent = e.wert || "";
      el.verlauf.insertBefore(li, el.verlauf.firstChild);
      while (el.verlauf.children.length > VERLAUF_LAENGE) el.verlauf.lastChild.remove();
      hervorheben(li);
    }

    /** Name eines Schwierigkeitsgrads → seine id (für die Zeile "Schwierigkeit"). */
    function gradMitName(name) {
      return SudokuEngine.SCHWIERIGKEITSGRADE.find(function (g) { return g.name === name; });
    }

    /**
     * Die Schadensrechnung als Zeilen. Gelesen wird aus rechnung.schritte –
     * so erscheinen genau die Stufen, die bei diesem Treffer gewirkt haben
     * (auch solche aus Erweiterungen).
     */
    function rechnungsZeilen(e) {
      const zeilen = [];
      if (e.immun) {
        // "Wurf 6 · gerade · immun" – sonst wurde nichts berechnet
        return [
          { key: "wurf", label: "Wurf", wert: String(e.wurf) },
          { key: "immun", label: e.selten.grund, wert: e.selten.art, art: "selten", farbe: e.selten.farbe },
          { key: "selten", label: e.selten.name, wert: "", art: "notiz" },
        ];
      }
      e.rechnung.schritte.forEach(function (schritt, i) {
        const teil = /^(.*) (\S+)$/.exec(schritt);
        const name = teil ? teil[1] : schritt;
        const wert = teil ? teil[2] : "";
        const grad = gradMitName(name);
        if (name === "Wurf") {
          zeilen.push({ key: "wurf", label: "Wurf", wert: wert });
        } else if (name === "Kritisch") {
          zeilen.push({ key: "kritisch", label: "Kritisch", wert: wert, art: "kritisch" });
        } else if (schritt === "Fehlschlag") {
          zeilen.push({ key: "fehlschlag", label: "Fehlschlag", wert: "×0", art: "daneben" });
        } else if (name === "Zuschlag") {
          zeilen.push({ key: "zuschlag", label: "Zuschlag", wert: wert });
        } else if (name === "Kombo") {
          zeilen.push({ key: "kombo", label: "Kombo", wert: wert });
        } else if (grad) {
          zeilen.push({ key: "schwierigkeit", label: "Schwierigkeit",
            wert: "+" + Math.round(SudokuRPG.belohnung(grad.id).schadensBonus * 100) + " %" });
        } else if (name === "Doppelt") {
          zeilen.push({ key: "doppelt", label: "Doppelschaden", wert: wert, art: "doppelt" });
        } else if (e.boss.selten && name === e.boss.selten.name) {
          zeilen.push({ key: "selten", label: name, wert: wert, art: "selten", farbe: e.boss.selten.farbe });
        } else if (e.eigenheit && name === e.eigenheit.name) {
          zeilen.push({ key: "eigenheit", label: name, wert: wert, art: "eigenheit", farbe: e.eigenheit.farbe });
        } else {
          zeilen.push({ key: "schritt" + i, label: name, wert: wert });
        }
      });
      if (e.gift > 0) zeilen.push({ key: "gift", label: "Gift", wert: "+" + e.gift, art: "gift" });
      if (e.fehlschlag && e.spruch) zeilen.push({ key: "spruch", label: e.spruch, wert: "", art: "notiz" });
      return zeilen;
    }

    /** Münzen dieses Zugs mit Grund, dazu ein gewonnenes Leben. */
    function belohnungsZeilen(e) {
      const zeilen = [];
      const proZahl = e.werte ? e.werte.muenzenProZahl : K.muenzen.proZahl;
      zeilen.push({ key: "zahl", label: "Zahl", wert: "+" + proZahl });
      if (e.einheiten.zeile) zeilen.push({ key: "zeile", label: "Zeile", wert: "+" + K.muenzen.proZeileOderSpalte });
      if (e.einheiten.spalte) zeilen.push({ key: "spalte", label: "Spalte", wert: "+" + K.muenzen.proZeileOderSpalte });
      if (e.einheiten.block) zeilen.push({ key: "block", label: "Block", wert: "+" + K.muenzen.proBlock });
      if (e.powerup && e.powerupEffekt && e.powerupEffekt.muenzen > 0) {
        zeilen.push({ key: "powerup", label: e.powerup.name + "feld", wert: "+" + e.powerupEffekt.muenzen, art: "gold" });
      }
      if (e.muenzFaktor !== 1) {
        zeilen.push({ key: "faktor", label: "Schwierigkeit", wert: "×" + SudokuRPG.zahlText(e.muenzFaktor) });
      }
      if (e.eliteBonus > 0) zeilen.push({ key: "elite", label: "Elite-Bonus", wert: "+" + e.eliteBonus, art: "gold" });
      if (e.lebenPlus > 0) {
        zeilen.push({ key: "leben", label: "Leben", wert: "+" + e.lebenPlus, art: "leben" });
      } else if (e.lebenGewuenscht > 0) {
        zeilen.push({ key: "leben", label: "Leben", wert: "schon voll", art: "daneben" });
      }
      return zeilen;
    }

    function muenzenText(n) {
      return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);
    }

    /** Panel und Verlauf nach einer richtigen Zahl. */
    function protokolliereTreffer(e) {
      const gesamt = e.schaden + e.gift;
      const muenzen = e.muenzenPlus + e.eliteBonus;
      const art = e.immun ? "selten" : e.kritisch ? "kritisch" : e.fehlschlag ? "daneben" :
        e.eigenheit ? "eigenheit" : e.doppelt ? "doppelt" : "";
      const farbe = e.immun ? e.selten.farbe : e.eigenheit ? e.eigenheit.farbe : null;
      let kurz = gesamt + " Schaden";
      if (e.immun) kurz = e.selten.art === "geblockt" ? "Geblockt" : "Immun";
      else if (e.fehlschlag) kurz = "Fehlschlag";
      else if (e.eigenheit) kurz = "Geblockt";
      zeigeZug({
        treffer: rechnungsZeilen(e),
        schaden: { label: "Gesamt", wert: String(gesamt), art: art, farbe: farbe },
        belohnung: belohnungsZeilen(e),
        muenzen: { label: "Summe", wert: muenzenText(muenzen), art: "gold" },
        kurz: { schaden: kurz, schadenArt: art, muenzen: muenzenText(muenzen) + " Münzen" },
      });
      if (e.immun) {
        verlaufEintrag({ text: e.selten.name + ": Wurf " + e.wurf + " " + e.selten.art, wert: "0", art: "selten", symbol: "stern", farbe: e.selten.farbe });
      } else if (e.kritisch) {
        verlaufEintrag({ text: e.doppelt ? "Kritisch und doppelt!" : "Kritischer Treffer", wert: "−" + gesamt, art: "kritisch", symbol: "blitz" });
      } else if (e.fehlschlag) {
        verlaufEintrag({ text: "Fehlschlag", wert: "0", art: "daneben", symbol: "kreuz" });
      } else if (e.eigenheit) {
        verlaufEintrag({ text: e.eigenheit.name + " blockt", wert: "0", art: "eigenheit", symbol: "warnung", farbe: e.eigenheit.farbe });
      } else {
        verlaufEintrag({ text: e.doppelt ? "Doppelschaden" : "Treffer", wert: "−" + gesamt, art: e.doppelt ? "doppelt" : "" });
      }
    }

    /** Panel und Verlauf nach einer falschen Zahl. */
    function protokolliereFehler(e) {
      const treffer = [{ key: "falsch", label: "Falsche Zahl", wert: "✕", art: "fehler" }];
      if (e.komboVorher > 0) treffer.push({ key: "kombo", label: "Kombo", wert: e.komboVorher + " → 0", art: "fehler" });
      if (e.eigenheit && e.hp !== e.hpVorher) {
        treffer.push({ key: "eigenheit", label: e.eigenheit.name, wert: "+" + (e.hp - e.hpVorher) + " HP", art: "eigenheit", farbe: e.eigenheit.farbe });
      }
      const belohnung = [{ key: "leben", label: "Leben", wert: "−1", art: "fehler" }];
      const verlust = e.muenzen - e.muenzenVorher;
      if (verlust < 0) {
        belohnung.push({ key: "dieb", label: e.eigenheit ? e.eigenheit.name : "Verlust", wert: muenzenText(verlust), art: "fehler" });
      }
      zeigeZug({
        treffer: treffer,
        schaden: { label: "Gesamt", wert: "0", art: "fehler" },
        belohnung: belohnung,
        muenzen: { label: "Summe", wert: muenzenText(verlust), art: verlust < 0 ? "fehler" : "" },
        kurz: { schaden: "Falsche Zahl", schadenArt: "fehler", muenzenArt: "fehler", muenzen: "−1 Leben" + (verlust < 0 ? " · " + muenzenText(verlust) + " Münzen" : "") },
      });
      verlaufEintrag({ text: "Falsche Zahl", wert: "−1 Leben", art: "fehler", symbol: "herz" });
      if (e.eigenheit) {
        verlaufEintrag({ text: e.eigenheit.name + ": " + e.eigenheit.text, wert: "", art: "eigenheit", symbol: "warnung", farbe: e.eigenheit.farbe });
      }
    }

    /** Zurück zum Hinweistext (neues Abenteuer). */
    function leerePanel() {
      el.panel.classList.add("ist-leer");
      el.trefferZeilen.innerHTML = "";
      el.belohnungZeilen.innerHTML = "";
      el.verlauf.innerHTML = "";
      el.kurzSchaden.textContent = "Noch kein Zug";
      el.kurzSchaden.dataset.art = "";
      el.kurzMuenzen.textContent = "";
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
      setTimeout(function () { b.remove(); }, art === "elite" || art === "elite-sieg" ? DAUER.eliteAuftritt : DAUER.banner);
      return b;
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
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite");
      });
    }

    /** Fasst zusammen, was eine richtige Zahl bewirkt hat – mit der Rechnung. */
    function trefferText(e) {
      const teile = [];
      if (e.immun) {
        teile.push(e.selten.name + "! Wurf " + e.wurf + ", " + e.selten.grund + ", " + e.selten.art + ": kein Schaden.");
      } else if (e.fehlschlag) {
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
      if (e.eliteBonus > 0) teile.push("Elite-Bonus +" + e.eliteBonus + " Münzen.");
      return teile.join(" ");
    }

    /**
     * Richtige Zahl: würfeln, zuschlagen (oder stolpern), Schaden, Gift,
     * Kombo, Münzen, Leben – kurz nacheinander.
     */
    function treffer(e) {
      spaeter(function () {
        meldung(trefferText(e));
        protokolliereTreffer(e);
      });
      return einreihen(function () {
        zeigeBoss(e.boss);
        // 1. Würfel rollt
        let wuerfeln = Promise.resolve();
        el.wuerfel.classList.remove("ist-wirkungslos");
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
          zeigeKombo(e.kombo, e.komboBonus, true);
          if (e.fehlschlag) {
            schwebeZahl("Daneben!", "daneben");
            return null;
          }
          if (e.immun) {
            // Seltene Eigenschaft: Wurf wirkungslos – Würfel grau, Boss wehrt ab
            el.wuerfel.classList.add("ist-wirkungslos");
            schwebeZahl(e.selten.art === "geblockt" ? "Geblockt!" : "Immun!", "immun");
            banner(e.selten.name + "!", e.selten.farbe, "selten");
            animiere(el.bossFigur, "wehrt-ab", DAUER.treffer);
            return faerbe(el.selten, "ausgeloest", 900);
          }
          if (e.eigenheit) {
            // Rüstung hat den Wurf geblockt
            el.wuerfel.classList.add("ist-wirkungslos");
            schwebeZahl("Geblockt!", "geblockt");
            animiere(el.bossFigur, "wehrt-ab", DAUER.treffer);
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
          schwebeZahl("+" + (e.muenzenPlus + e.eliteBonus), "muenzen");
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
      spaeter(function () {
        let text = e.boss.name + " greift an! Falsche Zahl, " +
          (e.leben === 0 ? "keine Leben mehr." : "noch " + e.leben + " Leben.");
        if (e.komboVorher > 0) text += " Kombo verloren.";
        if (e.eigenheit) text += " " + e.eigenheit.name + ": " + e.eigenheit.text + ".";
        meldung(text);
        protokolliereFehler(e);
      });
      return einreihen(function () {
        const rest = e.leben;
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
      spaeter(function () {
        meldung(e.boss.name + " ist besiegt!" + (e.elite ? " Elite-Bonus: " + e.eliteBonus + " Münzen." : ""));
        verlaufEintrag(e.elite
          ? { text: "Elite " + e.boss.name + " besiegt!", wert: "+" + e.eliteBonus, art: "elite", symbol: "krone" }
          : { text: e.boss.name + " besiegt!", wert: "", art: "besiegt", symbol: "krone" });
      });
      return einreihen(function () {
        zeigeHp(0, e.boss.maxHp);
        if (ohneBewegung()) {
          return Promise.resolve();
        }
        if (e.elite) {
          // Größer: goldener Blitz, starkes Wackeln, längeres Verglühen, Hinweis mit Bonus
          faerbe(el.blitz, "an-gold", 420);
          animiere(el.buehne, "wackelt-stark", DAUER.kritisch);
          banner("Elite besiegt! +" + e.eliteBonus + " Münzen", null, "elite-sieg");
          el.bossFigur.classList.add("ist-besiegt-elite");
          return warte(DAUER.eliteSieg);
        }
        el.bossFigur.classList.add("ist-besiegt");
        return warte(DAUER.sieg);
      });
    }

    /** Der nächste Boss erscheint (volle HP, Leben aufgefüllt) – mit seiner Eigenheit. */
    function neuerBoss(e, rekord) {
      spaeter(function () {
        let text = (e.boss.elite ? "Ein Elite-Boss erscheint! " : "") +
          "Boss " + e.boss.nummer + ": " + e.boss.name + ", " + e.boss.maxHp + " HP.";
        if (e.boss.eigenheit) text += " Eigenheit " + e.boss.eigenheit.name + ": " + e.boss.eigenheit.beschreibung;
        if (e.boss.selten) text += " Selten, " + e.boss.selten.name + ": " + e.boss.selten.beschreibung;
        meldung(text);
        verlaufEintrag(e.boss.elite
          ? { text: "Elite " + e.boss.nummer + ": " + e.boss.name + (e.boss.selten ? " · " + e.boss.selten.name : ""),
              wert: e.boss.maxHp + " HP", art: "elite", symbol: "stern" }
          : e.boss.eigenheit
          ? { text: "Boss " + e.boss.nummer + ": " + e.boss.name + " · " + e.boss.eigenheit.name, wert: "",
              art: "eigenheit", symbol: "warnung", farbe: e.boss.eigenheit.farbe }
          : { text: "Boss " + e.boss.nummer + ": " + e.boss.name, wert: e.boss.maxHp + " HP" });
      });
      return einreihen(function () {
        el.bossFigur.classList.remove("ist-besiegt", "ist-besiegt-elite");
        zeigeBoss(e.boss);
        zeigeHp(e.hp, e.boss.maxHp);
        zeigeHerzen(e.leben, e.maxLeben);
        zeigeRekord(e.boss, rekord);
        if (e.boss.elite) {
          // Eigene Einblendung (entfällt bei "Bewegung reduzieren" – die Kennzeichnungen bleiben)
          if (!ohneBewegung()) {
            const b = banner("Ein Elite-Boss erscheint!", null, "elite");
            setTimeout(function () { b.remove(); }, DAUER.eliteAuftritt);
          }
        } else if (e.boss.eigenheit) {
          banner(e.boss.eigenheit.name, e.boss.eigenheit.farbe, "eigenheit");
        }
        return animiere(el.bossFigur, "erscheint", DAUER.erscheinen);
      });
    }

    /** Eine Verbesserung wurde gewählt: Symbole und ggf. Herzen aktualisieren. */
    function verbesserung(e) {
      spaeter(function () {
        meldung(e.name + ", Stufe " + e.stufe + "." + (e.lebenPlus > 0 ? " +" + e.lebenPlus + " Leben." : ""));
        verlaufEintrag({ text: e.name, wert: "Stufe " + e.stufe });
      });
      return einreihen(function () {
        zeigeVerbesserungen(e.gesammelt, e.id);
        zeigeHerzen(e.leben, e.maxLeben);
      });
    }

    /** Kurze Nachricht: im Verlauf und für Screenreader. */
    function text(nachricht) {
      spaeter(function () {
        meldung(nachricht);
        verlaufEintrag({ text: nachricht, wert: "" });
      });
    }

    /** Ein neues Abenteuer: Panel zurück auf den Hinweistext. */
    function neuesAbenteuer() {
      spaeter(leerePanel);
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

    function auswahl(rahmen, angebote, beimWaehlen, info) {
      info = info || { rest: 1, elite: false };
      // Titel: "Boss besiegt! Wähle eine …" / "Elite besiegt! Wähle zwei …" / "Wähle noch eine …"
      const gesamt = info.elite ? Math.max(1, K.elite.verbesserungenWaehlen) : 1;
      const zahlwort = { 1: "eine", 2: "zwei", 3: "drei" };
      let titel;
      if (info.rest > 1) {
        titel = "Elite besiegt! Wähle " + (zahlwort[info.rest] || info.rest) + " Verbesserungen:";
      } else if (info.elite && gesamt > 1) {
        titel = "Wähle noch eine Verbesserung:";
      } else {
        titel = (info.elite ? "Elite" : "Boss") + " besiegt! Wähle eine Verbesserung:";
      }
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
              '<p class="auswahl-titel"></p>' +
              '<div class="auswahl-karten"></div>' +
            "</div>";
          overlay.querySelector(".auswahl-titel").textContent = titel;
          if (info.elite) overlay.classList.add("ist-elite");
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
      spaeter(function () {
        meldung("Niederlage gegen " + e.boss.name + ".");
        verlaufEintrag({ text: "Niederlage gegen " + e.boss.name, wert: "", art: "fehler", symbol: "kreuz" });
      });
      return einreihen(function () {
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
      neuesAbenteuer: neuesAbenteuer,
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
