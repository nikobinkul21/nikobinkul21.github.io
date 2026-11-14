/* ==========================================================================
   chess/muster.js – Mustererkennung und Claudys Textbausteine
   Aus der Analyse der Engine (bester Zug, Bewertung, Antwort des Gegners)
   und einfachen Mustern auf dem Brett entstehen kurze deutsche Sätze:
   Tipps ("Da steht ein Turm ungedeckt"), Urteile ("Fehler, damit verlierst
   du den Läufer") und Erklärungen ("Was wäre besser gewesen?").
   Erkannt werden: Matt und Mattdrohung, Schach, Schlagen, ungedeckte
   (hängende) Figuren, Gabeln, Fesselungen, Umwandlung, Rochade.
   Keine KI-Schnittstelle – nur Regeln und Bausteine.

   Ohne Seite und ohne Engine: Alle Funktionen bekommen Stellungen (FEN),
   Züge (z. B. "e2e4") und Zahlen. Läuft auch in Node (für Tests).
   ========================================================================== */

const SchachMuster = (function () {
  const K = typeof SchachKonfig !== "undefined" ? SchachKonfig : require("./konfig.js");
  const Regeln = typeof Chess !== "undefined" ? Chess : require("./vendor/chess.js").Chess;

  const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  // Figurennamen in den Formen, die die Sätze brauchen
  const NAME = {
    p: { nom: "Bauer",    ein: "ein Bauer",    den: "den Bauern",   dein: "dein Bauer",    deinen: "deinen Bauern" },
    n: { nom: "Springer", ein: "ein Springer", den: "den Springer", dein: "dein Springer", deinen: "deinen Springer" },
    b: { nom: "Läufer",   ein: "ein Läufer",   den: "den Läufer",   dein: "dein Läufer",   deinen: "deinen Läufer" },
    r: { nom: "Turm",     ein: "ein Turm",     den: "den Turm",     dein: "dein Turm",     deinen: "deinen Turm" },
    q: { nom: "Dame",     ein: "eine Dame",    den: "die Dame",     dein: "deine Dame",    deinen: "deine Dame" },
    k: { nom: "König",    ein: "ein König",    den: "den König",    dein: "dein König",    deinen: "deinen König" },
  };
  // Zugrichtungen der Linienfiguren (Spalte, Reihe)
  const GERADE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SCHRAEG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const RICHTUNGEN = { r: GERADE, b: SCHRAEG, q: GERADE.concat(SCHRAEG) };

  const anderer = function (farbe) { return farbe === "w" ? "b" : "w"; };
  const gross = function (text) { return text.charAt(0).toUpperCase() + text.slice(1); };

  /* ---------- Bewertung in Zahlen ---------- */

  /** Bewertung einer Engine-Linie in Hundertstel Bauern; Matt wird zu einer sehr großen Zahl. */
  function cpVon(linie) {
    if (!linie) return 0;
    if (linie.matt) return (linie.matt > 0 ? 1 : -1) * (10000 - Math.min(99, Math.abs(linie.matt)) * 10);
    return linie.cp || 0;
  }

  /** Gewinnchance in Prozent (0–100) zu einer Bewertung – flacht bei großem Vorteil ab. */
  function gewinnChance(cp) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  /** Einstufung nach dem Verlust an Gewinnchance (Tabelle in der Konfiguration). */
  function klasseVon(verlust) {
    return K.klassen.find(function (k) { return verlust < k.bis; }) || K.klassen[K.klassen.length - 1];
  }

  /* ---------- Schreibweise ---------- */

  /** Deutsche Figurenbuchstaben in der Kurznotation: N→S, B→L, R→T, Q→D. */
  function sanDeutsch(san) {
    return san.replace(/[NBRQ]/g, function (b) { return { N: "S", B: "L", R: "T", Q: "D" }[b]; });
  }

  /** Der Zug "e2e4" als Objekt von chess.js – oder null, wenn er nicht erlaubt ist. */
  function zugVon(schach, uci) {
    return schach.moves({ verbose: true }).find(function (z) { return z.lan === uci; }) || null;
  }

  /** Kurznotation (deutsch) eines Zugs in einer Stellung; "" wenn nicht erlaubt. */
  function sanVon(fen, uci) {
    const z = uci ? zugVon(new Regeln(fen), uci) : null;
    return z ? sanDeutsch(z.san) : "";
  }

  /* ---------- Muster auf dem Brett ---------- */

  /** Alle Figuren einer Farbe: [{ feld, typ }] */
  function figuren(schach, farbe) {
    const liste = [];
    schach.board().forEach(function (reihe) {
      reihe.forEach(function (f) { if (f && f.color === farbe) liste.push({ feld: f.square, typ: f.type }); });
    });
    return liste;
  }

  /** Kleinster Wert unter den Figuren auf diesen Feldern. */
  function kleinsterWert(schach, felder) {
    return Math.min.apply(null, felder.map(function (f) { return WERT[schach.get(f).type]; }));
  }

  /**
   * Hängende Figuren einer Farbe: angegriffen und entweder gar nicht gedeckt
   * oder von einer billigeren Figur angegriffen. Wertvollste zuerst.
   * @returns {Array<{feld, typ}>}
   */
  function haengende(schach, farbe) {
    const gegner = anderer(farbe);
    return figuren(schach, farbe).filter(function (f) {
      if (f.typ === "k") return false;
      const angreifer = schach.attackers(f.feld, gegner);
      if (!angreifer.length) return false;
      return !schach.attackers(f.feld, farbe).length || kleinsterWert(schach, angreifer) < WERT[f.typ];
    }).sort(function (a, b) { return WERT[b.typ] - WERT[a.typ]; });
  }

  /**
   * Gabel: Die Figur auf "feld" greift mindestens zwei lohnende Ziele an –
   * den König, eine wertvollere Figur oder eine ungedeckte Figur.
   * @returns {Array<{feld, typ}>} die Ziele (leer = keine Gabel)
   */
  function gabelZiele(schach, feld) {
    const ich = schach.get(feld);
    if (!ich) return [];
    const gegner = anderer(ich.color);
    const ziele = figuren(schach, gegner).filter(function (f) {
      if (schach.attackers(f.feld, ich.color).indexOf(feld) < 0) return false;
      return f.typ === "k" || WERT[f.typ] > WERT[ich.type] || !schach.attackers(f.feld, gegner).length;
    });
    return ziele.length >= 2 ? ziele.sort(function (a, b) { return WERT[b.typ] - WERT[a.typ]; }) : [];
  }

  /**
   * Fesselung: Die Linienfigur auf "feld" zielt durch genau eine gegnerische
   * Figur hindurch auf den König oder eine wertvollere Figur dahinter.
   * @returns {{vorn: {feld, typ}, hinten: {feld, typ}} | null}
   */
  function fesselung(schach, feld) {
    const ich = schach.get(feld);
    if (!ich || !RICHTUNGEN[ich.type]) return null;
    const spalte = feld.charCodeAt(0) - 97, reihe = Number(feld[1]) - 1;
    for (const r of RICHTUNGEN[ich.type]) {
      let vorn = null;
      for (let s = spalte + r[0], z = reihe + r[1]; s >= 0 && s < 8 && z >= 0 && z < 8; s += r[0], z += r[1]) {
        const f = String.fromCharCode(97 + s) + (z + 1);
        const figur = schach.get(f);
        if (!figur) continue;
        if (figur.color === ich.color) break;
        if (!vorn) {
          if (figur.type === "k") break;
          vorn = { feld: f, typ: figur.type };
          continue;
        }
        // die zweite Figur auf der Linie: König oder deutlich wertvoller als die vordere
        if (figur.type === "k" || WERT[figur.type] > WERT[vorn.typ] && WERT[figur.type] > WERT[ich.type]) {
          return { vorn: vorn, hinten: { feld: f, typ: figur.type } };
        }
        break;
      }
    }
    return null;
  }

  /**
   * Das Motiv eines Zugs – wofür ist er gut? Die erste zutreffende Art gewinnt.
   * @param {string} fen – Stellung vor dem Zug
   * @param {string} uci – der Zug, z. B. "g1f3"
   * @param {{matt?: number}} [linie] – Linie der Engine zu diesem Zug (für Matt)
   * @returns {object|null} { art, san, ... } – art ist eine von: matt, mattnetz,
   *   gewinn, umwandlung, gabel, fesselung, tausch, schach, retten, rochade,
   *   entwicklung, zentrum, ruhig
   */
  function motiv(fen, uci, linie) {
    const vorher = new Regeln(fen);
    const zug = zugVon(vorher, uci);
    if (!zug) return null;
    const ich = zug.color, gegner = anderer(ich);
    const danach = new Regeln(fen);
    danach.move({ from: zug.from, to: zug.to, promotion: zug.promotion });
    const m = { art: "ruhig", san: sanDeutsch(zug.san), von: zug.from, nach: zug.to, figur: zug.piece };

    if (danach.isCheckmate()) return Object.assign(m, { art: "matt" });
    if (linie && linie.matt > 0) return Object.assign(m, { art: "mattnetz", zuege: linie.matt });

    // Materialgewinn: eine hängende oder wertvollere Figur schlagen
    let gewinn = null;
    if (zug.captured) {
      const zielFeld = zug.isEnPassant() ? zug.to[0] + zug.from[1] : zug.to;
      const frei = haengende(vorher, gegner).some(function (f) { return f.feld === zielFeld; });
      if (frei || WERT[zug.captured] > WERT[zug.piece]) {
        gewinn = { art: "gewinn", beute: zug.captured, feld: zielFeld, ungedeckt: !vorher.attackers(zielFeld, gegner).length };
      }
    }
    if (gewinn && WERT[gewinn.beute] >= 3) return Object.assign(m, gewinn);
    if (zug.promotion) return Object.assign(m, { art: "umwandlung", zu: zug.promotion });

    // Eine Gabel ist mehr wert als ein geschlagener Bauer
    const ziele = gabelZiele(danach, zug.to);
    if (ziele.length) return Object.assign(m, { art: "gabel", ziele: ziele });
    if (gewinn) return Object.assign(m, gewinn);
    const f = fesselung(danach, zug.to);
    if (f) return Object.assign(m, { art: "fesselung", vorn: f.vorn, hinten: f.hinten });
    if (zug.captured) return Object.assign(m, { art: "tausch", beute: zug.captured });
    if (danach.isCheck()) return Object.assign(m, { art: "schach" });

    // Eine eigene Figur hing und ist nach dem Zug in Sicherheit
    const hingen = haengende(vorher, ich).filter(function (h) { return WERT[h.typ] >= 3; });
    if (hingen.length) {
      const haengtNoch = haengende(danach, ich).map(function (h) { return h.feld; });
      const gerettet = hingen.find(function (h) {
        return haengtNoch.indexOf(h.feld === zug.from ? zug.to : h.feld) < 0;
      });
      if (gerettet) return Object.assign(m, { art: "retten", gerettet: gerettet, zieht: gerettet.feld === zug.from });
    }
    if (zug.isKingsideCastle() || zug.isQueensideCastle()) return Object.assign(m, { art: "rochade" });
    if (vorher.moveNumber() <= 12) {
      const grundreihe = ich === "w" ? "1" : "8";
      if ((zug.piece === "n" || zug.piece === "b") && zug.from[1] === grundreihe) return Object.assign(m, { art: "entwicklung" });
      if (zug.piece === "p" && ["d4", "e4", "d5", "e5"].indexOf(zug.to) >= 0) return Object.assign(m, { art: "zentrum" });
    }
    return m;
  }

  /** "Dame und Turm", "König, Dame und Turm" */
  function aufzaehlung(ziele) {
    const namen = ziele.map(function (z) { return NAME[z.typ].nom; });
    return namen.length < 2 ? namen.join("") : namen.slice(0, -1).join(", ") + " und " + namen[namen.length - 1];
  }

  /* ---------- Textbausteine: Tipps ---------- */

  /** Hilfestufe "Idee": das Motiv nennen, aber nicht den Zug. */
  function ideeText(m) {
    if (!m) return "Hm, hier fällt mir nichts Besonderes auf.";
    switch (m.art) {
      case "matt": return "Schau genau hin: Hier geht Matt in einem Zug!";
      case "mattnetz": return "Da liegt ein Matt in " + m.zuege + " Zügen in der Luft. Such nach Schachs!";
      case "gewinn": return m.ungedeckt
        ? "Da steht " + NAME[m.beute].ein + " ungedeckt."
        : "Da kannst du " + NAME[m.beute].den + " günstig schlagen.";
      case "umwandlung": return "Einer deiner Bauern kann sich umwandeln!";
      case "gabel": return "Hier geht eine Gabel.";
      case "fesselung": return "Hier geht eine Fesselung.";
      case "tausch": return "Hier bietet sich ein Abtausch an.";
      case "schach": return "Ein Schach bringt den König in Verlegenheit.";
      case "retten": return "Achtung: " + gross(NAME[m.gerettet.typ].dein) + " auf " + m.gerettet.feld + " ist in Gefahr.";
      case "rochade": return "Bring deinen König in Sicherheit.";
      case "entwicklung": return "Bring eine Figur ins Spiel, die noch auf der Grundreihe steht.";
      case "zentrum": return "Besetz das Zentrum mit einem Bauern.";
      default: return "Kein Feuerwerk hier. Stell eine Figur auf ein besseres Feld.";
    }
  }

  /** Der Grund für einen Zug als Halbsatz (für "Lösung" und die Erklärung). */
  function grund(m) {
    switch (m.art) {
      case "matt": return "das ist Matt";
      case "mattnetz": return "das führt zu Matt in " + m.zuege + " Zügen";
      case "gewinn": return m.ungedeckt
        ? "du gewinnst " + NAME[m.beute].den + ", denn " + (m.beute === "q" ? "sie" : "er") + " ist ungedeckt"
        : "du schlägst " + NAME[m.beute].den + " und gewinnst Material";
      case "umwandlung": return "dein Bauer wird zur " + (m.zu === "q" ? "Dame" : NAME[m.zu].nom);
      case "gabel": return "eine Gabel auf " + aufzaehlung(m.ziele);
      case "fesselung": return "das fesselt " + NAME[m.vorn.typ].den + ", dahinter steht " + (m.hinten.typ === "q" ? "die Dame" : "der " + NAME[m.hinten.typ].nom);
      case "tausch": return "du tauschst ab";
      case "schach": return "das gibt Schach";
      case "retten": return m.zieht
        ? "das bringt " + NAME[m.gerettet.typ].deinen + " in Sicherheit"
        : "das deckt " + NAME[m.gerettet.typ].deinen;
      case "rochade": return "dein König kommt in Sicherheit";
      case "entwicklung": return "du bringst eine Figur ins Spiel";
      case "zentrum": return "du besetzt das Zentrum";
      default: return "das verbessert deine Stellung";
    }
  }

  /** Hilfestufe "Lösung": bester Zug mit kurzer Begründung. */
  function loesungText(m) {
    if (!m) return "Hier finde ich gerade keinen Zug.";
    return "Am besten ist " + m.san + ": " + grund(m) + ".";
  }

  /* ---------- Textbausteine: Urteil und Erklärung ---------- */

  /**
   * Was richtet mein Zug an? Schaut auf die beste Antwort des Gegners.
   * @param {string} fen – Stellung vor meinem Zug
   * @param {string} gespielt – mein Zug
   * @param {string} antwort – beste Antwort des Gegners ("" = unbekannt)
   * @param {number} cpDanach – Bewertung nach meinem Zug aus meiner Sicht
   * @returns {object|null} { art: "matt" | "verlust" | "tausch", ... }
   */
  function schaden(fen, gespielt, antwort, cpDanach) {
    const vorher = new Regeln(fen);
    const zug = zugVon(vorher, gespielt);
    if (!zug || !antwort) return null;
    const ich = zug.color;
    const danach = new Regeln(fen);
    danach.move({ from: zug.from, to: zug.to, promotion: zug.promotion });
    const a = zugVon(danach, antwort);
    if (!a) return null;
    const antwortSan = sanDeutsch(a.san);
    const meinSan = sanDeutsch(zug.san);
    if (a.san.indexOf("#") >= 0) return { art: "matt", meinSan: meinSan, antwortSan: antwortSan, sofort: true };
    if (cpDanach <= -9000) return { art: "matt", meinSan: meinSan, antwortSan: antwortSan, sofort: false };
    if (a.captured) {
      const feld = a.isEnPassant() ? a.to[0] + a.from[1] : a.to;
      const haengt = haengende(danach, ich).some(function (h) { return h.feld === feld; });
      // Ein Schlagen direkt nach meinem Schlagen auf demselben Feld ist ein Abtausch, kein Verlust
      const zurueck = zug.captured && feld === zug.to && WERT[zug.captured] >= WERT[a.captured];
      if (haengt && !zurueck) {
        const schonVorher = feld !== zug.to && haengende(vorher, ich).some(function (h) { return h.feld === feld; });
        return { art: "verlust", figur: a.captured, feld: feld, schonVorher: schonVorher, meinSan: meinSan, antwortSan: antwortSan };
      }
    }
    return null;
  }

  /**
   * Zugbewertung: ein kurzer Satz direkt nach meinem Zug.
   * @param {object} b – Bewertung des Zugs (siehe spiel.js: bewerte)
   * @param {string} fen – Stellung vor dem Zug
   * @param {string} gespielt – mein Zug
   * @returns {{text: string, stimmung: string}}
   */
  function urteil(b, fen, gespielt) {
    const beste = sanVon(fen, b.bester);
    const s = schaden(fen, gespielt, b.antwort, b.cpDanach);
    const folge = !s ? "" : s.art === "matt" ? ", damit läufst du ins Matt"
      : ", damit verlierst du " + NAME[s.figur].den;
    switch (b.klasse) {
      case "sehrgut": return { text: b.bester === gespielt ? "Stark! Das war der beste Zug." : "Stark!", stimmung: "froh" };
      case "gut": return { text: "Guter Zug.", stimmung: "froh" };
      case "ungenau": return { text: "Ungenau" + (beste ? ", " + beste + " war etwas besser." : "."), stimmung: "denkt" };
      case "fehler": return { text: "Fehler" + (folge || (beste ? ", " + beste + " war deutlich besser" : "")) + ".", stimmung: "sorge" };
      default: return { text: "Autsch, grober Fehler" + (folge || (beste ? ". " + beste + " war viel besser" : "")) + ".", stimmung: "sorge" };
    }
  }

  /** "1,5 Bauern" – Unterschied zweier Bewertungen in Worten; "" wenn Matt im Spiel ist. */
  function bauernText(cp) {
    if (Math.abs(cp) >= 9000) return "";
    const b = Math.round(Math.abs(cp) / 10) / 10;
    return b < 0.3 ? "" : String(b).replace(".", ",") + (b === 1 ? " Bauer" : " Bauern");
  }

  /**
   * "Was wäre besser gewesen?" – Erklärung zu einem meiner Züge.
   * @param {string} fen – Stellung vor meinem Zug
   * @param {string} gespielt – mein Zug
   * @param {object} b – Bewertung des Zugs (klasse, bester, antwort, cp, cpDanach, matt)
   * @returns {{text: string, pfeil: string|null, stimmung: string}} pfeil = der bessere Zug
   */
  function besserText(fen, gespielt, b) {
    if (!b) return { text: "Zu diesem Zug habe ich keine Analyse.", pfeil: null, stimmung: "denkt" };
    if (!b.bester || b.bester === gespielt || b.klasse === "sehrgut") {
      const m = motiv(fen, gespielt, b.bester === gespielt ? { matt: b.matt } : null);
      return {
        text: "Hier gibt es nichts zu meckern: " + (m ? m.san + " war " + (b.bester === gespielt ? "der beste Zug" : "so gut wie der beste Zug") + ", " + grund(m) + "." : "ein starker Zug."),
        pfeil: null, stimmung: "froh",
      };
    }
    const saetze = [];
    // 1. Was ist an meinem Zug schiefgegangen?
    const s = schaden(fen, gespielt, b.antwort, b.cpDanach);
    if (s && s.art === "matt") {
      saetze.push(s.sofort
        ? "Nach " + s.meinSan + " setzt der Bot mit " + s.antwortSan + " matt. Die Mattdrohung hast du übersehen."
        : "Nach " + s.meinSan + " kommt der Bot mit " + s.antwortSan + " zu einem Mattangriff.");
    } else if (s && s.art === "verlust") {
      saetze.push(s.schonVorher
        ? gross(NAME[s.figur].dein) + " auf " + s.feld + " war schon angegriffen, und nach " + s.meinSan + " schlägt der Bot einfach zu (" + s.antwortSan + ")."
        : "Nach " + s.meinSan + " hängt " + NAME[s.figur].dein + " auf " + s.feld + ": Der Bot schlägt mit " + s.antwortSan + ".");
    }
    // 2. Was hätte der bessere Zug gebracht?
    const m = motiv(fen, b.bester, { matt: b.matt });
    if (m) {
      switch (m.art) {
        case "matt": saetze.push(m.san + " wäre Matt gewesen!"); break;
        case "mattnetz": saetze.push("Mit " + m.san + " hättest du in " + m.zuege + " Zügen mattsetzen können."); break;
        case "gewinn": saetze.push("Mit " + m.san + " hättest du " + NAME[m.beute].den + " gewinnen können" + (m.ungedeckt ? ", denn " + (m.beute === "q" ? "sie" : "er") + " stand ungedeckt." : ".")); break;
        case "umwandlung": saetze.push("Mit " + m.san + " hätte sich dein Bauer umgewandelt."); break;
        case "gabel": saetze.push(m.san + " wäre eine Gabel gewesen: ein Angriff auf " + aufzaehlung(m.ziele) + " zugleich."); break;
        case "fesselung": saetze.push(m.san + " hätte " + NAME[m.vorn.typ].den + " gefesselt, weil dahinter " + (m.hinten.typ === "q" ? "die Dame" : "der " + NAME[m.hinten.typ].nom) + " steht."); break;
        case "retten": saetze.push(m.san + " hätte " + NAME[m.gerettet.typ].deinen + (m.zieht ? " in Sicherheit gebracht." : " gedeckt.")); break;
        case "schach": saetze.push("Besser war " + m.san + " mit Schach."); break;
        case "rochade": saetze.push("Besser war die Rochade (" + m.san + "): Dein König wäre in Sicherheit gewesen."); break;
        case "entwicklung": saetze.push("Besser war " + m.san + ": Damit bringst du eine Figur ins Spiel."); break;
        case "zentrum": saetze.push("Besser war " + m.san + ": Damit besetzt du das Zentrum."); break;
        default: saetze.push("Besser war " + m.san + "."); break;
      }
    }
    // 3. Wie viel hat es gekostet? (nur wenn sonst wenig zu sagen ist)
    const kosten = bauernText(b.cp - b.cpDanach);
    if (saetze.length < 2 && kosten) saetze.push("Laut Engine kostet dich das etwa " + kosten + ".");
    return { text: saetze.join(" "), pfeil: b.bester, stimmung: "denkt" };
  }

  return {
    WERT: WERT,
    NAME: NAME,
    cpVon: cpVon,
    gewinnChance: gewinnChance,
    klasseVon: klasseVon,
    sanDeutsch: sanDeutsch,
    sanVon: sanVon,
    haengende: haengende,
    gabelZiele: gabelZiele,
    fesselung: fesselung,
    motiv: motiv,
    ideeText: ideeText,
    loesungText: loesungText,
    schaden: schaden,
    urteil: urteil,
    besserText: besserText,
  };
})();

if (typeof module !== "undefined") module.exports = SchachMuster;
