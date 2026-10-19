/* ==========================================================================
   prompts.js – fertige Prompts für häufige Aufgaben, als Kachel-Navigation

   Ablauf
     Start:     In der Mitte steht nur die Hauptkachel "Prompt erstellen".
     Klick:     Aus ihr fliegen die Kategorien heraus – die erste Hälfte
                nach links, die zweite nach rechts. Unter dem Titel der
                Hauptkachel steht "Zurückkehren".
     Kategorie: Die übrigen Kacheln fliegen in die Mitte und verschwinden,
                die gewählte gleitet in die Mitte und wird zur neuen
                Hauptkachel; dann fliegen ihre Unterkacheln heraus.
                Ohne Unterkacheln: "Kommt bald" in der Hauptkachel.
     Prompt:    Die Kachel wächst in der Mitte zur Prompt-Ansicht mit
                Textfeld, "Kopieren" und "Zurückkehren".
     Zurück:    jeweils eine Ebene, mit der umgekehrten Bewegung.

   Adresse (damit Neuladen und der Zurück-Button funktionieren):
     #prompts                     Startzustand (nur die Hauptkachel)
     #prompts/auswahl             Hauptkachel ausgeklappt
     #prompts/uni                 Kategorie "Uni/Schule"
     #prompts/uni/vereinfacht     Prompt-Ansicht
   Jeder Klick setzt nur die Adresse; app.js ruft daraufhin zeige() auf,
   und zeige() spielt den passenden Übergang ab.

   Smartphone und schmale Tablets (unter 900 px): Hauptkachel oben, die
   anderen darunter in zwei Spalten (2×2). Die Reihenfolge im HTML folgt
   der sichtbaren Anordnung,
   damit Tab in der richtigen Reihenfolge durch die Kacheln geht.

   Animiert werden nur transform und opacity (Web Animations API). Während
   einer Bewegung sind weitere Klicks gesperrt. Bei "Bewegung reduzieren"
   gibt es nur eine kurze Überblendung.

   Daten: js/prompts-data.js – Aussehen: css/prompts.css
   ========================================================================== */

