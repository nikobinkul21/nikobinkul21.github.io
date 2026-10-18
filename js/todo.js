/* ==========================================================================
   todo.js – "Zu erledigen": Aufgaben und Abgaben aus dem Studium
   - Neue Aufgabe / Bearbeiten / Löschen über einen Dialog
   - Rechts an jeder Karte: grün "Erledigt", rot "Noch offen"
   - Die Priorität ergibt sich aus der Zeit bis zur Fälligkeit (fünf
     Stufen, Werte in TODO_KONFIG); Überfälliges steht ganz oben
   - Links eine senkrechte Skala von Rot ("Sehr wichtig") bis Grün
     ("Locker noch Zeit"), rechts daneben die Aufgaben je Stufe
   - Erledigtes liegt unten im einklappbaren Bereich "Erledigt"
   Gespeichert wird alles über js/todo-store.js.
   ========================================================================== */

/* --------------------------------------------------------------------------
   KONFIGURATION – Startwerte, hier anpassbar
   -------------------------------------------------------------------------- */
const TODO_KONFIG = {
  // Die fünf Stufen, von dringend nach entspannt. bisTage: Aufgaben, die
  // in weniger als so vielen Tagen fällig sind, gehören in diese Stufe.
  // Die Farben stehen als CSS-Variablen in css/todo.css (--todo-<id>).
  stufen: [
    { id: "sehr-wichtig", name: "Sehr wichtig", bisTage: 1 },
    { id: "wichtig", name: "Wichtig", bisTage: 3 },
    { id: "bald", name: "Bald", bisTage: 7 },
    { id: "entspannt", name: "Entspannt", bisTage: 14 },
    { id: "locker", name: "Locker noch Zeit", bisTage: Infinity },
  ],
  standardZeit: "23:59",          // ohne Uhrzeit gilt eine Aufgabe bis zum Ende des Tages
  aktualisierenMs: 30000,         // so oft rechnet die offene Seite Prioritäten neu
  animationMs: 380,               // Karte wandert nach "Erledigt" bzw. zurück
};


