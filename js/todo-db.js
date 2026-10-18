/* ==========================================================================
   todo-db.js – Verbindung von "Zu erledigen" zur Oracle-Datenbank
   Die Tabelle AUFGABE (siehe db/01_aufgabe.sql) ist über ORDS als
   REST-Schnittstelle erreichbar (AutoREST, geschützt mit OAuth 2.0):

     POST   …/oauth/token            Client-ID + Secret → Token (1 Stunde)
     GET    …/aufgabe/               alle Zeilen (seitenweise)
     POST   …/aufgabe/               neue Zeile
     PUT    …/aufgabe/<id>           Zeile ersetzen
     DELETE …/aufgabe/<id>           Zeile löschen

   Client-ID und Secret stehen NICHT im Code (die Seite ist öffentlich),
   sondern werden in den Einstellungen eingetragen und nur im Browser des
   jeweiligen Geräts gespeichert. Ohne Zugangsdaten bleibt alles lokal.

   Diese Datei übersetzt außerdem zwischen einer Aufgabe der App
   ({ faelligkeit: { art, datum, … } }) und einer Tabellenzeile
   ({ faelligkeit_art, faelligkeit_datum, … }).
   ========================================================================== */

const TodoDb = (function () {

  const KONFIG = {
    basisUrl: "https://ge6cee71e1b4994-ipglvvqg82y2926o.adb.eu-paris-1.oraclecloudapps.com/ords/ntb_app",
    tabelle: "aufgabe",
    seitenGroesse: 100,               // Zeilen pro GET (ORDS liefert sonst 25)
    tokenPufferMs: 60000,             // Token eine Minute vor Ablauf erneuern
  };

  const ZUGANG_SCHLUESSEL = "ntb-todo-db-zugang";

  // Token nur im Speicher – nach dem Neuladen wird ein neues geholt
  let token = null;                   // { wert, gueltigBis }


  /* ------------------------------------------------------------------------
     ZUGANGSDATEN
     ------------------------------------------------------------------------ */

  /** @returns {{clientId, secret} | null} */
  function zugang() {
    try {
      const roh = JSON.parse(localStorage.getItem(ZUGANG_SCHLUESSEL));
      if (roh && typeof roh.clientId === "string" && typeof roh.secret === "string" && roh.clientId && roh.secret) {
        return { clientId: roh.clientId, secret: roh.secret };
      }
    } catch (fehler) {
      // gesperrt oder kaputt – dann eben nicht verbunden
    }
    return null;
  }

  function verbunden() {
    return zugang() !== null;
  }

  function setzeZugang(clientId, secret) {
    token = null;
    localStorage.setItem(ZUGANG_SCHLUESSEL, JSON.stringify({ clientId: clientId.trim(), secret: secret.trim() }));
  }

  function trennen() {
    token = null;
    try {
      localStorage.removeItem(ZUGANG_SCHLUESSEL);
    } catch (fehler) {
      // nichts zu tun
    }
  }


  /* ------------------------------------------------------------------------
     ANFRAGEN
     ------------------------------------------------------------------------ */

  /** Fehler mit HTTP-Status, damit der Aufrufer unterscheiden kann. */
  function anfrageFehler(text, status) {
    const fehler = new Error(text);
    fehler.status = status || 0;
    return fehler;
  }

  /** Ein gültiges Token – aus dem Speicher oder neu geholt. */
  function holeToken(z) {
    if (token && Date.now() < token.gueltigBis - KONFIG.tokenPufferMs) return Promise.resolve(token.wert);
    return fetch(KONFIG.basisUrl + "/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(z.clientId + ":" + z.secret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }).then(function (antwort) {
      if (antwort.status === 401) throw anfrageFehler("Client-ID oder Secret falsch.", 401);
      if (!antwort.ok) throw anfrageFehler("Anmeldung fehlgeschlagen (HTTP " + antwort.status + ").", antwort.status);
      return antwort.json();
    }).then(function (daten) {
      token = { wert: daten.access_token, gueltigBis: Date.now() + (Number(daten.expires_in) || 3600) * 1000 };
      return token.wert;
    });
  }

  /**
   * Anfrage an die Tabelle. Läuft das Token unterwegs ab (401), wird
   * einmal ein neues geholt und die Anfrage wiederholt.
   * @param {string} pfad – z. B. "/" oder "/<id>" oder "/?offset=100"
   */
  function anfrage(methode, pfad, inhalt, nochmal) {
    const z = zugang();
    if (!z) return Promise.reject(anfrageFehler("Keine Datenbank-Zugangsdaten eingetragen."));
    return holeToken(z).then(function (wert) {
      const optionen = { method: methode, headers: { "Authorization": "Bearer " + wert } };
      if (inhalt !== undefined) {
        optionen.headers["Content-Type"] = "application/json";
        optionen.body = JSON.stringify(inhalt);
      }
      return fetch(KONFIG.basisUrl + "/" + KONFIG.tabelle + pfad, optionen);
    }).then(function (antwort) {
      if (antwort.status === 401 && !nochmal) {
        token = null;
        return anfrage(methode, pfad, inhalt, true);
      }
      if (!antwort.ok) {
        return antwort.text().then(function (text) {
          throw anfrageFehler(fehlerText(antwort.status, text), antwort.status);
        });
      }
      return antwort.status === 204 ? null : antwort.text().then(function (text) {
        return text ? JSON.parse(text) : null;
      });
    }, function (fehler) {
      // fetch selbst ist gescheitert: offline, CORS oder Server nicht erreichbar
      if (fehler.status !== undefined) throw fehler;
      throw anfrageFehler("Datenbank nicht erreichbar (offline oder Ursprung nicht freigegeben).");
    });
  }

  /** Verständliche Meldung; bei verletzten Regeln den Constraint-Namen mitgeben. */
  function fehlerText(status, text) {
    const regel = /ORA-\d{5}[^"\\]*/.exec(text || "");
    if (status === 401 || status === 403) return "Keine Berechtigung für die Tabelle (HTTP " + status + ").";
    if (status === 404) return "Aufgabe nicht gefunden.";
    return "Die Datenbank hat abgelehnt (HTTP " + status + ")" + (regel ? ": " + regel[0] : ".");
  }


  /* ------------------------------------------------------------------------
     AUFGABE ↔ TABELLENZEILE
     ------------------------------------------------------------------------ */

  /** Aufgabe der App → Zeile für die Tabelle AUFGABE. */
  function alsZeile(a) {
    const f = a.faelligkeit;
    return {
      id: a.id,
      titel: a.titel,
      beschreibung: a.beschreibung || null,              // "" ist in Oracle ohnehin NULL
      faelligkeit_art: f.art,
      // DATE ohne Zeitzone: Mitternacht, so wie ORDS es auch liefert
      faelligkeit_datum: f.art === "abgabe" ? f.datum + "T00:00:00Z" : null,
      faelligkeit_zeit: f.zeit || null,
      faelligkeit_wochentag: f.art === "woechentlich" ? f.wochentag : null,
      erledigt: a.erledigt,
      erledigt_am: a.erledigt ? a.erledigtAm : null,
      erstellt: a.erstellt,
    };
  }

  /** Zeile aus der Tabelle → Aufgabe der App (ungeprüft, siehe TodoStore.pruefeDaten). */
  function alsAufgabe(z) {
    const faelligkeit = z.faelligkeit_art === "woechentlich"
      ? { art: "woechentlich", wochentag: z.faelligkeit_wochentag, zeit: z.faelligkeit_zeit || "" }
      // Nur das Datum nehmen – über new Date() würde die Zeitzone den Tag verschieben
      : { art: z.faelligkeit_art, datum: typeof z.faelligkeit_datum === "string" ? z.faelligkeit_datum.slice(0, 10) : "", zeit: z.faelligkeit_zeit || "" };
    return {
      id: z.id,
      titel: z.titel,
      beschreibung: z.beschreibung || "",
      faelligkeit: faelligkeit,
      erledigt: z.erledigt === true,
      erledigtAm: z.erledigt_am || null,
      erstellt: z.erstellt,
    };
  }


  /* ------------------------------------------------------------------------
     OPERATIONEN
     ------------------------------------------------------------------------ */

  /** Alle Aufgaben aus der Tabelle – ORDS liefert seitenweise, also nachladen. */
  function holeAlle() {
    const aufgaben = [];
    function seite(offset) {
      return anfrage("GET", "/?limit=" + KONFIG.seitenGroesse + "&offset=" + offset).then(function (daten) {
        (daten.items || []).forEach(function (z) { aufgaben.push(alsAufgabe(z)); });
        return daten.hasMore ? seite(offset + (daten.items || []).length) : aufgaben;
      });
    }
    return seite(0);
  }

  function einfuegen(aufgabe) {
    return anfrage("POST", "/", alsZeile(aufgabe));
  }

  function aendern(aufgabe) {
    return anfrage("PUT", "/" + encodeURIComponent(aufgabe.id), alsZeile(aufgabe));
  }

  function loeschen(id) {
    return anfrage("DELETE", "/" + encodeURIComponent(id));
  }

  /** Zugangsdaten prüfen: Token holen und einmal lesen. @returns {Promise<number>} Anzahl Aufgaben */
  function testen() {
    token = null;
    return holeAlle().then(function (aufgaben) { return aufgaben.length; });
  }


  return {
    KONFIG: KONFIG,
    zugang: zugang,
    verbunden: verbunden,
    setzeZugang: setzeZugang,
    trennen: trennen,
    alsZeile: alsZeile,
    alsAufgabe: alsAufgabe,
    holeAlle: holeAlle,
    einfuegen: einfuegen,
    aendern: aendern,
    loeschen: loeschen,
    testen: testen,
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = TodoDb;
}
