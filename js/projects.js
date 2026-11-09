/* ==========================================================================
   projects.js – Abschnitt "Projekte/Ideen"
   Links eine schmale Seitenleiste mit allen Projekten und Ideen (neueste
   oben, je Titel und erste Zeile der Idee) und dem Button "Neue Idee";
   rechts das ausgewählte Projekt: Titel groß in der Serifenschrift, darunter
   die Idee – beides per Klick bearbeitbar – und ein Platzhalter für die
   spätere schrittweise Dokumentation.

   Adressen:
     #projects        → Computer: das neueste Projekt; Smartphone: die Liste
     #projects/<id>   → dieses Projekt (Neuladen und Zurück-Button gehen)
   Auf dem Smartphone zeigt #projects/<id> das Projekt in voller Breite mit
   Zurück-Pfeil zur Liste.

   Daten: js/projects-store.js. Aussehen: css/projects.css.
   ========================================================================== */

const ProjekteAnsicht = (function () {
  const S = ProjekteStore;
  const handyAbfrage = window.matchMedia("(max-width: 699px)");   // wie in css/projects.css
  const el = {};
  let gewaehlt = null;            // ID des angezeigten Projekts
  let bearbeitet = null;          // "titel" oder "idee" während der Bearbeitung


  /* ==========================================================================
     AUFBAU
     ========================================================================== */

  function init(container) {
    container.innerHTML =
      '<div class="pj">' +
        '<aside class="pj-seite" aria-label="Alle Projekte und Ideen">' +
          '<button type="button" class="knopf knopf--haupt pj-neu" data-aktion="neu" aria-expanded="false" aria-controls="pj-formular">+ Neue Idee</button>' +
          '<form class="pj-formular" id="pj-formular" hidden novalidate>' +
            '<label class="pj-feld"><span>Titel</span><input name="titel" type="text" maxlength="200" required autocomplete="off"></label>' +
            '<label class="pj-feld"><span>Idee (optional)</span><textarea name="idee" rows="3"></textarea></label>' +
            '<p class="pj-fehler" role="alert"></p>' +
            '<div class="pj-formular-knoepfe">' +
              '<button type="submit" class="knopf knopf--haupt">Speichern</button>' +
              '<button type="button" class="knopf" data-aktion="abbrechen">Abbrechen</button>' +
            "</div>" +
          "</form>" +
          '<ul class="pj-liste"></ul>' +
        "</aside>" +
        '<section class="pj-detail" aria-live="polite"></section>' +
      "</div>";

    el.pj = container.querySelector(".pj");
    el.neu = container.querySelector(".pj-neu");
    el.formular = container.querySelector(".pj-formular");
    el.fehler = container.querySelector(".pj-fehler");
    el.liste = container.querySelector(".pj-liste");
    el.detail = container.querySelector(".pj-detail");

    el.pj.addEventListener("click", klick);
    el.formular.addEventListener("submit", formularSpeichern);
    el.formular.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); formularSchliessen(true); }
    });
    // Klick neben das Löschen-Menü schließt es
    document.addEventListener("click", function (e) {
      if (el.menue && !el.menue.hidden && !e.target.closest(".pj-menue, .pj-menue-knopf")) menueZu();
    });
    handyAbfrage.addEventListener("change", function () { zeige(gewaehlt || ""); });
  }

  /**
   * Wird bei jedem Öffnen aufgerufen (auch beim Wechsel #projects ↔ #projects/<id>).
   * @param {string} unterseite – die Projekt-ID aus der Adresse oder ""
   * @returns {HTMLElement|null} – bekommt den Fokus
   */
  function zeige(unterseite) {
    const liste = S.liste();
    let id = unterseite && S.hole(unterseite) ? unterseite : null;
    if (unterseite && !id) {
      // Unbekannte ID (z. B. gelöscht): zurück zur Liste, ohne neuen Verlaufseintrag
      history.replaceState(null, "", "#projects");
    }
    if (!id && !handyAbfrage.matches && liste.length) {
      // Computer: ohne Auswahl das neueste Projekt zeigen
      id = liste[0].id;
      history.replaceState(null, "", "#projects/" + id);
    }
    gewaehlt = id;
    bearbeitet = null;
    zeichneListe(liste);
    zeichneDetail();
    // Smartphone: entweder Liste oder Projekt in voller Breite
    el.pj.classList.toggle("zeigt-projekt", Boolean(id));
    return id && unterseite ? el.detail.querySelector(".pj-titel") : null;
  }

  /** Nach einem Import: alles neu zeichnen. */
  function neuLaden() {
    if (el.pj && !document.getElementById("view-projects").hidden) zeige(gewaehlt || "");
  }


  /* ==========================================================================
     LISTE
     ========================================================================== */

  function zeichneListe(liste) {
    el.liste.textContent = "";
    if (!liste.length) {
      // Nur auf dem Smartphone sichtbar – dort fehlt der rechte Bereich mit dem Hinweis
      const li = document.createElement("li");
      li.className = "pj-liste-leer";
      li.textContent = "Noch keine Projekte. Mit „Neue Idee“ legst du die erste an.";
      el.liste.appendChild(li);
    }
    liste.forEach(function (p) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "pj-eintrag";
      a.href = "#projects/" + p.id;
      a.dataset.id = p.id;
      if (p.id === gewaehlt) a.setAttribute("aria-current", "true");
      const t = document.createElement("span");
      t.className = "pj-eintrag-titel";
      t.textContent = p.titel;
      const z = document.createElement("span");
      z.className = "pj-eintrag-idee";
      z.textContent = ersteZeile(p.idee);
      a.appendChild(t);
      a.appendChild(z);
      li.appendChild(a);
      el.liste.appendChild(li);
    });
  }

  function ersteZeile(text) {
    return (text || "").split("\n").map(function (z) { return z.trim(); }).find(Boolean) || "";
  }


  /* ==========================================================================
     DETAIL DES AUSGEWÄHLTEN PROJEKTS
     ========================================================================== */

  function zeichneDetail() {
    const p = gewaehlt ? S.hole(gewaehlt) : null;
    el.detail.textContent = "";
    if (!p) {
      el.detail.innerHTML = S.liste().length
        ? '<p class="pj-leer">Wähle links ein Projekt aus.</p>'
        : '<p class="pj-leer">Noch keine Projekte. Mit „Neue Idee“ legst du die erste an – ein Titel genügt.</p>';
      return;
    }
    el.detail.innerHTML =
      '<a class="pj-zurueck" href="#projects" aria-label="Zurück zur Liste">← Alle Projekte</a>' +
      '<div class="pj-kopf">' +
        '<h2 class="pj-titel" tabindex="0" title="Klicken zum Bearbeiten"></h2>' +
        '<button type="button" class="pj-menue-knopf" data-aktion="menue" aria-label="Weitere Aktionen" aria-haspopup="menu" aria-expanded="false">⋯</button>' +
        '<div class="pj-menue" role="menu" hidden>' +
          '<button type="button" role="menuitem" class="pj-menue-eintrag pj-menue-eintrag--gefahr" data-aktion="loeschen">Projekt löschen</button>' +
        "</div>" +
      "</div>" +
      '<p class="pj-zeit"></p>' +
      '<div class="pj-idee" tabindex="0" title="Klicken zum Bearbeiten"></div>' +
      '<section class="pj-doku" aria-label="Dokumentation">' +
        '<h3 class="pj-doku-titel">Dokumentation</h3>' +
        '<p class="pj-doku-platzhalter">Dokumentation folgt</p>' +
      "</section>";
    el.menue = el.detail.querySelector(".pj-menue");
    el.detail.querySelector(".pj-titel").textContent = p.titel;
    const idee = el.detail.querySelector(".pj-idee");
    idee.textContent = p.idee;
    idee.classList.toggle("ist-leer", !p.idee);
    if (!p.idee) idee.textContent = "Idee beschreiben …";
    el.detail.querySelector(".pj-zeit").textContent = "Angelegt " + datum(p.erstellt) +
      (p.geaendert !== p.erstellt ? " · geändert " + datum(p.geaendert) : "");
    ["pj-titel", "pj-idee"].forEach(function (k) {
      el.detail.querySelector("." + k).addEventListener("keydown", function (e) {
        if ((e.key === "Enter" || e.key === " ") && !bearbeitet) { e.preventDefault(); bearbeite(k === "pj-titel" ? "titel" : "idee"); }
      });
    });
  }

  function datum(iso) {
    const d = new Date(iso);
    const z = function (n) { return String(n).padStart(2, "0"); };
    return z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear();
  }


  /* ==========================================================================
     BEARBEITEN PER KLICK (Titel und Idee)
     ========================================================================== */

  function bearbeite(feld) {
    if (bearbeitet || !gewaehlt) return;
    const p = S.hole(gewaehlt);
    const anzeige = el.detail.querySelector(feld === "titel" ? ".pj-titel" : ".pj-idee");
    const eingabe = document.createElement(feld === "titel" ? "input" : "textarea");
    eingabe.className = "pj-eingabe pj-eingabe--" + feld;
    eingabe.value = p[feld];
    eingabe.setAttribute("aria-label", feld === "titel" ? "Titel" : "Idee");
    if (feld === "titel") eingabe.maxLength = 200;
    else eingabe.rows = Math.max(4, p.idee.split("\n").length + 1);
    anzeige.hidden = true;
    anzeige.after(eingabe);
    bearbeitet = feld;
    eingabe.focus();
    eingabe.setSelectionRange(eingabe.value.length, eingabe.value.length);

    let fertig = false;
    function ende(uebernehmen) {
      if (fertig) return;
      fertig = true;
      bearbeitet = null;
      const wert = eingabe.value;
      if (uebernehmen && wert !== p[feld]) {
        const aenderung = {};
        aenderung[feld] = wert;
        const r = S.aendern(gewaehlt, aenderung);
        if (!r.ok) {
          // Leerer Titel: der alte bleibt
          zeichneDetail();
          zeigeHinweis(r.fehler);
          return;
        }
        zeichneListe(S.liste());
      }
      zeichneDetail();
      el.detail.querySelector(feld === "titel" ? ".pj-titel" : ".pj-idee").focus({ preventScroll: true });
    }
    eingabe.addEventListener("blur", function () { ende(true); });
    eingabe.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); ende(false); }
      // Titel: Enter speichert; Idee: Strg/Cmd + Enter speichert (Enter = neue Zeile)
      if (e.key === "Enter" && (feld === "titel" || e.ctrlKey || e.metaKey)) { e.preventDefault(); ende(true); }
    });
  }

  function zeigeHinweis(text) {
    const h = document.createElement("p");
    h.className = "pj-hinweis";
    h.setAttribute("role", "status");
    h.textContent = text;
    el.detail.querySelector(".pj-kopf").after(h);
    setTimeout(function () { h.remove(); }, 4000);
  }


  /* ==========================================================================
     KLICKS: Neue Idee, Bearbeiten, Menü, Löschen
     ========================================================================== */

  function klick(e) {
    const k = e.target.closest("[data-aktion]");
    const a = k && k.dataset.aktion;
    if (a === "neu") { el.formular.hidden ? formularOeffnen() : formularSchliessen(true); return; }
    if (a === "abbrechen") { formularSchliessen(true); return; }
    if (a === "menue") { el.menue.hidden ? menueAuf() : menueZu(); return; }
    if (a === "loeschen") { loesche(); return; }
    if (e.target.closest(".pj-titel")) bearbeite("titel");
    else if (e.target.closest(".pj-idee")) bearbeite("idee");
  }

  function formularOeffnen() {
    el.formular.reset();
    el.fehler.textContent = "";
    el.formular.hidden = false;
    el.neu.setAttribute("aria-expanded", "true");
    el.formular.elements.titel.removeAttribute("aria-invalid");
    el.formular.elements.titel.focus();
  }

  function formularSchliessen(fokusZurueck) {
    el.formular.hidden = true;
    el.neu.setAttribute("aria-expanded", "false");
    if (fokusZurueck) el.neu.focus();
  }

  function formularSpeichern(e) {
    e.preventDefault();
    const r = S.anlegen({ titel: el.formular.elements.titel.value, idee: el.formular.elements.idee.value });
    if (!r.ok) {
      el.fehler.textContent = r.fehler;
      el.formular.elements.titel.setAttribute("aria-invalid", "true");
      el.formular.elements.titel.focus();
      return;
    }
    formularSchliessen(false);
    // Neu angelegt: oben in der Liste und ausgewählt
    window.location.hash = "#projects/" + r.projekt.id;
  }

  function menueAuf() {
    el.menue.hidden = false;
    el.detail.querySelector(".pj-menue-knopf").setAttribute("aria-expanded", "true");
    el.menue.querySelector("button").focus();
  }

  function menueZu() {
    if (!el.menue) return;
    el.menue.hidden = true;
    const k = el.detail.querySelector(".pj-menue-knopf");
    if (k) k.setAttribute("aria-expanded", "false");
  }

  function loesche() {
    const p = S.hole(gewaehlt);
    menueZu();
    if (!p) return;
    if (!window.confirm("Projekt „" + p.titel + "“ wirklich löschen? Das lässt sich nicht rückgängig machen.")) return;
    S.loeschen(p.id);
    gewaehlt = null;
    // Zurück zur Übersicht (Computer: dort steht dann das neueste Projekt)
    history.replaceState(null, "", "#projects");
    zeige("");
    el.neu.focus();
  }


  return { init: init, zeige: zeige, neuLaden: neuLaden };
})();
