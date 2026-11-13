/* ==========================================================================
   board.js – die Pinnwand: eine unendliche Fläche mit Notizzetteln
   Zettel frei platzieren, bearbeiten, in der Größe ändern, einfärben und
   mit geschwungenen Pfeilen verbinden – z. B. für Mindmaps.

   Aufbau:
     .pw-flaeche   – der sichtbare Ausschnitt (fängt alle Zeiger-Eingaben)
       .pw-ebene   – EINE Ebene mit allen Zetteln und Linien; Verschieben
                     und Zoomen ändern nur ihre transform (flüssig auch mit
                     hunderten Zetteln). Darin:
         svg.pw-linien     – Verbindungen (Welt-Koordinaten)
         .pw-zettel-ebene  – die Zettel (Welt-Koordinaten)
     Darüber (Bildschirm-Koordinaten): Werkzeugleiste, Zoomleiste, Menü am
     ausgewählten Zettel, Auswahlrahmen, Beschriftungsfeld, Hinweise.

   Koordinaten: Welt = (Bildschirm − Verschiebung) / Zoom.
   Bedienung:
     Verschieben – Ziehen auf leerer Fläche, Leertaste + Ziehen, mittlere
                   Maustaste, Wischen mit zwei Fingern (Trackpad), auf dem
                   Smartphone ein Finger auf leerer Fläche
     Zoomen      – Strg/Cmd + Mausrad, Pinch, Plus/Minus (zur Maus bzw. zur
                   Mitte der Finger), 10 % bis 300 %
     Zettel      – Doppelklick auf leere Stelle oder "Neuer Zettel";
                   Doppelklick bearbeitet; Umschalt + Klick oder Umschalt +
                   Ziehen auf leerer Fläche (Rahmen) wählt mehrere
     Verbindung  – an einem Punkt am Rand ziehen und auf einem anderen
                   Zettel loslassen, oder Menü "Verbinden" + Zielzettel
     Tasten      – Entf/Rück löscht, Cmd/Strg+Z rückgängig,
                   Cmd/Strg+Umschalt+Z wiederholen, Esc hebt die Auswahl auf
   Smartphone: Antippen wählt, nochmal antippen bearbeitet, lange drücken
   öffnet das Menü.
   Speicherung: js/board-store.js. Aussehen: css/board.css, Farben in
   css/style.css (--zettel-…).
   ========================================================================== */

