import feedparser
import json
import time

def nach_datum(eintrag):
    return eintrag["datum"]

feeds = [
    {"name": "tagesschau", "url": "https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml"},
    {"name": "Spiegel", "url": "https://www.spiegel.de/schlagzeilen/index.rss"},
]

alle_meldungen = []

for feed in feeds:
    daten = feedparser.parse(feed["url"])
    for meldung in daten.entries:
        if "published_parsed" not in meldung:
            continue
        eintrag = {
            "titel": meldung.title,
            "text": meldung.get("summary", ""),
            "link": meldung.link,
            "quelle": feed["name"],
            "datum": time.strftime("%Y-%m-%d %H:%M", meldung.published_parsed),
                   
        }
        alle_meldungen.append(eintrag)
alle_meldungen = sorted(alle_meldungen,
                 key=nach_datum, reverse=True)
neueste = alle_meldungen[:20]

if len(neueste) == 0:
    print("WARNUNG: Keine Meldungen gefunden!")

print("Gesamt:", len(alle_meldungen))

for eintrag in neueste[:10]:
    print(eintrag["datum"],eintrag["quelle"], 
"|", eintrag["titel"])
    

if len(neueste) != 0:
    with open("data/news.json", "w",
encoding="utf-8") as datei:
        json.dump(neueste, datei,
ensure_ascii=False, indent=2)
    print ("Gespeichert!")
else:
    print("Nicht Gespeichert- alte Datei bleibt erhalten")




