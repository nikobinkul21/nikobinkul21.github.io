# Lernlog: Nachrichten-Pipeline mit Python

Ziel: Ein Python-Skript holt Meldungen aus einigen RSS-Feeds, bereitet sie
auf und speichert die wichtigsten als `data/news.json`. Später läuft es
täglich über GitHub Actions; die Website zeigt die Datei in einer
News-Ansicht. Verwendet werden nur Schlagzeile, Anreißertext und Link.

Arbeitsweise: siehe Abschnitt „Nachrichten-Pipeline“ in `CLAUDE.md`.

## Fahrplan

1. [x] Python auf dem Mac prüfen/einrichten, erstes „Hallo Welt“
2. [x] Grundlagen: Variablen, Listen, Schleifen, Funktionen
3. [x] Einen RSS-Feed abrufen, Schlagzeilen ausgeben
4. [x] Mehrere Feeds abrufen, Meldungen in einer Liste sammeln
5. [x] Einheitliches Format, als JSON speichern (Format der Website)
6. [ ] Wichtigste Meldungen auswählen (erst die neuesten, später schlauer)
7. [ ] Täglich über GitHub Actions ausführen

## Stand

- **2026-10-27:** Start. Schritt 1 erklärt: Terminal öffnen,
  `python3 --version` geprüft: **Python 3.9.6** (die von Apple
  mitgelieferte Version). Reicht zum Lernen; ein Update auf eine neuere
  Version ist später möglich, aber nicht nötig.
- Bisher hat der Nutzer Dateien nur auf github.com bearbeitet, das
  Repository lag noch nicht auf dem Mac.
- VS Code installiert, Repository `nikobinkul21/nikobinkul21.github.io`
  (früher NTBhub) nach `Dokumente` geklont. Stolpersteine: „Restricted
  Mode“ (Ordner vertrauen) und „Initialize Repository“ (falscher Ordner
  offen). Gelöst über Befehlspalette ⌘⇧P → `Git: Clone`.
- Schritt 1d erledigt: `pipeline/hallo.py` mit drei `print`-Zeilen läuft
  (`python3 pipeline/hallo.py` im VS-Code-Terminal). Übung (eigener Name)
  gelöst. **Schritt 1 abgeschlossen.**
- Interview-Frage `print("Hallo")` vs. `print(Hallo)`: richtig beantwortet
  (String vs. Verweis auf nicht vorhandene Variable). Ergänzt: Fehlername
  `NameError`.
- Schritt 2a erledigt: Variablen in `pipeline/grundlagen.py`, Übung
  (3 → 5) gelöst.
- Schritt 2b erledigt: Listen. Übung richtig: letzter Eintrag ist `[2]`,
  `[3]` gibt `IndexError`, weil es keinen vierten Eintrag gibt.
- Schritt 2c erledigt: Kommentare mit `#`, `for`-Schleife. Übung richtig:
  eingerücktes `print("Fertig!")` erscheint nach jeder Schlagzeile, weil
  es dann zur Schleife gehört.
- **Pause.** Die Dateien `pipeline/hallo.py` und `pipeline/grundlagen.py`
  liegen nur lokal auf dem Mac (nicht gepusht).

## Hier geht es weiter

- Kurz wiederholen: Variablen, Listen, Schleifen (Einrückung!).
- Offene Interview-Frage (Angebot): „Was ist eine Schleife, und wozu
  braucht man die Einrückung in Python?“
- Schritt 2d (Teil 1) gestellt: eigene Funktion `zeige_meldung(titel)` mit
  `def`, Parameter, Aufruf; Übung: zweiter Parameter `quelle`.
  Erster Versuch: Quelle fest in den Text geschrieben („NDR“ im `print`)
  statt als Parameter. Hinweis gegeben (zwei Quellen, Komma in `def`).
  Zweiter Versuch richtig: `def zeige_meldung(titel, quelle)`. Kleinigkeit:
  Leerzeichen vor `)` durch Komma in `print`; Lösung mit `quelle + ")"`
  (Strings mit `+` verbinden) gezeigt.
- Interview-Frage „Warum Funktionen?“: gut beantwortet (Wiederverwendung,
  weniger Code). Ergänzt: Änderungen nur an einer Stelle, weniger Fehler,
  sprechende Namen machen Code lesbar. Nutzer kennt etwas Java.
