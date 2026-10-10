/* ==========================================================================
   app.js – das "Gehirn" von NTB
   Kümmert sich um:
     1. Navigation zwischen den Ansichten (über den URL-Hash, z. B. #games)
     2. Das mobile Menü (Hamburger + ausklappendes Panel)
     3. Den Dark-Mode-Schalter
   ========================================================================== */


/* --------------------------------------------------------------------------
   Einstellungen
   -------------------------------------------------------------------------- */

// Alle Ansichten. Bei Tools steht dabei:
//   init  – die Startfunktion aus der Tool-Datei (z. B. games.js)
//   root  – die ID des Containers in index.html, in den das Tool zeichnet
//   zeige – (optional) wird bei JEDEM Öffnen aufgerufen und bekommt die
//           Unterseite aus der Adresse, z. B. "sudoku" bei #games/sudoku
// Neues Tool? Hier eine Zeile ergänzen (plus Reiter in der Leiste und
// eine <section> in index.html).
const ANSICHTEN = {
  home: { init: StartseiteAnsicht.init, zeige: StartseiteAnsicht.zeige, root: "home-root" },
  kalender: { init: KalenderAnsicht.init, zeige: KalenderAnsicht.zeige, root: "calendar-root" },
  games: { init: initGames, zeige: zeigeGames, root: "games-root" },
  media: { init: MediaAnsicht.init, zeige: MediaAnsicht.zeige, root: "media-root" },
  schedule: { init: StundenplanAnsicht.init, zeige: StundenplanAnsicht.zeige, root: "schedule-root" },
  einstellungen: { init: EinstellungenAnsicht.init, root: "settings-root" },
  customising: { init: initCustomising, root: "customising-root" },
};

const START_ANSICHT = "home";
const SEITENNAME = "NTB";
const THEME_SCHLUESSEL = "hub-theme"; // Name des Eintrags im localStorage

// Merkt sich, welche Tools schon gestartet wurden (damit init nur 1x läuft)
const gestarteteTools = {};


/* --------------------------------------------------------------------------
   Elemente aus dem HTML holen
   -------------------------------------------------------------------------- */

const navPanel = document.getElementById("nav-panel");
const menuButton = document.getElementById("menu-button");
const themeButton = document.getElementById("theme-button");
const themeSymbol = document.getElementById("theme-symbol");
// Alle Reiter, die zu einer Ansicht führen – auch beide NTB-Links
const reiterLinks = document.querySelectorAll(".reiter[data-view]");
// Nur die Reiter im ausklappbaren Panel (für den Fokus auf dem Handy)
const panelLinks = navPanel.querySelectorAll(".reiter-gruppe .reiter");

// Ab hier gibt es das Hamburger-Menü – dieselbe Grenze wie in style.css
// (Abschnitt 7: @media max-width: 1049px)
const mobilAbfrage = window.matchMedia("(max-width: 1049px)");


/* ==========================================================================
   1. NAVIGATION
   ========================================================================== */

/**
 * Liest Ansicht und Unterseite aus dem URL-Hash.
 * Beispiele: "#games"        → { name: "games", unterseite: "" }
 *            "#games/sudoku" → { name: "games", unterseite: "sudoku" }
 * Unbekannte oder leere Hashes führen zur Startansicht.
 */
function ansichtAusHash() {
  const teile = window.location.hash.slice(1).split("/"); // "#" entfernen, bei "/" trennen
  const name = teile[0];
  if (name in ANSICHTEN) {
    return { name: name, unterseite: teile.slice(1).join("/") };
  }
  return { name: START_ANSICHT, unterseite: "" };
}

/**
 * Blendet die gewünschte Ansicht ein und alle anderen aus.
 * @param {string} name – z. B. "kalender"
 * @param {string} unterseite – z. B. "sudoku" (leer = keine Unterseite)
 * @param {boolean} fokusSetzen – true, wenn der Fokus auf die Überschrift
 *                                springen soll (hilft Tastatur- und
 *                                Screenreader-Nutzern)
 */