const PromptsAnsicht = (function () {

  // Kennung der ausgeklappten Hauptkachel in der Adresse (#prompts/auswahl)
  const AUSWAHL = "auswahl";

  // Bewegung (Millisekunden)
  const DAUER = 450;            // Fliegen, Verteilen, Verschmelzen
  const VERSATZ = 45;           // Start der nächsten Kachel etwas später
  const KLEIN = 0.3;            // so klein sind Kacheln in der Mitte (beim Herausfliegen / Verschmelzen)
  const RUHIG_DAUER = 160;      // "Bewegung reduzieren": Überblendung
  const SPRUNG_DAUER = 220;     // Sprung über mehrere Ebenen: Überblendung
  const HINWEIS_DAUER = 1800;   // so lange steht "Kommt bald" / "Kopiert ✓"
  // Kurven: heraus weich abbremsen, hinein beschleunigen
  const KURVE_HERAUS = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  const KURVE_HINEIN = "cubic-bezier(0.5, 0, 0.75, 0.4)";
  const KURVE_GLEITEN = "cubic-bezier(0.45, 0, 0.25, 1)";

  // Gleiche Grenze wie in css/prompts.css
  const mobilAbfrage = window.matchMedia("(max-width: 899px)");
  const ruhigAbfrage = window.matchMedia("(prefers-reduced-motion: reduce)");

  const el = {};
  let zustand = null;          // { art: "zu" | "ebene" | "prompt", pfad: [Kennungen] }
  let gesperrt = false;        // true: Klick ausgelöst oder Bewegung läuft
  let laufNr = 0;              // erhöht sich bei jedem Übergang (alte brechen dann ab)
  let laufende = [];           // alle gerade laufenden Animationen
  let hinweisTimer = null;
  let kopierTimer = null;


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  /**
   * Baut die Ansicht auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="prompts-root">
   */
  function init(container) {
    container.innerHTML = '<div class="pr-buehne" tabindex="-1"></div>';
    el.buehne = container.querySelector(".pr-buehne");
    el.ansicht = document.getElementById("view-prompts");
    el.buehne.addEventListener("click", geklickt);
    document.addEventListener("keydown", tasteGedrueckt);
    // Smartphone ↔ Computer: Reihenfolge der Kacheln neu aufbauen
    mobilAbfrage.addEventListener("change", function () {
      if (zustand && !laufende.length) baue(zustand, true);
    });
  }

  /**
   * Wird von app.js bei jedem Öffnen und bei jeder neuen Adresse aufgerufen.
   * @param {string} unterseite – z. B. "uni/vereinfacht" (leer = Startzustand)
   * @param {boolean} warOffen – true: die Ansicht war schon offen, nur die
   *                             Ebene wechselt → mit Übergang
   * @returns {HTMLElement|null} – Element für den Fokus
   */
  function zeige(unterseite, warOffen) {
    const ziel = zustandAus(unterseite);
    // Unbekannte Adresse (z. B. alter Link)? Zur nächsten gültigen Ebene,
    // ohne neuen Eintrag im Verlauf
    if (window.location.hash !== hashVon(ziel)) history.replaceState(null, "", hashVon(ziel));

    const vorher = zustand;
    const unterbrochen = laufende.length > 0;
    abbrechen();

    // Neuladen, Einstieg aus einem anderen Abschnitt oder ein Übergang
    // wurde unterbrochen (z. B. Zurück-Button mitten in der Bewegung):
    // sofort den Zielzustand zeigen
    if (!warOffen || !vorher || unterbrochen) {
      baue(ziel);
      gesperrt = false;
      return warOffen ? fokusZiel(ziel, vorher) : null;
    }
    if (gleich(vorher, ziel)) {
      gesperrt = false;
      return null;
    }
    wechsle(vorher, ziel);
    // Bis die Bewegung fertig ist, bleibt der Fokus auf der Bühne
    return el.buehne;
  }


  /* ==========================================================================
     ZUSTAND UND ADRESSE
     ========================================================================== */

  /** Hat ein Eintrag etwas zum Öffnen (Unterkacheln oder einen Prompt)? */
  function hatInhalt(eintrag) {
    return typeof eintrag.prompt === "string" || (Array.isArray(eintrag.kinder) && eintrag.kinder.length > 0);
  }

  /** Der Eintrag am Ende eines Pfads (leerer Pfad = Wurzel). */
  function eintragZu(pfad) {
    let eintrag = PROMPT_DATEN;
    pfad.forEach(function (id) {
      eintrag = eintrag.kinder.find(function (k) { return k.id === id; });
    });
    return eintrag;
  }

  /** Liest den Zustand aus der Unterseite; Unbekanntes wird abgeschnitten. */
  function zustandAus(unterseite) {
    if (!unterseite) return { art: "zu", pfad: [] };
    if (unterseite === AUSWAHL) return { art: "ebene", pfad: [] };
    let eintrag = PROMPT_DATEN;
    const pfad = [];
    const teile = unterseite.split("/");
    for (let i = 0; i < teile.length; i++) {
      const kind = (eintrag.kinder || []).find(function (k) { return k.id === teile[i]; });
      if (!kind || !hatInhalt(kind)) break;
      pfad.push(kind.id);
      if (typeof kind.prompt === "string") return { art: "prompt", pfad: pfad };
      eintrag = kind;
    }
    return { art: "ebene", pfad: pfad };
  }

  function hashVon(z) {
    if (z.art === "zu") return "#prompts";
    return "#prompts/" + (z.pfad.length ? z.pfad.join("/") : AUSWAHL);
  }

  /** Eine Ebene zurück. */
  function eltern(z) {
    if (z.art === "prompt") return { art: "ebene", pfad: z.pfad.slice(0, -1) };
    if (z.pfad.length === 0) return { art: "zu", pfad: [] };
    return { art: "ebene", pfad: z.pfad.slice(0, -1) };
  }

  function gleich(a, b) {
    return a.art === b.art && a.pfad.join("/") === b.pfad.join("/");
  }

  /** Ist b genau eine Ebene unter a? */
  function istDarunter(a, b) {
    return b.pfad.length === a.pfad.length + 1 && a.pfad.every(function (id, i) { return b.pfad[i] === id; });
  }


  /* ==========================================================================
     ZEICHNEN
     ========================================================================== */

  /**
   * Zeichnet einen Zustand ohne Bewegung.
   * @param {boolean} [fokusHalten] – Fokus auf dasselbe Element setzen wie vorher
   */
  function baue(z, fokusHalten) {
    const fokusId = fokusHalten && document.activeElement && el.buehne.contains(document.activeElement)
      ? fokusSchluessel(document.activeElement) : null;
    el.buehne.textContent = "";
    el.buehne.dataset.art = z.art;
    if (z.art === "prompt") baueAnsicht(z);
    else baueReihe(z);
    zustand = z;
    if (fokusId) {
      const neu = el.buehne.querySelector(fokusId);
      if (neu) neu.focus({ preventScroll: true });
    }
  }

  function fokusSchluessel(element) {
    if (element.dataset.id) return '[data-id="' + element.dataset.id + '"]';
    if (element.classList.contains("pr-zurueck")) return ".pr-zurueck";
    if (element.classList.contains("pr-kopieren")) return ".pr-kopieren";
    if (element.classList.contains("pr-haupt")) return ".pr-haupt";
    return null;
  }

  /**
   * Eine Reihe: Hauptkachel in der Mitte, die Unterkacheln links und
   * rechts davon. Das Raster hat immer gleich viele Spalten links und
   * rechts – so steht die Hauptkachel immer genau in der Mitte, auch bei
   * ungerader Zahl. Im Startzustand gibt es nur die Hauptkachel (an
   * derselben Stelle wie ausgeklappt).
   */
  function baueReihe(z) {
    const eintrag = z.art === "zu" ? PROMPT_DATEN : eintragZu(z.pfad);
    const kinder = z.art === "zu" ? [] : eintrag.kinder;
    const anzahl = z.art === "zu" ? PROMPT_DATEN.kinder.length : kinder.length;
    const seite = Math.ceil(anzahl / 2);               // Spalten je Seite
    const links = Math.ceil(kinder.length / 2);        // so viele stehen links

    const reihe = document.createElement("div");
    reihe.className = "pr-reihe";
    reihe.style.setProperty("--spalten", 2 * seite + 1);

    const haupt = baueHaupt(eintrag, z);
    haupt.style.setProperty("--spalte", seite + 1);
    const kacheln = kinder.map(function (kind, i) {
      const kachel = baueKachel(kind, z.pfad.concat(kind.id));
      // links: dicht an die Mitte; rechts: direkt daneben
      kachel.style.setProperty("--spalte", i < links ? seite + 1 - links + i : seite + 2 + (i - links));
      kachel.dataset.seite = i < links ? "links" : "rechts";
      return kachel;
    });

    // Reihenfolge im HTML = sichtbare Reihenfolge (für Tab)
    const folge = mobilAbfrage.matches
      ? [haupt].concat(kacheln)
      : kacheln.slice(0, links).concat([haupt], kacheln.slice(links));
    folge.forEach(function (k) { reihe.appendChild(k); });
    el.buehne.appendChild(reihe);
  }

  /** Inhalt einer Kachel: Emoji darüber, Titel darunter. */
  function fuelle(kachel, eintrag, titelTag) {
    const emoji = document.createElement("span");
    emoji.className = "pr-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = eintrag.emoji;
    const titel = document.createElement(titelTag || "span");
    titel.className = "pr-titel";
    setzeTitel(titel, eintrag.titel);
    kachel.appendChild(emoji);
    kachel.appendChild(titel);
    return titel;
  }

  /** Titel als Text; nach jedem "/" darf umbrochen werden (wie auf der Startseite). */
  function setzeTitel(ziel, text) {
    text.split("/").forEach(function (teil, i, teile) {
      ziel.appendChild(document.createTextNode(teil + (i < teile.length - 1 ? "/" : "")));
      if (i < teile.length - 1) ziel.appendChild(document.createElement("wbr"));
    });
  }

  /**
   * Die Hauptkachel. Im Startzustand ein Link zum Ausklappen; sonst eine
   * Fläche mit Titel, "Zurückkehren" und Platz für "Kommt bald".
   */
  function baueHaupt(eintrag, z) {
    if (z.art === "zu") {
      const link = document.createElement("a");
      link.className = "pr-kachel pr-haupt";
      link.href = hashVon({ art: "ebene", pfad: [] });
      fuelle(link, eintrag);
      return link;
    }
    const haupt = document.createElement("div");
    haupt.className = "pr-kachel pr-haupt ist-offen";
    fuelle(haupt, eintrag, "h2");
    haupt.appendChild(baueZurueck(z));
    const hinweis = document.createElement("p");
    hinweis.className = "pr-hinweis";
    hinweis.setAttribute("role", "status");
    haupt.appendChild(hinweis);
    return haupt;
  }

  /** "Zurückkehren": ein Link eine Ebene höher. */
  function baueZurueck(z) {
    const zurueck = document.createElement("a");
    zurueck.className = "pr-zurueck";
    zurueck.href = hashVon(eltern(z));
    zurueck.textContent = "Zurückkehren";
    return zurueck;
  }

  /**
   * Eine Unterkachel: Link zur nächsten Ebene oder zum Prompt. Hat sie
   * (noch) keinen Inhalt, ist sie ein Knopf, der "Kommt bald" zeigt.
   */
  function baueKachel(eintrag, pfad) {
    let kachel;
    if (hatInhalt(eintrag)) {
      kachel = document.createElement("a");
      kachel.href = hashVon({ art: typeof eintrag.prompt === "string" ? "prompt" : "ebene", pfad: pfad });
    } else {
      kachel = document.createElement("button");
      kachel.type = "button";
      kachel.dataset.leer = "";
    }
    kachel.className = "pr-kachel";
    kachel.dataset.id = eintrag.id;
    fuelle(kachel, eintrag);
    return kachel;
  }

  /**
   * Prompt-Ansicht: die Kachel groß in der Mitte, darin der Text in einem
   * (nur lesbaren) Textfeld mit farbigen Platzhaltern, darunter "Kopieren"
   * und "Zurückkehren".
   */
  function baueAnsicht(z) {
    const eintrag = eintragZu(z.pfad);
    const gross = document.createElement("article");
    gross.className = "pr-kachel pr-gross";
    gross.setAttribute("aria-labelledby", "pr-prompt-titel");
    const titel = fuelle(gross, eintrag, "h2");
    titel.id = "pr-prompt-titel";
    // Auch Emoji und Titel blenden beim Wachsen/Schrumpfen über – sonst
    // würden sie mit der Kachel verzerrt
    titel.classList.add("pr-inhalt");
    gross.querySelector(".pr-emoji").classList.add("pr-inhalt");

    const feld = document.createElement("div");
    feld.className = "pr-textfeld pr-inhalt";
    feld.tabIndex = 0;
    feld.setAttribute("role", "textbox");
    feld.setAttribute("aria-readonly", "true");
    feld.setAttribute("aria-multiline", "true");
    feld.setAttribute("aria-labelledby", "pr-prompt-titel");
    const hatPlatzhalter = setzePromptText(feld, eintrag.prompt);
    gross.appendChild(feld);

    if (hatPlatzhalter) {
      const legende = document.createElement("p");
      legende.className = "pr-legende pr-inhalt";
      legende.innerHTML = 'Farbig markiert: <mark class="pr-platzhalter">[Platzhalter]</mark> – nach dem Einfügen ersetzen.';
      gross.appendChild(legende);
    }

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "knopf knopf--haupt pr-kopieren pr-inhalt";
    knopf.textContent = "Kopieren";
    gross.appendChild(knopf);

    const zurueck = baueZurueck(z);
    zurueck.classList.add("pr-inhalt");
    gross.appendChild(zurueck);

    const status = document.createElement("p");
    status.className = "nur-screenreader pr-kopier-status";
    status.setAttribute("role", "status");
    gross.appendChild(status);

    el.buehne.appendChild(gross);
  }

  /**
   * Schreibt den Prompt ins Textfeld. Platzhalter in eckigen Klammern
   * (z. B. [Fach]) werden als <mark> hervorgehoben.
   * @returns {boolean} – enthält der Text Platzhalter?
   */
  function setzePromptText(feld, text) {
    let gefunden = false;
    text.split(/(\[[^\[\]\n]+\])/).forEach(function (teil, i) {
      if (!teil) return;
      if (i % 2 === 1) {
        const mark = document.createElement("mark");
        mark.className = "pr-platzhalter";
        mark.textContent = teil;
        feld.appendChild(mark);
        gefunden = true;
      } else {
        feld.appendChild(document.createTextNode(teil));
      }
    });
    return gefunden;
  }


  /* ==========================================================================
     BEDIENUNG
     ========================================================================== */

  function geklickt(event) {
    const ziel = event.target.closest("a, button");
    if (!ziel || !el.buehne.contains(ziel)) return;
    // Während einer Bewegung (oder eines Seitenwechsels) nichts annehmen
    if (gesperrt || laufende.length || Seitenwechsel.istAktiv()) {
      event.preventDefault();
      return;
    }
    if (ziel.classList.contains("pr-kopieren")) {
      kopieren(ziel);
      return;
    }
    if (ziel.dataset.leer !== undefined) {
      kommtBald(ziel);
      return;
    }
    // Links: Strg/Cmd/Umschalt/Mitteltaste wie gewohnt (neuer Tab …)
    if (ziel.tagName === "A") {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      geheZu(ziel.getAttribute("href"));
    }
  }

  /** Neue Adresse setzen – den Übergang startet dann zeige(). */
  function geheZu(hash) {
    if (window.location.hash === hash) return;
    gesperrt = true;
    window.location.hash = hash;
  }

  /** Escape: eine Ebene zurück (nur in dieser Ansicht, nicht bei offenem Menü). */
  function tasteGedrueckt(event) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (!el.ansicht || el.ansicht.hidden || !zustand || zustand.art === "zu") return;
    const menue = document.getElementById("nav-panel");
    if (menue && menue.classList.contains("offen")) return;
    if (gesperrt || laufende.length || Seitenwechsel.istAktiv()) return;
    event.preventDefault();
    geheZu(hashVon(eltern(zustand)));
  }

  /** Kategorie ohne Inhalt: kurz "Kommt bald" in der Hauptkachel. */
  function kommtBald(kachel) {
    const haupt = el.buehne.querySelector(".pr-haupt");
    const hinweis = haupt && haupt.querySelector(".pr-hinweis");
    if (!hinweis) return;
    hinweis.textContent = "Kommt bald";
    haupt.classList.add("zeigt-hinweis");
    clearTimeout(hinweisTimer);
    hinweisTimer = setTimeout(function () {
      haupt.classList.remove("zeigt-hinweis");
      hinweis.textContent = "";
    }, HINWEIS_DAUER);
    // Die Kachel wackelt kurz: "hier gibt es noch nichts"
    if (!ruhigAbfrage.matches) {
      kachel.animate([
        { transform: "translateX(0)" }, { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" },
      ], { duration: 320, easing: "ease-in-out" });
    }
  }


  /* ==========================================================================
     KOPIEREN
     navigator.clipboard braucht eine sichere Umgebung (https oder
     localhost). Klappt das nicht – z. B. per Doppelklick als Datei
     geöffnet –, kopiert die ältere Methode über ein verstecktes Textfeld.
     ========================================================================== */

  function kopieren(knopf) {
    const text = eintragZu(zustand.pfad).prompt;
    const status = el.buehne.querySelector(".pr-kopier-status");
    inZwischenablage(text).then(function () {
      knopf.textContent = "Kopiert ✓";
      knopf.classList.add("ist-kopiert");
      status.textContent = "In die Zwischenablage kopiert.";
    }, function () {
      knopf.textContent = "Kopieren nicht möglich";
      status.textContent = "Kopieren nicht möglich. Der Text ist markiert – kopiere ihn mit Strg+C.";
      markiere(el.buehne.querySelector(".pr-textfeld"));
    }).then(function () {
      clearTimeout(kopierTimer);
      kopierTimer = setTimeout(function () {
        knopf.textContent = "Kopieren";
        knopf.classList.remove("ist-kopiert");
        status.textContent = "";
      }, HINWEIS_DAUER);
    });
  }

  /** @returns {Promise} – erfüllt, wenn der Text in der Zwischenablage liegt */
  function inZwischenablage(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return altesKopieren(text) ? undefined : Promise.reject(new Error("Kopieren nicht möglich"));
      });
    }
    return altesKopieren(text) ? Promise.resolve() : Promise.reject(new Error("Kopieren nicht möglich"));
  }

  /** Ältere Methode: unsichtbares Textfeld markieren und "copy" ausführen. */
  function altesKopieren(text) {
    const vorher = document.activeElement;
    const feld = document.createElement("textarea");
    feld.value = text;
    feld.setAttribute("readonly", "");
    feld.style.position = "fixed";
    feld.style.top = "0";
    feld.style.left = "0";
    feld.style.opacity = "0";
    document.body.appendChild(feld);
    feld.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (fehler) {
      ok = false;
    }
    feld.remove();
    if (vorher && vorher.focus) vorher.focus({ preventScroll: true });
    return ok;
  }

  /** Markiert den ganzen Text eines Elements (zum Kopieren von Hand). */
  function markiere(element) {
    const bereich = document.createRange();
    bereich.selectNodeContents(element);
    const auswahl = window.getSelection();
    auswahl.removeAllRanges();
    auswahl.addRange(bereich);
  }


  /* ==========================================================================
     ÜBERGÄNGE
     ========================================================================== */

  /** Sucht den passenden Übergang zwischen zwei Zuständen und spielt ihn ab. */
  function wechsle(von, nach) {
    const nr = ++laufNr;
    gesperrt = true;
    el.buehne.classList.add("ist-animiert");

    let ablauf;
    if (ruhigAbfrage.matches) {
      ablauf = ueberblenden(nr, nach, RUHIG_DAUER);
    } else if (von.art === "zu" && nach.art === "ebene" && nach.pfad.length === 0) {
      ablauf = ausklappen(nr, nach);
    } else if (von.art === "ebene" && von.pfad.length === 0 && nach.art === "zu") {
      ablauf = einklappen(nr, nach);
    } else if (von.art === "ebene" && nach.art !== "zu" && istDarunter(von, nach)) {
      ablauf = hinein(nr, nach);
    } else if (nach.art === "ebene" && von.art !== "zu" && istDarunter(nach, von)) {
      ablauf = heraus(nr, von, nach);
    } else {
      ablauf = ueberblenden(nr, nach, SPRUNG_DAUER);   // Sprung über mehrere Ebenen
    }

    ablauf.then(function () {
      if (nr !== laufNr) return;                       // abgebrochen
      laufende.forEach(function (a) { a.cancel(); });
      laufende = [];
      el.buehne.classList.remove("ist-animiert");
      gesperrt = false;
      const ziel = fokusZiel(nach, von);
      if (ziel) ziel.focus({ preventScroll: true });
    });
  }

  /** Bricht alle Bewegungen ab (der Aufrufer zeichnet danach neu). */
  function abbrechen() {
    laufNr++;
    laufende.forEach(function (a) { a.cancel(); });
    laufende = [];
    if (el.buehne) el.buehne.classList.remove("ist-animiert");
  }

  /**
   * Wohin der Fokus nach einem Wechsel geht:
   * ausgeklappt → erste Unterkachel, zurück → die Kachel, aus der man kam,
   * Startzustand → Hauptkachel, Prompt → "Kopieren".
   */
  function fokusZiel(nach, von) {
    if (nach.art === "prompt") return el.buehne.querySelector(".pr-kopieren");
    if (nach.art === "zu") return el.buehne.querySelector(".pr-haupt");
    if (von && istDarunter(nach, von)) {
      const herkunft = el.buehne.querySelector('[data-id="' + von.pfad[von.pfad.length - 1] + '"]');
      if (herkunft) return herkunft;
    }
    return ersteKachel() || el.buehne.querySelector(".pr-zurueck");
  }

  /** Die erste Unterkachel in sichtbarer Reihenfolge (= Reihenfolge im HTML). */
  function ersteKachel() {
    return el.buehne.querySelector(".pr-reihe > .pr-kachel:not(.pr-haupt)");
  }

  // --- Bausteine ---------------------------------------------------------

  function merke(animation) {
    laufende.push(animation);
    return animation;
  }

  /** Wartet auf alle Animationen (abgebrochene zählen als fertig). */
  function fertig(animationen) {
    return Promise.all(animationen.map(function (a) {
      return a.finished.catch(function () { /* abgebrochen */ });
    }));
  }

  function mitte(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** transform, das ein Element mit Lage r auf die Lage ziel legt (Mitte und Größe). */
  function aufLage(r, ziel) {
    const a = mitte(r);
    const b = mitte(ziel);
    return "translate(" + (b.x - a.x) + "px, " + (b.y - a.y) + "px) scale(" +
      (ziel.width / r.width) + ", " + (ziel.height / r.height) + ")";
  }

  /** transform, das ein Element mit Lage r klein in den Punkt p schiebt. */
  function inPunkt(r, p) {
    const a = mitte(r);
    return "translate(" + (p.x - a.x) + "px, " + (p.y - a.y) + "px) scale(" + KLEIN + ")";
  }

  /** Kacheln nach Abstand zum Punkt p sortiert (nahe zuerst) – für den Versatz. */
  function nachAbstand(kacheln, p) {
    return kacheln.map(function (k) {
      const m = mitte(k.getBoundingClientRect());
      return { k: k, d: Math.hypot(m.x - p.x, m.y - p.y), r: k.getBoundingClientRect() };
    }).sort(function (a, b) { return a.d - b.d; });
  }

  /**
   * Kacheln fliegen aus dem Punkt p heraus an ihren Platz – die nahen
   * zuerst, jede etwas später. Beginnen klein und durchsichtig.
   */
  function herausfliegen(kacheln, p, start) {
    let rang = 0, letzterAbstand = -1;
    return nachAbstand(kacheln, p).map(function (e) {
      // Gleich weit entfernte (links und rechts) starten gemeinsam
      if (letzterAbstand >= 0 && Math.abs(e.d - letzterAbstand) > 2) rang++;
      letzterAbstand = e.d;
      return merke(e.k.animate([
        { transform: inPunkt(e.r, p), opacity: 0 },
        { transform: "none", opacity: 1 },
      ], { duration: DAUER, delay: (start || 0) + rang * VERSATZ, easing: KURVE_HERAUS, fill: "backwards" }));
    });
  }

  /** Umgekehrt: Kacheln fliegen in den Punkt p und verschwinden (die äußeren zuerst). */
  function hineinfliegen(kacheln, p) {
    const liste = nachAbstand(kacheln, p).reverse();
    let rang = 0, letzterAbstand = -1;
    return liste.map(function (e) {
      if (letzterAbstand >= 0 && Math.abs(e.d - letzterAbstand) > 2) rang++;
      letzterAbstand = e.d;
      return merke(e.k.animate([
        { transform: "none", opacity: 1 },
        { transform: inPunkt(e.r, p), opacity: 0 },
      ], { duration: DAUER, delay: rang * VERSATZ, easing: KURVE_HINEIN, fill: "forwards" }));
    });
  }

  /** Ein Element erscheint (oder verschwindet) sanft – z. B. "Zurückkehren". */
  function blende(element, rein, verzoegerung) {
    if (!element) return [];
    const bilder = rein ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }];
    return [merke(element.animate(bilder, {
      duration: DAUER * 0.6, delay: verzoegerung || 0, easing: "ease", fill: rein ? "backwards" : "forwards",
    }))];
  }

  function hauptkachel() {
    return el.buehne.querySelector(".pr-haupt");
  }

  function unterkacheln() {
    return [...el.buehne.querySelectorAll(".pr-reihe > .pr-kachel:not(.pr-haupt)")];
  }

  // --- die einzelnen Übergänge -------------------------------------------

  /** Startzustand → ausgeklappt: die Kategorien fliegen aus der Hauptkachel. */
  function ausklappen(nr, nach) {
    baue(nach);
    const haupt = hauptkachel();
    const p = mitte(haupt.getBoundingClientRect());
    const a = herausfliegen(unterkacheln(), p, 0).concat(blende(haupt.querySelector(".pr-zurueck"), true, DAUER * 0.3));
    return fertig(a);
  }

  /** Ausgeklappt → Startzustand: die Kategorien fliegen zurück und verschmelzen. */
  function einklappen(nr, nach) {
    const haupt = hauptkachel();
    const p = mitte(haupt.getBoundingClientRect());
    const a = hineinfliegen(unterkacheln(), p).concat(blende(haupt.querySelector(".pr-zurueck"), false));
    return fertig(a).then(function () {
      if (nr !== laufNr) return;
      baue(nach);
      // Kurzes "Aufnehmen": die Hauptkachel schluckt die Kacheln
      return fertig([merke(hauptkachel().animate([
        { transform: "scale(1.05)" }, { transform: "none" },
      ], { duration: DAUER * 0.6, easing: KURVE_HERAUS }))]);
    });
  }

  /**
   * Eine Ebene tiefer (Kategorie oder Prompt):
   * 1. die übrigen Kacheln fliegen in die Mitte und verschwinden, die
   *    gewählte gleitet an den Platz der Hauptkachel;
   * 2. Kategorie: ihre Unterkacheln fliegen heraus.
   *    Prompt: die Kachel wächst zur Prompt-Ansicht.
   */
  function hinein(nr, nach) {
    const id = nach.pfad[nach.pfad.length - 1];
    const haupt = hauptkachel();
    const gewaehlt = el.buehne.querySelector('[data-id="' + id + '"]');
    const hr = haupt.getBoundingClientRect();
    const p = mitte(hr);
    const andere = unterkacheln().filter(function (k) { return k !== gewaehlt; });

    gewaehlt.style.zIndex = "3";
    const a = hineinfliegen(andere.concat([haupt]), p);
    a.push(merke(gewaehlt.animate([
      { transform: "none" },
      { transform: aufLage(gewaehlt.getBoundingClientRect(), hr) },
    ], { duration: DAUER, easing: KURVE_GLEITEN, fill: "forwards" })));

    return fertig(a).then(function () {
      if (nr !== laufNr) return;
      baue(nach);
      if (nach.art === "ebene") {
        const neu = hauptkachel();
        return fertig(herausfliegen(unterkacheln(), mitte(neu.getBoundingClientRect()), 0)
          .concat(blende(neu.querySelector(".pr-zurueck"), true, DAUER * 0.3)));
      }
      // Prompt-Ansicht: wächst aus der Kachel in der Mitte
      const gross = el.buehne.querySelector(".pr-gross");
      const b = [merke(gross.animate([
        { transform: aufLage(gross.getBoundingClientRect(), hr) },
        { transform: "none" },
      ], { duration: DAUER, easing: KURVE_HERAUS, fill: "backwards" }))];
      gross.querySelectorAll(".pr-inhalt").forEach(function (teil) {
        b.push.apply(b, blende(teil, true, DAUER * 0.45));
      });
      return fertig(b);
    });
  }

  /**
   * Eine Ebene höher – die umgekehrte Bewegung:
   * 1. Kategorie: ihre Unterkacheln fliegen zurück in die Hauptkachel.
   *    Prompt: die große Kachel schrumpft auf die Größe der Hauptkachel.
   * 2. Die Kachel, aus der man kam, gleitet an ihren Platz; die übrigen
   *    fliegen aus der Mitte heraus.
   */
  function heraus(nr, von, nach) {
    const id = von.pfad[von.pfad.length - 1];

    if (von.art === "ebene") {
      const haupt = hauptkachel();
      const hr = haupt.getBoundingClientRect();
      const a = hineinfliegen(unterkacheln(), mitte(hr)).concat(blende(haupt.querySelector(".pr-zurueck"), false));
      return fertig(a).then(function () {
        if (nr !== laufNr) return;
        baue(nach);
        return zurueckAnDenPlatz(id, hr);
      });
    }

    // Prompt → Ebene: Die große Kachel bleibt als Bild über der Bühne
    // liegen, darunter wird die Ebene schon aufgebaut (unsichtbar). So ist
    // bekannt, wohin sie schrumpfen muss.
    const gross = el.buehne.querySelector(".pr-gross");
    const gr = gross.getBoundingClientRect();
    const br = el.buehne.getBoundingClientRect();
    baue(nach);
    gross.classList.add("ist-abbild");
    gross.style.left = (gr.left - br.left) + "px";
    gross.style.top = (gr.top - br.top) + "px";
    gross.style.width = gr.width + "px";
    gross.style.height = gr.height + "px";
    el.buehne.appendChild(gross);
    const haupt = hauptkachel();
    const hr = haupt.getBoundingClientRect();
    const neue = [...el.buehne.querySelectorAll(".pr-reihe > .pr-kachel")];
    const versteckt = neue.map(function (k) {
      return merke(k.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" }));
    });

    const a = [merke(gross.animate([
      { transform: "none" },
      { transform: aufLage(gross.getBoundingClientRect(), hr) },
    ], { duration: DAUER, easing: KURVE_GLEITEN, fill: "forwards" }))];
    gross.querySelectorAll(".pr-inhalt").forEach(function (teil) {
      a.push.apply(a, blende(teil, false));
    });
    return fertig(a).then(function () {
      if (nr !== laufNr) return;
      gross.remove();
      versteckt.forEach(function (v) { v.cancel(); });
      return zurueckAnDenPlatz(id, hr);
    });
  }

  /** Die Kachel id gleitet von der Mitte (Lage hr) an ihren Platz, die anderen fliegen heraus. */
  function zurueckAnDenPlatz(id, hr) {
    const gewaehlt = el.buehne.querySelector('[data-id="' + id + '"]');
    const p = mitte(hr);
    const andere = [...el.buehne.querySelectorAll(".pr-reihe > .pr-kachel")].filter(function (k) {
      return k !== gewaehlt;
    });
    const a = herausfliegen(andere, p, 0);
    if (gewaehlt) {
      gewaehlt.style.zIndex = "3";
      a.push(merke(gewaehlt.animate([
        { transform: aufLage(gewaehlt.getBoundingClientRect(), hr) },
        { transform: "none" },
      ], { duration: DAUER, easing: KURVE_GLEITEN, fill: "backwards" })));
    }
    return fertig(a).then(function () {
      if (gewaehlt) gewaehlt.style.zIndex = "";
    });
  }

  /** Kurze Überblendung (Bewegung reduziert oder Sprung über mehrere Ebenen). */
  function ueberblenden(nr, nach, dauer) {
    const aus = merke(el.buehne.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dauer / 2, fill: "forwards" }));
    return fertig([aus]).then(function () {
      if (nr !== laufNr) return;
      baue(nach);
      aus.cancel();
      return fertig([merke(el.buehne.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dauer / 2 }))]);
    });
  }


  return {
    init: init,
    zeige: zeige,
  };
})();