- **Pause** nach Schritt 2d.
- **2026-11-06:** Eine Woche Pause. Wiederholung gegeben: Spickzettel,
  Quiz mit 4 Fragen (Ausgabe vorhersagen) und Aufwärm-Übung
  `pipeline/wiederholung.py` (Liste + Schleife + Funktion, ohne Vorlage).
  Quiz: 1–3 richtig. Frage 4 (nur `def`, kein Aufruf) falsch: erwartete
  Fehlermeldung, richtig ist „keine Ausgabe“. Erklärt: Funktionskörper
  läuft erst beim Aufruf, Parameter wird erst dann gefüllt.
  Aufwärm-Übung ohne Vorlage richtig gelöst (Liste, `def zeige(titel)`,
  Aufruf in der Schleife). Erst keine Ausgabe: Datei nicht gespeichert
  (Tipp: Auto Save). Nutzer versteht die `for`-Schleife noch nicht ganz →
  Schritt-für-Schritt-Durchlauf mit Tabelle erklärt, Kontrollfrage gestellt.
  Kontrollfrage (4. Schlagzeile → Schleife unverändert, 4 Ausgaben)
  richtig beantwortet. Schleife sitzt.
- **2026-11-08:** Mini-Wiederholung (3 Fragen) und Schritt 2e gestellt:
  `return` in `pipeline/rueckgabe.py` (`mache_ueberschrift`), Unterschied
  `print` vs. `return`. Übung: `zeige` in `wiederholung.py` auf `return`
  umbauen. Wiederholung: Index direkt an Liste (`[...][0]`) erst falsch,
  nach Hinweis richtig („A“); Schleife „Hallo Hallo Ende“ nach Nachfrage
  richtig. Frage: Wie hängt `x` mit „a“/„b“ zusammen, wenn `x` nicht
  benutzt wird? → erklärt (Schleifenvariable wird gefüllt, aber nicht
  verwendet; Liste bestimmt nur die Anzahl der Runden).
- Übung `return` richtig gelöst: `return "* " + titel`,
  `print(zeige(schlagzeile))` in der Schleife (verschachtelter Aufruf,
  von innen nach außen erklärt). **Schritt 2 abgeschlossen.**
- Interview-Frage „Unterschied `print` und `return`?“: erster Versuch
  verwechselte `return` mit der Funktion („Bauplan“); nach Hinweis
  (Kaffeeautomat) richtig: liefert einen Wert, der nicht angezeigt wird.
  Ergänzt: Wert geht an den Aufrufer zurück, `return` beendet die Funktion.
- **2026-11-08, Schritt 3a gestellt:** Paket `feedparser` mit
  `pip3 install feedparser` installieren, Konzept Paket/`import` erklärt,
  Prüfen mit `pip3 show feedparser`: **feedparser 6.0.12** installiert.
- Schritt 3b gestellt: `pipeline/news.py` (das eigentliche Pipeline-Skript)
  mit `import feedparser`, `feedparser.parse(URL)`, Schleife über
  `feed.entries`, `meldung.title`. Feed: tagesschau „Alle Meldungen“
  (`https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml`).
  Übung: zusätzlich `meldung.link` ausgeben.
- Adresse erst mit Tippfehler (`infoservice` statt `infoservices`), lief
  trotzdem (vermutlich Weiterleitung). Gelernt: leere Liste → keine
  Ausgabe ohne Fehler; Kontrolle mit `feed.status` (200/301/404) und
  `len(feed.entries)`. Offizielle Adresse mit `s` verwenden.
- Übung gelöst: Titel + Link ausgegeben; **selbstständig** einen Zähler
  `zahl = 1` / `zahl += 1` eingebaut (aus Java bekannt). Feed hat 40
  Meldungen. **Schritt 3 abgeschlossen.**
- Interview-Frage gestellt: „Was ist ein Paket, und warum benutzt man es,
  statt alles selbst zu schreiben?“ Gut beantwortet (fertiges Werkzeug,
  Hammer aus dem Baumarkt, Zeit sparen). Ergänzt: von vielen getestet;
  Nachteil Abhängigkeit (vertrauen, aktuell halten).
- Schritt 4a gestellt: `news.py` umgebaut auf Liste `feeds` (tagesschau +
  Spiegel `https://www.spiegel.de/schlagzeilen/index.rss`), Schleife,
  `daten.feed.title` und Anzahl je Feed. Übung „erste drei Schlagzeilen“:
  1. Versuch `daten.entries[0]` (ganze Meldung statt Titel), 2. Versuch
  richtig mit `daten.entries[0].title` usw., aber alles in einer Zeile →
  übersichtliche Variante mit eigenen `print`-Zeilen gezeigt.
- Auf Nachfrage erklärt: erste 10 Schlagzeilen mit verschachtelter
  Schleife und Slicing `daten.entries[:10]` (noch nicht selbst geübt).
- **Pause.** Als Nächstes **4b:** leere Liste, `.append`, alle Meldungen
  aus allen Feeds sammeln. Vorher kurz Slicing/verschachtelte Schleife
  selbst ausprobieren lassen.