function zeigeAnsicht(name, unterseite, fokusSetzen) {
  // Alle Ansichten durchgehen: die gewünschte zeigen, den Rest verstecken
  for (const ansichtName in ANSICHTEN) {
    const section = document.getElementById("view-" + ansichtName);
    section.hidden = ansichtName !== name;
  }

  // Aktiven Reiter markieren. aria-current="page" sagt Screenreadern
  // "hier bist du gerade" – und das CSS zeigt dafür das abgeschwächte Glas.
  reiterLinks.forEach(function (link) {
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

  // Das Tool entscheidet selbst, was es bei dieser Unterseite zeigt.
  // Gibt es ein Element zurück, bekommt dieses den Fokus.
  let fokusZiel = null;
  if (tool && tool.zeige) {
    fokusZiel = tool.zeige(unterseite);
  }

  // Titel im Browser-Tab anpassen: "NTB" auf Home, sonst z. B. "Games – NTB"
  const ueberschrift = document.getElementById("titel-" + name);
  if (name === START_ANSICHT) {
    document.title = SEITENNAME;
  } else {
    document.title = ueberschrift.textContent + " – " + SEITENNAME;
  }

  if (fokusSetzen) {
    (fokusZiel || ueberschrift).focus();
  }
}

// Wenn sich der Hash ändert (Klick auf einen Reiter, Zurück-Button im Browser),
// die passende Ansicht zeigen.
window.addEventListener("hashchange", function () {
  const ziel = ansichtAusHash();
  zeigeAnsicht(ziel.name, ziel.unterseite, true);
});


/* ==========================================================================
   2. MOBILES MENÜ
   Auf dem Handy klappt das Panel mit den Reitern unter der Leiste aus.
   Auf dem Computer hat die Klasse "offen" keine Wirkung.
   ========================================================================== */

function menueOeffnen() {
  navPanel.classList.add("offen");
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "Menü schließen");
  // Fokus auf den ersten Reiter, damit man direkt mit der Tastatur weitermachen kann
  panelLinks[0].focus();
}

/**
 * @param {boolean} fokusZurueck – true: Fokus wieder auf den Hamburger-Button
 */
function menueSchliessen(fokusZurueck) {
  navPanel.classList.remove("offen");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Menü öffnen");
  if (fokusZurueck) {
    menuButton.focus();
  }
}

function menueIstOffen() {
  return navPanel.classList.contains("offen");
}

// Hamburger-Button: öffnen bzw. schließen
menuButton.addEventListener("click", function () {
  if (menueIstOffen()) {
    menueSchliessen(false);
  } else {
    menueOeffnen();
  }
});

// Klick irgendwo daneben schließt das Menü.
// "daneben" = weder ins Panel noch auf den Hamburger-Button.
document.addEventListener("click", function (event) {
  const imPanel = navPanel.contains(event.target);
  const aufButton = menuButton.contains(event.target);
  if (menueIstOffen() && !imPanel && !aufButton) {
    menueSchliessen(false);
  }
});

// Nach Auswahl eines Reiters schließen
reiterLinks.forEach(function (link) {
  link.addEventListener("click", function () {
    if (menueIstOffen()) {
      menueSchliessen(false);
    }
  });
});

// Escape-Taste schließt das Menü
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && menueIstOffen()) {
    menueSchliessen(true);
  }
});

// Wird das Fenster breiter als 1050 px, offenes Menü zurücksetzen
mobilAbfrage.addEventListener("change", function () {
  if (!mobilAbfrage.matches && menueIstOffen()) {
    menueSchliessen(false);
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
// Ansicht aus der URL zeigen (ohne Fokus-Sprung)
const startZiel = ansichtAusHash();
zeigeAnsicht(startZiel.name, startZiel.unterseite, false);