const TodoAnsicht = (function () {

  const K = TODO_KONFIG;
  const TAG_MS = 24 * 60 * 60 * 1000;
  const KURZ_TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Im Browser liegt der Store schon global vor, in Node.js (Tests) wird er nachgeladen
  const Store = typeof TodoStore !== "undefined" ? TodoStore : require("./todo-store.js");


  /* ==========================================================================
     FÄLLIGKEIT UND PRIORITÄT (ohne DOM – auch in Tests nutzbar)
     ========================================================================== */

  function zeitTeile(zeit) {
    const t = (zeit || K.standardZeit).split(":").map(Number);
    return { h: t[0], m: t[1] };
  }

  /**
   * Wann ist die Aufgabe fällig?
   * - Abgabe: Datum + Uhrzeit (ohne Uhrzeit 23:59)
   * - Wöchentlich: der Wochentag der laufenden Woche (Montag bis Sonntag).
   *   Ist er schon vorbei, bleibt die Aufgabe bis Montag 0 Uhr überfällig –
   *   außer sie wurde erst danach angelegt, dann zählt die nächste Woche.
   *   Erledigte wöchentliche Aufgaben zeigen den Termin der nächsten Woche.
   * @returns {Date}
   */
  function faelligAm(aufgabe, jetzt) {
    const f = aufgabe.faelligkeit;
    const z = zeitTeile(f.zeit);
    if (f.art === "abgabe") {
      const t = f.datum.split("-").map(Number);
      return new Date(t[0], t[1] - 1, t[2], z.h, z.m);
    }
    const montag = Store.wochenStart(jetzt);
    const d = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + f.wochentag, z.h, z.m);
    const angelegt = aufgabe.erstellt ? new Date(aufgabe.erstellt) : null;
    if (aufgabe.erledigt || (d < jetzt && angelegt && angelegt > d)) d.setDate(d.getDate() + 7);
    return d;
  }

  /** Stufe für eine Zeitspanne bis zur Fälligkeit (ms); negativ = überfällig. */
  function stufeFuer(ms) {
    if (ms < 0) return { id: "ueberfaellig", name: "Überfällig" };
    const tage = ms / TAG_MS;
    return K.stufen.find(function (s) { return tage < s.bisTage; }) || K.stufen[K.stufen.length - 1];
  }

  /** Ganze Kalendertage zwischen zwei Zeitpunkten (0 = gleicher Tag). */
  function kalenderTage(von, bis) {
    const a = new Date(von.getFullYear(), von.getMonth(), von.getDate());
    const b = new Date(bis.getFullYear(), bis.getMonth(), bis.getDate());
    return Math.round((b - a) / TAG_MS);
  }

  function uhrzeit(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /** "2 Tagen", "3 Std.", "12 Min." – für "seit …" */
  function dauerText(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 60) return min <= 1 ? "1 Minute" : min + " Minuten";
    const std = Math.floor(min / 60);
    if (std < 24) return std === 1 ? "1 Stunde" : std + " Stunden";
    const tage = Math.floor(std / 24);
    return tage === 1 ? "1 Tag" : tage + " Tagen";
  }

  /**
   * Verbleibende Zeit als kurzer Text: "heute 23:59", "morgen 14:00",
   * "in 2 Tagen", "in 3 Wochen" – bei Überfälligem "seit 2 Tagen".
   */
  function restText(faellig, jetzt) {
    const ms = faellig - jetzt;
    if (ms < 0) return "überfällig seit " + dauerText(-ms);
    const tage = kalenderTage(jetzt, faellig);
    if (tage === 0) return "heute " + uhrzeit(faellig);
    if (tage === 1) return "morgen " + uhrzeit(faellig);
    if (tage < 14) return "in " + tage + " Tagen";
    const wochen = Math.floor(tage / 7);
    return "in " + wochen + " Wochen";
  }

  /** Die Fälligkeit selbst: "Abgabe Fr, 17.10.2026, 23:59" bzw. "jeden Freitag, 14:00". */
  function faelligText(aufgabe) {
    const f = aufgabe.faelligkeit;
    const zeit = f.zeit || K.standardZeit;
    if (f.art === "woechentlich") return "jeden " + Store.WOCHENTAGE[f.wochentag] + ", " + zeit;
    const t = f.datum.split("-").map(Number);
    const d = new Date(t[0], t[1] - 1, t[2]);
    return "Abgabe " + KURZ_TAGE[(d.getDay() + 6) % 7] + ", " +
      String(t[2]).padStart(2, "0") + "." + String(t[1]).padStart(2, "0") + "." + t[0] + ", " + zeit;
  }

  /**
   * Alles, was die Anzeige über eine Aufgabe wissen muss.
   * @returns {{faellig: Date, ms: number, stufe: {id, name}, rest: string, text: string}}
   */
  function info(aufgabe, jetzt) {
    const faellig = faelligAm(aufgabe, jetzt);
    const ms = faellig - jetzt;
    return { faellig: faellig, ms: ms, stufe: stufeFuer(ms), rest: restText(faellig, jetzt), text: faelligText(aufgabe) };
  }


  /* ==========================================================================
     OBERFLÄCHE
     ========================================================================== */

  const el = {};
  const zustand = { bearbeiteId: null, uhr: null, laeuft: false };

  // Symbole (schlicht, als SVG)
  const SYMBOL = {
    haken: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>',
    offen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>',
    wiederholung: '<svg class="todo-symbol" viewBox="0 0 24 24" aria-label="wöchentlich" role="img"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" /><path d="M20 4v4.5h-4.5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" /><path d="M4 20v-4.5h4.5" /></svg>',
    uhr: '<svg class="todo-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>',
  };

  function jetzt() {
    return new Date();
  }

  function bewegungReduziert() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Baut die Ansicht auf. Wird von app.js EINMAL aufgerufen.
   * @param {HTMLElement} container – das Element <div id="todo-root">
   */
  function init(container) {
    let skala = "";
    K.stufen.forEach(function (s, i) {
      skala +=
        '<div class="todo-stufe-name" data-stufe="' + s.id + '" style="grid-row:' + (i + 1) + '">' +
          '<span class="todo-punkt"></span>' + s.name + "</div>" +
        '<div class="todo-gruppe" data-stufe="' + s.id + '" style="grid-row:' + (i + 1) + '">' +
          '<h3 class="todo-gruppe-titel"><span class="todo-punkt"></span>' + s.name + "</h3>" +
          '<div class="todo-liste"></div>' +
        "</div>";
    });
    const wochentage = Store.WOCHENTAGE.map(function (name, i) {
      return '<option value="' + i + '">' + name + "</option>";
    }).join("");

    container.innerHTML =
      '<div class="todo">' +
        '<div class="todo-kopf">' +
          '<button type="button" class="knopf todo-neu" data-aktion="neu">+ Neue Aufgabe</button>' +
          '<p class="todo-zusammenfassung" role="status"></p>' +
          // Nur im Datenbank-Modus: lädt / verbunden / Fehler
          '<p class="todo-abgleich" role="status"></p>' +
        "</div>" +
        '<section class="todo-ueberfaellig" aria-labelledby="todo-ueberfaellig-titel" hidden>' +
          '<h2 id="todo-ueberfaellig-titel">Überfällig</h2>' +
          '<div class="todo-liste"></div>' +
        "</section>" +
        '<div class="todo-raster">' +
          '<div class="todo-skala" aria-hidden="true"></div>' + skala +
        "</div>" +
        '<p class="todo-leer" hidden>Nichts zu erledigen. Lege mit „Neue Aufgabe“ deine erste Aufgabe oder Abgabe an.</p>' +
        '<details class="todo-erledigt">' +
          '<summary><span class="todo-erledigt-titel">Erledigt</span> <span class="todo-erledigt-anzahl"></span></summary>' +
          '<div class="todo-erledigt-kopf">' +
            '<button type="button" class="knopf todo-leeren" data-aktion="leeren">Erledigte leeren</button>' +
          "</div>" +
          '<div class="todo-liste"></div>' +
        "</details>" +
        // Formular: <dialog> – Escape schließt es, der Rest der Seite ist gesperrt
        '<dialog class="todo-dialog" aria-labelledby="todo-dialog-titel">' +
          '<form class="todo-formular" novalidate>' +
            '<h2 id="todo-dialog-titel" class="todo-dialog-titel">Neue Aufgabe</h2>' +
            '<label class="todo-feld">Titel <input type="text" name="titel" autocomplete="off" maxlength="' + Store.MAX_TITEL + '" placeholder="z. B. Software Engineering"></label>' +
            '<label class="todo-feld">Was ist zu tun? <span class="todo-optional">(optional)</span>' +
              '<textarea name="beschreibung" rows="2" maxlength="' + Store.MAX_BESCHREIBUNG + '" placeholder="z. B. Übungsblatt 3 hochladen"></textarea></label>' +
            '<fieldset class="todo-feld todo-arten"><legend>Fälligkeit</legend>' +
              '<label class="todo-art-wahl"><input type="radio" name="art" value="abgabe"> Abgabe (Datum)</label>' +
              '<label class="todo-art-wahl"><input type="radio" name="art" value="woechentlich"> Wöchentlich</label>' +
            "</fieldset>" +
            '<label class="todo-feld todo-nur-abgabe">Datum <input type="date" name="datum"></label>' +
            '<label class="todo-feld todo-nur-woche">Wochentag <select name="wochentag"><option value="">Bitte wählen</option>' + wochentage + "</select></label>" +
            '<label class="todo-feld todo-nur-zeit">Uhrzeit <span class="todo-optional">(optional – ohne Uhrzeit gilt ' + K.standardZeit + ")</span>" +
              '<input type="time" name="zeit"></label>' +
            '<p class="todo-fehler" role="alert"></p>' +
            '<div class="todo-dialog-knoepfe">' +
              '<button type="button" class="todo-knopf todo-knopf--gefahr" data-aktion="loeschen">Löschen</button>' +
              '<span class="todo-platzhalter"></span>' +
              '<button type="button" class="todo-knopf" data-aktion="abbrechen">Abbrechen</button>' +
              '<button type="submit" class="todo-knopf todo-knopf--haupt">Speichern</button>' +
            "</div>" +
          "</form>" +
        "</dialog>" +
      "</div>";

    el.wurzel = container.querySelector(".todo");
    el.zusammenfassung = container.querySelector(".todo-zusammenfassung");
    el.ueberfaellig = container.querySelector(".todo-ueberfaellig");
    el.raster = container.querySelector(".todo-raster");
    el.leer = container.querySelector(".todo-leer");
    el.erledigt = container.querySelector(".todo-erledigt");
    el.erledigtAnzahl = container.querySelector(".todo-erledigt-anzahl");
    el.leeren = container.querySelector(".todo-leeren");
    el.dialog = container.querySelector(".todo-dialog");
    el.formular = container.querySelector(".todo-formular");
    el.fehler = container.querySelector(".todo-fehler");
    el.abgleich = container.querySelector(".todo-abgleich");

    // Alle Klicks an einer Stelle: Buttons der Karten, Neu, Leeren
    el.wurzel.addEventListener("click", function (event) {
      const knopf = event.target.closest("[data-aktion]");
      if (!knopf) return;
      const karte = knopf.closest(".todo-karte");
      const aktion = knopf.dataset.aktion;
      if (aktion === "neu") oeffneFormular(null);
      else if (aktion === "bearbeiten") oeffneFormular(karte.dataset.id);
      else if (aktion === "erledigt") setzeZustand(karte, true);
      else if (aktion === "offen") setzeZustand(karte, false);
      else if (aktion === "leeren") leeren();
      else if (aktion === "abbrechen") el.dialog.close();
      else if (aktion === "loeschen") loeschen();
    });
    el.formular.addEventListener("submit", speichern);
    el.formular.addEventListener("change", function (event) {
      if (event.target.name === "art") passeFormularAn();
    });

    // Die Priorität rechnet sich von selbst neu – auch wenn die Seite offen bleibt
    zustand.uhr = setInterval(function () {
      if (sichtbar()) zeichne();
    }, K.aktualisierenMs);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && sichtbar()) {
        zeichne();
        Store.aktualisieren();          // auf einem anderen Gerät kann sich etwas geändert haben
      }
    });

    // Datenbank: nach dem Laden neu zeichnen, Status und Fehler anzeigen
    Store.beiAenderung(function (stand) {
      zeigeAbgleich(stand);
      if (stand.status !== "laedt" && !el.dialog.open) zeichne();
    });

    zeichne();
  }

  /** Bei jedem Öffnen von #todo: neu zeichnen (Zeit ist vergangen) und frisch laden. */
  function zeige() {
    zeichne();
    zeigeAbgleich(Store.status());
    Store.aktualisieren();
    return null;
  }

  function zeigeAbgleich(stand) {
    let text = "";
    if (stand.modus === "datenbank") {
      if (stand.status === "laedt") text = "Lädt aus der Datenbank …";
      else if (stand.status === "fehler") text = stand.text;
      else text = "Gespeichert in der Datenbank";
    }
    el.abgleich.textContent = text;
    el.abgleich.dataset.art = stand.modus === "datenbank" ? stand.status : "";
  }

  function sichtbar() {
    return el.wurzel && el.wurzel.offsetParent !== null;
  }


  /* ------------------------------------------------------------------------
     ZEICHNEN
     ------------------------------------------------------------------------ */

  function zeichne() {
    const t = jetzt();
    const aufgaben = Store.alle(t);       // setzt wöchentliche Aufgaben nach einem Wochenwechsel zurück
    const offen = [], erledigt = [];
    aufgaben.forEach(function (a) {
      const i = info(a, t);
      (a.erledigt ? erledigt : offen).push({ a: a, i: i });
    });
    offen.sort(function (x, y) { return x.i.faellig - y.i.faellig; });
    erledigt.sort(function (x, y) { return new Date(y.a.erledigtAm) - new Date(x.a.erledigtAm); });

    // Überfällig
    const ueber = offen.filter(function (x) { return x.i.stufe.id === "ueberfaellig"; });
    el.ueberfaellig.hidden = ueber.length === 0;
    fuelle(el.ueberfaellig.querySelector(".todo-liste"), ueber, false);

    // Die fünf Stufen
    K.stufen.forEach(function (s) {
      const gruppe = el.raster.querySelector('.todo-gruppe[data-stufe="' + s.id + '"]');
      const liste = offen.filter(function (x) { return x.i.stufe.id === s.id; });
      fuelle(gruppe.querySelector(".todo-liste"), liste, false);
      const leer = liste.length === 0;
      gruppe.classList.toggle("ist-leer", leer);
      el.raster.querySelector('.todo-stufe-name[data-stufe="' + s.id + '"]').classList.toggle("ist-leer", leer);
    });

    // Erledigt
    fuelle(el.erledigt.querySelector(".todo-liste"), erledigt, true);
    el.erledigtAnzahl.textContent = "(" + erledigt.length + ")";
    el.leeren.disabled = !erledigt.some(function (x) { return x.a.faelligkeit.art === "abgabe"; });

    el.leer.hidden = offen.length > 0;
    el.zusammenfassung.textContent = offen.length === 0 ? "Alles erledigt."
      : offen.length + (offen.length === 1 ? " offene Aufgabe" : " offene Aufgaben") +
        (ueber.length ? ", davon " + ueber.length + " überfällig" : "");
  }

  /** Eine Liste mit Karten füllen. */
  function fuelle(liste, eintraege, erledigtBereich) {
    liste.innerHTML = eintraege.map(function (x) { return karteHtml(x.a, x.i, erledigtBereich); }).join("");
  }

  function escape(text) {
    return String(text).replace(/[&<>"']/g, function (z) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z];
    });
  }

  /** Eine Karte: farbiger Streifen, Titel, Beschreibung, Fälligkeit, Restzeit, zwei Knöpfe. */
  function karteHtml(a, i, erledigtBereich) {
    const woche = a.faelligkeit.art === "woechentlich";
    let rest;
    if (!erledigtBereich) rest = i.rest;
    else if (woche) rest = "wieder offen ab Montag";
    else rest = "erledigt am " + new Date(a.erledigtAm).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return (
      '<article class="todo-karte' + (a.erledigt ? " ist-erledigt" : "") + '" data-id="' + a.id + '" data-stufe="' + i.stufe.id + '">' +
        '<button type="button" class="todo-karte-inhalt" data-aktion="bearbeiten" aria-label="' + escape(a.titel) + ' bearbeiten">' +
          '<span class="todo-karte-titel">' + escape(a.titel) + "</span>" +
          (a.beschreibung ? '<span class="todo-karte-text">' + escape(a.beschreibung) + "</span>" : "") +
          '<span class="todo-karte-faellig">' + (woche ? SYMBOL.wiederholung : SYMBOL.uhr) +
            "<span>" + escape(i.text) + '</span><span class="todo-karte-rest">' + escape(rest) + "</span></span>" +
        "</button>" +
        '<div class="todo-status" role="group" aria-label="Status">' +
          '<button type="button" class="todo-status-knopf todo-status-knopf--erledigt" data-aktion="erledigt" aria-pressed="' + a.erledigt + '" title="Erledigt">' +
            SYMBOL.haken + '<span class="todo-unsichtbar">Erledigt</span></button>' +
          '<button type="button" class="todo-status-knopf todo-status-knopf--offen" data-aktion="offen" aria-pressed="' + !a.erledigt + '" title="Noch offen">' +
            SYMBOL.offen + '<span class="todo-unsichtbar">Noch offen</span></button>' +
        "</div>" +
      "</article>"
    );
  }


  /* ------------------------------------------------------------------------
     ERLEDIGT / NOCH OFFEN
     ------------------------------------------------------------------------ */

  /** Karte kurz wegfliegen lassen, dann speichern und neu zeichnen. */
  function setzeZustand(karte, erledigt) {
    const id = karte.dataset.id;
    const vorher = karte.classList.contains("ist-erledigt");
    if (vorher === erledigt) return;                 // schon in diesem Zustand
    const fertig = function () {
      Store.setzeErledigt(id, erledigt, jetzt());
      if (erledigt) el.erledigt.open = el.erledigt.open || false;
      zeichne();
      const neu = el.wurzel.querySelector('.todo-karte[data-id="' + id + '"]');
      if (neu && !bewegungReduziert()) {
        neu.classList.add("kommt");
        setTimeout(function () { neu.classList.remove("kommt"); }, K.animationMs);
      }
    };
    if (bewegungReduziert()) { fertig(); return; }
    // Höhe festhalten, damit die Karte weich zusammenschrumpfen kann
    karte.style.height = karte.offsetHeight + "px";
    karte.classList.add(erledigt ? "geht-runter" : "geht-hoch");
    requestAnimationFrame(function () { karte.style.height = "0px"; });
    setTimeout(fertig, K.animationMs);
  }

  function leeren() {
    const anzahl = Store.alle(jetzt()).filter(function (a) { return a.erledigt && a.faelligkeit.art === "abgabe"; }).length;
    if (!anzahl) return;
    const frage = anzahl === 1 ? "Die erledigte Aufgabe endgültig löschen?" : "Alle " + anzahl + " erledigten Aufgaben endgültig löschen?";
    if (!window.confirm(frage + "\n(Wöchentliche Aufgaben bleiben – sie sind am Montag wieder offen.)")) return;
    Store.erledigteLeeren();
    zeichne();
  }


  /* ------------------------------------------------------------------------
     FORMULAR
     ------------------------------------------------------------------------ */

  function oeffneFormular(id) {
    const f = el.formular.elements;
    const a = id ? Store.hole(id) : null;
    zustand.bearbeiteId = a ? a.id : null;
    el.formular.querySelector(".todo-dialog-titel").textContent = a ? "Aufgabe bearbeiten" : "Neue Aufgabe";
    el.formular.querySelector('[data-aktion="loeschen"]').hidden = !a;
    f.titel.value = a ? a.titel : "";
    f.beschreibung.value = a ? a.beschreibung : "";
    const fa = a ? a.faelligkeit : null;
    // Neue Aufgabe: noch keine Fälligkeit gewählt (wird geprüft)
    Array.prototype.forEach.call(f.art, function (r) { r.checked = Boolean(fa) && r.value === fa.art; });
    f.datum.value = fa && fa.art === "abgabe" ? fa.datum : "";
    f.wochentag.value = fa && fa.art === "woechentlich" ? String(fa.wochentag) : "";
    f.zeit.value = fa ? fa.zeit : "";
    zeigeFehler(null);
    passeFormularAn();
    el.dialog.showModal();
    f.titel.focus();
  }

  /** Datum bzw. Wochentag nur zeigen, wenn die passende Art gewählt ist. */
  function passeFormularAn() {
    const art = el.formular.elements.art.value;
    el.formular.querySelector(".todo-nur-abgabe").hidden = art !== "abgabe";
    el.formular.querySelector(".todo-nur-woche").hidden = art !== "woechentlich";
    el.formular.querySelector(".todo-nur-zeit").hidden = !art;
  }

  function formularWerte() {
    const f = el.formular.elements;
    const art = f.art.value;
    const faelligkeit = !art ? null : art === "abgabe"
      ? { art: "abgabe", datum: f.datum.value, zeit: f.zeit.value }
      : { art: "woechentlich", wochentag: f.wochentag.value === "" ? "" : Number(f.wochentag.value), zeit: f.zeit.value };
    return { titel: f.titel.value, beschreibung: f.beschreibung.value, faelligkeit: faelligkeit };
  }

  function speichern(event) {
    event.preventDefault();
    const werte = formularWerte();
    const ergebnis = zustand.bearbeiteId ? Store.aendern(zustand.bearbeiteId, werte) : Store.hinzufuegen(werte, jetzt());
    if (!ergebnis.ok) {
      zeigeFehler(ergebnis);
      return;
    }
    el.dialog.close();
    zeichne();
  }

  function loeschen() {
    const a = Store.hole(zustand.bearbeiteId);
    if (!a) return;
    if (!window.confirm("„" + a.titel + "“ löschen?")) return;
    Store.loeschen(a.id);
    el.dialog.close();
    zeichne();
  }

  /** Fehlermeldung im Formular, betroffenes Feld markieren. */
  function zeigeFehler(ergebnis) {
    el.formular.querySelectorAll("[aria-invalid]").forEach(function (feld) { feld.removeAttribute("aria-invalid"); });
    el.fehler.textContent = ergebnis ? ergebnis.fehler : "";
    if (ergebnis && ergebnis.feld) {
      const feld = el.formular.elements[ergebnis.feld];
      if (!feld) return;
      // Die Fälligkeit ist eine Gruppe aus zwei Optionen: die Gruppe markieren, die erste fokussieren
      const gruppe = !feld.tagName;
      (gruppe ? el.formular.querySelector(".todo-arten") : feld).setAttribute("aria-invalid", "true");
      (gruppe ? feld[0] : feld).focus();
    }
  }


  return {
    init: init,
    zeige: zeige,
    // Für Tests und andere Bereiche: reine Berechnungen
    KONFIG: K,
    faelligAm: faelligAm,
    stufeFuer: stufeFuer,
    restText: restText,
    faelligText: faelligText,
    info: info,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = TodoAnsicht;
}