- **2026-11-09:** Aufwärmfrage (Schlagzeilen 3 bis 5 → `[2:5]`) und
  Schritt 4b gestellt: `alle_meldungen = []`, verschachtelte Schleife,
  `.append(meldung)`, `print("Gesamt:", len(...))` nach den Schleifen.
  Übung: erste 5 Titel der Sammelliste. Aufwärmfrage: 1. Versuch `[3:6]`
  (um eins verrutscht), nach Tabelle Mensch/Index richtig `[2:5]`.
  4b gelöst. Übung erste 5 Titel: 1. Versuch `alle_meldungen(5)` →
  `TypeError: 'list' object is not callable` (runde vs. eckige Klammern
  erklärt), 2. Versuch `[0:4]` (nur 4), 3. Versuch richtig `[:5]`.
  **Schritt 4 abgeschlossen.**
- Frage „Von welchem Feed kommen die ersten 5?“ richtig: tagesschau, weil
  erster Feed in der Liste (`append` hängt hinten an). Folge für Schritt 6
  notiert: Reihenfolge = Feed-Reihenfolge, nicht Aktualität → sortieren.
- Interview-Frage „Warum `alle_meldungen = []` vor der Schleife?“: Kern
  richtig (Korb würde bei jedem Durchlauf geleert). Korrigiert: Übrig
  bliebe der **letzte** Feed, nicht der erste.
- **Schritt 5a gestellt:** Dictionary in `pipeline/dictionary.py`
  (`{"titel": ..., "link": ..., "quelle": ...}`, Zugriff mit
  `meldung["titel"]`). Übung gelöst: `"text"` ergänzt; `meldung["datum"]`
  richtig erklärt (Schlüssel fehlt) → Fehlername `KeyError`; `.get()` mit
  Ersatzwert eingeführt.
- **Schritt 5b gestellt:** in `news.py` je Meldung ein Dictionary
  `eintrag` (titel, text via `meldung.get("summary", "")`, link, quelle =
  `daten.feed.title`) bauen und anhängen; Kontrolle der ersten 3.
  Läuft: Ausgabe mit Quelle, Titel und Anreißer korrekt.
- **Schritt 5c gestellt:** `feeds` als Liste von Dictionaries
  (`{"name": "tagesschau", "url": ...}`); Nutzer passt die Schleife selbst
  an (`feed["url"]`, `feed["name"]`). Erst `AttributeError: 'dict' object
  has no attribute 'encode'` (Dictionary statt Text an `parse`) → Traceback
  lesen gelernt (eigene Datei im Traceback suchen). Dann selbst richtig
  gelöst.
- **Schritt 5d gestellt:** `import json`, Ordner `data` anlegen,
  `with open("data/news.json", "w", encoding="utf-8") as datei:` +
  `json.dump(alle_meldungen, datei, ensure_ascii=False, indent=2)`.
  Format vorerst: Liste von Dictionaries (titel, text, link, quelle).
  **Funktioniert:** `data/news.json` mit 70 Meldungen (tagesschau +
  Spiegel), Umlaute korrekt. **Schritt 5 abgeschlossen.**
- Beobachtung: Fehlende Leerzeichen („erden“) nur in der kopierten
  Terminal-Ausgabe, in der JSON-Datei korrekt („er den“). Spiegel-Links
  enden auf `#ref=rss` (könnte man später entfernen).
- Interview-Frage gestellt: „Was ist JSON, und warum speichert man die
  Daten nicht einfach als Python-Code oder Textdatei?“ Gut beantwortet
  (gemeinsame Sprache Python ↔ JavaScript). Präzisiert: nicht die
  Python-Datei, sondern die Daten werden umgewandelt; JSON ist ein
  Format, kein Übersetzer. Ergänzt: Struktur (Schlüssel) statt Fließtext,
  Programme können Felder zuverlässig auslesen.
- **Pause.**
- **2026-11-10:** Mini-Wiederholung (Dictionary, `KeyError`/`.get`,
  `"w"`/`encoding`) und **Schritt 6a** gestellt: `import time`,
  `"datum": time.strftime("%Y-%m-%d %H:%M", meldung.published_parsed)`.
  Frage „Warum Jahr zuerst?“ richtig (Sortieren); erklärt: Text wird
  Zeichen für Zeichen von links verglichen (ISO 8601). 6a läuft (Datum in
  Ausgabe und JSON). Wiederholung: 1 richtig,
  2 richtig (`.get`, Name `KeyError` ergänzt), 3 nicht gewusst (`"w"` =
  schreiben/überschreiben, `utf-8` = Umlaute) → nochmals erklärt,
  **beim nächsten Mal wieder abfragen.**
