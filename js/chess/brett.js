/* ==========================================================================
   chess/brett.js – das Schachbrett
   Ein eigenes Brett aus 64 Schaltflächen (so ist jedes Feld auch per
   Tastatur erreichbar), darüber eine SVG-Ebene für Pfeile.
   - Ziehen per Klick (Startfeld, dann Zielfeld) und per Drag-and-drop
     (Maus, Finger, Stift – über Pointer Events)
   - mögliche Züge als dezente Punkte, letzter Zug und Schach hervorgehoben
   - Bauernumwandlung mit Auswahl der Figur
   - Pfeile (Claudys Tipps) und eine Markierung für ein einzelnes Feld
   Das Brett kennt keine Regeln: Welche Züge erlaubt sind, fragt es über
   zielFelder(feld) ab; einen gewählten Zug meldet es über beimZug(von, nach).
   Figuren: js/chess/figuren/ (CC BY-SA 3.0, siehe LIZENZ.md dort).
   Aussehen: css/chess.css.
   ========================================================================== */

/**
 * @param {HTMLElement} wurzel – hier hinein wird das Brett gebaut
 * @param {object} rueckruf
 * @param {function(string): string[]} rueckruf.zielFelder – erlaubte Zielfelder einer Figur
 * @param {function(string, string)} rueckruf.beimZug – der Spieler will von → nach ziehen
 * @returns {object} Steuerung: zeige(), pfeile(), markiere(), frageUmwandlung()
 */
