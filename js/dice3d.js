/* ==========================================================================
   dice3d.js – der Zwanzigseiter (W20) in echtem 3D, ohne Bibliothek
   Ein Ikosaeder auf einem Canvas: Eckpunkte berechnen, drehen,
   perspektivisch projizieren, die sichtbaren Flächen von hinten nach vorn
   zeichnen – mit einfacher Beleuchtung, feinen Kanten, Glanz und den Zahlen
   1–20 auf den Flächen (gegenüberliegende Flächen ergeben zusammen 21).

   Nur Darstellung: Das Ergebnis steht immer schon fest (js/sudoku-rpg.js).
   Ein Wurf dreht den Würfel so, dass er GENAU auf der Ergebnisfläche zur
   Ruhe kommt – die Drehung ist von hinten gerechnet und endet ohne Sprung.
   Gezeichnet wird nur, solange er sich bewegt; in Ruhe bleibt das Bild stehen.

   Farben kommen aus CSS-Variablen am Canvas (siehe css/sudoku-rpg.css):
     --w3d-farbe, --w3d-kante, --w3d-zahl, --w3d-zahl-rand, --w3d-schatten
   data-schema="boss" am Canvas wählt das Farbschema des Bosses.

   Verwendet von js/sudoku-battle-ui.js (Würfelfläche am Computer, Würfel
   über dem Gitter auf dem Smartphone, Vergleich im Verteidigungszug).
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – alle Werte an einer Stelle
   -------------------------------------------------------------------------- */
const DICE3D_KONFIG = {
  licht: [-0.45, 0.62, 0.64],  // Richtung zum Licht (links oben vorn)
  umgebung: 0.5,               // Grundhelligkeit jeder Fläche (0–1)
  diffus: 0.7,                 // wie stark die Ausrichtung zum Licht zählt
  glanz: 0.5,                  // Stärke des Glanzpunkts
  glanzSchaerfe: 18,           // je größer, desto kleiner der Glanzpunkt
  kamera: 6,                   // Abstand der Kamera in Würfelradien (Perspektive)
  fuellung: 0.4,               // Würfelradius als Anteil der Canvas-Breite
  mitteY: 0.45,                // Höhe der Würfelmitte im Canvas (Rest: Schatten)
  zahlGroesse: 0.4,            // Schrifthöhe der Zahlen (Anteil einer Kante)
  // Wurf (Anteile der Wurfdauer)
  drehungen: [2.2, 3.4],       // so viele volle Umdrehungen dreht er sich anfangs (zufällig dazwischen)
  kippen: 1.6,                 // so weit kippt er am Ende über die Kanten (in Flächenabständen)
  kippenAb: 0.55,              // ab hier kippt er über die Kanten
  sprungHoehe: 0.32,           // Höhe des ersten Aufpralls (Anteil des Durchmessers)
  aufprall: 0.55,              // hier berührt er zum ersten Mal den Boden
  abkuerzen: 160,              // Millisekunden: schnell auf die Ergebnisfläche drehen
  ruhe: [0.35, -0.5, 0.15],    // leichte Schräglage in Ruhe (Rad um x, y, z) – nur ohne Ergebnis
};


