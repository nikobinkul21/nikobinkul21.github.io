/* ==========================================================================
   sudoku-battle-ui.js – Kampffenster, Slot-Walze und Animationen
   für das Sudoku-Abenteuer. Die REGELN stehen in js/sudoku-rpg.js –
   diese Datei zeigt nur an, was die Regeln melden.
   Aussehen: css/sudoku-rpg.css

   Wichtig: Animationen laufen nacheinander über eine Warteschlange.
   Setzt man schnell mehrere Zahlen, werden die Würfe der Reihe nach
   abgespielt – der Spielstand selbst ist aber längst aktuell.
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
    walze: 1900,       // Slot-Walze bis zum Stillstand
    walzePause: 550,   // kurz stehen lassen, bevor das Sudoku startet
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

  // Pixel-Herz als SVG (7 × 6 "Pixel", harte Kanten)
  const HERZ_SVG =
    '<svg viewBox="0 0 7 6" aria-hidden="true" shape-rendering="crispEdges">' +
      '<path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/>' +
    "</svg>";


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
          // Boss oben: Infokasten links, Figur rechts
          '<div class="kampf-info kampf-info--boss">' +
            '<div class="kampf-name"><span class="kampf-boss-name"></span> <span class="kampf-boss-nr"></span></div>' +
            '<div class="kampf-hp"><span class="kampf-hp-label">HP</span>' +
              '<div class="kampf-hp-balken"><div class="kampf-hp-fuellung"></div></div>' +
            "</div>" +
            '<div class="kampf-hp-zahl"></div>' +
          "</div>" +
          '<div class="kampf-figur kampf-figur--boss"><canvas class="kampf-boss"></canvas></div>' +
          // Held unten: Figur links, Herzen und Würfel rechts
          '<div class="kampf-figur kampf-figur--held"><canvas class="kampf-held"></canvas></div>' +
          '<div class="kampf-info kampf-info--held">' +
            '<div class="kampf-herzen" role="img"></div>' +
            '<div class="kampf-wuerfel" role="img"><span class="kampf-wuerfel-zahl">–</span></div>' +
          "</div>" +
          // Ebene für aufsteigende Schadenszahlen
          '<div class="kampf-effekte" aria-hidden="true"></div>' +
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
      effekte: container.querySelector(".kampf-effekte"),
      text: container.querySelector(".kampf-text"),
      rekord: container.querySelector(".kampf-rekord"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Was gerade ANGEZEIGT wird (kann wegen der Warteschlange kurz hinter
    // dem echten Spielstand liegen)
    const anzeige = { bossNummer: 0, maxFehler: 3 };

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
    }

    function zeigeHp(hp, maxHp) {
      const anteil = Math.max(0, hp) / maxHp;
      el.hpFuellung.style.width = (anteil * 100) + "%";
      // Farbe wie in klassischen Spielen: grün → gelb → rot
      el.hpBalken.dataset.stufe = anteil > 0.5 ? "voll" : anteil > 0.2 ? "mittel" : "knapp";
      el.hpZahl.textContent = Math.max(0, hp) + "/" + maxHp;
      el.hpBalken.setAttribute("aria-label", "HP " + Math.max(0, hp) + " von " + maxHp);
    }

    function zeigeHerzen(verbleibend, max) {
      anzeige.maxFehler = max;
      if (el.herzen.children.length !== max) {
        el.herzen.innerHTML = "";
        for (let i = 0; i < max; i++) {
          const herz = document.createElement("span");
          herz.className = "kampf-herz";
          herz.innerHTML = HERZ_SVG;
          el.herzen.appendChild(herz);
        }
      }
      Array.from(el.herzen.children).forEach(function (herz, i) {
        herz.classList.toggle("ist-leer", i >= verbleibend);
      });
      el.herzen.setAttribute("aria-label", verbleibend + " von " + max + " Herzen");
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

    /** Aufsteigende Zahl über dem Boss (Schaden) oder dem Helden. */
    function schwebeZahl(text, ziel) {
      if (ohneBewegung()) return;
      const zahl = document.createElement("span");
      zahl.className = "kampf-schwebezahl kampf-schwebezahl--" + ziel;
      zahl.textContent = text;
      el.effekte.appendChild(zahl);
      setTimeout(function () { zahl.remove(); }, 900);
    }


    /* ---------- Öffentliche Schritte (laufen über die Warteschlange) ---------- */

    /**
     * Zeigt einen Stand SOFORT (ohne Animation) – z. B. nach dem Laden.
     * @param {object} stand – { boss, hp, fehler, maxFehler, rekord }
     */
    function zeigeStand(stand) {
      return einreihen(function () {
        zeigeBoss(stand.boss);
        zeigeHp(stand.hp, stand.boss.maxHp);
        zeigeHerzen(stand.maxFehler - stand.fehler, stand.maxFehler);
        zeigeRekord(stand.boss, stand.rekord);
        el.bossFigur.classList.remove("ist-besiegt");
      });
    }

    /** Richtige Zahl: würfeln, zuschlagen, Boss getroffen, HP sinken. */
    function treffer(e) {
      return einreihen(function () {
        zeigeBoss(e.boss);
        // 1. Würfel rollt
        let wuerfeln = Promise.resolve();
        if (!ohneBewegung()) {
          el.wuerfel.classList.add("rollt");
          const zufallsAnzeige = setInterval(function () {
            el.wuerfelZahl.textContent = 1 + Math.floor(Math.random() * SudokuRPG.KONFIG.wuerfelSeiten);
          }, 55);
          wuerfeln = warte(DAUER.wuerfeln).then(function () {
            clearInterval(zufallsAnzeige);
            el.wuerfel.classList.remove("rollt");
          });
        }
        return wuerfeln.then(function () {
          zeigeWurf(e.wurf);
          // 2. Held schlägt zu
          return animiere(el.heldFigur, "schlaegt", DAUER.schlag);
        }).then(function () {
          // 3. Boss blinkt, Schaden steigt auf, HP sinken
          schwebeZahl("−" + e.schaden, "boss");
          zeigeHp(e.hpNachher, e.boss.maxHp);
          meldung("Treffer! Wurf " + e.wurf + " – " + e.schaden + " Schaden.");
          return animiere(el.bossFigur, "getroffen", DAUER.treffer);
        });
      });
    }

    /** Falsche Zahl: Boss greift an, ein Herz verschwindet. */
    function fehler(e) {
      return einreihen(function () {
        const rest = e.maxFehler - e.fehler;
        meldung(e.boss.name + " greift an! Falsche Zahl – " +
          (rest === 0 ? "keine Herzen mehr." : "noch " + rest + (rest === 1 ? " Herz." : " Herzen.")));
        const angriff = animiere(el.bossFigur, "greift-an", DAUER.angriff);
        return warte(DAUER.angriff / 2).then(function () {
          zeigeHerzen(rest, e.maxFehler);
          const herz = el.herzen.children[rest];
          if (herz) animiere(herz, "verschwindet", 400);
          animiere(el.heldFigur, "wird-getroffen", 300);
          return angriff;
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

    /** Der nächste Boss erscheint (volle HP, Herzen wieder voll). */
    function neuerBoss(e, rekord) {
      return einreihen(function () {
        el.bossFigur.classList.remove("ist-besiegt");
        zeigeBoss(e.boss);
        zeigeHp(e.hp, e.boss.maxHp);
        zeigeHerzen(anzeige.maxFehler, anzeige.maxFehler);
        zeigeRekord(e.boss, rekord);
        meldung("Boss " + e.boss.nummer + ": " + e.boss.name + " erscheint! (" + e.boss.maxHp + " HP)");
        return animiere(el.bossFigur, "erscheint", DAUER.erscheinen);
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

    /**
     * Slot-Walze: läuft durch die Schwierigkeitsgrade, wird langsamer und
     * bleibt auf dem ausgelosten Grad stehen.
     * @param {HTMLElement} rahmen – Bereich, über den die Walze gelegt wird
     * @param {object[]} grade     – alle Grade { id, name }
     * @param {object} ziel        – der ausgeloste Grad (aus den Regeln)
     * @returns {Promise} – erfüllt, wenn die Walze steht und die Pause vorbei ist
     */
    function losen(rahmen, grade, ziel) {
      const overlay = document.createElement("div");
      overlay.className = "slot";
      overlay.innerHTML =
        '<div class="slot-kasten">' +
          '<p class="slot-titel">Schwierigkeit wird ausgelost …</p>' +
          '<div class="slot-fenster"><div class="slot-walze"></div></div>' +
        "</div>";
      const walze = overlay.querySelector(".slot-walze");
      const titel = overlay.querySelector(".slot-titel");
      rahmen.appendChild(overlay);

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
        titel.textContent = "Ausgelost: " + ziel.name;
        overlay.classList.add("ist-fertig");
      };

      if (ohneBewegung()) {
        fertigText();
        return new Promise(function (ok) { setTimeout(ok, 700); }).then(function () { overlay.remove(); });
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
        return warte(DAUER.walzePause);
      }).then(function () {
        overlay.remove();
      });
    }

    /**
     * Niederlage-Bildschirm: zeigt, wie weit man gekommen ist.
     * @returns {Promise} – erfüllt, wenn "Erneut antreten" gedrückt wurde
     */
    function niederlage(rahmen, e) {
      return einreihen(function () {
        meldung("Niederlage gegen " + e.boss.name + " …");
        zeigeHerzen(0, anzeige.maxFehler);
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
            e.schadenGemacht + " von " + e.boss.maxHp + " HP geschafft.";
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
      zeigeWurf: zeigeWurf,
      treffer: treffer,
      fehler: fehler,
      sieg: sieg,
      neuerBoss: neuerBoss,
      text: text,
      fertig: fertig,
      losen: losen,
      niederlage: niederlage,
    };
  }

  return {
    erstelle: erstelle,
  };
})();
