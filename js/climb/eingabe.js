/* ==========================================================================
   climb/eingabe.js – Tastatur und Touch für das Kletterspiel
   Meldet nur "gedrückt" und "losgelassen" (mit Code) an die Oberfläche
   weiter – was das bedeutet, entscheiden die Regeln (climb/regeln.js).
     Tastatur – event.code (die POSITION der Taste, unabhängig vom Layout);
                Wiederholungen beim Gedrückthalten werden ignoriert.
     Touch    – ein Raster aus Griff-Feldern; jeder Finger (pointerId) hält
                sein Feld, bis er abhebt. Mehrere Finger gleichzeitig.
     Fokus    – verliert das Fenster den Fokus oder wird der Tab gewechselt,
                meldet der Browser keine "keyup" mehr: Dann gilt alles als
                losgelassen und das Spiel pausiert (beimFokusVerlust).
   ========================================================================== */

const KletterEingabe = (function () {

  /**
   * @param {object} o
   *   aktiv()          – nimmt das Spiel gerade Eingaben an? (sichtbar, nicht in einem Dialog)
   *   beimDruecken(code, quelle) · beimLoslassen(code, quelle) – quelle "tastatur" oder "touch"
   *   beimFokusVerlust()
   *   beimTastendruck(event) – jede Taste (auch andere), z. B. um auf Tastatur umzuschalten
   */
  function erstelle(o) {
    const unten = new Set();              // gedrückte Tasten (Codes)
    const finger = new Map();             // pointerId → Feld-Code

    function istSpielTaste(code) {
      return /^(Key[A-Z]|Digit[0-9])$/.test(code);
    }

    document.addEventListener("keydown", function (ev) {
      if (!o.aktiv()) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;   // Tastenkürzel des Browsers bleiben frei
      if (o.beimTastendruck) o.beimTastendruck(ev);
      if (!istSpielTaste(ev.code)) return;
      ev.preventDefault();
      if (ev.repeat || unten.has(ev.code)) return;          // gehaltene Taste wiederholt sich – nicht neu zählen
      unten.add(ev.code);
      o.beimDruecken(ev.code, "tastatur");
    });

    document.addEventListener("keyup", function (ev) {
      if (!unten.has(ev.code)) return;
      unten.delete(ev.code);
      if (o.aktiv()) ev.preventDefault();
      o.beimLoslassen(ev.code, "tastatur");
    });

    // Fokus weg: Der Browser vergisst die gedrückten Tasten → Pause statt Absturz
    function fokusWeg() {
      unten.clear();
      finger.clear();
      o.beimFokusVerlust();
    }
    window.addEventListener("blur", fokusWeg);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") fokusWeg();
    });

    /**
     * Touch-Raster anschließen: Jedes Element mit data-code ist ein Griff-Feld.
     * @param {HTMLElement} raster
     */
    function verbindeRaster(raster) {
      raster.addEventListener("pointerdown", function (ev) {
        const feld = ev.target.closest("[data-code]");
        if (!feld || !o.aktiv()) return;
        ev.preventDefault();
        const code = feld.dataset.code;
        finger.set(ev.pointerId, code);
        // Zählt nur, wenn noch kein anderer Finger dieses Feld hält
        if (Array.from(finger.values()).filter(function (c) { return c === code; }).length === 1) {
          o.beimDruecken(code, "touch");
        }
      });
      const hoch = function (ev) {
        const code = finger.get(ev.pointerId);
        if (code === undefined) return;
        finger.delete(ev.pointerId);
        if (Array.from(finger.values()).indexOf(code) === -1) o.beimLoslassen(code, "touch");
      };
      raster.addEventListener("pointerup", hoch);
      raster.addEventListener("pointercancel", hoch);
      // Langes Drücken soll kein Kontextmenü öffnen
      raster.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    }

    return {
      verbindeRaster: verbindeRaster,
      /** Alles vergessen (z. B. beim Wechsel zwischen Tastatur und Touch). */
      zuruecksetzen: function () { unten.clear(); finger.clear(); },
    };
  }

  /**
   * Beschriftung der Tasten: Kennt der Browser das eingestellte Layout
   * (navigator.keyboard.getLayoutMap, z. B. Chrome), steht dort die echte
   * Beschriftung – sonst die von QWERTZ aus climb/keyboard.js.
   * @param {object} feld – Tastatur mit Liste "tasten" (KletterTastatur aus climb/keyboard.js)
   * @returns {Promise<object>} – Code → Beschriftung
   */
  function beschriftungen(feld) {
    const qwertz = {};
    feld.tasten.forEach(function (t) { qwertz[t.code] = t.label; });
    if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return Promise.resolve(qwertz);
    return navigator.keyboard.getLayoutMap().then(function (karte) {
      const echt = {};
      feld.tasten.forEach(function (t) {
        const z = karte.get(t.code);
        echt[t.code] = z ? z.toUpperCase() : t.label;
      });
      return echt;
    }, function () { return qwertz; });
  }

  /** Gerät ohne Tastatur? (grober Zeiger, kein Hovern – Smartphone, Tablet) */
  function vermutlichTouch() {
    return window.matchMedia("(pointer: coarse) and (hover: none)").matches;
  }

  return { erstelle: erstelle, beschriftungen: beschriftungen, vermutlichTouch: vermutlichTouch };
})();