const Dice3D = (function () {

  const K = DICE3D_KONFIG;

  /* ------------------------------------------------------------------------
     VEKTOREN UND QUATERNIONEN
     ------------------------------------------------------------------------ */

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mal(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function kreuz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // Quaternion [w, x, y, z]
  function qAchse(achse, winkel) {
    const a = norm(achse), s = Math.sin(winkel / 2);
    return [Math.cos(winkel / 2), a[0] * s, a[1] * s, a[2] * s];
  }
  function qMal(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }
  function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  /** Kürzester Weg von a nach b (t = 0 … 1). */
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
    if (d > 0.9995) return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
    const th = Math.acos(d), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
  }
  /** Drehmatrix (Zeilen) aus einem Quaternion. */
  function qMatrix(q) {
    const w = q[0], x = q[1], y = q[2], z = q[3];
    return [
      [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
      [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
      [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ];
  }
  /** Quaternion aus einer Drehmatrix (Zeilen). */
  function qAusMatrix(m) {
    const spur = m[0][0] + m[1][1] + m[2][2];
    let q;
    if (spur > 0) {
      const s = Math.sqrt(spur + 1) * 2;
      q = [0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s];
    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
      const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
      q = [(m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s];
    } else if (m[1][1] > m[2][2]) {
      const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
      q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s];
    } else {
      const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
      q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s];
    }
    return qNorm(q);
  }
  function dreh(m, v) {
    return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  }


  /* ------------------------------------------------------------------------
     DER IKOSAEDER: 12 Ecken, 20 Flächen, Zahlen 1–20
     Gegenüberliegende Flächen ergeben zusammen 21. Die 20 liegt oben, ihre
     drei Nachbarn tragen 2, 8 und 14 (wie bei üblichen W20); die obere
     Hälfte trägt die geraden, die untere die ungeraden Zahlen.
     ------------------------------------------------------------------------ */

  const FORM = (function () {
    const p = (1 + Math.sqrt(5)) / 2;
    const ecken = [
      [-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
      [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
      [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1],
    ];
    const radius = Math.sqrt(1 + p * p);
    // Flächen: alle Dreiecke aus Ecken mit Kantenlänge 2
    const flaechen = [];
    for (let a = 0; a < 12; a++) {
      for (let b = a + 1; b < 12; b++) {
        for (let c = b + 1; c < 12; c++) {
          const kante = function (i, j) { return Math.abs(Math.sqrt(dot(sub(ecken[i], ecken[j]), sub(ecken[i], ecken[j]))) - 2) < 1e-6; };
          if (!kante(a, b) || !kante(b, c) || !kante(a, c)) continue;
          let idx = [a, b, c];
          const mitte = mal(add(add(ecken[a], ecken[b]), ecken[c]), 1 / 3);
          let n = norm(kreuz(sub(ecken[b], ecken[a]), sub(ecken[c], ecken[a])));
          if (dot(n, mitte) < 0) { idx = [a, c, b]; n = mal(n, -1); }   // Normale nach außen
          // Oben auf der Fläche: die Ecke, die am weitesten "nach oben" (fester Bezug) zeigt
          const bezug = norm([0.13, 1, 0.07]);
          let oben = idx[0], best = -Infinity;
          idx.forEach(function (i) { const d = dot(sub(ecken[i], mitte), bezug); if (d > best) { best = d; oben = i; } });
          const u = norm(sub(ecken[oben], mitte));
          flaechen.push({ ecken: idx, mitte: mitte, n: n, u: u, r: kreuz(u, n), zahl: 0 });
        }
      }
    }
    // Nummerierung: Pol = Fläche 0 → 20; Nachbarn 2, 8, 14; der Ring darunter die übrigen geraden Zahlen
    const pol = flaechen[0].n;
    const quer = norm(kreuz(pol, [0, 0, 1]).every(function (x) { return Math.abs(x) < 1e-6; }) ? [1, 0, 0] : kreuz(pol, [0, 0, 1]));
    const quer2 = kreuz(pol, quer);
    const winkel = function (f) { return Math.atan2(dot(f.n, quer2), dot(f.n, quer)); };
    const oben = flaechen.filter(function (f) { return dot(f.n, pol) > 1e-6; });
    oben.sort(function (a, b) { return dot(b.n, pol) - dot(a.n, pol); });     // Pol zuerst, dann Nachbarn, dann Ring
    const kreis = oben.slice(1, 4).sort(function (a, b) { return winkel(a) - winkel(b); });
    const ring = oben.slice(4).sort(function (a, b) { return winkel(a) - winkel(b); });
    oben[0].zahl = 20;
    [2, 8, 14].forEach(function (z, i) { kreis[i].zahl = z; });
    [16, 4, 10, 18, 6, 12].forEach(function (z, i) { ring[i].zahl = z; });
    // Die untere Hälfte: jeweils 21 minus die gegenüberliegende Fläche
    flaechen.forEach(function (f) {
      if (f.zahl) return;
      const gegen = flaechen.find(function (g) { return dot(g.n, f.n) < -0.999; });
      f.zahl = 21 - gegen.zahl;
    });
    return { ecken: ecken, flaechen: flaechen, radius: radius };
  })();

  /** Index der Fläche, die beim Ergebnis vorne liegt (über 20: dieselbe Fläche wie (zahl − 1) mod 20 + 1). */
  function flaecheFuer(zahl) {
    const z = ((Math.max(1, Math.round(zahl)) - 1) % 20) + 1;
    return FORM.flaechen.findIndex(function (f) { return f.zahl === z; });
  }

  /**
   * Lage, in der Fläche i gerade nach vorn zeigt (zum Betrachter, +z) und
   * ihre Zahl aufrecht steht: Die Drehung bildet (r, u, n) der Fläche auf
   * die Bildschirmachsen (x, y, z) ab.
   */
  function zielLage(i) {
    const f = FORM.flaechen[i];
    return qAusMatrix([f.r, f.u, f.n]);
  }


  /* ------------------------------------------------------------------------
     FARBEN aus CSS-Variablen
     ------------------------------------------------------------------------ */

  function farbeLesen(text, ersatz) {
    const t = (text || "").trim();
    let m = /^#([0-9a-f]{3})$/i.exec(t);
    if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(t);
    if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(([^)]+)\)$/i.exec(t);
    if (m) {
      const teile = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return { r: teile[0], g: teile[1], b: teile[2], a: teile.length > 3 ? teile[3] : 1 };
    }
    return ersatz;
  }

  function farben(canvas) {
    const s = getComputedStyle(canvas);
    return {
      flaeche: farbeLesen(s.getPropertyValue("--w3d-farbe"), { r: 108, g: 75, b: 216, a: 1 }),
      kante: farbeLesen(s.getPropertyValue("--w3d-kante"), { r: 30, g: 20, b: 70, a: 1 }),
      zahl: farbeLesen(s.getPropertyValue("--w3d-zahl"), { r: 255, g: 255, b: 255, a: 1 }),
      zahlRand: farbeLesen(s.getPropertyValue("--w3d-zahl-rand"), { r: 20, g: 12, b: 50, a: 0.85 }),
      schatten: farbeLesen(s.getPropertyValue("--w3d-schatten"), { r: 0, g: 0, b: 0, a: 0.3 }),
    };
  }

  function rgba(c, a) {
    return "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + "," + (a === undefined ? c.a : a) + ")";
  }

  /** Farbe heller (f > 1) oder dunkler (f < 1). */
  function schattiert(c, f) {
    if (f <= 1) return { r: c.r * f, g: c.g * f, b: c.b * f, a: c.a };
    const w = Math.min(1, f - 1);
    return { r: c.r + (255 - c.r) * w, g: c.g + (255 - c.g) * w, b: c.b + (255 - c.b) * w, a: c.a };
  }


  /* ------------------------------------------------------------------------
     ZEICHNEN
     ------------------------------------------------------------------------ */

  const LICHT = norm(K.licht);
  const HALB = norm(add(LICHT, [0, 0, 1]));     // für den Glanz (Blinn-Phong)

  /**
   * Ein Bild des Würfels.
   * @param {object} w – Zustand eines Würfels (canvas, ctx, farben, beschriftung)
   * @param {number[]} q – Lage als Quaternion
   * @param {number} hoehe – Höhe über dem Boden (0 = liegt; Anteil des Durchmessers)
   */
  function zeichne(w, q, hoehe) {
    const c = w.canvas, ctx = w.ctx;
    const B = c.width, H = c.height;
    if (!B || !H) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, B, H);
    const r = B * K.fuellung;                          // Würfelradius in Pixeln
    const skala = r / FORM.radius;
    const kamera = K.kamera * FORM.radius;
    const mx = B / 2;
    const bodenY = H * K.mitteY + r;                   // hier liegt der Würfel auf
    const my = H * K.mitteY - (hoehe || 0) * 2 * r;
    const fa = w.farben;

    // Schatten am Boden: kleiner und blasser, je höher der Würfel
    const h = Math.min(1, Math.max(0, hoehe || 0));
    ctx.save();
    ctx.fillStyle = rgba(fa.schatten, fa.schatten.a * (1 - h * 0.6));
    ctx.beginPath();
    ctx.ellipse(mx, bodenY - r * 0.04, r * (0.8 - h * 0.3), r * (0.16 - h * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const m = qMatrix(q);
    const projiziere = function (p) {
      const v = dreh(m, p);
      const f = kamera / (kamera - v[2]);
      return { x: mx + v[0] * skala * f, y: my - v[1] * skala * f, z: v[2] };
    };
    const ecken = FORM.ecken.map(projiziere);

    // Sichtbare Flächen, von hinten nach vorn
    const sichtbar = [];
    FORM.flaechen.forEach(function (f, i) {
      const n = dreh(m, f.n);
      if (n[2] <= 0.01) return;
      sichtbar.push({ f: f, i: i, n: n, z: dreh(m, f.mitte)[2] });
    });
    sichtbar.sort(function (a, b) { return a.z - b.z; });

    const kante = Math.max(1, B / 160);
    sichtbar.forEach(function (s) {
      const p = s.f.ecken.map(function (k) { return ecken[k]; });
      // Licht: Grundhelligkeit + Ausrichtung zum Licht, dazu ein Glanzpunkt
      const diffus = Math.max(0, dot(s.n, LICHT));
      const hell = K.umgebung + K.diffus * diffus;
      const glanz = K.glanz * Math.pow(Math.max(0, dot(s.n, HALB)), K.glanzSchaerfe);
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.closePath();
      ctx.fillStyle = rgba(schattiert(fa.flaeche, hell), 1);
      ctx.fill();
      if (glanz > 0.01) {
        ctx.fillStyle = "rgba(255,255,255," + Math.min(0.6, glanz).toFixed(3) + ")";
        ctx.fill();
      }
      ctx.lineJoin = "round";
      ctx.lineWidth = kante;
      ctx.strokeStyle = rgba(fa.kante, 0.85);
      ctx.stroke();
      zeichneZahl(w, s, m, projiziere);
    });
  }

  /** Die Zahl auf einer Fläche: in der Ebene der Fläche (affin projiziert), aufrecht zur Ecke "oben". */
  function zeichneZahl(w, s, m, projiziere) {
    const ctx = w.ctx, f = s.f;
    const text = w.beschriftung[s.i] !== undefined ? String(w.beschriftung[s.i]) : String(f.zahl);
    const schritt = 0.01;
    const c0 = projiziere(f.mitte);
    const cr = projiziere(add(f.mitte, mal(f.r, schritt)));
    const cu = projiziere(add(f.mitte, mal(f.u, schritt)));
    // 100 Einheiten im Text = 1 Einheit auf dem Ikosaeder (Kante = 2)
    const t = 1 / (schritt * 100);
    ctx.save();
    ctx.setTransform((cr.x - c0.x) * t, (cr.y - c0.y) * t, -(cu.x - c0.x) * t, -(cu.y - c0.y) * t, c0.x, c0.y);
    const deckkraft = Math.min(1, Math.max(0, (s.n[2] - 0.05) * 2.2));
    const groesse = K.zahlGroesse * 2 * 100 * (text.length > 1 ? 0.82 : 1);
    ctx.font = "900 " + Math.round(groesse) + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = deckkraft;
    ctx.lineJoin = "round";
    ctx.lineWidth = groesse * 0.16;
    ctx.strokeStyle = rgba(w.farben.zahlRand);
    ctx.fillStyle = rgba(w.farben.zahl);
    const y = -groesse * 0.02;
    ctx.strokeText(text, 0, y);
    ctx.fillText(text, 0, y);
    // 6 und 9: ein Strich darunter zur Unterscheidung
    if (text === "6" || text === "9") {
      const breite = groesse * 0.42, dicke = groesse * 0.09, unten = groesse * 0.5;
      ctx.fillRect(-breite / 2, unten, breite, dicke);
    }
    ctx.restore();
  }


  /* ------------------------------------------------------------------------
     EIN WÜRFEL
     ------------------------------------------------------------------------ */

  const alle = new Set();       // lebende Würfel (für Farbwechsel hell/dunkel)

  function ohneBewegung() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Erstellt einen Würfel auf einem Canvas.
   * @param {HTMLCanvasElement} canvas – Größe kommt aus dem CSS
   * @param {object} [optionen] – { schema: "held" | "boss" }
   * @returns {object} { zeige, rolle, ueberspringe, rollt, vorneZahl, vorneFlaeche, zeichneNeu }
   */
  function erstelle(canvas, optionen) {
    canvas.classList.add("w3d");
    canvas.dataset.schema = (optionen && optionen.schema) || "held";
    canvas.setAttribute("aria-hidden", "true");
    const w = {
      canvas: canvas,
      ctx: canvas.getContext("2d"),
      farben: null,
      beschriftung: {},       // Fläche → Text, falls abweichend (Würfel über 20 Seiten)
      lage: qMal(qMal(qAchse([1, 0, 0], K.ruhe[0]), qAchse([0, 1, 0], K.ruhe[1])), qMal(qAchse([0, 0, 1], K.ruhe[2]), zielLage(flaecheFuer(20)))),
      hoehe: 0,
      lauf: null,             // die laufende Animation
      ziel: null,             // Lage am Ende
    };

    /** Canvas-Größe an CSS-Größe × devicePixelRatio anpassen. */
    function passeGroesseAn() {
      const dpr = window.devicePixelRatio || 1;
      const b = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (b > 0 && h > 0 && (canvas.width !== b || canvas.height !== h)) {
        canvas.width = b;
        canvas.height = h;
        return true;
      }
      return false;
    }

    function bild() {
      if (!w.farben) w.farben = farben(canvas);
      passeGroesseAn();
      zeichne(w, w.lage, w.hoehe);
    }

    function zeichneNeu() {
      w.farben = farben(canvas);
      bild();
    }

    /** Ergebnisfläche festlegen (über 20: die Fläche zeigt die gewürfelte Zahl selbst). */
    function setzeZiel(zahl) {
      const i = flaecheFuer(zahl);
      w.beschriftung = {};
      if (zahl > 20) w.beschriftung[i] = zahl;
      w.ziel = zielLage(i);
      return i;
    }

    function beende() {
      if (w.lauf) {
        cancelAnimationFrame(w.lauf.bild);
        const fertig = w.lauf.fertig;
        w.lauf = null;
        fertig();
      }
    }

    /**
     * Sofort mit der Ergebnisfläche nach vorn (ohne Drehung) – für "Bewegung
     * reduzieren", "Kampfanimationen: Aus" und das Laden.
     * @param {number|null} zahl – null: Ruhelage (20 schräg oben)
     */
    function zeige(zahl) {
      beende();
      w.hoehe = 0;
      if (zahl === null || zahl === undefined) {
        w.beschriftung = {};
        w.lage = qMal(qMal(qAchse([1, 0, 0], K.ruhe[0]), qAchse([0, 1, 0], K.ruhe[1])), qMal(qAchse([0, 0, 1], K.ruhe[2]), zielLage(flaecheFuer(20))));
      } else {
        setzeZiel(zahl);
        w.lage = w.ziel;
      }
      zeichneNeu();
    }

    /**
     * Der Wurf: schnelle Drehung um mehrere Achsen, immer langsamer, kippt
     * zum Schluss über ein, zwei Kanten und kommt auf der Ergebnisfläche zur
     * Ruhe. Alle Drehungen sind "Abweichungen" von der Ziellage, die zum
     * Ende hin auf 0 laufen – so endet der Wurf genau dort, ohne Sprung.
     * Dazu fällt er aus der Höhe, prallt einmal kurz ab und liegt.
     * @param {number} zahl – das Ergebnis
     * @param {number} ms – Dauer
     * @param {function} [zufall] – Zufallsquelle (für Tests); sonst Math.random
     * @returns {Promise} – erfüllt, wenn er liegt (oder abgekürzt wurde)
     */
    function rolle(zahl, ms, zufall) {
      beende();
      const z = zufall || Math.random;
      setzeZiel(zahl);
      w.farben = farben(canvas);
      if (!(ms > 0) || ohneBewegung()) {
        w.lage = w.ziel;
        w.hoehe = 0;
        bild();
        return Promise.resolve();
      }
      // Zwei schnelle Drehachsen und eine Kipp-Achse (waagerecht, damit er "über die Kante" kippt)
      const zufallsAchse = function () { return norm([z() * 2 - 1, z() * 2 - 1, z() * 2 - 1]); };
      const a1 = zufallsAchse(), a2 = zufallsAchse();
      const w1 = (K.drehungen[0] + z() * (K.drehungen[1] - K.drehungen[0])) * Math.PI * 2 * (z() < 0.5 ? -1 : 1);
      const w2 = (0.6 + z() * 0.8) * Math.PI * 2 * (z() < 0.5 ? -1 : 1);
      const kippWinkel = Math.atan2(2, 1 + Math.sqrt(5)) * 2;     // Winkel zwischen zwei Nachbarflächen (≈ 41,8°)
      const kipp = norm([1, (z() - 0.5) * 0.6, 0]);
      const wk = K.kippen * kippWinkel * (z() < 0.5 ? -1 : 1);
      const ziel = w.ziel;
      const glatt = function (x) { return x * x * (3 - 2 * x); };
      return new Promise(function (fertig) {
        const start = performance.now();
        w.lauf = { fertig: fertig, bild: 0 };
        function schritt(jetzt) {
          if (!w.lauf) return;
          const t = Math.min(1, (jetzt - start) / ms);
          // schnelle Drehung, immer langsamer (bis K.kippenAb ist sie fast vorbei)
          const d1 = Math.pow(1 - Math.min(1, t / 0.75), 3);
          const d2 = Math.pow(1 - Math.min(1, t / 0.6), 2);
          // Kippen über die Kanten: hält, dann zum Schluss in einem Zug auf 0
          const k = t < K.kippenAb ? 1 : 1 - glatt((t - K.kippenAb) / (1 - K.kippenAb));
          const abweichung = qMal(qMal(qAchse(a1, w1 * d1), qAchse(a2, w2 * d2)), qAchse(kipp, wk * k));
          w.lage = qMal(abweichung, ziel);
          // Höhe: fällt bis zum ersten Aufprall, springt einmal kurz ab, liegt
          if (t < K.aufprall) {
            const f = t / K.aufprall;
            w.hoehe = K.sprungHoehe * (1 - f * f);
          } else {
            const f = (t - K.aufprall) / (1 - K.aufprall);
            w.hoehe = f < 0.6 ? K.sprungHoehe * 0.28 * Math.sin(Math.PI * f / 0.6) : 0;
          }
          bild();
          if (t >= 1) {
            w.lage = ziel;
            w.hoehe = 0;
            bild();
            beende();
            return;
          }
          w.lauf.bild = requestAnimationFrame(schritt);
        }
        w.lauf.bild = requestAnimationFrame(schritt);
      });
    }

    /** Abkürzen: in K.abkuerzen Millisekunden auf die Ergebnisfläche drehen (das Versprechen ist sofort erfüllt). */
    function ueberspringe() {
      if (!w.ziel) return;
      const laufenderWurf = Boolean(w.lauf);
      beende();
      if (!laufenderWurf) return;
      const von = w.lage, hoeheVon = w.hoehe, ziel = w.ziel;
      if (ohneBewegung()) {
        w.lage = ziel; w.hoehe = 0; bild();
        return;
      }
      const start = performance.now();
      w.lauf = { fertig: function () {}, bild: 0 };
      function schritt(jetzt) {
        if (!w.lauf) return;
        const t = Math.min(1, (jetzt - start) / K.abkuerzen);
        const e = 1 - Math.pow(1 - t, 3);
        w.lage = qSlerp(von, ziel, e);
        w.hoehe = hoeheVon * (1 - e);
        bild();
        if (t >= 1) { w.lage = ziel; w.hoehe = 0; bild(); beende(); return; }
        w.lauf.bild = requestAnimationFrame(schritt);
      }
      w.lauf.bild = requestAnimationFrame(schritt);
    }

    /** Welche Fläche zeigt gerade am weitesten nach vorn? (für Prüfungen) */
    function vorneFlaeche() {
      const m = qMatrix(w.lage);
      let best = -1, beste = -Infinity;
      FORM.flaechen.forEach(function (f, i) { const z = dreh(m, f.n)[2]; if (z > beste) { beste = z; best = i; } });
      return { index: best, zahl: w.beschriftung[best] !== undefined ? w.beschriftung[best] : FORM.flaechen[best].zahl, ausrichtung: beste,
        // wie aufrecht die Zahl steht: 1 = genau aufrecht
        aufrecht: dreh(m, FORM.flaechen[best].u)[1] };
    }

    const instanz = {
      zeige: zeige,
      rolle: rolle,
      ueberspringe: ueberspringe,
      rollt: function () { return Boolean(w.lauf); },
      vorneFlaeche: vorneFlaeche,
      vorneZahl: function () { return vorneFlaeche().zahl; },
      lage: function () { return w.lage.slice(); },     // aktuelle Lage (Quaternion, für Prüfungen)
      zielLage: function () { return w.ziel ? w.ziel.slice() : null; },
      zeichneNeu: zeichneNeu,
      canvas: canvas,
    };
    canvas.__wuerfel3d = instanz;     // für Prüfungen im Browser
    alle.add(instanz);
    // Größe ändert sich (Drehen, Fenster): neu zeichnen
    if (window.ResizeObserver) new ResizeObserver(function () { if (!w.lauf) bild(); }).observe(canvas);
    zeige(null);
    return instanz;
  }

  // Hell/Dunkel gewechselt: alle Würfel mit den neuen Farben zeichnen
  function alleNeu() {
    alle.forEach(function (x) {
      if (!x.canvas.isConnected) { alle.delete(x); return; }
      x.zeichneNeu();
    });
  }
  if (typeof window !== "undefined" && window.MutationObserver) {
    new MutationObserver(alleNeu).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (window.matchMedia) {
      const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
      if (dunkel.addEventListener) dunkel.addEventListener("change", alleNeu);
    }
  }

  return {
    KONFIG: K,
    FORM: FORM,
    erstelle: erstelle,
    flaecheFuer: flaecheFuer,
    zielLage: zielLage,
    qMatrix: qMatrix,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = Dice3D;
}