function SchachBrett(wurzel, rueckruf) {
  const K = SchachKonfig;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SPALTEN = "abcdefgh";
  const FIGUR_NAME = { p: "Bauer", n: "Springer", b: "Läufer", r: "Turm", q: "Dame", k: "König" };
  const ZIEH_SCHWELLE = 6;       // erst ab so vielen Pixeln Bewegung gilt es als Ziehen

  let zustand = { figuren: {}, gedreht: false, letzter: null, schach: null, bedienbar: false, farbe: "w" };
  let gewaehlt = null;           // gewähltes Startfeld
  let ziele = [];                // erlaubte Zielfelder der gewählten Figur
  let ziehen = null;             // laufendes Ziehen: { feld, x, y, bild, aktiv }
  let klickSchlucken = false;    // nach einem Ziehen folgt ein click – der zählt nicht
  const felder = {};             // Feldname → <button>

  wurzel.classList.add("sch-brett");
  const raster = document.createElement("div");
  raster.className = "sch-felder";
  const ebene = document.createElementNS(SVG_NS, "svg");
  ebene.setAttribute("class", "sch-pfeile");
  ebene.setAttribute("viewBox", "0 0 8 8");
  ebene.setAttribute("aria-hidden", "true");
  const auswahl = document.createElement("div");
  auswahl.className = "sch-umwandlung";
  auswahl.hidden = true;
  wurzel.appendChild(raster);
  wurzel.appendChild(ebene);
  wurzel.appendChild(auswahl);

  /** Spalte und Reihe eines Felds auf dem Bildschirm (0–7, von links oben). */
  function platz(feld) {
    const s = SPALTEN.indexOf(feld[0]), r = Number(feld[1]) - 1;
    return zustand.gedreht ? { x: 7 - s, y: r } : { x: s, y: 7 - r };
  }

  /** Das Feld unter einem Punkt des Bildschirms – oder null außerhalb des Bretts. */
  function feldBei(clientX, clientY) {
    const r = raster.getBoundingClientRect();
    const x = Math.floor((clientX - r.left) / (r.width / 8)), y = Math.floor((clientY - r.top) / (r.height / 8));
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return zustand.gedreht ? SPALTEN[7 - x] + (y + 1) : SPALTEN[x] + (8 - y);
  }

  /* ---------- Zeichnen ---------- */

  function baueFelder() {
    raster.textContent = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const feld = zustand.gedreht ? SPALTEN[7 - x] + (y + 1) : SPALTEN[x] + (8 - y);
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "sch-feld " + ((SPALTEN.indexOf(feld[0]) + Number(feld[1])) % 2 ? "ist-hell" : "ist-dunkel");
        knopf.dataset.feld = feld;
        // Koordinaten am Rand: Buchstaben unten, Zahlen links
        if (y === 7) knopf.dataset.spalte = feld[0];
        if (x === 0) knopf.dataset.reihe = feld[1];
        felder[feld] = knopf;
        raster.appendChild(knopf);
      }
    }
  }

  function zeichne() {
    Object.keys(felder).forEach(function (feld) {
      const knopf = felder[feld];
      const figur = zustand.figuren[feld];
      knopf.textContent = "";
      if (figur) {
        const bild = document.createElement("img");
        bild.className = "sch-figur";
        bild.src = K.figurenPfad + figur.color + figur.type + ".svg";
        bild.alt = "";
        bild.draggable = false;
        knopf.appendChild(bild);
      }
      knopf.setAttribute("aria-label", feld + (figur ? ", " + (figur.color === "w" ? "weiß: " : "schwarz: ") + FIGUR_NAME[figur.type] : ", leer"));
      knopf.classList.toggle("ist-letzter", Boolean(zustand.letzter) && zustand.letzter.indexOf(feld) >= 0);
      knopf.classList.toggle("ist-schach", zustand.schach === feld);
      knopf.classList.toggle("ist-gewaehlt", gewaehlt === feld);
      knopf.classList.toggle("ist-ziel", ziele.indexOf(feld) >= 0);
      knopf.classList.toggle("hat-figur", Boolean(figur));
    });
    wurzel.classList.toggle("ist-bedienbar", zustand.bedienbar);
  }

  /**
   * Zeigt eine Stellung.
   * @param {object} neu
   * @param {object} neu.figuren – Feldname → { type, color }
   * @param {boolean} neu.gedreht – Schwarz unten
   * @param {string[]|null} neu.letzter – [von, nach] des letzten Zugs
   * @param {string|null} neu.schach – Feld des Königs, der im Schach steht
   * @param {boolean} neu.bedienbar – darf der Spieler ziehen?
   * @param {string} neu.farbe – Farbe des Spielers ("w" oder "b")
   */
  function zeige(neu) {
    const drehen = neu.gedreht !== zustand.gedreht || !raster.firstChild;
    zustand = neu;
    gewaehlt = null;
    ziele = [];
    beendeZiehen();
    if (drehen) baueFelder();
    zeichne();
  }

  /* ---------- Pfeile und Markierung ---------- */

  /**
   * Zeichnet Pfeile (ersetzt die bisherigen).
   * @param {Array<{von: string, nach: string, art?: string}>} liste – art: "haupt" (kräftig) oder "neben"
   */
  function pfeile(liste) {
    ebene.textContent = "";
    (liste || []).forEach(function (p) {
      const a = platz(p.von), b = platz(p.nach);
      const x1 = a.x + 0.5, y1 = a.y + 0.5, x2 = b.x + 0.5, y2 = b.y + 0.5;
      const laenge = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ex = (x2 - x1) / laenge, ey = (y2 - y1) / laenge;       // Richtung
      const spitze = 0.34, breite = 0.2;
      // Schaft endet vor der Spitze; die Spitze ist ein Dreieck
      const sx = x2 - ex * spitze, sy = y2 - ey * spitze;
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "sch-pfeil" + (p.art === "neben" ? " ist-neben" : ""));
      const linie = document.createElementNS(SVG_NS, "line");
      linie.setAttribute("x1", x1 + ex * 0.2);
      linie.setAttribute("y1", y1 + ey * 0.2);
      linie.setAttribute("x2", sx);
      linie.setAttribute("y2", sy);
      const dreieck = document.createElementNS(SVG_NS, "polygon");
      dreieck.setAttribute("points", [
        x2 - ex * 0.06, y2 - ey * 0.06,
        sx - ey * breite, sy + ex * breite,
        sx + ey * breite, sy - ex * breite,
      ].join(" "));
      g.appendChild(linie);
      g.appendChild(dreieck);
      ebene.appendChild(g);
    });
  }

  /** Markiert ein Feld mit einem Ring (Claudys "Schubs"); null entfernt die Markierung. */
  function markiere(feld) {
    Object.keys(felder).forEach(function (f) { felder[f].classList.toggle("ist-schubs", f === feld); });
  }

  /* ---------- Bedienung ---------- */

  function waehle(feld) {
    gewaehlt = feld;
    ziele = feld ? rueckruf.zielFelder(feld) : [];
    zeichne();
  }

  /** Ein Feld wurde angeklickt oder per Tastatur ausgelöst. */
  function beimFeld(feld) {
    if (!zustand.bedienbar) return;
    const figur = zustand.figuren[feld];
    if (gewaehlt && ziele.indexOf(feld) >= 0) {
      const von = gewaehlt;
      waehle(null);
      rueckruf.beimZug(von, feld);
    } else if (figur && figur.color === zustand.farbe && feld !== gewaehlt) {
      waehle(feld);
    } else {
      waehle(null);
    }
  }

  raster.addEventListener("click", function (ereignis) {
    if (klickSchlucken) {
      klickSchlucken = false;
      return;
    }
    const knopf = ereignis.target.closest(".sch-feld");
    if (knopf) beimFeld(knopf.dataset.feld);
  });

  // Ziehen: beginnt auf einer eigenen Figur, die Figur folgt dem Zeiger
  raster.addEventListener("pointerdown", function (ereignis) {
    if (!zustand.bedienbar || ereignis.button > 0) return;
    const feld = feldBei(ereignis.clientX, ereignis.clientY);
    const figur = feld && zustand.figuren[feld];
    if (!figur || figur.color !== zustand.farbe) return;
    klickSchlucken = false;
    ziehen = { feld: feld, x: ereignis.clientX, y: ereignis.clientY, bild: null, aktiv: false, zeiger: ereignis.pointerId };
  });

  raster.addEventListener("pointermove", function (ereignis) {
    if (!ziehen || ereignis.pointerId !== ziehen.zeiger) return;
    if (!ziehen.aktiv) {
      if (Math.hypot(ereignis.clientX - ziehen.x, ereignis.clientY - ziehen.y) < ZIEH_SCHWELLE) return;
      // Jetzt wird wirklich gezogen: Figur wählen und ein Abbild an den Zeiger hängen
      ziehen.aktiv = true;
      waehle(ziehen.feld);
      try { raster.setPointerCapture(ziehen.zeiger); } catch (fehler) { /* nicht schlimm */ }
      const original = felder[ziehen.feld].querySelector(".sch-figur");
      const groesse = felder[ziehen.feld].getBoundingClientRect().width;
      ziehen.bild = original.cloneNode();
      ziehen.bild.className = "sch-figur sch-zieh-bild";
      ziehen.bild.style.width = ziehen.bild.style.height = groesse + "px";
      document.body.appendChild(ziehen.bild);
      felder[ziehen.feld].classList.add("wird-gezogen");
    }
    ziehen.bild.style.transform = "translate(" + (ereignis.clientX - ziehen.bild.offsetWidth / 2) + "px, " +
      (ereignis.clientY - ziehen.bild.offsetHeight / 2) + "px)";
    const ueber = feldBei(ereignis.clientX, ereignis.clientY);
    Object.keys(felder).forEach(function (f) { felder[f].classList.toggle("ist-ueber", f === ueber && ziele.indexOf(f) >= 0); });
  });

  function beendeZiehen() {
    if (!ziehen) return;
    if (ziehen.bild) ziehen.bild.remove();
    Object.keys(felder).forEach(function (f) { felder[f].classList.remove("wird-gezogen", "ist-ueber"); });
    ziehen = null;
  }

  raster.addEventListener("pointerup", function (ereignis) {
    if (!ziehen || ereignis.pointerId !== ziehen.zeiger) return;
    const von = ziehen.feld, gezogen = ziehen.aktiv;
    beendeZiehen();
    if (!gezogen) return;                    // nur ein Klick – den behandelt das click-Ereignis
    klickSchlucken = true;
    setTimeout(function () { klickSchlucken = false; }, 0);
    const nach = feldBei(ereignis.clientX, ereignis.clientY);
    if (nach && ziele.indexOf(nach) >= 0) {
      waehle(null);
      rueckruf.beimZug(von, nach);
    } else if (nach !== von) {
      waehle(null);                          // daneben losgelassen: Auswahl aufheben
    }
  });

  raster.addEventListener("pointercancel", function () {
    beendeZiehen();
    waehle(null);
  });

  /* ---------- Bauernumwandlung ---------- */

  /**
   * Fragt, in welche Figur sich der Bauer umwandeln soll.
   * @param {string} farbe – "w" oder "b"
   * @returns {Promise<string|null>} "q", "r", "b", "n" – oder null bei Abbruch
   */
  function frageUmwandlung(farbe) {
    return new Promise(function (fertig) {
      auswahl.textContent = "";
      const kasten = document.createElement("div");
      kasten.className = "sch-umwandlung-kasten";
      kasten.setAttribute("role", "dialog");
      kasten.setAttribute("aria-label", "Bauernumwandlung: Figur wählen");
      const schliesse = function (typ) {
        auswahl.hidden = true;
        auswahl.textContent = "";
        document.removeEventListener("keydown", beimEsc);
        fertig(typ);
      };
      const beimEsc = function (ereignis) { if (ereignis.key === "Escape") schliesse(null); };
      ["q", "r", "b", "n"].forEach(function (typ) {
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "sch-umwandlung-knopf";
        knopf.dataset.figur = typ;
        knopf.setAttribute("aria-label", FIGUR_NAME[typ]);
        const bild = document.createElement("img");
        bild.src = K.figurenPfad + farbe + typ + ".svg";
        bild.alt = "";
        knopf.appendChild(bild);
        knopf.addEventListener("click", function () { schliesse(typ); });
        kasten.appendChild(knopf);
      });
      auswahl.appendChild(kasten);
      auswahl.onclick = function (ereignis) { if (ereignis.target === auswahl) schliesse(null); };
      document.addEventListener("keydown", beimEsc);
      auswahl.hidden = false;
      kasten.firstChild.focus();
    });
  }

  return {
    zeige: zeige,
    pfeile: pfeile,
    markiere: markiere,
    frageUmwandlung: frageUmwandlung,
  };
}
