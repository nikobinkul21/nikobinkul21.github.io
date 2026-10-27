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

| Datei | Schrift | Schnitt | Rolle |
|---|---|---|---|
| `share-tech-mono-400.woff2` | Share Tech Mono | Normal | Kacheltitel, Navigation, Labels, kurze Hinweise |
| `cormorant-garamond-400/500/600.woff2` | Cormorant Garamond | 400–600 | große Zahlen und Überschriften (Datum!) |
| `archivo-narrow-700.woff2` | Archivo Narrow | Bold | Kleingedrucktes, Fußzeile, Status |
| `inter-400/500/600.woff2` | Inter | 400–600 | Fließtext und Formulare |

Herkunft: npm-Pakete `@fontsource/share-tech-mono`, `@fontsource/cormorant-garamond`,
`@fontsource/archivo-narrow` (je 5.3.0) und `@fontsource/inter` (5.3.0),
Teilmenge „latin“ (enthält ä, ö, ü, ß). Alle stehen unter der
SIL Open Font License 1.1 – siehe `LICENSE-ShareTechMono.txt`,
`LICENSE-CormorantGaramond.txt`, `LICENSE-ArchivoNarrow.txt` und
`LICENSE-Inter.txt`.
