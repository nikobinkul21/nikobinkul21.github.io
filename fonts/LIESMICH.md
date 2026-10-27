# Logo-Schrift

Lege hier die Schriftdatei für den Schriftzug „NTB“ ab:

- `ntb-logo.woff2` (empfohlen), oder
- `ntb-logo.ttf`

Der Name muss genau so lauten. Eingebunden wird sie in `css/style.css`
(Abschnitt „0. LOGO-SCHRIFT“). Solange keine Datei hier liegt, wird
automatisch Impact bzw. Arial Black verwendet.

# Seitenschriften

Alle Schriften liegen lokal hier – es wird nichts aus dem Internet geladen.
Eingebunden werden sie in `css/style.css` (Abschnitt „0. SCHRIFTEN“).

| Datei | Schrift | Schnitt | Verwendung |
|---|---|---|---|
| `manrope-300.woff2` | Manrope | Light (300) | Titel in Großbuchstaben |
| `manrope-400.woff2` | Manrope | Normal (400) | Fließtext, Navigation |
| `manrope-600.woff2` | Manrope | Semibold (600) | Hervorhebungen |
| `bebas-neue-400.woff2` | Bebas Neue | Normal (400) | große Überschriften |
| `ibm-plex-mono-300.woff2` | IBM Plex Mono | Light (300) | Zeitstempel, Nummern |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono | Normal (400) | kleine Angaben |

Herkunft: npm-Pakete `@fontsource/manrope` (5.3.0), `@fontsource/bebas-neue`
(5.3.0) und `@fontsource/ibm-plex-mono` (5.3.0), Teilmenge „latin“ (enthält
ä, ö, ü, ß). Alle drei stehen unter der SIL Open Font License 1.1 –
siehe `LICENSE-Manrope.txt`, `LICENSE-BebasNeue.txt` und
`LICENSE-IBMPlexMono.txt`.
