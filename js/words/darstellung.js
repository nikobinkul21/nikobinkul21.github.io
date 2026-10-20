/* ==========================================================================
   words/darstellung.js – Oberfläche des Worträtsels (#games/words)
   Oben: Sprache (Deutsch/Englisch), Streak und Rekord, Statistik,
         Farbenblind-Modus. Darunter das Spielfeld (6 Zeilen à 5 Felder)
         und die Bildschirmtastatur (QWERTZ bzw. QWERTY).
   Eingabe: echte Tastatur (Buchstaben inkl. Ä, Ö, Ü, Enter, Rücktaste)
            oder Bildschirmtastatur.
   Die Wortlisten werden erst beim ersten Öffnen geladen (per <script>,
   das klappt auch beim Öffnen per Doppelklick ohne Server).
   Regeln: js/words/regeln.js – Werte: js/words/konfig.js – Aussehen:
   css/words.css. Animationen: CSS-Klassen, Zeiten aus der Konfiguration.
   ========================================================================== */

/**
 * Startet das Worträtsel. Wird von games.js beim ersten Öffnen aufgerufen.
 * @param {HTMLElement} container – Inhaltsbereich des Spiels
 * @returns {{zeige: function}} – zeige() läuft bei jedem Öffnen
 */
function initWords(container) {
  const K = WoerterKonfig;
  const R = WoerterRegeln;
  const S = WoerterSpeicher;
  const Z = K.zeit;
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  let daten = S.laden();
  const listen = {};            // je Sprache: { loesungen: [...], erlaubt: Set } – nach dem Laden
  let eingabe = [];             // die Buchstaben der aktuellen Zeile
  let gesperrt = true;          // während Laden und Animationen: keine Eingabe
  let naechstesTimer = null;    // Sieg → nächstes Wort
  let meldungTimer = null;
  let laufNr = 0;               // erhöht sich bei jedem neuen Wort (alte Timer verfallen)

  /* ------------------------------------------------------------------------
     Gerüst
     ------------------------------------------------------------------------ */

  container.innerHTML =
    '<div class="wo">' +
      '<div class="wo-kopf">' +
        '<div class="wo-sprachen" role="group" aria-label="Sprache">' +
          Object.keys(K.sprachen).map(function (s) {
            return '<button type="button" class="wo-sprache" data-sprache="' + s + '" aria-pressed="false">' +
              '<span class="wo-sprache-lang">' + K.sprachen[s].name + '</span>' +
              '<span class="wo-sprache-kurz" aria-hidden="true">' + K.sprachen[s].kurz + "</span></button>";
          }).join("") +
        "</div>" +
        '<div class="wo-streak" aria-live="polite">' +
          '<span class="wo-streak-wert"><span class="wo-flamme" aria-hidden="true">🔥</span>' +
            '<strong class="wo-streak-zahl">0</strong><span class="wo-streak-name">Streak</span></span>' +
          '<span class="wo-rekord-wert"><span aria-hidden="true">🏆</span>' +
            '<strong class="wo-rekord-zahl">0</strong><span class="wo-streak-name">Rekord</span></span>' +
        "</div>" +
        '<div class="wo-werkzeuge">' +
          '<button type="button" class="wo-symbol" data-aktion="statistik" aria-label="Statistik" title="Statistik">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg></button>' +
          '<button type="button" class="wo-symbol" data-aktion="farben" aria-pressed="false" ' +
            'aria-label="Farbenblindenfreundliche Farben" title="Farbenblindenfreundliche Farben">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" class="wo-gefuellt"/></svg></button>' +
        "</div>" +
      "</div>" +
      // Meldung und Lösung (nach einer Niederlage) in derselben Zeile
      '<div class="wo-hinweis">' +
        '<p class="wo-meldung" role="status" aria-live="polite"></p>' +
        '<div class="wo-ende" hidden>' +
          '<p class="wo-ende-text" role="status"></p>' +
          '<button type="button" class="knopf knopf--haupt wo-weiter" data-aktion="weiter">Nächstes Wort</button>' +
        "</div>" +
      "</div>" +
      '<div class="wo-brett" aria-label="Spielfeld"></div>' +
      '<div class="wo-tastatur" aria-label="Bildschirmtastatur"></div>' +

      // Statistik
      '<dialog class="wo-dialog wo-statistik" aria-labelledby="wo-statistik-titel">' +
        '<h3 id="wo-statistik-titel">Statistik</h3>' +
        '<div class="wo-sprachen wo-stat-sprachen" role="group" aria-label="Sprache der Statistik">' +
          Object.keys(K.sprachen).map(function (s) {
            return '<button type="button" class="wo-sprache" data-stat-sprache="' + s + '" aria-pressed="false">' + K.sprachen[s].name + "</button>";
          }).join("") +
        "</div>" +
        '<dl class="wo-zahlen"></dl>' +
        '<h4 class="wo-vert-titel">Gewonnen im Versuch</h4>' +
        '<div class="wo-verteilung"></div>' +
        '<div class="wo-dialog-knoepfe"><button type="button" class="knopf" data-aktion="schliessen">Schließen</button></div>' +
      "</dialog>" +

      // Rückfrage beim Sprachwechsel
      '<dialog class="wo-dialog wo-frage" aria-labelledby="wo-frage-text">' +
        '<p id="wo-frage-text">' + K.texte.sprachWechsel + "</p>" +
        '<div class="wo-dialog-knoepfe">' +
          '<button type="button" class="knopf" data-aktion="abbrechen">Abbrechen</button>' +
          '<button type="button" class="knopf knopf--haupt" data-aktion="wechseln">Wechseln</button>' +
        "</div>" +
      "</dialog>" +
    "</div>";

  const el = {
    wurzel: container.querySelector(".wo"),
    sprachen: container.querySelectorAll(".wo-kopf .wo-sprache"),
    streak: container.querySelector(".wo-streak"),
    streakZahl: container.querySelector(".wo-streak-zahl"),
    rekordZahl: container.querySelector(".wo-rekord-zahl"),
    farben: container.querySelector('[data-aktion="farben"]'),
    meldung: container.querySelector(".wo-meldung"),
    brett: container.querySelector(".wo-brett"),
    ende: container.querySelector(".wo-ende"),
    endeText: container.querySelector(".wo-ende-text"),
    tastatur: container.querySelector(".wo-tastatur"),
    statistik: container.querySelector(".wo-statistik"),
    frage: container.querySelector(".wo-frage"),
  };

  // Zeiten aus der Konfiguration an das CSS weitergeben
  [["--wo-ploppen", Z.ploppen], ["--wo-drehen", Z.drehen], ["--wo-dreh-versatz", Z.drehVersatz],
    ["--wo-huepfen", Z.huepfen], ["--wo-huepf-versatz", Z.huepfVersatz], ["--wo-schuetteln", Z.schuetteln],
    ["--wo-rekord", Z.rekord], ["--wo-ruhig", Z.ruhig]].forEach(function (p) {
    el.wurzel.style.setProperty(p[0], p[1] + "ms");
  });

  // Spielfeld: 6 Zeilen à 5 Felder
  const zeilen = [];
  for (let z = 0; z < K.versuche; z++) {
    const zeile = document.createElement("div");
    zeile.className = "wo-zeile";
    zeile.setAttribute("role", "group");
    zeile.setAttribute("aria-label", "Versuch " + (z + 1));
    const felder = [];
    for (let i = 0; i < K.laenge; i++) {
      const feld = document.createElement("div");
      feld.className = "wo-feld";
      feld.style.setProperty("--i", i);
      zeile.appendChild(feld);
      felder.push(feld);
    }
    el.brett.appendChild(zeile);
    zeilen.push({ el: zeile, felder: felder });
  }


  /* ------------------------------------------------------------------------
     Wortlisten laden (einmal je Sprache)
     ------------------------------------------------------------------------ */

  function ladeSkript(pfad) {
    return new Promise(function (fertig, fehler) {
      const s = document.createElement("script");
      s.src = pfad;
      s.onload = fertig;
      s.onerror = function () { fehler(new Error(pfad)); };
      document.head.appendChild(s);
    });
  }

  const ladeVorgaenge = {};
  function ladeListen(sprache) {
    if (!ladeVorgaenge[sprache]) {
      const d = K.sprachen[sprache].dateien;
      ladeVorgaenge[sprache] = Promise.all([ladeSkript(d.loesungen), ladeSkript(d.erlaubt)]).then(function () {
        const quelle = window.WOERTER_LISTEN || {};
        const loesungen = R.listeAus(quelle[sprache + "-loesungen"] || "");
        const erlaubt = new Set(R.listeAus(quelle[sprache + "-erlaubt"] || ""));
        loesungen.forEach(function (w) { erlaubt.add(w); });
        if (!loesungen.length) throw new Error("leer");
        listen[sprache] = { loesungen: loesungen, erlaubt: erlaubt };
      }).catch(function (f) {
        delete ladeVorgaenge[sprache];          // nächster Versuch lädt neu
        throw f;
      });
    }
    return ladeVorgaenge[sprache];
  }


  /* ------------------------------------------------------------------------
     Ablauf
     ------------------------------------------------------------------------ */

  /** Bereitet die gewählte Sprache vor: Listen laden, Wort fortsetzen oder neu ziehen. */
  function starte() {
    const sprache = daten.sprache;
    gesperrt = true;
    zeigeKopf();
    if (!listen[sprache]) zeigeMeldung(K.texte.laden, true);
    return ladeListen(sprache).then(function () {
      if (daten.sprache !== sprache) return;   // inzwischen gewechselt
      const l = daten.laufend;
      // Fortsetzen, wenn das Wort zur Sprache gehört und nicht gewonnen ist
      // (nach einem Sieg kommt sowieso sofort das nächste)
      if (!l || l.sprache !== sprache || l.ende === "gewonnen" || listen[sprache].loesungen.indexOf(l.loesung) === -1) {
        R.neuesWort(daten, listen[sprache].loesungen);
        S.speichern(daten);
      }
      eingabe = [];
      laufNr++;
      zeigeMeldung("");
      zeichneAlles();
      // Eingabe frei – auch bei einem verlorenen Wort (Enter = nächstes Wort);
      // Buchstaben nimmt ein beendetes Wort ohnehin nicht mehr an
      gesperrt = false;
    }, function () {
      zeigeMeldung(K.texte.ladeFehler, true);
    });
  }

  /** Nächstes Wort nach Sieg oder Niederlage. */
  function naechstesWort() {
    clearTimeout(naechstesTimer);
    R.neuesWort(daten, listen[daten.sprache].loesungen);
    S.speichern(daten);
    eingabe = [];
    laufNr++;
    zeigeMeldung("");
    zeichneAlles();
    if (!ruhig()) {
      el.brett.classList.remove("ist-neu");
      void el.brett.offsetWidth;
      el.brett.classList.add("ist-neu");
    }
    gesperrt = false;
  }

  function buchstabe(b) {
    const l = daten.laufend;
    if (gesperrt || !l || l.ende || eingabe.length >= K.laenge) return;
    eingabe.push(b);
    const feld = zeilen[l.versuche.length].felder[eingabe.length - 1];
    zeichneEingabe();
    if (!ruhig()) neuStarten(feld, "ploppt");
  }

  function loeschen() {
    const l = daten.laufend;
    if (gesperrt || !l || l.ende || !eingabe.length) return;
    eingabe.pop();
    zeichneEingabe();
  }

  function absenden() {
    const l = daten.laufend;
    if (gesperrt || !l) return;
    if (l.ende === "verloren") { naechstesWort(); return; }
    if (l.ende) return;
    const zeile = zeilen[l.versuche.length];
    if (eingabe.length < K.laenge) {
      zeigeMeldung(K.texte.zuKurz);
      schuettle(zeile);
      return;
    }
    const r = R.rate(daten, eingabe.join(""), listen[l.sprache].erlaubt);
    if (!r.ok) {
      if (r.grund === "ungueltig" || r.grund === "zuKurz") {
        zeigeMeldung(r.grund === "ungueltig" ? K.texte.ungueltig : K.texte.zuKurz);
        schuettle(zeile);
      }
      return;
    }
    S.speichern(daten);                 // sofort sichern – auch wenn gleich neu geladen wird
    eingabe = [];
    gesperrt = true;
    const nr = laufNr;
    deckeAuf(zeile, l.versuche[l.versuche.length - 1], r.farben).then(function () {
      if (nr !== laufNr) return;
      zeichneTastatur();
      zeigeKopf();
      if (r.ende === "gewonnen") gewonnen(zeile, r, nr);
      else if (r.ende === "verloren") verloren();
      else gesperrt = false;
    });
  }

  function gewonnen(zeile, r, nr) {
    zeigeMeldung(K.texte.gewonnen[r.nummer - 1] || K.texte.gewonnen[K.texte.gewonnen.length - 1]);
    if (!ruhig()) zeile.felder.forEach(function (f) { neuStarten(f, "huepft"); });
    let warten = ruhig() ? Z.naechstesWort : Z.naechstesWort + Z.huepfVersatz * K.laenge;
    if (r.neuerRekord) {
      feiereRekord(r.bester);
      warten = Math.max(warten, Z.rekord);
    }
    naechstesTimer = setTimeout(function () {
      if (nr === laufNr) naechstesWort();
    }, warten);
  }

  function verloren() {
    zeigeMeldung("");
    el.endeText.innerHTML = "";
    el.endeText.append(K.texte.verloren + ": ");
    const wort = document.createElement("strong");
    wort.textContent = daten.laufend.loesung.toUpperCase();
    el.endeText.append(wort);
    el.ende.hidden = false;
    gesperrt = false;                   // Enter = nächstes Wort
  }

  function feiereRekord(bester) {
    zeigeMeldung(K.texte.rekord + ": " + bester + "!", false, Z.rekord);
    neuStarten(el.streak, "feiert");
    setTimeout(function () { el.streak.classList.remove("feiert"); }, Z.rekord);
  }


  /* ------------------------------------------------------------------------
     Sprache und Optionen
     ------------------------------------------------------------------------ */

  function sprachKlick(sprache) {
    if (sprache === daten.sprache) return;
    if (R.istAngefangen(daten)) {
      el.frage.dataset.ziel = sprache;
      el.frage.showModal();
      return;
    }
    wechsle(sprache);
  }

  function wechsle(sprache) {
    clearTimeout(naechstesTimer);
    laufNr++;
    R.wechsleSprache(daten, sprache);
    S.speichern(daten);
    eingabe = [];
    el.ende.hidden = true;
    leereBrett();
    starte();
  }

  function setzeFarbenblind(an) {
    daten.farbenblind = an;
    S.speichern(daten);
    zeigeKopf();
  }


  /* ------------------------------------------------------------------------
     Zeichnen
     ------------------------------------------------------------------------ */

  function zeigeKopf() {
    el.sprachen.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.sprache === daten.sprache));
    });
    const st = daten.stats[daten.sprache];
    el.streakZahl.textContent = st.streak;
    el.rekordZahl.textContent = st.bester;
    el.streak.setAttribute("aria-label", "Streak " + st.streak + ", Rekord " + st.bester + " (" + K.sprachen[daten.sprache].name + ")");
    el.wurzel.classList.toggle("wo--farbenblind", daten.farbenblind);
    el.farben.setAttribute("aria-pressed", String(daten.farbenblind));
    el.wurzel.dataset.aktiveSprache = daten.sprache;
  }

  function leereBrett() {
    zeilen.forEach(function (z) {
      z.el.classList.remove("schuettelt");
      z.felder.forEach(function (f) {
        f.textContent = "";
        f.className = "wo-feld";
        delete f.dataset.status;
        f.removeAttribute("aria-label");
      });
    });
  }

  /** Alles neu: Brett (ohne Animation), Tastatur, Kopf, Ende-Hinweis. */
  function zeichneAlles() {
    leereBrett();
    const l = daten.laufend;
    l.versuche.forEach(function (wort, z) {
      const farben = R.bewerte(wort, l.loesung);
      R.zeichen(wort).forEach(function (b, i) {
        setzeFeld(zeilen[z].felder[i], b, farben[i]);
      });
    });
    zeichneEingabe();
    zeichneTastatur();
    zeigeKopf();
    if (l.ende === "verloren") verloren();
    else el.ende.hidden = true;
  }

  const STATUS_NAME = { richtig: "richtig", vorhanden: "an anderer Stelle", fehlt: "nicht im Wort" };

  function setzeFeld(feld, b, status) {
    feld.textContent = b.toUpperCase();
    feld.classList.add("ist-voll");
    if (status) {
      feld.dataset.status = status;
      feld.setAttribute("aria-label", b.toUpperCase() + ", " + STATUS_NAME[status]);
    }
  }

  /** Die aktuelle Eingabezeile. */
  function zeichneEingabe() {
    const l = daten.laufend;
    if (!l || l.ende || l.versuche.length >= K.versuche) return;
    zeilen[l.versuche.length].felder.forEach(function (f, i) {
      f.textContent = eingabe[i] ? eingabe[i].toUpperCase() : "";
      f.classList.toggle("ist-voll", Boolean(eingabe[i]));
    });
  }

  /** Bildschirmtastatur der Sprache; Tasten zeigen das beste bisherige Ergebnis. */
  function zeichneTastatur() {
    const sprache = daten.sprache;
    if (el.tastatur.dataset.layout !== sprache) {
      el.tastatur.textContent = "";
      K.sprachen[sprache].tastatur.forEach(function (reihe) {
        const r = document.createElement("div");
        r.className = "wo-tasten-reihe";
        reihe.forEach(function (t) {
          const knopf = document.createElement("button");
          knopf.type = "button";
          knopf.className = "wo-taste";
          knopf.dataset.taste = t;
          if (t === "enter") {
            knopf.classList.add("wo-taste--breit");
            knopf.textContent = "Enter";
            knopf.setAttribute("aria-label", "Absenden");
          } else if (t === "zurueck") {
            knopf.classList.add("wo-taste--breit");
            knopf.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 6H9l-6 6 6 6h12zM17 9.5l-5 5M12 9.5l5 5"/></svg>';
            knopf.setAttribute("aria-label", "Löschen");
          } else {
            knopf.textContent = t.toUpperCase();
          }
          r.appendChild(knopf);
        });
        el.tastatur.appendChild(r);
      });
      el.tastatur.dataset.layout = sprache;
    }
    const l = daten.laufend;
    const stand = l ? R.tastenStand(l.versuche, l.loesung) : {};
    el.tastatur.querySelectorAll(".wo-taste").forEach(function (k) {
      const s = stand[k.dataset.taste];
      if (s) k.dataset.status = s;
      else delete k.dataset.status;
    });
  }

  /**
   * Felder drehen sich nacheinander um und zeigen ihre Farbe.
   * Die Farbe wechselt im CSS genau in der Mitte der Drehung.
   * @returns {Promise} – erfüllt, wenn das letzte Feld fertig ist
   */
  function deckeAuf(zeile, wort, farben) {
    R.zeichen(wort).forEach(function (b, i) {
      const f = zeile.felder[i];
      f.classList.remove("ploppt");
      setzeFeld(f, b, farben[i]);
      neuStarten(f, "dreht");
    });
    const dauer = ruhig() ? Z.ruhig : Z.drehen + Z.drehVersatz * (K.laenge - 1);
    return new Promise(function (fertig) {
      setTimeout(function () {
        zeile.felder.forEach(function (f) { f.classList.remove("dreht"); });
        fertig();
      }, dauer + 30);
    });
  }

  function schuettle(zeile) {
    if (ruhig()) return;
    neuStarten(zeile.el, "schuettelt");
  }

  /** Startet eine CSS-Animation (Klasse) neu, auch wenn sie gerade lief. */
  function neuStarten(element, klasse) {
    element.classList.remove(klasse);
    void element.offsetWidth;
    element.classList.add(klasse);
  }

  function ruhig() {
    return ruhigAbfrage.matches;
  }

  /**
   * Kurze Meldung über dem Spielfeld.
   * @param {boolean} [bleibt] – true: bleibt stehen, bis eine neue kommt
   */
  function zeigeMeldung(text, bleibt, dauer) {
    clearTimeout(meldungTimer);
    el.meldung.textContent = text;
    el.meldung.classList.toggle("ist-sichtbar", Boolean(text));
    if (text && !bleibt) {
      meldungTimer = setTimeout(function () {
        el.meldung.classList.remove("ist-sichtbar");
      }, dauer || Z.meldung);
    }
  }


  /* ------------------------------------------------------------------------
     Statistik
     ------------------------------------------------------------------------ */

  function zeigeStatistik(sprache) {
    el.statistik.dataset.sprache = sprache;
    el.statistik.querySelectorAll("[data-stat-sprache]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.statSprache === sprache));
    });
    const s = R.statistik(daten, sprache);
    const zahlen = el.statistik.querySelector(".wo-zahlen");
    zahlen.innerHTML = "";
    [[s.gespielt, "Gespielt"], [s.quote + " %", "Gewonnen"], [s.streak, "Streak"], [s.bester, "Bester Streak"]].forEach(function (z) {
      const block = document.createElement("div");
      const dd = document.createElement("dd");
      dd.textContent = z[0];
      const dt = document.createElement("dt");
      dt.textContent = z[1];
      block.append(dd, dt);
      zahlen.appendChild(block);
    });
    const max = Math.max.apply(null, s.verteilung.concat([1]));
    const l = daten.laufend;
    const markiert = l && l.sprache === sprache && l.ende === "gewonnen" ? l.versuche.length : 0;
    const vert = el.statistik.querySelector(".wo-verteilung");
    vert.innerHTML = "";
    s.verteilung.forEach(function (anzahl, i) {
      const zeile = document.createElement("div");
      zeile.className = "wo-vert-zeile";
      const nr = document.createElement("span");
      nr.className = "wo-vert-nr";
      nr.textContent = i + 1;
      const balken = document.createElement("span");
      balken.className = "wo-vert-balken" + (markiert === i + 1 ? " ist-zuletzt" : "");
      balken.style.setProperty("--anteil", anzahl / max);
      balken.textContent = anzahl;
      zeile.setAttribute("aria-label", "Im " + (i + 1) + ". Versuch: " + anzahl + "-mal");
      zeile.append(nr, balken);
      vert.appendChild(zeile);
    });
    if (!el.statistik.open) el.statistik.showModal();
  }


  /* ------------------------------------------------------------------------
     Bedienung
     ------------------------------------------------------------------------ */

  el.tastatur.addEventListener("click", function (event) {
    const k = event.target.closest(".wo-taste");
    if (!k) return;
    const t = k.dataset.taste;
    if (t === "enter") absenden();
    else if (t === "zurueck") loeschen();
    else buchstabe(t);
  });

  // Tasten der Bildschirmtastatur nehmen beim Antippen nicht den Fokus –
  // sonst würde ein späteres Enter auf der echten Tastatur die zuletzt
  // angetippte Taste noch einmal drücken
  el.tastatur.addEventListener("mousedown", function (event) {
    if (event.target.closest(".wo-taste")) event.preventDefault();
  });

  el.wurzel.addEventListener("click", function (event) {
    const knopf = event.target.closest("button");
    if (!knopf) return;
    // Nach einem Mausklick gibt der Knopf den Fokus wieder ab – sonst würde
    // das nächste Enter (Wort absenden) diesen Knopf noch einmal drücken.
    // Mit der Tastatur (event.detail = 0) bleibt der Fokus, wo er ist.
    if (event.detail > 0 && !knopf.closest("dialog")) knopf.blur();
    if (knopf.dataset.sprache) sprachKlick(knopf.dataset.sprache);
    else if (knopf.dataset.statSprache) zeigeStatistik(knopf.dataset.statSprache);
    else if (knopf.dataset.aktion === "statistik") zeigeStatistik(daten.sprache);
    else if (knopf.dataset.aktion === "farben") setzeFarbenblind(!daten.farbenblind);
    else if (knopf.dataset.aktion === "weiter") naechstesWort();
    else if (knopf.dataset.aktion === "schliessen") el.statistik.close();
    else if (knopf.dataset.aktion === "abbrechen") el.frage.close();
    else if (knopf.dataset.aktion === "wechseln") {
      el.frage.close();
      wechsle(el.frage.dataset.ziel);
    }
  });

  // Klick auf den abgedunkelten Rand schließt die Statistik
  el.statistik.addEventListener("click", function (event) {
    if (event.target === el.statistik) el.statistik.close();
  });

  /** Ist das Spiel gerade sichtbar (und kein Dialog offen)? */
  function aktiv() {
    return container.offsetParent !== null && !el.statistik.open && !el.frage.open &&
      !document.documentElement.classList.contains("im-seitenwechsel");
  }

  document.addEventListener("keydown", function (event) {
    if (!aktiv() || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    const ziel = event.target;
    if (ziel.closest && ziel.closest("input, textarea, select, [contenteditable]")) return;
    const taste = event.key;
    if (taste === "Enter") {
      // Enter auf einem anderen Knopf (z. B. Sprache) gehört diesem Knopf
      if (ziel.closest && ziel.closest("button, a") && !ziel.closest(".wo-taste, .wo-weiter")) return;
      event.preventDefault();
      absenden();
    } else if (taste === "Backspace") {
      event.preventDefault();
      loeschen();
    } else if (taste && R.zeichen(taste).length === 1) {
      const b = R.normalisiere(taste);
      if (K.sprachen[daten.sprache].buchstaben.indexOf(b) !== -1) {
        event.preventDefault();
        buchstabe(b);
      }
    }
  });


  /* ------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------ */

  zeigeKopf();

  return {
    /** Bei jedem Öffnen: Stand neu lesen (z. B. nach einem Import) und weiterspielen. */
    zeige: function () {
      if (gesperrt && daten.laufend && !daten.laufend.ende && listen[daten.sprache]) return;   // Animation läuft
      clearTimeout(naechstesTimer);
      daten = S.laden();
      starte();
    },
  };
}
