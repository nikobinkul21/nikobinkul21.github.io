meldung = {
    "titel": "Bayern gewinnt",
    "link": "https://www.tagesschau.de/beispiel",
    "quelle": "tagesschau",
    "text": "Bayern gewinnt dank Harry Kane",
}

print(meldung["titel"])
print(meldung["quelle"])
print(meldung)
print(meldung["text"])
print(meldung.get("datum", "unbekannt"))