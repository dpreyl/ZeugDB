# Standorte

Die App speichert einen Standort pro UTF-8 `.location`-Datei, benannt nach
der Standort-ID. Unterstützt werden Punkt-, Raum- und Leitungsstandorte.
Koordinaten sind optional und können später ergänzt werden. Wenn die Geometrie
eingetragen wird, benötigt ein Punkt ein vollständiges Koordinatenpaar, ein Raum
mindestens drei vollständige Eckpunkte und eine Leitung mindestens zwei
vollständige Wegpunkte. Dateien werden beim nächsten Sync angelegt, geändert
oder gelöscht.

Für ein Gelände mit mehreren Küchen und Funktionsbereichen empfiehlt sich eine
Hierarchie, zum Beispiel `Gelände → Küche 1 → Kühlraum` oder
`Gelände → Verwaltung → Büro 1`. Assets werden dem konkreten Raum oder
Arbeitsbereich zugeordnet; Geräteprüfungen bleiben dadurch räumlich
auffindbar.
