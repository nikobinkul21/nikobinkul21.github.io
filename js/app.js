/* ==========================================================================
   app.js – das "Gehirn" des Hubs
   Kümmert sich um:
     1. Navigation zwischen den Ansichten (über den URL-Hash, z. B. #sudoku)
     2. Die mobile Sidebar (Hamburger-Menü)
     3. Den Dark-Mode-Schalter
   ========================================================================== */


/* --------------------------------------------------------------------------
   Einstellungen
   -------------------------------------------------------------------------- */

// Alle Ansichten. Bei Tools steht dabei:
//   init – die Startfunktion aus der Tool-Datei (z. B. calendar.js)
//   root – die ID des Containers in index.html, in den das Tool zeichnet
// Neues Tool? Hier eine Zeile ergänzen (plus Link in der Sidebar und
// eine <section> in index.html).
const ANSICHTEN = {
  home: null,
  kalender: { init: initCalendar, root: "calendar-root" },
  sudoku: { init: initSudoku, root: "sudoku-root" },
  einstellungen: null,
};

const START_ANSICHT = "home";
const THEME_SCHLUESSEL = "hub-theme"; // Name des Eintrags im localStorage

// Merkt sich, welche Tools schon gestartet wurden (damit init nur 1x läuft)
const gestarteteTools = {};


/* --------------------------------------------------------------------------
   Elemente aus dem HTML holen
   -------------------------------------------------------------------------- */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuButton = document.getElementById("menu-button");
const themeButton = document.getElementById("theme-button");
const themeSymbol = document.getElementById("theme-symbol");
const sidebarLinks = document.querySelectorAll(".sidebar__link");

// Dieselbe Grenze wie in style.css (@media max-width: 767px)
const mobilAbfrage = window.matchMedia("(max-width: 767px)");


/* ==========================================================================
   1. NAVIGATION
   ========================================================================== */

/**
 * Liest den Namen der Ansicht aus dem URL-Hash.
 * Beispiel: "…/index.html#sudoku" → "sudoku"
 * Unbekannte oder leere Hashes führen zur Startansicht.
 */
function ansichtAusHash() {
  const name = window.location.hash.slice(1); // "#" am Anfang entfernen
  if (name in ANSICHTEN) {
    return name;
  }
  return START_ANSICHT;
}

/**
 * Blendet die gewünschte Ansicht ein und alle anderen aus.
 * @param {string} name – z. B. "kalender"
 * @param {boolean} fokusSetzen – true, wenn der Fokus auf die Überschrift
 *                                springen soll (hilft Tastatur- und
 *                                Screenreader-Nutzern)
 */
function zeigeAnsicht(name, fokusSetzen) {
  // Alle Ansichten durchgehen: die gewünschte zeigen, den Rest verstecken
  for (const ansichtName in ANSICHTEN) {
    const section = document.getElementById("view-" + ansichtName);
    section.hidden = ansichtName !== name;
  }

  // Aktiven Menüpunkt markieren. aria-current="page" sagt Screenreadern
  // "hier bist du gerade" – und das CSS nutzt es für die Hervorhebung.
  sidebarLinks.forEach(function (link) {
    if (link.dataset.view === name) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Tool beim ersten Öffnen starten
  const tool = ANSICHTEN[name];
  if (tool && !gestarteteTools[name]) {
    tool.init(document.getElementById(tool.root));
    gestarteteTools[name] = true;
  }

  // Titel im Browser-Tab anpassen
  const ueberschrift = document.getElementById("titel-" + name);
  document.title = ueberschrift.textContent + " – Mein Hub";

  if (fokusSetzen) {
    ueberschrift.focus();
  }
}

// Wenn sich der Hash ändert (Klick auf einen Link, Zurück-Button im Browser),
// die passende Ansicht zeigen.
window.addEventListener("hashchange", function () {
  zeigeAnsicht(ansichtAusHash(), true);
});


/* ==========================================================================
   2. MOBILE SIDEBAR
   ========================================================================== */

function sidebarOeffnen() {
  sidebar.classList.add("offen");
  overlay.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "Menü schließen");
  // Fokus auf den ersten Menüpunkt, damit man direkt mit der Tastatur weitermachen kann
  sidebarLinks[0].focus();
}

/**
 * @param {boolean} fokusZurueck – true: Fokus wieder auf den Hamburger-Button
 */
function sidebarSchliessen(fokusZurueck) {
  sidebar.classList.remove("offen");
  overlay.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Menü öffnen");
  if (fokusZurueck) {
    menuButton.focus();
  }
}

function sidebarIstOffen() {
  return sidebar.classList.contains("offen");
}

// Hamburger-Button: öffnen bzw. schließen
menuButton.addEventListener("click", function () {
  if (sidebarIstOffen()) {
    sidebarSchliessen(false);
  } else {
    sidebarOeffnen();
  }
});

// Klick neben die Sidebar (aufs Overlay) schließt sie
overlay.addEventListener("click", function () {
  sidebarSchliessen(false);
});

// Nach Auswahl eines Menüpunkts schließen (nur auf dem Handy relevant)
sidebarLinks.forEach(function (link) {
  link.addEventListener("click", function () {
    if (sidebarIstOffen()) {
      sidebarSchliessen(false);
    }
  });
});

// Escape-Taste schließt die Sidebar
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && sidebarIstOffen()) {
    sidebarSchliessen(true);
  }
});

// Wird das Fenster breiter als 768 px, offene mobile Sidebar zurücksetzen
mobilAbfrage.addEventListener("change", function () {
  if (!mobilAbfrage.matches && sidebarIstOffen()) {
    sidebarSchliessen(false);
  }
});


/* ==========================================================================
   3. DARK MODE
   Das Theme wurde schon beim Laden im <head> von index.html gesetzt.
   Hier geht es nur noch um den Schalter.
   ========================================================================== */

function aktuellesTheme() {
  return document.documentElement.getAttribute("data-theme");
}

/**
 * Setzt das Theme und passt den Schalter an.
 * @param {string} theme – "light" oder "dark"
 */
function setzeTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const istDunkel = theme === "dark";
  // aria-pressed: Screenreader sagen "Dunkles Design, gedrückt/nicht gedrückt"
  themeButton.setAttribute("aria-pressed", String(istDunkel));
  // Symbol zeigt, wohin man wechselt: im Dunkeln die Sonne, im Hellen den Mond
  themeSymbol.textContent = istDunkel ? "☀" : "☾";
}

// Klick auf den Schalter: Theme umdrehen und Wahl speichern
themeButton.addEventListener("click", function () {
  const neuesTheme = aktuellesTheme() === "dark" ? "light" : "dark";
  setzeTheme(neuesTheme);
  try {
    localStorage.setItem(THEME_SCHLUESSEL, neuesTheme);
  } catch (fehler) {
    // Speichern nicht möglich (z. B. privater Modus) – Theme gilt dann nur bis zum Neuladen
  }
});

// Ändert sich die Systemeinstellung, folgen wir ihr –
// aber nur, solange der Nutzer noch nichts selbst gewählt hat.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (event) {
  let gespeichert = null;
  try {
    gespeichert = localStorage.getItem(THEME_SCHLUESSEL);
  } catch (fehler) {
    // ignorieren
  }
  if (!gespeichert) {
    setzeTheme(event.matches ? "dark" : "light");
  }
});


/* ==========================================================================
   START
   ========================================================================== */

setzeTheme(aktuellesTheme());       // Schalter an das bereits gesetzte Theme anpassen
zeigeAnsicht(ansichtAusHash(), false); // Ansicht aus der URL zeigen (ohne Fokus-Sprung)