const PinnwandAnsicht = (function () {
  const S = BoardStore;
  const K = S.K;

  // Alle Werte der Fläche an einer Stelle
  const KONFIG = {
    raster: 24,                 // Abstand der Rasterpunkte (Welt-Pixel)
    rasterMinPx: 10,            // enger als das auf dem Bildschirm: nur jeden 4. Punkt zeigen
    zoomSchritt: 1.25,          // Plus/Minus
    radZoom: 0.0025,            // Strg + Mausrad / Pinch auf dem Trackpad
    zoomTitel: 0.4,             // darunter: nur noch der Titel, groß
    zoomFern: 0.15,             // darunter: nur farbige Flächen und Linien
    titelFernPx: 11.5,          // so groß erscheint der Titel weit herausgezoomt (Bildschirm-Pixel)
    titelGroesse: 15,           // Titel-Schriftgröße im Zettel (Welt-Pixel, wie in board.css)
    ziehSchwelle: 4,            // ab so vielen Pixeln ist ein Klick ein Ziehen
    langDruck: 500,             // ms: lange drücken (Smartphone) öffnet das Menü
    undoMax: 100,
    speicherVerzug: 300,        // ms nach der letzten Änderung wird gespeichert
    duplikatVersatz: 28,
    allesRand: 72,              // Rand bei "Alles anzeigen" (Bildschirm-Pixel)
    allesMaxZoom: 1,            // "Alles anzeigen" vergrößert höchstens bis 100 %
    linieKruemmung: 0.45,       // Anteil des Abstands für die Biegung der Linien
    linieBiegungMin: 30,
    linieBiegungMax: 260,
  };
  const FARBNAMEN = { creme: "Off-White", grau: "Hellgrau", sand: "Sand", salbei: "Salbei", taube: "Taubenblau" };

  let d = null;                            // die Daten (siehe board-store.js)
  const el = {};
  const zettelEl = new Map();              // id → Element
  const linieEl = new Map();               // id → { gruppe, pfad, treffer, text }
  let auswahl = new Set();                 // ausgewählte Zettel-IDs
  let gewaehlteLinie = null;               // ausgewählte Verbindung (ID)
  let bearbeitet = null;                   // { id, eingabe, vorher } während der Textbearbeitung
  let verbindeVon = null;                  // Menü "Verbinden": Quelle, wartet auf den Zielzettel
  let menueOffen = false;                  // Smartphone: Menü nur nach langem Drücken
  let undo = [], redo = [];
  let leertaste = false;
  const zeiger = new Map();                // aktive Zeiger auf der Fläche (für Pinch)
  let geste = null;                        // laufende Geste (Verschieben, Ziehen, Rahmen …)
  let speicherTimer = null;
  let lodStufe = "";                       // "", "titel" oder "fern"
  let lodFaktor = 0;
  let zaehler = 0;


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  function init(container) {
    d = S.laden();
    container.innerHTML =
      '<div class="pw">' +
        '<div class="pw-flaeche" tabindex="0" aria-label="Pinnwand-Fläche. Doppelklick legt einen Zettel an.">' +
          '<div class="pw-ebene">' +
            '<svg class="pw-linien" aria-hidden="true">' +
              '<defs><marker id="pw-pfeil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' +
                '<path class="pw-pfeilspitze" d="M0 0.8 L10 5 L0 9.2 Z"/></marker>' +
                '<marker id="pw-pfeil-aktiv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' +
                '<path class="pw-pfeilspitze pw-pfeilspitze--aktiv" d="M0 0.8 L10 5 L0 9.2 Z"/></marker></defs>' +
              '<g class="pw-linien-gruppe"></g>' +
              '<path class="pw-linie-neu" hidden marker-end="url(#pw-pfeil-aktiv)"/>' +
            "</svg>" +
            '<div class="pw-zettel-ebene"></div>' +
          "</div>" +
          '<div class="pw-rahmen" hidden></div>' +
        "</div>" +
        '<div class="pw-werkzeug">' +
          '<button type="button" class="knopf knopf--haupt" data-aktion="neu">+ Neuer Zettel</button>' +
        "</div>" +
        '<p class="pw-hinweis" hidden>Doppelklick auf eine freie Stelle oder „Neuer Zettel“ –<br>so entsteht dein erster Zettel.</p>' +
        '<p class="pw-modus" role="status" hidden></p>' +
        '<div class="pw-menue" role="toolbar" aria-label="Zettel" hidden>' +
          '<div class="pw-farben">' +
            K.farben.map(function (f) {
              return '<button type="button" class="pw-farbe" data-farbe="' + f + '" aria-label="Farbe ' + FARBNAMEN[f] + '"></button>';
            }).join("") +
          "</div>" +
          '<button type="button" class="pw-menue-knopf" data-aktion="duplizieren">Duplizieren</button>' +
          '<button type="button" class="pw-menue-knopf" data-aktion="verbinden">Verbinden</button>' +
          '<button type="button" class="pw-menue-knopf pw-menue-knopf--gefahr" data-aktion="loeschen">Löschen</button>' +
        "</div>" +
        '<div class="pw-zoomleiste" role="group" aria-label="Zoom">' +
          '<button type="button" class="pw-zoomknopf" data-aktion="minus" aria-label="Verkleinern">−</button>' +
          '<output class="pw-zoomwert" aria-live="polite">100 %</output>' +
          '<button type="button" class="pw-zoomknopf" data-aktion="plus" aria-label="Vergrößern">+</button>' +
          '<button type="button" class="pw-zoomknopf pw-zoomknopf--alles" data-aktion="alles">Alles anzeigen</button>' +
        "</div>" +
        '<input class="pw-beschriftung" type="text" maxlength="' + K.maxBeschriftung + '" aria-label="Beschriftung der Verbindung" hidden>' +
      "</div>";

    el.pw = container.querySelector(".pw");
    el.flaeche = container.querySelector(".pw-flaeche");
    el.ebene = container.querySelector(".pw-ebene");
    el.linien = container.querySelector(".pw-linien-gruppe");
    el.linieNeu = container.querySelector(".pw-linie-neu");
    el.zettel = container.querySelector(".pw-zettel-ebene");
    el.rahmen = container.querySelector(".pw-rahmen");
    el.hinweis = container.querySelector(".pw-hinweis");
    el.modus = container.querySelector(".pw-modus");
    el.menue = container.querySelector(".pw-menue");
    el.zoomwert = container.querySelector(".pw-zoomwert");
    el.beschriftung = container.querySelector(".pw-beschriftung");

    el.flaeche.addEventListener("pointerdown", zeigerRunter);
    el.flaeche.addEventListener("pointermove", zeigerBewegt);
    el.flaeche.addEventListener("pointerup", zeigerHoch);
    el.flaeche.addEventListener("pointercancel", zeigerHoch);
    el.flaeche.addEventListener("dblclick", doppelklick);
    el.flaeche.addEventListener("wheel", rad, { passive: false });
    el.flaeche.addEventListener("contextmenu", function (e) {
      if (!e.target.closest(".pw-eingabe")) e.preventDefault();
    });
    el.pw.addEventListener("click", knopfKlick);
    // Safari: Pinch auf dem Trackpad kommt als "gesture"-Ereignis
    el.flaeche.addEventListener("gesturestart", function (e) { e.preventDefault(); });

    el.beschriftung.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); beschriftungFertig(true); }
      if (e.key === "Escape") { e.preventDefault(); beschriftungFertig(false); }
    });
    el.beschriftung.addEventListener("blur", function () { beschriftungFertig(true); });

    document.addEventListener("keydown", taste);
    document.addEventListener("keyup", function (e) {
      if (e.code === "Space") { leertaste = false; el.pw.classList.remove("ist-greifbereit"); }
    });
    window.addEventListener("blur", function () { leertaste = false; el.pw.classList.remove("ist-greifbereit"); });
    window.addEventListener("resize", function () { if (sichtbar()) zeichneMenue(); });
    // Beim Verlassen der Seite sofort speichern
    window.addEventListener("pagehide", jetztSpeichern);
    document.addEventListener("visibilitychange", function () { if (document.hidden) jetztSpeichern(); });

    alleNeuZeichnen();
  }

  /** Wird bei jedem Öffnen der Pinnwand aufgerufen. */
  function zeige() {
    anwenden();
    zeichneHinweis();
    return null;
  }

  function sichtbar() {
    return el.pw && el.pw.offsetParent !== null;
  }

  /** Nach einem Import: Daten neu laden und alles neu zeichnen. */
  function neuLaden() {
    if (!el.pw) return;
    d = S.laden();
    auswahl = new Set();
    gewaehlteLinie = null;
    undo = [];
    redo = [];
    alleNeuZeichnen();
  }


  /* ==========================================================================
     ANSICHT: Verschieben und Zoomen (eine transform auf der Ebene)
     ========================================================================== */

  function anwenden() {
    const a = d.ansicht;
    el.ebene.style.transform = "translate(" + a.x + "px," + a.y + "px) scale(" + a.zoom + ")";
    // Punktraster: wächst mit; wird es zu eng, nur jeden 4. Punkt zeigen
    let abstand = KONFIG.raster * a.zoom;
    while (abstand < KONFIG.rasterMinPx) abstand *= 4;
    el.flaeche.style.backgroundSize = abstand + "px " + abstand + "px";
    el.flaeche.style.backgroundPosition = a.x + "px " + a.y + "px";
    el.zoomwert.textContent = Math.round(a.zoom * 100) + " %";
    // Weit herausgezoomt: erst nur Titel (groß), dann nur Flächen
    const stufe = a.zoom < KONFIG.zoomFern ? "fern" : a.zoom < KONFIG.zoomTitel ? "titel" : "";
    if (stufe !== lodStufe) {
      el.pw.classList.toggle("zoom-titel", stufe === "titel");
      el.pw.classList.toggle("zoom-fern", stufe === "fern");
      lodStufe = stufe;
    }
    if (stufe === "titel") {
      // nur in Viertelschritten ändern – sonst müsste jeder Zettel bei jedem Zoomschritt neu gesetzt werden
      const f = Math.max(1, Math.round(KONFIG.titelFernPx / (a.zoom * KONFIG.titelGroesse) * 4) / 4);
      if (f !== lodFaktor) {
        lodFaktor = f;
        el.pw.style.setProperty("--pw-lod", f);
      }
    }
    zeichneMenue();
    planeSpeichern();
  }

  /** Zoomt auf "neu", wobei der Bildschirmpunkt (px, py) an seinem Platz bleibt. */
  function zoomeUm(neu, px, py) {
    const a = d.ansicht;
    const z = Math.min(K.zoom.max, Math.max(K.zoom.min, neu));
    const wx = (px - a.x) / a.zoom, wy = (py - a.y) / a.zoom;
    a.x = px - wx * z;
    a.y = py - wy * z;
    a.zoom = z;
    anwenden();
  }

  function mitte() {
    const r = el.flaeche.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2 };
  }

  /** Zoomt so, dass alle Zettel sichtbar sind (höchstens 100 %). */
  function allesAnzeigen() {
    if (!d.zettel.length) {
      d.ansicht = { x: mitte().x, y: mitte().y, zoom: 1 };
      anwenden();
      return;
    }
    const b = umriss(d.zettel);
    const r = el.flaeche.getBoundingClientRect();
    const rand = KONFIG.allesRand;
    const z = Math.min(KONFIG.allesMaxZoom, K.zoom.max,
      Math.max(K.zoom.min, Math.min((r.width - 2 * rand) / b.b, (r.height - 2 * rand) / b.h)));
    d.ansicht = { x: r.width / 2 - (b.x + b.b / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z, zoom: z };
    anwenden();
  }

  /** Bildschirm (relativ zur Fläche) → Welt */
  function welt(px, py) {
    const a = d.ansicht;
    return { x: (px - a.x) / a.zoom, y: (py - a.y) / a.zoom };
  }

  function lokal(e) {
    const r = el.flaeche.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function umriss(liste) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    liste.forEach(function (z) {
      x1 = Math.min(x1, z.x); y1 = Math.min(y1, z.y);
      x2 = Math.max(x2, z.x + z.b); y2 = Math.max(y2, z.y + z.h);
    });
    return { x: x1, y: y1, b: x2 - x1, h: y2 - y1 };
  }


  /* ==========================================================================
     ZETTEL ZEICHNEN
     ========================================================================== */

  function alleNeuZeichnen() {
    el.zettel.textContent = "";
    el.linien.textContent = "";
    zettelEl.clear();
    linieEl.clear();
    d.zettel.forEach(zeichneZettel);
    d.verbindungen.forEach(zeichneLinie);
    anwenden();
    zeichneHinweis();
  }

  function finde(id) {
    return d.zettel.find(function (z) { return z.id === id; });
  }

  function zeichneZettel(z) {
    let e = zettelEl.get(z.id);
    if (!e) {
      e = document.createElement("div");
      e.className = "pw-zettel";
      e.dataset.id = z.id;
      e.tabIndex = 0;
      e.setAttribute("role", "group");
      e.innerHTML =
        '<div class="pw-inhalt"><div class="pw-titel"></div><div class="pw-text"></div></div>' +
        '<span class="pw-anker" data-seite="o" aria-hidden="true"></span>' +
        '<span class="pw-anker" data-seite="r" aria-hidden="true"></span>' +
        '<span class="pw-anker" data-seite="u" aria-hidden="true"></span>' +
        '<span class="pw-anker" data-seite="l" aria-hidden="true"></span>' +
        '<span class="pw-griff" aria-hidden="true"></span>';
      el.zettel.appendChild(e);
      zettelEl.set(z.id, e);
    }
    e.style.left = z.x + "px";
    e.style.top = z.y + "px";
    e.style.width = z.b + "px";
    e.style.height = z.h + "px";
    e.dataset.farbe = z.farbe;
    const zeilen = z.text.split("\n");
    if (!bearbeitet || bearbeitet.id !== z.id) {
      e.querySelector(".pw-titel").textContent = zeilen[0];
      e.querySelector(".pw-text").textContent = zeilen.slice(1).join("\n");
    }
    e.setAttribute("aria-label", "Zettel: " + (zeilen[0] || "leer"));
    stapel(z, e);
    e.classList.toggle("ist-ausgewaehlt", auswahl.has(z.id));
  }

  // Ausgewählte Zettel liegen vorn, sonst gilt die Stapelfolge z
  function stapel(z, e) {
    e.style.zIndex = (auswahl.has(z.id) ? 1000000 : 0) + z.z;
  }

  function nachVorn(ids) {
    d.zettel.filter(function (z) { return ids.has(z.id); })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (z) { z.z = d.naechsteZ++; });
  }

  function zeichneHinweis() {
    if (el.hinweis) el.hinweis.hidden = d.zettel.length > 0;
  }


  /* ==========================================================================
     VERBINDUNGEN ZEICHNEN
     Weich geschwungene Linie (kubische Bézierkurve) von der günstigsten
     Seite des einen zur günstigsten Seite des anderen Zettels.
     ========================================================================== */

  const SVG = "http://www.w3.org/2000/svg";

  function geometrie(a, b) {
    const ax = a.x + a.b / 2, ay = a.y + a.h / 2, bx = b.x + b.b / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay;
    let p1, p2, n1, n2;
    if (Math.abs(dx) / (a.b + b.b) >= Math.abs(dy) / (a.h + b.h)) {
      const s = dx >= 0 ? 1 : -1;
      p1 = { x: s > 0 ? a.x + a.b : a.x, y: ay };
      p2 = { x: s > 0 ? b.x : b.x + b.b, y: by };
      n1 = { x: s, y: 0 }; n2 = { x: -s, y: 0 };
    } else {
      const s = dy >= 0 ? 1 : -1;
      p1 = { x: ax, y: s > 0 ? a.y + a.h : a.y };
      p2 = { x: bx, y: s > 0 ? b.y : b.y + b.h };
      n1 = { x: 0, y: s }; n2 = { x: 0, y: -s };
    }
    const abstand = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const k = Math.min(KONFIG.linieBiegungMax, Math.max(KONFIG.linieBiegungMin, abstand * KONFIG.linieKruemmung));
    const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k };
    const c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k };
    // Punkt in der Mitte der Kurve (für die Beschriftung)
    const m = {
      x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x,
      y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y,
    };
    return { d: "M" + p1.x + " " + p1.y + " C" + c1.x + " " + c1.y + " " + c2.x + " " + c2.y + " " + p2.x + " " + p2.y, mitte: m };
  }

  function zeichneLinie(v) {
    const a = finde(v.von), b = finde(v.nach);
    if (!a || !b) return;
    let l = linieEl.get(v.id);
    if (!l) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class", "pw-linie");
      g.dataset.id = v.id;
      const treffer = document.createElementNS(SVG, "path");
      treffer.setAttribute("class", "pw-linie-treffer");
      const pfad = document.createElementNS(SVG, "path");
      pfad.setAttribute("class", "pw-linie-pfad");
      const text = document.createElementNS(SVG, "text");
      text.setAttribute("class", "pw-linie-text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      g.appendChild(treffer);
      g.appendChild(pfad);
      g.appendChild(text);
      el.linien.appendChild(g);
      l = { g: g, treffer: treffer, pfad: pfad, text: text };
      linieEl.set(v.id, l);
    }
    const geo = geometrie(a, b);
    l.treffer.setAttribute("d", geo.d);
    l.pfad.setAttribute("d", geo.d);
    const aktiv = gewaehlteLinie === v.id;
    l.pfad.setAttribute("marker-end", aktiv ? "url(#pw-pfeil-aktiv)" : "url(#pw-pfeil)");
    l.g.classList.toggle("ist-ausgewaehlt", aktiv);
    l.text.textContent = v.text || "";
    l.text.setAttribute("x", geo.mitte.x);
    l.text.setAttribute("y", geo.mitte.y);
    l.mitte = geo.mitte;
  }

  /** Linien neu zeichnen, die an einem der Zettel hängen. */
  function zeichneLinienVon(ids) {
    d.verbindungen.forEach(function (v) {
      if (ids.has(v.von) || ids.has(v.nach)) zeichneLinie(v);
    });
  }

  function entferneLinienElement(id) {
    const l = linieEl.get(id);
    if (l) l.g.remove();
    linieEl.delete(id);
  }


  /* ==========================================================================
     ÄNDERUNGEN, RÜCKGÄNGIG, SPEICHERN
     ========================================================================== */

  function schnappschuss() {
    return JSON.stringify({ zettel: d.zettel, verbindungen: d.verbindungen, naechsteZ: d.naechsteZ });
  }

  /** Vor jeder Änderung aufrufen: der jetzige Stand kommt auf den Rückgängig-Stapel. */
  function merke(stand) {
    undo.push(stand || schnappschuss());
    if (undo.length > KONFIG.undoMax) undo.shift();
    redo = [];
  }

  function wiederherstellen(stand) {
    const s = JSON.parse(stand);
    d.zettel = s.zettel;
    d.verbindungen = s.verbindungen;
    d.naechsteZ = s.naechsteZ;
    auswahl = new Set(Array.from(auswahl).filter(function (id) { return finde(id); }));
    if (gewaehlteLinie && !d.verbindungen.some(function (v) { return v.id === gewaehlteLinie; })) gewaehlteLinie = null;
    alleNeuZeichnen();
  }

  function rueckgaengig() {
    beendeBearbeitung();
    if (!undo.length) return;
    redo.push(schnappschuss());
    wiederherstellen(undo.pop());
  }

  function wiederholen() {
    beendeBearbeitung();
    if (!redo.length) return;
    undo.push(schnappschuss());
    wiederherstellen(redo.pop());
  }

  function planeSpeichern() {
    clearTimeout(speicherTimer);
    speicherTimer = setTimeout(jetztSpeichern, KONFIG.speicherVerzug);
  }

  function jetztSpeichern() {
    clearTimeout(speicherTimer);
    if (d) S.speichern(d);
  }

  function neueId(vorsilbe) {
    zaehler++;
    return vorsilbe + Date.now().toString(36) + zaehler.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }


  /* ==========================================================================
     AKTIONEN
     ========================================================================== */

  /** Neuer Zettel mit der Mitte an (wx, wy); sofort im Bearbeitungsmodus. */
  function neuerZettel(wx, wy) {
    merke();
    const g = K.groesse;
    const z = { id: neueId("z"), x: Math.round(wx - g.b / 2), y: Math.round(wy - g.h / 2), b: g.b, h: g.h, farbe: K.standardFarbe, text: "", z: d.naechsteZ++ };
    d.zettel.push(z);
    waehle([z.id]);
    zeichneZettel(z);
    zeichneHinweis();
    planeSpeichern();
    bearbeite(z.id, true);
    return z;
  }

  /** "Neuer Zettel": in der Mitte der Ansicht (leicht versetzt, falls dort schon einer liegt). */
  function neuerZettelMitte() {
    const m = mitte();
    const w = welt(m.x, m.y);
    let versatz = 0;
    while (versatz < 400 && d.zettel.some(function (z) { return Math.abs(z.x + z.b / 2 - w.x - versatz) < 4 && Math.abs(z.y + z.h / 2 - w.y - versatz) < 4; })) {
      versatz += KONFIG.duplikatVersatz;
    }
    neuerZettel(w.x + versatz, w.y + versatz);
  }

  function loescheAuswahl() {
    if (gewaehlteLinie) {
      merke();
      d.verbindungen = d.verbindungen.filter(function (v) { return v.id !== gewaehlteLinie; });
      entferneLinienElement(gewaehlteLinie);
      gewaehlteLinie = null;
      planeSpeichern();
      return;
    }
    if (!auswahl.size) return;
    merke();
    d.zettel = d.zettel.filter(function (z) { return !auswahl.has(z.id); });
    // Verbindungen gelöschter Zettel verschwinden mit
    d.verbindungen = d.verbindungen.filter(function (v) {
      const weg = auswahl.has(v.von) || auswahl.has(v.nach);
      if (weg) entferneLinienElement(v.id);
      return !weg;
    });
    auswahl.forEach(function (id) {
      const e = zettelEl.get(id);
      if (e) e.remove();
      zettelEl.delete(id);
    });
    auswahl = new Set();
    menueOffen = false;
    zeichneMenue();
    zeichneHinweis();
    planeSpeichern();
  }

  function dupliziere() {
    if (!auswahl.size) return;
    merke();
    const neu = new Map();
    const v = KONFIG.duplikatVersatz;
    d.zettel.filter(function (z) { return auswahl.has(z.id); })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (z) {
        const k = Object.assign({}, z, { id: neueId("z"), x: z.x + v, y: z.y + v, z: d.naechsteZ++ });
        neu.set(z.id, k.id);
        d.zettel.push(k);
      });
    // Verbindungen innerhalb der Auswahl mitkopieren
    d.verbindungen.slice().forEach(function (c) {
      if (neu.has(c.von) && neu.has(c.nach)) {
        d.verbindungen.push({ id: neueId("v"), von: neu.get(c.von), nach: neu.get(c.nach), text: c.text });
      }
    });
    alleNeuZeichnen();
    waehle(Array.from(neu.values()));
    planeSpeichern();
  }

  function faerbe(farbe) {
    if (!auswahl.size) return;
    merke();
    d.zettel.forEach(function (z) {
      if (auswahl.has(z.id)) { z.farbe = farbe; zeichneZettel(z); }
    });
    zeichneMenue();
    planeSpeichern();
  }

  function verbinde(von, nach) {
    if (!von || !nach || von === nach) return false;
    if (d.verbindungen.some(function (v) { return v.von === von && v.nach === nach; })) return false;
    merke();
    const v = { id: neueId("v"), von: von, nach: nach, text: "" };
    d.verbindungen.push(v);
    zeichneLinie(v);
    planeSpeichern();
    return true;
  }


  /* ==========================================================================
     AUSWAHL UND MENÜ
     ========================================================================== */

  function waehle(ids, dazu) {
    const alt = auswahl;
    auswahl = dazu ? new Set(Array.from(alt).concat(ids)) : new Set(ids);
    if (auswahl.size) gewaehlteLinie = null;
    const geaendert = new Set(Array.from(alt).concat(Array.from(auswahl)));
    geaendert.forEach(function (id) {
      const z = finde(id), e = zettelEl.get(id);
      if (z && e) { e.classList.toggle("ist-ausgewaehlt", auswahl.has(id)); stapel(z, e); }
    });
    zeichneLinienAuswahl();
    zeichneMenue();
  }

  function waehleLinie(id) {
    waehle([]);
    gewaehlteLinie = id;
    zeichneLinienAuswahl();
  }

  function zeichneLinienAuswahl() {
    d.verbindungen.forEach(function (v) {
      const l = linieEl.get(v.id);
      if (!l) return;
      const aktiv = gewaehlteLinie === v.id;
      if (l.g.classList.contains("ist-ausgewaehlt") !== aktiv) {
        l.g.classList.toggle("ist-ausgewaehlt", aktiv);
        l.pfad.setAttribute("marker-end", aktiv ? "url(#pw-pfeil-aktiv)" : "url(#pw-pfeil)");
      }
    });
  }

  /** Menü über der Auswahl (Bildschirm-Koordinaten). */
  function zeichneMenue() {
    if (!el.menue) return;
    const zeigen = auswahl.size > 0 && menueOffen && !bearbeitet && !(geste && geste.bewegt) && !verbindeVon;
    el.menue.hidden = !zeigen;
    if (!zeigen) return;
    const liste = d.zettel.filter(function (z) { return auswahl.has(z.id); });
    if (!liste.length) { el.menue.hidden = true; return; }
    const b = umriss(liste), a = d.ansicht;
    const r = el.flaeche.getBoundingClientRect();
    const mb = el.menue.offsetWidth, mh = el.menue.offsetHeight;
    let x = a.x + (b.x + b.b / 2) * a.zoom - mb / 2;
    let y = a.y + b.y * a.zoom - mh - 10;
    if (y < 8) y = a.y + (b.y + b.h) * a.zoom + 10;      // oben kein Platz: darunter
    x = Math.max(8, Math.min(r.width - mb - 8, x));
    y = Math.max(8, Math.min(r.height - mh - 8, y));
    el.menue.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    // Aktive Farbe (nur wenn alle ausgewählten dieselbe haben)
    const farben = new Set(liste.map(function (z) { return z.farbe; }));
    el.menue.querySelectorAll(".pw-farbe").forEach(function (k) {
      k.setAttribute("aria-pressed", String(farben.size === 1 && farben.has(k.dataset.farbe)));
    });
    el.menue.querySelector('[data-aktion="verbinden"]').hidden = liste.length !== 1;
  }

  function knopfKlick(e) {
    const k = e.target.closest("button");
    if (!k || !el.pw.contains(k)) return;
    if (k.classList.contains("pw-farbe")) { faerbe(k.dataset.farbe); return; }
    const a = k.dataset.aktion;
    if (a === "neu") neuerZettelMitte();
    if (a === "plus") { const m = mitte(); zoomeUm(d.ansicht.zoom * KONFIG.zoomSchritt, m.x, m.y); }
    if (a === "minus") { const m = mitte(); zoomeUm(d.ansicht.zoom / KONFIG.zoomSchritt, m.x, m.y); }
    if (a === "alles") allesAnzeigen();
    if (a === "duplizieren") dupliziere();
    if (a === "loeschen") loescheAuswahl();
    if (a === "verbinden" && auswahl.size === 1) starteVerbindeModus(Array.from(auswahl)[0]);
  }

  function starteVerbindeModus(id) {
    verbindeVon = id;
    el.modus.textContent = "Jetzt den Zielzettel antippen – Antippen der freien Fläche bricht ab.";
    el.modus.hidden = false;
    zeichneMenue();
  }

  function beendeVerbindeModus() {
    verbindeVon = null;
    el.modus.hidden = true;
    zeichneMenue();
  }


  /* ==========================================================================
     TEXT BEARBEITEN
     Ein Eingabefeld (contenteditable, nur Text) liegt über dem Inhalt. Die
     erste Zeile erscheint größer (::first-line in board.css).
     ========================================================================== */

  function bearbeite(id, neu) {
    beendeBearbeitung();
    const z = finde(id), e = zettelEl.get(id);
    if (!z || !e) return;
    const eingabe = document.createElement("div");
    eingabe.className = "pw-eingabe";
    eingabe.contentEditable = "plaintext-only";
    if (eingabe.contentEditable !== "plaintext-only") eingabe.contentEditable = "true";
    eingabe.setAttribute("role", "textbox");
    eingabe.setAttribute("aria-multiline", "true");
    eingabe.setAttribute("aria-label", "Text des Zettels – erste Zeile ist der Titel");
    eingabe.spellcheck = true;
    eingabe.innerText = z.text;
    e.appendChild(eingabe);
    e.classList.add("wird-bearbeitet");
    bearbeitet = { id: id, eingabe: eingabe, vorher: neu ? null : schnappschuss() };
    zeichneMenue();
    eingabe.addEventListener("blur", function () {
      // Klick in das Menü o. Ä. beendet die Bearbeitung
      setTimeout(function () { if (bearbeitet && bearbeitet.eingabe === eingabe && document.activeElement !== eingabe) beendeBearbeitung(); }, 0);
    });
    eingabe.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); beendeBearbeitung(); e.focus({ preventScroll: true }); }
    });
    eingabe.focus({ preventScroll: true });
    // Schreibmarke ans Ende
    const r = document.createRange();
    r.selectNodeContents(eingabe);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function beendeBearbeitung() {
    if (!bearbeitet) return;
    const b = bearbeitet;
    bearbeitet = null;
    const z = finde(b.id), e = zettelEl.get(b.id);
    const text = b.eingabe.innerText.replace(/\r/g, "").replace(/\n$/, "").slice(0, K.maxText);
    b.eingabe.remove();
    if (e) e.classList.remove("wird-bearbeitet");
    if (z && text !== z.text) {
      // neuer Zettel: Anlegen und Text sind EIN Schritt zum Rückgängigmachen
      if (b.vorher) merke(b.vorher);
      z.text = text;
      planeSpeichern();
    }
    if (z) zeichneZettel(z);
    zeichneMenue();
  }


  /* ==========================================================================
     BESCHRIFTUNG EINER VERBINDUNG (Doppelklick auf die Linie)
     ========================================================================== */

  let beschriftet = null;

  function beschrifte(id) {
    const v = d.verbindungen.find(function (x) { return x.id === id; });
    const l = linieEl.get(id);
    if (!v || !l) return;
    beschriftet = id;
    const a = d.ansicht;
    el.beschriftung.value = v.text || "";
    el.beschriftung.hidden = false;
    const b = 180;
    el.beschriftung.style.transform = "translate(" + Math.round(a.x + l.mitte.x * a.zoom - b / 2) + "px," + Math.round(a.y + l.mitte.y * a.zoom - 16) + "px)";
    el.beschriftung.focus();
    el.beschriftung.select();
  }

  function beschriftungFertig(uebernehmen) {
    if (!beschriftet) return;
    const id = beschriftet;
    beschriftet = null;
    el.beschriftung.hidden = true;
    const v = d.verbindungen.find(function (x) { return x.id === id; });
    const text = el.beschriftung.value.trim().slice(0, K.maxBeschriftung);
    if (uebernehmen && v && text !== v.text) {
      merke();
      v.text = text;
      zeichneLinie(v);
      planeSpeichern();
    }
    el.flaeche.focus({ preventScroll: true });
  }


  /* ==========================================================================
     ZEIGER: Maus, Stift und Finger
     ========================================================================== */

  function zeigerRunter(e) {
    if (e.button === 2) return;
    // In das Textfeld des gerade bearbeiteten Zettels: normales Textverhalten
    if (bearbeitet && e.target.closest(".pw-eingabe")) return;
    if (bearbeitet) beendeBearbeitung();

    const p = lokal(e);
    zeiger.set(e.pointerId, p);

    // Zweiter Finger: Pinch (eine laufende Geste wird abgebrochen)
    if (zeiger.size === 2) {
      beendeGeste(null, true);
      const [a, b] = Array.from(zeiger.values());
      geste = { art: "pinch", abstand: Math.hypot(b.x - a.x, b.y - a.y) || 1, zoom: d.ansicht.zoom, welt: welt((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (zeiger.size > 2) return;

    el.flaeche.setPointerCapture(e.pointerId);
    const touch = e.pointerType === "touch";
    const ziel = e.target;
    const zettel = ziel.closest(".pw-zettel");
    const linie = ziel.closest(".pw-linie");

    // Verschieben: mittlere Taste oder Leertaste
    if (e.button === 1 || leertaste) {
      e.preventDefault();
      geste = { art: "pan", start: p, x0: d.ansicht.x, y0: d.ansicht.y, bewegt: false };
      el.pw.classList.add("ist-am-greifen");
      return;
    }

    // Menü "Verbinden": Zielzettel wählen
    if (verbindeVon) {
      if (zettel && zettel.dataset.id !== verbindeVon) verbinde(verbindeVon, zettel.dataset.id);
      beendeVerbindeModus();
      geste = { art: "nichts" };
      return;
    }

    if (ziel.classList.contains("pw-anker") && zettel) {
      e.preventDefault();
      geste = { art: "verbinden", von: zettel.dataset.id, start: p, bewegt: false };
      return;
    }
    if (ziel.classList.contains("pw-griff") && zettel) {
      e.preventDefault();
      const z = finde(zettel.dataset.id);
      geste = { art: "groesse", id: z.id, start: p, b0: z.b, h0: z.h, bewegt: false };
      return;
    }
    if (zettel) {
      const id = zettel.dataset.id;
      const warAusgewaehlt = auswahl.has(id);
      if (e.shiftKey) {
        // Umschalt: zur Auswahl hinzufügen oder wieder herausnehmen
        if (warAusgewaehlt) { auswahl.delete(id); waehle(Array.from(auswahl)); geste = { art: "nichts" }; return; }
        waehle([id], true);
      } else if (!warAusgewaehlt) {
        waehle([id]);
        if (touch) menueOffen = false;
      }
      if (!touch) { menueOffen = true; zeichneMenue(); }
      geste = {
        art: "zettel", id: id, start: p, bewegt: false, touch: touch, warAusgewaehlt: warAusgewaehlt && !e.shiftKey,
        positionen: new Map(d.zettel.filter(function (z) { return auswahl.has(z.id); }).map(function (z) { return [z.id, { x: z.x, y: z.y }]; })),
      };
      if (touch) {
        geste.langTimer = setTimeout(function () {
          if (geste && geste.art === "zettel" && !geste.bewegt) {
            geste.lang = true;
            menueOffen = true;
            zeichneMenue();
          }
        }, KONFIG.langDruck);
      }
      return;
    }
    if (linie) {
      waehleLinie(linie.dataset.id);
      geste = { art: "nichts" };
      return;
    }
    // Leere Fläche: Umschalt + Ziehen = Rahmen, sonst verschieben
    if (e.shiftKey && !touch) {
      geste = { art: "rahmen", start: p, vorher: new Set(auswahl), bewegt: false };
      return;
    }
    geste = { art: "pan", start: p, x0: d.ansicht.x, y0: d.ansicht.y, bewegt: false, leer: true };
  }

  function zeigerBewegt(e) {
    if (!zeiger.has(e.pointerId)) return;
    const p = lokal(e);
    zeiger.set(e.pointerId, p);
    if (!geste) return;

    if (geste.art === "pinch") {
      if (zeiger.size < 2) return;
      const [a, b] = Array.from(zeiger.values());
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = Math.min(K.zoom.max, Math.max(K.zoom.min, geste.zoom * Math.hypot(b.x - a.x, b.y - a.y) / geste.abstand));
      // Der Weltpunkt unter der Fingermitte bleibt unter der Fingermitte
      d.ansicht.zoom = z;
      d.ansicht.x = m.x - geste.welt.x * z;
      d.ansicht.y = m.y - geste.welt.y * z;
      anwenden();
      return;
    }

    const dx = p.x - geste.start.x, dy = p.y - geste.start.y;
    if (!geste.bewegt) {
      if (Math.hypot(dx, dy) < KONFIG.ziehSchwelle) return;
      geste.bewegt = true;
      clearTimeout(geste.langTimer);
      if (geste.art === "zettel" || geste.art === "groesse") {
        geste.vorher = schnappschuss();
        if (geste.art === "zettel") {
          // Die zuletzt bewegten liegen über älteren
          nachVorn(auswahl);
          auswahl.forEach(function (id) { stapel(finde(id), zettelEl.get(id)); });
        }
      }
      zeichneMenue();      // während des Ziehens kein Menü (es könnte das Ziel verdecken)
    }
    const z = d.ansicht.zoom;

    if (geste.art === "pan") {
      d.ansicht.x = geste.x0 + dx;
      d.ansicht.y = geste.y0 + dy;
      el.pw.classList.add("ist-am-greifen");
      anwenden();
    } else if (geste.art === "zettel") {
      geste.positionen.forEach(function (pos, id) {
        const zz = finde(id);
        zz.x = Math.round(pos.x + dx / z);
        zz.y = Math.round(pos.y + dy / z);
        const e2 = zettelEl.get(id);
        e2.style.left = zz.x + "px";
        e2.style.top = zz.y + "px";
      });
      zeichneLinienVon(auswahl);
    } else if (geste.art === "groesse") {
      const zz = finde(geste.id);
      zz.b = Math.round(Math.min(K.max.b, Math.max(K.min.b, geste.b0 + dx / z)));
      zz.h = Math.round(Math.min(K.max.h, Math.max(K.min.h, geste.h0 + dy / z)));
      const e2 = zettelEl.get(zz.id);
      e2.style.width = zz.b + "px";
      e2.style.height = zz.h + "px";
      zeichneLinienVon(new Set([zz.id]));
    } else if (geste.art === "verbinden") {
      const von = finde(geste.von);
      const w = welt(p.x, p.y);
      const ziel = document.elementFromPoint(e.clientX, e.clientY);
      const zielZettel = ziel && ziel.closest(".pw-zettel");
      const nach = zielZettel && zielZettel.dataset.id !== geste.von ? finde(zielZettel.dataset.id) : { x: w.x, y: w.y, b: 0, h: 0 };
      el.linieNeu.setAttribute("d", geometrie(von, nach).d);
      el.linieNeu.removeAttribute("hidden");   // SVG-Elemente haben keine hidden-Eigenschaft
      el.zettel.querySelectorAll(".ist-ziel").forEach(function (x) { x.classList.remove("ist-ziel"); });
      if (zielZettel && zielZettel.dataset.id !== geste.von) zielZettel.classList.add("ist-ziel");
    } else if (geste.art === "rahmen") {
      const x1 = Math.min(geste.start.x, p.x), y1 = Math.min(geste.start.y, p.y);
      const bb = Math.abs(dx), hh = Math.abs(dy);
      el.rahmen.hidden = false;
      el.rahmen.style.transform = "translate(" + x1 + "px," + y1 + "px)";
      el.rahmen.style.width = bb + "px";
      el.rahmen.style.height = hh + "px";
      const w1 = welt(x1, y1), w2 = welt(x1 + bb, y1 + hh);
      const drin = d.zettel.filter(function (zz) {
        return zz.x < w2.x && zz.x + zz.b > w1.x && zz.y < w2.y && zz.y + zz.h > w1.y;
      }).map(function (zz) { return zz.id; });
      menueOffen = true;
      waehle(Array.from(geste.vorher).concat(drin));
    }
  }

  function zeigerHoch(e) {
    if (!zeiger.has(e.pointerId)) return;
    zeiger.delete(e.pointerId);
    if (geste && geste.art === "pinch") {
      if (zeiger.size === 0) geste = null;
      else geste = { art: "nichts" };
      return;
    }
    beendeGeste(e, e.type === "pointercancel");
  }

  /** Beendet die laufende Geste (abbrechen = ohne Klick-Wirkung). */
  function beendeGeste(e, abbrechen) {
    const g = geste;
    geste = null;
    el.pw.classList.remove("ist-am-greifen");
    if (!g) return;
    clearTimeout(g.langTimer);

    if (g.art === "zettel") {
      if (g.bewegt) {
        merke(g.vorher);
        planeSpeichern();
      } else if (!abbrechen && !g.lang) {
        // Antippen: erneutes Antippen eines allein ausgewählten Zettels bearbeitet ihn (Smartphone)
        if (g.touch && g.warAusgewaehlt && auswahl.size === 1) bearbeite(g.id);
        else if (!e || !e.shiftKey) waehle([g.id]);
      }
    } else if (g.art === "groesse") {
      if (g.bewegt) { merke(g.vorher); planeSpeichern(); }
    } else if (g.art === "verbinden") {
      el.linieNeu.setAttribute("hidden", "");
      el.zettel.querySelectorAll(".ist-ziel").forEach(function (x) { x.classList.remove("ist-ziel"); });
      if (e && !abbrechen) {
        const ziel = document.elementFromPoint(e.clientX, e.clientY);
        const zielZettel = ziel && ziel.closest(".pw-zettel");
        if (zielZettel) verbinde(g.von, zielZettel.dataset.id);
      }
    } else if (g.art === "rahmen") {
      el.rahmen.hidden = true;
    } else if (g.art === "pan") {
      // Klick ohne Ziehen auf leere Fläche: Auswahl aufheben
      if (!g.bewegt && g.leer && !abbrechen) {
        waehle([]);
        gewaehlteLinie = null;
        zeichneLinienAuswahl();
        menueOffen = false;
      }
    }
    zeichneMenue();
  }

  function doppelklick(e) {
    // Das Ziel über die Position bestimmen: wegen des Festhaltens des
    // Zeigers (setPointerCapture) kommt das Ereignis an der Fläche an
    const ziel = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    if (ziel.closest(".pw-eingabe")) return;
    const zettel = ziel.closest(".pw-zettel");
    if (zettel) {
      if (!ziel.classList.contains("pw-anker") && !ziel.classList.contains("pw-griff")) bearbeite(zettel.dataset.id);
      return;
    }
    const linie = ziel.closest(".pw-linie");
    if (linie) { beschrifte(linie.dataset.id); return; }
    if (ziel === el.flaeche || ziel.closest(".pw-ebene")) {
      const p = lokal(e);
      const w = welt(p.x, p.y);
      neuerZettel(w.x, w.y);
    }
  }

  /** Mausrad: mit Strg/Cmd (oder Pinch auf dem Trackpad) zoomen, sonst verschieben. */
  function rad(e) {
    if (e.target.closest(".pw-eingabe") && !e.ctrlKey && !e.metaKey) return;   // im Text scrollen
    e.preventDefault();
    const faktor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (e.ctrlKey || e.metaKey) {
      const p = lokal(e);
      zoomeUm(d.ansicht.zoom * Math.exp(-e.deltaY * faktor * KONFIG.radZoom), p.x, p.y);
    } else {
      d.ansicht.x -= e.deltaX * faktor;
      d.ansicht.y -= e.deltaY * faktor;
      anwenden();
    }
  }


  /* ==========================================================================
     TASTATUR
     ========================================================================== */

  function taste(e) {
    if (!sichtbar()) return;
    const imText = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
    if (imText) return;      // im Text gelten die normalen Tasten (Esc beendet die Bearbeitung selbst)
    const mod = e.metaKey || e.ctrlKey;

    if (e.code === "Space" && !mod) {
      if (e.target.closest && e.target.closest("button, a")) return;
      e.preventDefault();
      leertaste = true;
      el.pw.classList.add("ist-greifbereit");
      return;
    }
    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) wiederholen(); else rueckgaengig();
      return;
    }
    if (mod && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      wiederholen();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (auswahl.size || gewaehlteLinie) {
        e.preventDefault();
        loescheAuswahl();
      }
      return;
    }
    if (e.key === "Escape") {
      if (verbindeVon) beendeVerbindeModus();
      else { waehle([]); gewaehlteLinie = null; zeichneLinienAuswahl(); }
      return;
    }
    // Enter auf einem Zettel mit Fokus: bearbeiten
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("pw-zettel")) {
      e.preventDefault();
      waehle([e.target.dataset.id]);
      bearbeite(e.target.dataset.id);
    }
  }


  return {
    init: init,
    zeige: zeige,
    neuLaden: neuLaden,
    // für Tests
    _daten: function () { return d; },
  };
})();
