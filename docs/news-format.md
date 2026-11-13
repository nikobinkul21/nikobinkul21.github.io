# Format von `data/news.json`

Diese Datei ist der Vertrag zwischen der Nachrichten-Pipeline und dem
News-Feed der Startseite (`js/news.js`). Die Pipeline erzeugt die Datei
(geplant: einmal täglich) und legt sie unter `data/news.json` ab. Der Feed
liest sie bei jedem Öffnen der Startseite neu, ohne Zwischenspeicher.

## Beispiel

```json
{
  "aktualisiert": "2026-11-13T09:45:00+01:00",
  "meldungen": [
    {
      "titel": "Schlagzeile der wichtigsten Meldung",
      "zusammenfassung": "Ein bis drei Sätze, die die Meldung zusammenfassen.",
      "url": "https://example.com/artikel",
      "quelle": "Name der Quelle",
      "region": "Welt",
      "veroeffentlicht": "2026-11-13T07:40:00+01:00",
      "anzahlQuellen": 7
    },
    {
      "titel": "Meldung nur mit Pflichtfeldern",
      "zusammenfassung": "Optionale Felder dürfen fehlen.",
      "url": "https://example.com/artikel-2",
      "quelle": "Name der Quelle"
    }
  ]
}
```

## Oberste Ebene

| Feld | Pflicht | Typ | Bedeutung |
|---|---|---|---|
| `aktualisiert` | ja | Text, ISO-8601-Zeitpunkt | Wann die Pipeline die Datei erzeugt hat. Daraus entsteht „Stand: 09:45“. |
| `meldungen` | ja | Liste | Die Meldungen, **nach Wichtigkeit sortiert**. |

## Felder einer Meldung

| Feld | Pflicht | Typ | Regeln |
|---|---|---|---|
| `titel` | ja | Text | Die Schlagzeile. Höchstens 200 Zeichen. |
| `zusammenfassung` | ja | Text | 1 bis 3 Sätze. Höchstens 600 Zeichen. |
| `url` | ja | Text | Link zum Originalartikel. Muss mit `http://` oder `https://` beginnen. |
| `quelle` | ja | Text | Name der Quelle, z. B. der Zeitung. Höchstens 80 Zeichen. |
| `region` | nein | Text | Genau einer dieser Werte: `Welt`, `Europa`, `Deutschland`, `Wirtschaft`, `Technik`. |
| `veroeffentlicht` | nein | Text, ISO-8601-Zeitpunkt | Wann der Artikel erschienen ist. Daraus entsteht „vor 2 Std“. |
| `anzahlQuellen` | nein | Zahl (ganz, ab 1) | Wie viele Quellen über die Geschichte berichten. Ab 2 zeigt der Feed „7 Quellen berichten“. |

## Regeln

1. **Reihenfolge = Wichtigkeit.** Die erste Meldung ist die wichtigste und
   wird als Topmeldung groß gezeigt. Der Feed sortiert nicht um.
2. **Kodierung:** UTF-8, gültiges JSON, ein Objekt auf oberster Ebene.
3. **Nur reiner Text.** Alle Texte werden als reiner Text eingefügt, nie
   als HTML. Tags wie `<b>` oder Zeichenfolgen wie `&amp;` erscheinen
   wörtlich – die Pipeline muss HTML vorher entfernen und Entities
   auflösen. Zeilenumbrüche und mehrfache Leerzeichen werden zu einem
   Leerzeichen.
4. **Zeitpunkte** im ISO-8601-Format **mit Zeitzone**, z. B.
   `2026-11-13T09:45:00+01:00` oder `2026-11-13T08:45:00Z`. Ohne
   Zeitzone deutet der Browser die Zeit als Ortszeit des Geräts.
5. **Optionale Felder weglassen**, wenn es keinen Wert gibt – nicht `null`,
   nicht `""` (beides wird zwar wie „fehlt“ behandelt, ist aber unnötig).
6. **Umfang:** empfohlen 5 bis 15 Meldungen. Der Feed zeigt höchstens die
   ersten 30 gültigen.
7. **Erweiterbar:** Unbekannte Felder werden ignoriert. Neue Felder können
   also jederzeit ergänzt werden, ohne den Feed zu stören.

## So prüft der Feed die Datei

| Fall | Verhalten |
|---|---|
| Datei fehlt, ist kein gültiges JSON oder `meldungen` ist keine Liste | Hinweis „Die News konnten nicht geladen werden.“ |
| Meldung ohne ein Pflichtfeld (fehlt, leer, kein Text) | Meldung wird übersprungen |
| `url` beginnt nicht mit `http://` oder `https://` | Meldung wird übersprungen |
| `region` hat einen anderen Wert als die fünf erlaubten | Meldung erscheint ohne Region (nur unter „Alle“) |
| `veroeffentlicht` ist kein gültiger Zeitpunkt oder liegt in der Zukunft | Meldung erscheint ohne Zeitangabe |
| `anzahlQuellen` ist keine Zahl oder kleiner als 1 | Angabe entfällt |
| Text länger als die Obergrenze | Wird gekürzt und endet auf „…“ |
| `aktualisiert` fehlt oder ist ungültig | „Stand: unbekannt“ mit dem Zusatz „nicht aktuell“ |
| `aktualisiert` ist älter als 36 Stunden | Zusatz „nicht aktuell“ neben dem Stand |
| `meldungen` ist leer | Hinweis „Zurzeit gibt es keine Meldungen.“ |

## Hinweise für die Pipeline

- Die Datei **in einem Schritt ersetzen** (erst unter anderem Namen
  schreiben, dann umbenennen), damit der Feed nie eine halbe Datei liest.
- Die Seite muss über einen Webserver laufen (z. B. GitHub Pages). Direkt
  aus einem Ordner geöffnet (`file://`) darf der Browser die Datei nicht
  lesen; der Feed zeigt dann einen Hinweis.
- Die Filterleiste zeigt nur Regionen, die in der Datei vorkommen.
- Die mitgelieferte `data/news.json` enthält ausgedachte Beispielmeldungen
  („Beispiel: …“) und wird von der Pipeline überschrieben.
