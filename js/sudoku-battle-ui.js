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

  /* ------------------------------------------------------------------------
     SYMBOLE als kleine Pixel-SVGs (harte Kanten). Werden im Kampffenster
     UND auf den Power-up-Feldern im Gitter benutzt (sudoku-ui.js).
     Neuer Power-up-Typ mit neuem Symbol? Hier ein weiteres Symbol ergänzen
     und in SUDOKU_RPG_KONFIG.powerupTypen den Namen eintragen.
     ------------------------------------------------------------------------ */
  const SYMBOLE = {
    herz: '<path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/>',
    muenze: '<path d="M2 0h3v1h1v1h1v3H6v1H5v1H2V6H1V5H0V2h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M3 2h1v3H3z"/>',
    tropfen: '<path d="M3 0h1v1h1v2h1v3H5v1H2V6H1V3h1V1h1z"/><path fill="rgba(255,255,255,.55)" d="M2 4h1v1H2z"/>',
    stern: '<path d="M3 0h1v2h3v1H6v1h1v3H6V6H5V5H2v1H1v1H0V4h1V3H0V2h3z"/>',
    blitz: '<path d="M3 0h3v2H5v1h2v1H6v1H5v1H4v1H3V5h1V4H1V3h1V2h1z"/>',
  };

  /** Ein Symbol als fertiges SVG (Farbe kommt über CSS: fill). */
  function symbolSvg(name) {
    return '<svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges">' +
      (SYMBOLE[name] || SYMBOLE.stern) + "</svg>";
  }

  // Das Herz für die Lebensanzeige
  const HERZ_SVG = symbolSvg("herz");


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
            '<div class="kampf-info-zeile">' +
              // Münzstand mit Münzsymbol
              '<div class="kampf-muenzen" role="img">' + symbolSvg("muenze") +
                '<span class="kampf-muenzen-zahl">0</span></div>' +
              '<div class="kampf-wuerfel" role="img"><span class="kampf-wuerfel-zahl">–</span></div>' +
            "</div>" +
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
      buehne: container.querySelector(".kampf-buehne"),
      muenzen: container.querySelector(".kampf-muenzen"),
      muenzenZahl: container.querySelector(".kampf-muenzen-zahl"),
      text: container.querySelector(".kampf-text"),
      rekord: container.querySelector(".kampf-rekord"),
    };

    SudokuSprites.zeichne(el.heldCanvas, "held", 0);

    container.querySelector(".kampf-reset").addEventListener("click", function () {
      if (optionen && optionen.beimZuruecksetzen) optionen.beimZuruecksetzen();
    });

    // Was gerade ANGEZEIGT wird (kann wegen der Warteschlange kurz hinter
    // dem echten Spielstand liegen)
    const anzeige = { bossNummer: 0, muenzen: 0 };
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
    function zeigeHerzen(leben) {
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
      el.herzen.setAttribute("aria-label", leben + (leben === 1 ? " Leben" : " Leben") + " (höchstens " + K.maxLeben + ")");
    }

    /**
     * Münzstand. animiert = true: Der Zähler zählt in kleinen Schritten hoch.
     */
    function zeigeMuenzen(ziel, animiert) {
      const start = anzeige.muenzen;
      anzeige.muenzen = ziel;
      el.muenzen.setAttribute("aria-label", ziel + " Münzen");
      if (!animiert || ohneBewegung() || ziel <= start) {
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
     * Aufsteigende Zahl: Schaden über dem Boss, Gift, Münzen am Münzzähler.
     * Bei "Bewegung reduzieren" erscheint sie nur kurz an Ort und Stelle.
     * @param {string} ziel – "boss", "doppelt", "gift" oder "muenzen"
     */
    function schwebeZahl(text, ziel) {
      const zahl = document.createElement("span");
      zahl.className = "kampf-schwebezahl kampf-schwebezahl--" + ziel;
      zahl.textContent = text;
      el.effekte.appendChild(zahl);
      setTimeout(function () { zahl.remove(); }, 900);
    }


    /* ---------- Öffentliche Schritte (laufen über die Warteschlange) ---------- */

    /**
     * Zeigt einen Stand SOFORT (ohne Animation) – z. B. nach dem Laden.
     * @param {object} stand – { boss, hp, leben, muenzen, rekord }
     */
    function zeigeStand(stand) {
      return einreihen(function () {
        zeigeBoss(stand.boss);
        zeigeHp(stand.hp, stand.boss.maxHp);
        zeigeHerzen(stand.leben);
        zeigeMuenzen(stand.muenzen, false);
        zeigeRekord(stand.boss, stand.rekord);
        el.bossFigur.classList.remove("ist-besiegt");
      });
    }

    /** Fasst in einem Satz zusammen, was eine richtige Zahl bewirkt hat. */
    function trefferText(e) {
      const teile = [];
      teile.push(e.doppelt
        ? "Doppelter Schaden! Wurf " + e.wurf + " × " + K.doppelschadenFaktor + " = " + e.schaden + "."
        : "Treffer! Wurf " + e.wurf + " – " + e.schaden + " Schaden.");
      if (e.gift > 0) teile.push("Gift: " + e.gift + " extra.");
      if (e.powerup && e.lebenGewuenscht > 0) {
        teile.push(e.lebenPlus > 0 ? "+" + e.lebenPlus + " Leben!" : "Leben schon voll (" + K.maxLeben + ").");
      }
      if (e.powerup && e.powerup.typ === "gold") teile.push("Goldfeld!");
      teile.push("+" + e.muenzenPlus + (e.muenzenPlus === 1 ? " Münze." : " Münzen."));
      return teile.join(" ");
    }

    /**
     * Richtige Zahl: würfeln, zuschlagen, Schaden (ggf. doppelt), Gift,
     * Münzen, Leben – kurz nacheinander.
     */
    function treffer(e) {
      return einreihen(function () {
        zeigeBoss(e.boss);
        // 1. Würfel rollt
        let wuerfeln = Promise.resolve();
        if (!ohneBewegung()) {
          el.wuerfel.classList.add("rollt");
          const zufallsAnzeige = setInterval(function () {
            el.wuerfelZahl.textContent = 1 + Math.floor(Math.random() * K.wuerfelSeiten);
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
          // 3. Der Treffer: Schadenszahl, Boss blinkt, HP sinken.
          //    Doppelschaden: größere Zahl in eigener Farbe, Fenster wackelt,
          //    Boss blitzt stärker auf.
          meldung(trefferText(e));
          schwebeZahl("−" + e.schaden, e.doppelt ? "doppelt" : "boss");
          zeigeHp(e.hpNachSchaden, e.boss.maxHp);
          if (e.doppelt) {
            animiere(el.buehne, "wackelt", 360);
            return animiere(el.bossFigur, "getroffen-stark", DAUER.treffer);
          }
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
            zeigeHerzen(e.leben);
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

    /** Falsche Zahl: Boss greift an, ein Leben (Herz) geht verloren. */
    function fehler(e) {
      return einreihen(function () {
        const rest = e.leben;
        meldung(e.boss.name + " greift an! Falsche Zahl – " +
          (rest === 0 ? "keine Leben mehr." : "noch " + rest + (rest === 1 ? " Leben." : " Leben.")));
        const angriff = animiere(el.bossFigur, "greift-an", DAUER.angriff);
        return warte(DAUER.angriff / 2).then(function () {
          zeigeHerzen(rest);
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

    /** Der nächste Boss erscheint (volle HP, Leben aufgefüllt). */
    function neuerBoss(e, rekord) {
      return einreihen(function () {
        el.bossFigur.classList.remove("ist-besiegt");
        zeigeBoss(e.boss);
        zeigeHp(e.hp, e.boss.maxHp);
        zeigeHerzen(e.leben);
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
      zeigeMuenzen: zeigeMuenzen,
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
    symbolSvg: symbolSvg,
  };
})();
