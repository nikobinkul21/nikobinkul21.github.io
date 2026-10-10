/* ==========================================================================
   media-store.js – Speicherung für Filme/Serien
   ALLE Lese- und Schreibzugriffe auf die gespeicherten Listen laufen über
   diese Datei. Die Darstellung (media.js) greift nie selbst auf localStorage
   zu. Soll die Speicherung später woanders hin (z. B. auf einen Server),
   muss nur diese Datei geändert werden.

   So sehen die gespeicherten Daten aus:
   {
     version: 1,
     kategorien: {
       filme: {
         watchlist: [ { id, titel, hinzugefuegt } ],            ← neueste zuerst
         watched:   [ { id, titel, bewertung, hinzugefuegt } ]
       },
       serien: { … },
       anime:  { … }
     }
   }
   ========================================================================== */

const MediaStore = (function () {

  /* ------------------------------------------------------------------------
     KATEGORIEN
     Die EINZIGE Stelle, an der sie festgelegt sind. Übersicht, Adressen
     (#media/<id>) und Speicherung richten sich nach dieser Liste.
     Neue Kategorie? Einfach einen weiteren Eintrag hinzufügen.
     ------------------------------------------------------------------------ */
  const KATEGORIEN = [
    { id: "filme", name: "Filme" },
    { id: "serien", name: "Serien" },
    { id: "anime", name: "Anime" },
  ];

  const SPEICHER_SCHLUESSEL = "ntb-media";  // Name des Eintrags im localStorage
  const VERSION = 1;                        // Format-Version (für spätere Änderungen)

  // Erlaubte Bewertungen: 1 bis 10 in 0,5er-Schritten
  const BEWERTUNG_MIN = 1;
  const BEWERTUNG_MAX = 10;


  /* ------------------------------------------------------------------------
     INTERNE HELFER
     ------------------------------------------------------------------------ */

  /** Leere Datenstruktur mit allen Kategorien. */
  function leereDaten() {
    const daten = { version: VERSION, kategorien: {} };
    KATEGORIEN.forEach(function (k) {
      daten.kategorien[k.id] = { watchlist: [], watched: [] };
    });
    return daten;
  }

  /** Liest alle Daten aus dem localStorage (oder leere Daten). */
  function laden() {
    try {
      const text = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (text) {
        const geprueft = pruefe(JSON.parse(text));
        if (geprueft.ok) {
          return geprueft.daten;
        }
      }
    } catch (fehler) {
      // kaputte Daten oder kein Zugriff → mit leeren Daten weitermachen
    }
    return leereDaten();
  }

  /** Schreibt alle Daten in den localStorage. */
  function speichern(daten) {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    } catch (fehler) {
      // Speichern nicht möglich (z. B. privater Modus) – Änderung gilt bis zum Neuladen
    }
  }

  /** Erzeugt eine eindeutige ID für einen neuen Eintrag. */
  function neueId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Vergleichsform eines Titels: ohne Leerzeichen außen, Groß-/Kleinschreibung egal. */
  function vergleichsTitel(titel) {
    return titel.trim().toLocaleLowerCase("de");
  }

  /** Ist das eine erlaubte Bewertung (1–10, in 0,5er-Schritten)? */
  function istGueltigeBewertung(wert) {
    return typeof wert === "number" &&
      wert >= BEWERTUNG_MIN && wert <= BEWERTUNG_MAX &&
      Number.isInteger(wert * 2);          // 8.5 * 2 = 17 → ganze Zahl → ok
  }

  /**
   * Prüft, ob Daten das richtige Format haben, und bringt sie in Ordnung
   * (fehlende Kategorien ergänzen, fehlende IDs vergeben).
   * Wird beim Laden UND beim Import benutzt.
   * @returns {{ok: true, daten} | {ok: false, fehler: string}}
   */
  function pruefe(roh) {
    if (!roh || typeof roh !== "object" || !roh.kategorien || typeof roh.kategorien !== "object") {
      return { ok: false, fehler: "Das ist keine NTB-Filme/Serien-Datei." };
    }
    if (roh.version !== VERSION) {
      return { ok: false, fehler: "Unbekannte Dateiversion (" + roh.version + ")." };
    }

    const daten = leereDaten();
    for (const k of KATEGORIEN) {
      const kategorie = roh.kategorien[k.id];
      if (kategorie === undefined) continue;        // fehlende Kategorie = leer

      for (const art of ["watchlist", "watched"]) {
        const liste = kategorie[art] === undefined ? [] : kategorie[art];
        if (!Array.isArray(liste)) {
          return { ok: false, fehler: k.name + " / " + art + " ist keine Liste." };
        }
        for (const eintrag of liste) {
          if (!eintrag || typeof eintrag.titel !== "string" || eintrag.titel.trim() === "") {
            return { ok: false, fehler: "Ein Eintrag in " + k.name + " / " + art + " hat keinen Titel." };
          }
          if (art === "watched" && !istGueltigeBewertung(eintrag.bewertung)) {
            return { ok: false, fehler: "„" + eintrag.titel + "“ hat keine gültige Bewertung (1–10 in 0,5er-Schritten)." };
          }
          const sauber = {
            id: typeof eintrag.id === "string" && eintrag.id ? eintrag.id : neueId(),
            titel: eintrag.titel.trim(),
            hinzugefuegt: typeof eintrag.hinzugefuegt === "number" ? eintrag.hinzugefuegt : Date.now(),
          };
          if (art === "watched") {
            sauber.bewertung = eintrag.bewertung;
          }
          daten.kategorien[k.id][art].push(sauber);
        }
      }
    }
    return { ok: true, daten: daten };
  }

  /**
   * Gibt es den Titel in dieser Kategorie schon (Watchlist ODER Watched)?
   * @param {string} ausserId – diesen Eintrag ignorieren (beim Bearbeiten)
   * @returns {string|null} "watchlist" / "watched", wo er gefunden wurde, sonst null
   */
  function findeDoppelten(daten, kategorieId, titel, ausserId) {
    const gesucht = vergleichsTitel(titel);
    for (const art of ["watchlist", "watched"]) {
      const treffer = daten.kategorien[kategorieId][art].some(function (e) {
        return e.id !== ausserId && vergleichsTitel(e.titel) === gesucht;
      });
      if (treffer) return art;
    }
    return null;
  }

  /** Prüft Titel (nicht leer, kein Duplikat). Gibt einen Fehler zurück oder null. */
  function titelFehler(daten, kategorieId, titel, ausserId) {
    if (typeof titel !== "string" || titel.trim() === "") {
      return { ok: false, grund: "leer" };
    }
    const wo = findeDoppelten(daten, kategorieId, titel, ausserId);
    if (wo) {
      return { ok: false, grund: "doppelt", wo: wo };
    }
    return null;
  }


  /* ------------------------------------------------------------------------
     ÖFFENTLICHE FUNKTIONEN
     Alle Schreib-Funktionen geben ein Ergebnis zurück:
       { ok: true }  oder  { ok: false, grund: "leer" | "doppelt" | "bewertung" | "nicht-gefunden", wo? }
     ------------------------------------------------------------------------ */

  /**
   * Liefert eine Liste – bereits fertig sortiert:
   *   watchlist: neueste zuerst
   *   watched:   beste Bewertung zuerst, bei Gleichstand alphabetisch
   * Es ist eine Kopie, Änderungen daran werden NICHT gespeichert.
   */
  function liste(kategorieId, art) {
    const eintraege = laden().kategorien[kategorieId][art].map(function (e) {
      return Object.assign({}, e);
    });
    if (art === "watched") {
      eintraege.sort(function (a, b) {
        if (b.bewertung !== a.bewertung) {
          return b.bewertung - a.bewertung;                         // absteigend
        }
        return a.titel.localeCompare(b.titel, "de", { sensitivity: "base" }); // A → Z
      });
    }
    return eintraege;
  }

  /** Anzahl der Einträge einer Liste. */
  function anzahl(kategorieId, art) {
    return laden().kategorien[kategorieId][art].length;
  }

  /** Neuer Titel auf die Watchlist (ganz oben). */
  function zurWatchlist(kategorieId, titel) {
    const daten = laden();
    const fehler = titelFehler(daten, kategorieId, titel, null);
    if (fehler) return fehler;
    daten.kategorien[kategorieId].watchlist.unshift({
      id: neueId(),
      titel: titel.trim(),
      hinzugefuegt: Date.now(),
    });
    speichern(daten);
    return { ok: true };
  }

  /** Neuer Titel mit Bewertung nach Watched. */
  function zuWatched(kategorieId, titel, bewertung) {
    const daten = laden();
    const fehler = titelFehler(daten, kategorieId, titel, null);
    if (fehler) return fehler;
    if (!istGueltigeBewertung(bewertung)) return { ok: false, grund: "bewertung" };
    daten.kategorien[kategorieId].watched.push({
      id: neueId(),
      titel: titel.trim(),
      bewertung: bewertung,
      hinzugefuegt: Date.now(),
    });
    speichern(daten);
    return { ok: true };
  }

  /**
   * Ändert einen Eintrag.
   * @param {object} aenderung – { titel } und bei Watched zusätzlich { bewertung }
   */
  function aendere(kategorieId, art, id, aenderung) {
    const daten = laden();
    const eintrag = daten.kategorien[kategorieId][art].find(function (e) { return e.id === id; });
    if (!eintrag) return { ok: false, grund: "nicht-gefunden" };
    const fehler = titelFehler(daten, kategorieId, aenderung.titel, id);
    if (fehler) return fehler;
    if (art === "watched" && !istGueltigeBewertung(aenderung.bewertung)) {
      return { ok: false, grund: "bewertung" };
    }
    eintrag.titel = aenderung.titel.trim();
    if (art === "watched") {
      eintrag.bewertung = aenderung.bewertung;
    }
    speichern(daten);
    return { ok: true };
  }

  /** Löscht einen Eintrag. */
  function loesche(kategorieId, art, id) {
    const daten = laden();
    const liste = daten.kategorien[kategorieId][art];
    const position = liste.findIndex(function (e) { return e.id === id; });
    if (position === -1) return { ok: false, grund: "nicht-gefunden" };
    liste.splice(position, 1);
    speichern(daten);
    return { ok: true };
  }

  /** Verschiebt einen Titel von der Watchlist nach Watched (mit Bewertung). */
  function alsGeschautMarkieren(kategorieId, id, bewertung) {
    if (!istGueltigeBewertung(bewertung)) return { ok: false, grund: "bewertung" };
    const daten = laden();
    const kategorie = daten.kategorien[kategorieId];
    const position = kategorie.watchlist.findIndex(function (e) { return e.id === id; });
    if (position === -1) return { ok: false, grund: "nicht-gefunden" };
    const eintrag = kategorie.watchlist.splice(position, 1)[0];
    kategorie.watched.push({
      id: eintrag.id,
      titel: eintrag.titel,
      bewertung: bewertung,
      hinzugefuegt: Date.now(),
    });
    speichern(daten);
    return { ok: true };
  }

  /* ------------------------------------------------------------------------
     SICHERUNG (wird von settings.js benutzt – Export/Import in den Einstellungen)
     ------------------------------------------------------------------------ */

  /** Alle Daten als Objekt (für die Gesamtsicherung). */
  function alsObjekt() {
    return laden();
  }

  /**
   * Prüft Daten aus einer Sicherung, OHNE etwas zu speichern.
   * @returns {{ok: true, daten, anzahl} | {ok: false, fehler}}
   */
  function pruefeDaten(roh) {
    const ergebnis = pruefe(roh);
    if (ergebnis.ok) {
      let summe = 0;
      KATEGORIEN.forEach(function (k) {
        summe += ergebnis.daten.kategorien[k.id].watchlist.length +
                 ergebnis.daten.kategorien[k.id].watched.length;
      });
      ergebnis.anzahl = summe;
    }
    return ergebnis;
  }

  /** Ersetzt ALLE gespeicherten Daten durch geprüfte Daten. */
  function ersetzen(gepruefteDaten) {
    speichern(gepruefteDaten);
  }


  return {
    KATEGORIEN: KATEGORIEN,
    BEWERTUNG_MIN: BEWERTUNG_MIN,
    BEWERTUNG_MAX: BEWERTUNG_MAX,
    liste: liste,
    anzahl: anzahl,
    zurWatchlist: zurWatchlist,
    zuWatched: zuWatched,
    aendere: aendere,
    loesche: loesche,
    alsGeschautMarkieren: alsGeschautMarkieren,
    alsObjekt: alsObjekt,
    pruefeDaten: pruefeDaten,
    ersetzen: ersetzen,
  };
})();
