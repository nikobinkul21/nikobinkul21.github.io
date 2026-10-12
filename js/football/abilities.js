/* ==========================================================================
   football/abilities.js – die Fähigkeiten der Spieler
   Jede Fähigkeit ist ein Eintrag der Liste:
     id, name, beschreibung, symbol (Name eines Symbols der Oberfläche),
     wirkung – Funktionen für die klar benannten Haken der Duell-Regeln
               (football/regeln.js ruft sie an genau diesen Stellen auf):

     wertBonus(wert, k)          → Zuschlag auf einen Wert ("passen" …)
     schussAbZone(standard, k)   → ab welcher Zone (Sicht des Schützen) geschossen werden darf
     schussZuschlag(rel, standard, k) → Zonenzuschlag beim Schuss gegen den Torwart
     vorDuell(k)                 → { art } – löst VOR dem Duell aus (Sologang)
     falschGeraten(k)            → true: Verteidiger erobert den Ball trotzdem (Mauer)
     vorruecken(standard, k)     → wie viele Zonen eine gelungene Aktion vorrückt
     passAngenommen(k)           → true: der Empfänger löst etwas aus (Traumannahme)
     torwartWert(wert, k)        → Wert des Torwarts gegen diesen Schützen
     schussArt(k)                → Name des Schusses (Akrobatik)

   k (Kontext) enthält: konfig (W = konfig.faehigkeiten[id]), zufall,
   figurId, aktion, passt, gewonnen, zustand. Die Zahlen stehen in
   konfig.faehigkeiten. Neue Fähigkeit? Ein weiterer Eintrag – die Regeln
   bleiben unverändert.
   ========================================================================== */

const FootballFaehigkeiten = (function () {

  function W(k, id) { return k.konfig.faehigkeiten[id]; }

  const LISTE = [
    {
      id: "uebersicht",
      name: "Übersicht",
      beschreibung: "Deutlich höherer Pass-Wert. Pässe, die der Gegner nicht blockt, rücken 2 Zonen statt 1 vor.",
      symbol: "auge",
      wirkung: {
        wertBonus: function (wert, k) { return W(k, "uebersicht").bonus[wert] || 0; },
        vorruecken: function (standard, k) {
          return k.aktion === "passen" && !k.passt ? W(k, "uebersicht").zonen : standard;
        },
      },
    },
    {
      id: "ballzauber",
      name: "Ballzauber",
      beschreibung: "Deutlich höherer Dribbel-Wert. Ein gewonnenes Dribbling gegen Zweikampf rückt 2 Zonen vor.",
      symbol: "funke",
      wirkung: {
        wertBonus: function (wert, k) { return W(k, "ballzauber").bonus[wert] || 0; },
        vorruecken: function (standard, k) {
          return k.aktion === "dribbeln" && k.passt && k.gewonnen ? W(k, "ballzauber").zonen : standard;
        },
      },
    },
    {
      id: "kanone",
      name: "Kanone",
      beschreibung: "Deutlich höherer Schuss-Wert. Schüsse aus der gegnerischen Hälfte ohne Abzug.",
      symbol: "kanone",
      wirkung: {
        wertBonus: function (wert, k) { return W(k, "kanone").bonus[wert] || 0; },
        // Aus der gegnerischen Hälfte zählt der Zuschlag des Strafraums
        schussZuschlag: function (rel, standard, k) {
          const z = k.konfig.regeln.schussZone;
          return rel >= k.konfig.regeln.schussAbZone ? z[k.konfig.regeln.zonen.length - 1] : standard;
        },
      },
    },
    {
      id: "traumannahme",
      name: "Traumannahme",
      beschreibung: "Nimmt er einen gelungenen Pass an, glückt mit 50 % eine spektakuläre Ballannahme: Sein nächster Schuss trifft auf einen Torwart mit halbem Wert. Verfällt, wenn er den Ball verliert oder abgibt.",
      symbol: "stern",
      wirkung: {
        passAngenommen: function (k) { return k.zufall() < W(k, "traumannahme").chance; },
        torwartWert: function (wert, k) {
          return k.zustand.traumannahme === k.figurId ? Math.floor(wert * W(k, "traumannahme").torwartFaktor) : wert;
        },
      },
    },
    {
      id: "mauer",
      name: "Mauer",
      beschreibung: "Hohe Werte in Zweikampf, Pass blockieren und Tor blockieren. Rät er falsch, erobert er mit 15 % trotzdem den Ball.",
      symbol: "schild",
      wirkung: {
        falschGeraten: function (k) { return k.zufall() < W(k, "mauer").chance; },
      },
    },
    {
      id: "sologang",
      name: "Sologang",
      beschreibung: "Wählt er Dribbeln, startet mit 15 % ein Sologang: Lauf übers ganze Feld und Tor – die Verteidigung spielt keine Rolle.",
      symbol: "blitz",
      wirkung: {
        vorDuell: function (k) {
          return k.aktion === "dribbeln" && k.zufall() < W(k, "sologang").chance ? { art: "sologang" } : null;
        },
      },
    },
    {
      id: "akrobatik",
      name: "Akrobatik",
      beschreibung: "Schießt schon ab der Mitte, seine Torchance hängt nicht von der Zone ab. Jeder Schuss ist ein Fallrückzieher, Seitfallzieher oder Scherenschlag.",
      symbol: "salto",
      wirkung: {
        schussAbZone: function (standard, k) { return Math.min(standard, W(k, "akrobatik").abZone); },
        schussZuschlag: function (rel, standard, k) { return W(k, "akrobatik").zonenZuschlag; },
        schussArt: function (k) {
          const liste = W(k, "akrobatik").schuesse;
          return liste[Math.floor(k.zufall() * liste.length)];
        },
      },
    },
  ];

  const NACH_ID = {};
  LISTE.forEach(function (f) { NACH_ID[f.id] = f; });

  return {
    liste: LISTE,
    /** Fähigkeit mit dieser Kennung (oder null). */
    holen: function (id) { return NACH_ID[id] || null; },
  };
})();

// Für Tests außerhalb des Browsers (Node.js)
if (typeof module !== "undefined") {
  module.exports = FootballFaehigkeiten;
}
