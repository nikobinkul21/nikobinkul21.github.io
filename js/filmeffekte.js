/* ==========================================================================
   filmeffekte.js – Filmkorn, Staub, Kratzer, Flackern und Vignette
   Legt eine eigene Ebene über die ganze Seite (fängt keine Klicks ab):
     Vignette, Korn und Flackern sind reines CSS (css/style.css, 6d),
     Staubpunkte und Kratzer zeichnet ein kleines Canvas – sparsam: nur
     wenn gerade etwas zu sehen ist, und nie, solange der Tab verborgen ist.
   Alle Werte (Häufigkeit, Farbe, Stärke) als CSS-Variablen in style.css.
   Schalter "Film-Effekte" in den Einstellungen (js/settings.js); gespeichert
   unter localStorage "ntb-filmeffekte" ("aus" = ausgeschaltet). Das Skript
   im <head> von index.html setzt die Klasse "ohne-film" schon beim Laden.
   Bei "Bewegung reduzieren" bleibt nur das stehende Korn.
   ========================================================================== */

const FilmEffekte = (function () {
  const SCHLUESSEL = "ntb-filmeffekte";
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  let canvas = null, ctx = null;
  let teile = [];              // sichtbare Staubpunkte und Kratzer
  let laeuft = false, zuletzt = 0;
  let naechsterKratzer = 0;
  let werte = null;            // gelesene CSS-Variablen (beim Start und Designwechsel)

  /** Baut die Ebene einmal auf. */
  function init() {
    const ebene = document.createElement("div");
    ebene.className = "film-ebene";
    ebene.setAttribute("aria-hidden", "true");
    ebene.innerHTML =
      '<div class="film-vignette"></div>' +
      '<div class="film-korn"></div>' +
      '<div class="film-flackern"></div>' +
      '<canvas class="film-staub"></canvas>';
    document.body.appendChild(ebene);
    canvas = ebene.querySelector(".film-staub");
    ctx = canvas.getContext("2d");
    leseWerte();
    // Hell/dunkel gewechselt: Farben neu lesen
    new MutationObserver(leseWerte).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", groesse);
    document.addEventListener("visibilitychange", pruefeLauf);
    ruhigAbfrage.addEventListener("change", pruefeLauf);
    groesse();
    pruefeLauf();
  }

  // Staub braucht keine hohe Auflösung: 1 Canvas-Pixel = 1 CSS-Pixel
  function groesse() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function istAn() {
    try {
      return localStorage.getItem(SCHLUESSEL) !== "aus";
    } catch (fehler) {
      return true;
    }
  }

  /** Schalter in den Einstellungen. */
  function setzeAn(an) {
    try {
      if (an) localStorage.removeItem(SCHLUESSEL);
      else localStorage.setItem(SCHLUESSEL, "aus");
    } catch (fehler) {
      // nicht speicherbar – gilt dann bis zum Neuladen
    }
    document.documentElement.classList.toggle("ohne-film", !an);
    pruefeLauf();
  }

  /** Staub läuft nur, wenn die Effekte an sind, der Tab sichtbar ist und Bewegung erlaubt. */
  function pruefeLauf() {
    const soll = istAn() && !document.hidden && !ruhigAbfrage.matches;
    if (soll && !laeuft) {
      laeuft = true;
      zuletzt = performance.now();
      naechsterKratzer = zuletzt + zufallsAbstand(werte.kratzerAbstand * 1000);
      requestAnimationFrame(bild);
    } else if (!soll) {
      laeuft = false;
      teile = [];
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function leseWerte() {
    const s = getComputedStyle(document.documentElement);
    const zahl = function (name, ersatz) {
      const z = parseFloat(s.getPropertyValue(name));
      return isNaN(z) ? ersatz : z;
    };
    werte = {
      proSekunde: zahl("--staub-pro-sekunde", 1.4),
      kratzerAbstand: zahl("--kratzer-abstand", 9),
      deckkraft: zahl("--staub-deckkraft", 0.55),
      rgb: (s.getPropertyValue("--staub-farbe").trim() || "232 227 213").split(/\s+/).join(","),
    };
  }

  // Exponentiell verteilte Wartezeit: wirkt zufällig, nie im Takt
  function zufallsAbstand(mittel) {
    return -Math.log(1 - Math.random()) * mittel;
  }

  /**
   * Ein Bild: neue Staubpunkte und Kratzer würfeln, alte altern lassen,
   * zeichnen. Ist nichts zu sehen, bleibt das Canvas leer und es wird
   * nur gewürfelt (kein Zeichnen).
   */
  function bild(jetzt) {
    if (!laeuft) return;
    const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
    zuletzt = jetzt;
    const w = canvas.width, h = canvas.height;

    // Staubpunkte: im Mittel --staub-pro-sekunde, kurz sichtbar
    if (Math.random() < werte.proSekunde * dt) {
      const anzahl = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < anzahl; i++) {
        teile.push({
          art: "staub", x: Math.random() * w, y: Math.random() * h,
          r: 0.6 + Math.random() * 1.6, dauer: 0.05 + Math.random() * 0.14, t: 0,
          haar: Math.random() < 0.15,                 // manchmal ein feines Härchen
          w: Math.random() * Math.PI,
        });
      }
    }
    // Kratzer: feine senkrechte Linie, kurz und selten
    if (jetzt >= naechsterKratzer) {
      naechsterKratzer = jetzt + zufallsAbstand(werte.kratzerAbstand * 1000);
      teile.push({
        art: "kratzer", x: w * (0.1 + Math.random() * 0.8), y0: Math.random() * h * 0.4,
        laenge: h * (0.3 + Math.random() * 0.7), dauer: 0.18 + Math.random() * 0.35, t: 0,
        neigung: (Math.random() - 0.5) * 6, wandern: (Math.random() - 0.5) * 40,
      });
    }

    const warSichtbar = teile.length > 0;
    teile.forEach(function (t) { t.t += dt; });
    teile = teile.filter(function (t) { return t.t < t.dauer; });
    if (teile.length || warSichtbar) zeichne(w, h);
    requestAnimationFrame(bild);
  }

  function zeichne(w, h) {
    ctx.clearRect(0, 0, w, h);
    const deckkraft = werte.deckkraft, rgb = werte.rgb;
    teile.forEach(function (t) {
      // Ein- und Ausblenden innerhalb der kurzen Lebenszeit
      const a = deckkraft * Math.sin(Math.PI * Math.min(1, t.t / t.dauer));
      if (t.art === "staub") {
        ctx.fillStyle = "rgba(" + rgb + "," + a + ")";
        if (t.haar) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.quadraticCurveTo(t.x + Math.cos(t.w) * 6, t.y + Math.sin(t.w) * 6, t.x + Math.cos(t.w + 1) * 12, t.y + Math.sin(t.w + 1) * 9);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const x = t.x + t.wandern * (t.t / t.dauer);
        ctx.strokeStyle = "rgba(" + rgb + "," + a * 0.6 + ")";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, t.y0);
        ctx.lineTo(x + t.neigung, t.y0 + t.laenge);
        ctx.stroke();
      }
    });
  }

  return { init: init, istAn: istAn, setzeAn: setzeAn };
})();

FilmEffekte.init();
