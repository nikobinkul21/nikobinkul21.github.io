/* ==========================================================================
   chess/claudy.js – Claudy, der kleine Assistent neben dem Brett
   Eine eigene, schlichte Figur: ein rundes Wesen mit zwei Augen und einem
   kleinen Blatt auf dem Kopf. Claudy spricht in einer Sprechblase – kurz,
   locker und ermutigend. Je nach Stimmung schaut er anders:
     "ruhig"  normaler Blick       "froh"   lachende Augen
     "denkt"  Blick nach oben      "sorge"  besorgter Blick
   WAS Claudy sagt, entscheidet spiel.js (mit den Bausteinen aus muster.js);
   diese Datei zeichnet nur die Figur und die Sprechblase.
   Die Figur entsteht als SVG-Elemente, Texte kommen per textContent.
   Aussehen: css/chess.css.
   ========================================================================== */

/**
 * @param {HTMLElement} wurzel – hier hinein wird Claudy gebaut
 * @returns {{sag: function(string, string=), schweig: function()}}
 */
function SchachClaudy(wurzel) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STIMMUNGEN = ["ruhig", "froh", "denkt", "sorge"];

  function teil(tag, attribute) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attribute).forEach(function (name) { e.setAttribute(name, attribute[name]); });
    return e;
  }

  /** Eine Gruppe von Formen, die nur bei bestimmten Stimmungen sichtbar ist. */
  function gruppe(klasse, formen) {
    const g = teil("g", { class: klasse });
    formen.forEach(function (f) { g.appendChild(teil(f[0], f[1])); });
    return g;
  }

  wurzel.classList.add("sch-claudy");
  const figur = teil("svg", { class: "sch-claudy-figur", viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" });
  // Blatt auf dem Kopf, runder Körper, Füße
  figur.appendChild(gruppe("sch-claudy-blatt", [
    ["path", { d: "M32 14c0-6 3-9 8-10 0 6-3 9-8 10z" }],
    ["path", { d: "M32 14v-4" }],
  ]));
  figur.appendChild(teil("ellipse", { class: "sch-claudy-koerper", cx: 32, cy: 37, rx: 22, ry: 21 }));
  figur.appendChild(gruppe("sch-claudy-fuesse", [
    ["path", { d: "M22 57h7M35 57h7" }],
  ]));
  // Augen je Stimmung
  figur.appendChild(gruppe("sch-claudy-augen ist-ruhig", [
    ["circle", { cx: 24, cy: 34, r: 3.2 }], ["circle", { cx: 40, cy: 34, r: 3.2 }],
  ]));
  figur.appendChild(gruppe("sch-claudy-augen ist-froh", [
    ["path", { d: "M20 35c1.5-3.5 6.5-3.5 8 0" }], ["path", { d: "M36 35c1.5-3.5 6.5-3.5 8 0" }],
  ]));
  figur.appendChild(gruppe("sch-claudy-augen ist-denkt", [
    ["circle", { cx: 25.5, cy: 31.5, r: 3.2 }], ["circle", { cx: 41.5, cy: 31.5, r: 3.2 }],
  ]));
  figur.appendChild(gruppe("sch-claudy-augen ist-sorge", [
    ["circle", { cx: 24, cy: 35, r: 3 }], ["circle", { cx: 40, cy: 35, r: 3 }],
    ["path", { d: "M19 29l7 2M45 29l-7 2" }],
  ]));
  // Mund je Stimmung
  figur.appendChild(gruppe("sch-claudy-mund ist-ruhig", [["path", { d: "M28 44c2.5 2 5.5 2 8 0" }]]));
  figur.appendChild(gruppe("sch-claudy-mund ist-froh", [["path", { d: "M26 43c3 4.5 9 4.5 12 0" }]]));
  figur.appendChild(gruppe("sch-claudy-mund ist-denkt", [["path", { d: "M29 45h6" }]]));
  figur.appendChild(gruppe("sch-claudy-mund ist-sorge", [["path", { d: "M28 46c2.5-2 5.5-2 8 0" }]]));

  const blase = document.createElement("p");
  blase.className = "sch-claudy-blase";
  blase.setAttribute("role", "status");          // Screenreader lesen Claudys Sätze vor
  wurzel.appendChild(figur);
  wurzel.appendChild(blase);

  function stimmung(name) {
    STIMMUNGEN.forEach(function (s) { wurzel.classList.toggle("ist-" + s, s === name); });
  }

  /**
   * Claudy sagt etwas.
   * @param {string} text
   * @param {string} [wie] – Stimmung: "ruhig" (Vorgabe), "froh", "denkt", "sorge"
   */
  function sag(text, wie) {
    blase.textContent = text;
    wurzel.classList.remove("ist-still");
    stimmung(STIMMUNGEN.indexOf(wie) >= 0 ? wie : "ruhig");
  }

  /** Claudy ist still: keine Sprechblase. */
  function schweig() {
    blase.textContent = "";
    wurzel.classList.add("ist-still");
    stimmung("ruhig");
  }

  schweig();
  return { sag: sag, schweig: schweig };
}
