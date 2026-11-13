titel = "Neue Brücke in Hamburg eröffnet"
anzahl = 5
print(titel)
print(anzahl)
print("Meldungen heute:", anzahl)

schlagzeilen = ["Brücke eröffnet", "Sonne am Wochenende", "Neuer Bahnhof geplant"]
print(schlagzeilen)
#print(schlagzeilen[-1])
print(len(schlagzeilen))

for schlagzeile in schlagzeilen:
    print("-", schlagzeile)
print("Fertig!")

def zeige_meldung(titel,quelle):
    print("Neu:", titel, "(Quelle:",quelle+")")

zeige_meldung("Brücke eröffnet", "NDR")
zeige_meldung("Sonne am Wochenende", "WDR")
