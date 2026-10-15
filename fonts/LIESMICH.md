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
| `inter-400.woff2` | Inter | Normal (400) | Fließtext |
| `inter-500.woff2` | Inter | Medium (500) | Navigation, Buttons |
| `inter-600.woff2` | Inter | Semibold (600) | Hervorhebungen |
| `source-serif-4-400.woff2` | Source Serif 4 | Normal (400) | Überschriften |
| `source-serif-4-600.woff2` | Source Serif 4 | Semibold (600) | Überschriften |

Herkunft: npm-Pakete `@fontsource/inter` (5.3.0) und
`@fontsource/source-serif-4` (5.3.1), Teilmenge „latin“ (enthält ä, ö, ü, ß).
Beide Schriften stehen unter der SIL Open Font License 1.1 –
siehe `LICENSE-Inter.txt` und `LICENSE-SourceSerif4.txt`.
