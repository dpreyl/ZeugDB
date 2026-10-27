# Gerätetypen und Elektroprüfung

Die App speichert jeden Typ in einer UTF-8-Datei `types/<type-id>.type`.
Typdefinitionen werden beim Klonen/Holen geladen und beim Sync übertragen.

## Vererbung und gemeinsame Elektrogeräte-Daten

`_base.type` enthält allgemeine Felder wie den Zustand. `elektrogeraet.type`
ergänzt Hersteller, Modell, Seriennummer, Inventarnummer und elektrische
Kenndaten. Die konkreten Büro-, Küchen- und Wartungstypen erben davon; neue
gemeinsame Felder müssen daher nur in `elektrogeraet.type` ergänzt werden.

Jeder Elektrogerätetyp erbt außerdem den wiederholbaren Baustein `pruefung`.
Dort wird für jede Prüfung ein eigener Eintrag angelegt. Erfasst werden
das tatsächliche Prüfdatum, Prüfer, Prüfart und Ergebnis, optionale Messwerte,
Mängel und Maßnahmen. Jeder Termin wird als eigener Eintrag geführt; damit ist
das jüngste Prüfdatum zugleich das letzte Prüfdatum. Ein nächster Termin wird
nicht fest eingetragen, weil sich Prüffristen ändern können.

Die Vorlage nennt keine pauschalen Prüffristen oder Grenzwerte: Diese hängen
unter anderem von Gefährdungsbeurteilung, Einsatzbedingungen und Gerät ab.
Die „BGV-A3-Prüfung“ wird heute üblicherweise als Prüfung nach DGUV Vorschrift 3
bezeichnet. Diese Datenbank dokumentiert die Prüfung; sie ersetzt weder
Prüfanweisung noch fachliche Bewertung.

Der Repository-Initializer ergänzt fehlende Vorlagen, überschreibt aber keine
bereits vorhandenen Typdateien. Bei einem bestehenden Repository muss ein
vorhandener `projektor.type` daher gegebenenfalls manuell auf
`extends: elektrogeraet` umgestellt werden, damit auch Projektoren den
Prüfbaustein erhalten.

## Fotos und reservierte Asset-Daten

Jedes Asset kann die Rollen `foto_typenschild` und `foto_uebersicht` für ein
lesbares Typenschildfoto und ein Übersichtsbild führen. Die Bilddateien selbst
liegen über den vorhandenen Git-LFS-Workflow unter `fotos/<asset-id>/`; die
Rollen und Dateipfade stehen in der `.asset`-Datei. Weitere Fotos bleiben als
Zusatzfotos möglich. Zusätzlich kann ein Typ eigene Felder vom Eingabetyp
`image` oder `images` definieren. Beispiele:
`feld: typenschild, image, optional` und `feld: maengelfotos, images, optional`.
`image` nimmt eine Datei auf, `images` mehrere Dateien für ein Feld. Beim
Anlegen oder Bearbeiten des Assets werden die Bilder direkt am Feld ausgewählt;
die Git-LFS-Pfade des Mehrfach-Bilderfelds stehen als JSON-Array in der
`.asset`-Datei.

Für Werte mit Nachkommastellen steht der Eingabetyp `decimal` zur Verfügung,
zum Beispiel `feld: ableitstrom, decimal, optional`.

Der Asset-Typ ist reservierte `type:`-Metadaten und darf nicht als normales
`feld:` definiert werden. `bezeichnung` wird unabhängig vom Typ bei jedem
Asset erfasst. Auch die Foto-Rollen werden von der App verwaltet und gehören
nicht als Freitextfelder in einzelne Typen. Typbezogene `image`-Felder sind
davon unabhängig und können für beliebige asset-spezifische Bilder verwendet
werden.
