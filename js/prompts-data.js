/* ==========================================================================
   prompts-data.js – alle Kacheln und Prompts des Abschnitts "Prompts"
   Ein Baum: Die Wurzel ist die Hauptkachel "Prompt erstellen". Jeder
   Eintrag hat
     id     – Kennung für die Adresse, z. B. "uni" → #prompts/uni
              (nur Kleinbuchstaben, Ziffern und "-"; "auswahl" ist
              vergeben: #prompts/auswahl ist die ausgeklappte Hauptkachel)
     titel  – Text auf der Kachel ("/" darf umbrechen)
     emoji  – Bild über dem Titel
   und ENTWEDER
     kinder – Liste der Unterkacheln (leere Liste = "Kommt bald")
   ODER
     prompt – der fertige Prompt-Text. Platzhalter in eckigen Klammern,
              z. B. [Fach], werden in der Ansicht farbig hervorgehoben.

   Neue Kategorie oder neuer Prompt? Einfach einen weiteren Eintrag in die
   passende Liste schreiben. Die Reihenfolge der Liste ist die Reihenfolge
   von links nach rechts: die erste Hälfte steht links der Hauptkachel,
   die zweite rechts (bei ungerader Zahl links eine mehr). Es dürfen auch
   mehr oder weniger als vier sein.
   ========================================================================== */

const PROMPT_DATEN = {
  titel: "Prompt erstellen",
  emoji: "✨",
  kinder: [
    {
      id: "uni",
      titel: "Uni/Schule",
      emoji: "📚",
      kinder: [
        { id: "hefteintrag", titel: "Zusammenfassung Hefteintrag", emoji: "📝", prompt: "Prompt folgt" },
        { id: "frage-antwort", titel: "Zusammenfassung Frage/Antwort", emoji: "🗂️", prompt: "Prompt folgt" },
        { id: "frage-zu", titel: "Frage zu …", emoji: "💬", prompt: "Prompt folgt" },
        { id: "vereinfacht", titel: "Vereinfacht", emoji: "💡", prompt: "Prompt folgt" },
      ],
    },
    { id: "arbeit", titel: "Arbeit", emoji: "💼", kinder: [] },
    { id: "recherche", titel: "Berechnungen/Recherche", emoji: "🔎", kinder: [] },
    { id: "bild-video", titel: "Bild/Video-Bearbeitung", emoji: "🎬", kinder: [] },
  ],
};