- **Schritt 6b gestellt:** Funktion `nach_datum(eintrag)` (oben),
  `alle_meldungen = sorted(alle_meldungen, key=nach_datum, reverse=True)`,
  `neueste = alle_meldungen[:20]`, `json.dump(neueste, ...)`. Frage: Warum
  `key=nach_datum` ohne Klammern? Läuft: neueste zuerst, tagesschau und
  Spiegel gemischt, JSON mit 20 Meldungen. Frage richtig beantwortet
  (Verweis auf Funktion statt Aufruf). VS-Code-Helfer (Vorschläge,
  graue Inline-Vorschläge, Auto-Klammern) auf Wunsch abschaltbar erklärt.
- Plan 6c: `if` für Meldungen ohne Datum (Robustheit für den täglichen
  Lauf).
- Als Nächstes **Schritt 6:** Datum mitspeichern, nach Datum sortieren,
  die neuesten N auswählen. Offen: News-Ansicht der Website (Claude darf
  das Frontend bauen, wenn der Nutzer das möchte).
- Plan Schritt 5: Dictionary → je Meldung ein Dictionary mit titel, text,
  link, quelle, datum → `json` → `data/news.json`. Die News-Ansicht der
  Website gibt es noch nicht; das Format legen wir in Schritt 5 fest.
- Als Nächstes **Schritt 4:** Liste mit mehreren Feed-Adressen, Schleife
  darüber, alle Meldungen in einer Liste sammeln (`.append`).
  (Hinweis: Claudes Cloud-Umgebung erreicht tagesschau.de nicht; das
  Skript läuft auf dem Mac des Nutzers.)
- Danach **Schritt 2e: `return`** (Funktion gibt Wert zurück), dann
  Abschluss von Schritt 2 mit Zusammenfassung.

## Gelernte Konzepte

- Terminal: Befehle tippen statt klicken; Option `--version`
- Git-Begriffe: Repository, klonen (lokale Kopie), pushen (hochschicken)
- VS Code: Befehlspalette ⌘⇧P, eingeschränkter Modus
- Python ausführen: `python3 pfad/datei.py`; Pfeil ↑ holt letzten Befehl
- `print(...)` als Funktion, Strings in Anführungszeichen, Ablauf von oben
  nach unten
- Variablen als beschriftete Kisten, `=` als Zuweisung, String vs. `int`,
  `print` mit mehreren Werten per Komma
- Listen `[...]`, Index ab 0 (auch `[-1]` für den letzten), `len()`,
  `IndexError`; Python bricht beim ersten Fehler ab
- Kommentare mit `#`; `for x in liste:` mit Doppelpunkt, Einrückung
  (4 Leerzeichen) bestimmt, was zur Schleife gehört
- Eigene Funktionen: `def name(param1, param2):`, Aufruf mit Werten,
  Definition allein tut nichts; Strings mit `+` verbinden
- `return` gibt einen Wert zurück (Becher statt Display), `print` zeigt nur
  an; Aufrufe verschachteln: `print(zeige(x))` wird von innen nach außen
  ausgeführt
- Pakete: `pip3 install`, `import`; Punkt-Schreibweise `paket.funktion`,
  `objekt.feld`; `feedparser.parse(url)` → `feed.entries`, `.title`,
  `.link`; HTTP-Status 200/301/404; Zähler mit `+=`
- Slicing `liste[:10]` (die ersten 10), Schleife in der Schleife
  (doppelte Einrückung)
- Leere Liste `[]` + `.append(x)` zum Sammeln; runde Klammern = aufrufen,
  eckige = aus Liste holen; `TypeError: ... not callable`; Slicing-Anzahl
  = hinten − vorne
- Dictionary `{"schluessel": wert}`, Zugriff `d["schluessel"]`, `KeyError`,
  sicherer Zugriff `d.get("schluessel", ersatz)`
- Liste von Dictionaries (`feeds`), `AttributeError`, Traceback lesen:
  eigene Datei suchen, Ursache meist im Übergebenen
- JSON als gemeinsames Datenformat; `import json`, `with open(pfad, "w",
  encoding="utf-8") as datei:`, `json.dump(..., ensure_ascii=False,
  indent=2)`; relativer Pfad hängt vom Ordner des Terminals ab
- `import time`, `time.strftime("%Y-%m-%d %H:%M", meldung.published_parsed)`,
  Platzhalter, UTC; Datumsformat Jahr zuerst zum Sortieren (ISO 8601)
- `sorted(liste, key=funktion, reverse=True)`; Funktion als Wert übergeben
  (ohne Klammern) vs. aufrufen (mit Klammern)

## Offene Punkte / Notizen

- Eine News-Ansicht auf der Website gibt es noch nicht; das JSON-Format
  wird in Schritt 5 festgelegt.
