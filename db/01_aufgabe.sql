-- Tabelle für "Zu erledigen" (selbst geschrieben, Schritt 3 im Lernlog)
CREATE TABLE aufgabe (
    id                      VARCHAR2(20)                NOT NULL,
    titel                   VARCHAR2(50 CHAR)           NOT NULL,
    beschreibung            VARCHAR2(100 CHAR),
    faelligkeit_art         VARCHAR2(20 CHAR)           NOT NULL,
    faelligkeit_datum       DATE,
    faelligkeit_zeit        VARCHAR2(5),
    faelligkeit_wochentag   NUMBER(1),
    erledigt                BOOLEAN                     NOT NULL,
    erledigt_am             TIMESTAMP WITH TIME ZONE,
    erstellt                TIMESTAMP WITH TIME ZONE    NOT NULL,

    CONSTRAINT aufgabe_pk                           PRIMARY KEY (id),
    CONSTRAINT aufgabe_faelligkeit_art_ck           CHECK (faelligkeit_art IN ('abgabe','woechentlich')),
    CONSTRAINT aufgabe_faelligkeit_wochentag_ck     CHECK(faelligkeit_wochentag BETWEEN 0 AND 6),
    CONSTRAINT aufgabe_faelligkeit_datum_ck         CHECK(
        (faelligkeit_art= 'abgabe' AND faelligkeit_datum IS NOT NULL)
    OR  (faelligkeit_art<> 'abgabe' AND faelligkeit_datum IS NULL)
    ),
    CONSTRAINT aufgabe_wochentag_art_ck             CHECK(
        (faelligkeit_art= 'woechentlich' AND faelligkeit_wochentag IS NOT NULL)
    OR  (faelligkeit_art<> 'woechentlich' AND faelligkeit_wochentag IS NULL)
    ),
    CONSTRAINT aufgabe_erledigt_am_ck               CHECK(
        (erledigt= TRUE AND erledigt_am IS NOT NULL)
    OR  (erledigt= FALSE AND erledigt_am IS NULL)
    ),
    CONSTRAINT aufgabe_faelligkeit_zeit_ck          CHECK(REGEXP_LIKE(faelligkeit_zeit,'^([01]\d|2[0-3]):[0-5]\d$'))
);
