-- Titel darf nicht nur aus Leerzeichen bestehen (Lücke beim Testen gefunden,
-- Schritt 4 im Lernlog). TRIM(' ') ergibt '' und das ist in Oracle NULL.
ALTER TABLE aufgabe ADD CONSTRAINT aufgabe_titel_ck CHECK (TRIM(titel) IS NOT NULL);
