#target "InDesign"

(function () {

    // ============================================================
    // ALLGEMEINE HILFSFUNKTIONEN
    // ============================================================

    function heutigesDatum() {

        var heute = new Date();
        var tag = heute.getDate();
        var monat = heute.getMonth() + 1;
        var jahr = heute.getFullYear();

        if (tag < 10) {
            tag = "0" + tag;
        }

        if (monat < 10) {
            monat = "0" + monat;
        }

        return tag + "." + monat + "." + jahr;
    }


    function trimText(text) {

        if (text === null || text === undefined) {
            return "";
        }

        return String(text).replace(/^\s+|\s+$/g, "");
    }


    // ============================================================
    // CSV
    // ============================================================

    function csvDateiLesen(datei) {

        if (!datei || !datei.exists) {
            throw new Error(
                "Die ausgewählte CSV-Datei wurde nicht gefunden."
            );
        }


        datei.encoding = "UTF-8";


        if (!datei.open("r")) {
            throw new Error(
                "Die CSV-Datei konnte nicht geöffnet werden."
            );
        }


        var inhalt = datei.read();

        datei.close();


        // UTF-8-BOM entfernen
        if (
            inhalt.length > 0 &&
            inhalt.charCodeAt(0) == 65279
        ) {
            inhalt = inhalt.substring(1);
        }


        if (trimText(inhalt) == "") {
            throw new Error(
                "Die CSV-Datei ist leer."
            );
        }


        // --------------------------------------------------------
        // Trennzeichen automatisch bestimmen
        // --------------------------------------------------------

        var ersteZeile = "";
        var inAnfuehrungszeichen = false;
        var i;
        var zeichen;


        for (i = 0; i < inhalt.length; i++) {

            zeichen = inhalt.charAt(i);


            if (zeichen == '"') {

                if (
                    inAnfuehrungszeichen &&
                    i + 1 < inhalt.length &&
                    inhalt.charAt(i + 1) == '"'
                ) {
                    ersteZeile += '""';
                    i++;
                    continue;
                }

                inAnfuehrungszeichen =
                    !inAnfuehrungszeichen;

                ersteZeile += zeichen;

                continue;
            }


            if (
                !inAnfuehrungszeichen &&
                (
                    zeichen == "\r" ||
                    zeichen == "\n"
                )
            ) {
                break;
            }


            ersteZeile += zeichen;
        }


        var anzahlSemikolon =
            zaehleTrennzeichen(
                ersteZeile,
                ";"
            );

        var anzahlKomma =
            zaehleTrennzeichen(
                ersteZeile,
                ","
            );

        var anzahlTab =
            zaehleTrennzeichen(
                ersteZeile,
                "\t"
            );


        var trennzeichen = ";";


        if (
            anzahlKomma > anzahlSemikolon &&
            anzahlKomma >= anzahlTab
        ) {
            trennzeichen = ",";
        }


        if (
            anzahlTab > anzahlSemikolon &&
            anzahlTab > anzahlKomma
        ) {
            trennzeichen = "\t";
        }


        // --------------------------------------------------------
        // CSV vollständig parsen
        // --------------------------------------------------------

        var zeilen = [];
        var aktuelleZeile = [];
        var aktuellesFeld = "";

        inAnfuehrungszeichen = false;


        for (i = 0; i < inhalt.length; i++) {

            zeichen = inhalt.charAt(i);


            // Anführungszeichen
            if (zeichen == '"') {

                if (
                    inAnfuehrungszeichen &&
                    i + 1 < inhalt.length &&
                    inhalt.charAt(i + 1) == '"'
                ) {

                    aktuellesFeld += '"';

                    i++;

                    continue;
                }


                inAnfuehrungszeichen =
                    !inAnfuehrungszeichen;

                continue;
            }


            // Trennzeichen
            if (
                !inAnfuehrungszeichen &&
                zeichen == trennzeichen
            ) {

                aktuelleZeile.push(
                    aktuellesFeld
                );

                aktuellesFeld = "";

                continue;
            }


            // Zeilenende
            if (
                !inAnfuehrungszeichen &&
                (
                    zeichen == "\r" ||
                    zeichen == "\n"
                )
            ) {

                aktuelleZeile.push(
                    aktuellesFeld
                );

                aktuellesFeld = "";


                if (
                    !istCsvZeileLeer(
                        aktuelleZeile
                    )
                ) {

                    zeilen.push(
                        aktuelleZeile
                    );
                }


                aktuelleZeile = [];


                // Windows CRLF
                if (
                    zeichen == "\r" &&
                    i + 1 < inhalt.length &&
                    inhalt.charAt(i + 1) == "\n"
                ) {
                    i++;
                }


                continue;
            }


            aktuellesFeld += zeichen;
        }


        // Letzte Zeile übernehmen
        if (
            aktuellesFeld != "" ||
            aktuelleZeile.length > 0
        ) {

            aktuelleZeile.push(
                aktuellesFeld
            );


            if (
                !istCsvZeileLeer(
                    aktuelleZeile
                )
            ) {

                zeilen.push(
                    aktuelleZeile
                );
            }
        }


        if (zeilen.length == 0) {

            throw new Error(
                "Die CSV-Datei enthält keine Daten."
            );
        }


        // Erste nicht-leere Zeile = Überschriften
        var spalten = zeilen[0];

        var datensaetze = [];


        for (i = 1; i < zeilen.length; i++) {

            if (
                !istCsvZeileLeer(
                    zeilen[i]
                )
            ) {

                datensaetze.push(
                    zeilen[i]
                );
            }
        }


        return {

            spalten: spalten,

            datensaetze: datensaetze,

            anzahl:
                datensaetze.length,

            trennzeichen:
                trennzeichen
        };
    }


    function zaehleTrennzeichen(
        text,
        trennzeichen
    ) {

        var anzahl = 0;
        var inAnfuehrungszeichen = false;
        var i;
        var zeichen;


        for (i = 0; i < text.length; i++) {

            zeichen = text.charAt(i);


            if (zeichen == '"') {

                if (
                    inAnfuehrungszeichen &&
                    i + 1 < text.length &&
                    text.charAt(i + 1) == '"'
                ) {

                    i++;

                    continue;
                }


                inAnfuehrungszeichen =
                    !inAnfuehrungszeichen;

                continue;
            }


            if (
                !inAnfuehrungszeichen &&
                zeichen == trennzeichen
            ) {

                anzahl++;
            }
        }


        return anzahl;
    }


    function istCsvZeileLeer(zeile) {

        var i;


        for (i = 0; i < zeile.length; i++) {

            if (
                trimText(
                    zeile[i]
                ) != ""
            ) {

                return false;
            }
        }


        return true;
    }


    // ============================================================
    // STARTSEITE
    // ============================================================

    function zeigeStartseite() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant"
        );


        dlg.orientation = "column";

        dlg.alignChildren = [
            "fill",
            "top"
        ];

        dlg.spacing = 12;

        dlg.margins = 20;


        dlg.add(
            "statictext",
            undefined,
            "Mailing-Assistant"
        );


        var neuerAuftrag = dlg.add(
            "button",
            undefined,
            "Neuer Mailing-Auftrag"
        );


        dlg.add(
            "button",
            undefined,
            "Gespeicherten Auftrag öffnen"
        );


        dlg.add(
            "button",
            undefined,
            "Auftrag duplizieren"
        );


        dlg.add(
            "button",
            undefined,
            "Nachproduktion"
        );


        var trennlinie =
            dlg.add("panel");

        trennlinie.alignment =
            "fill";


        dlg.add(
            "statictext",
            undefined,
            "Zuletzt verwendet"
        );


        var zuletztListe = dlg.add(
            "listbox",
            undefined,
            [],
            {
                multiselect: false
            }
        );


        zuletztListe.preferredSize =
            [520, 160];


        zuletztListe.add(
            "item",
            "Noch keine Mailing-Aufträge vorhanden"
        );


        var buttons =
            dlg.add("group");

        buttons.alignment =
            "right";


        var schliessen =
            buttons.add(
                "button",
                undefined,
                "Schließen"
            );


        schliessen.onClick =
            function () {

                dlg.close(0);
            };


        neuerAuftrag.onClick =
            function () {

                dlg.close(1);
            };


        dlg.center();


        var ergebnis =
            dlg.show();


        if (ergebnis == 1) {

            zeigeNeuenAuftrag();
        }
    }


    // ============================================================
    // NEUER AUFTRAG
    // ============================================================

    function zeigeNeuenAuftrag() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Neuer Auftrag"
        );


        dlg.orientation = "column";

        dlg.alignChildren = [
            "fill",
            "top"
        ];

        dlg.spacing = 12;

        dlg.margins = 20;


        dlg.add(
            "statictext",
            undefined,
            "Neuer Mailing-Auftrag"
        );


        var formular =
            dlg.add("panel");

        formular.orientation =
            "column";

        formular.alignChildren = [
            "fill",
            "top"
        ];

        formular.margins = 15;

        formular.spacing = 10;


        // --------------------------------------------------------
        // Auftragsnummer
        // --------------------------------------------------------

        var zeileAuftrag =
            formular.add("group");

        zeileAuftrag.orientation =
            "row";


        var labelAuftrag =
            zeileAuftrag.add(
                "statictext",
                undefined,
                "Auftragsnummer:"
            );


        labelAuftrag.preferredSize.width =
            160;


        var feldAuftrag =
            zeileAuftrag.add(
                "edittext",
                undefined,
                ""
            );


        feldAuftrag.characters =
            30;


        // --------------------------------------------------------
        // Kunde
        // --------------------------------------------------------

        var zeileKunde =
            formular.add("group");

        zeileKunde.orientation =
            "row";


        var labelKunde =
            zeileKunde.add(
                "statictext",
                undefined,
                "Kunde:"
            );


        labelKunde.preferredSize.width =
            160;


        var feldKunde =
            zeileKunde.add(
                "edittext",
                undefined,
                ""
            );


        feldKunde.characters =
            30;


        // --------------------------------------------------------
        // Bezeichnung
        // --------------------------------------------------------

        var zeileBezeichnung =
            formular.add("group");

        zeileBezeichnung.orientation =
            "row";


        var labelBezeichnung =
            zeileBezeichnung.add(
                "statictext",
                undefined,
                "Bezeichnung:"
            );


        labelBezeichnung.preferredSize.width =
            160;


        var feldBezeichnung =
            zeileBezeichnung.add(
                "edittext",
                undefined,
                ""
            );


        feldBezeichnung.characters =
            30;


        // --------------------------------------------------------
        // Produktionsdatum
        // --------------------------------------------------------

        var zeileProduktionsdatum =
            formular.add("group");

        zeileProduktionsdatum.orientation =
            "row";


        var labelProduktionsdatum =
            zeileProduktionsdatum.add(
                "statictext",
                undefined,
                "Produktionsdatum:"
            );


        labelProduktionsdatum.preferredSize.width =
            160;


        var feldProduktionsdatum =
            zeileProduktionsdatum.add(
                "edittext",
                undefined,
                heutigesDatum()
            );


        feldProduktionsdatum.characters =
            30;


        // --------------------------------------------------------
        // Versanddatum
        // --------------------------------------------------------

        var zeileVersanddatum =
            formular.add("group");

        zeileVersanddatum.orientation =
            "row";


        var labelVersanddatum =
            zeileVersanddatum.add(
                "statictext",
                undefined,
                "Versanddatum:"
            );


        labelVersanddatum.preferredSize.width =
            160;


        var feldVersanddatum =
            zeileVersanddatum.add(
                "edittext",
                undefined,
                ""
            );


        feldVersanddatum.characters =
            30;


        // --------------------------------------------------------
        // Versandart
        // --------------------------------------------------------

        var zeileVersandart =
            formular.add("group");

        zeileVersandart.orientation =
            "row";


        var labelVersandart =
            zeileVersandart.add(
                "statictext",
                undefined,
                "Versandart:"
            );


        labelVersandart.preferredSize.width =
            160;


        var feldVersandart =
            zeileVersandart.add(
                "dropdownlist",
                undefined,
                [
                    "Dialogpost",
                    "Briefpost",
                    "Sonstiges"
                ]
            );


        feldVersandart.preferredSize.width =
            308;

        feldVersandart.selection =
            0;


        // --------------------------------------------------------
        // Sonstiges
        // --------------------------------------------------------

        var zeileSonstiges =
            formular.add("group");

        zeileSonstiges.orientation =
            "row";

        zeileSonstiges.visible =
            false;


        var labelSonstiges =
            zeileSonstiges.add(
                "statictext",
                undefined,
                "Sonstiges:"
            );


        labelSonstiges.preferredSize.width =
            160;


        var feldSonstiges =
            zeileSonstiges.add(
                "edittext",
                undefined,
                ""
            );


        feldSonstiges.characters =
            30;


        feldVersandart.onChange =
            function () {

                if (
                    feldVersandart.selection &&
                    feldVersandart.selection.text ==
                        "Sonstiges"
                ) {

                    zeileSonstiges.visible =
                        true;

                } else {

                    zeileSonstiges.visible =
                        false;
                }


                dlg.layout.layout(true);
            };


        // --------------------------------------------------------
        // Soll-Auflage
        // --------------------------------------------------------

        var zeileSollAuflage =
            formular.add("group");

        zeileSollAuflage.orientation =
            "row";


        var labelSollAuflage =
            zeileSollAuflage.add(
                "statictext",
                undefined,
                "Soll-Auflage (optional):"
            );


        labelSollAuflage.preferredSize.width =
            160;


        var feldSollAuflage =
            zeileSollAuflage.add(
                "edittext",
                undefined,
                ""
            );


        feldSollAuflage.characters =
            30;


        // Hinweis
        var zeileSollHinweis =
            formular.add("group");

        zeileSollHinweis.orientation =
            "row";


        var abstandSollHinweis =
            zeileSollHinweis.add(
                "statictext",
                undefined,
                ""
            );


        abstandSollHinweis.preferredSize.width =
            160;


        zeileSollHinweis.add(
            "statictext",
            undefined,
            "Leer lassen = Auflage wird automatisch aus den freigegebenen Datensätzen ermittelt."
        );


        // --------------------------------------------------------
        // Buttons
        // --------------------------------------------------------

        var buttons =
            dlg.add("group");

        buttons.alignment =
            "right";


        var zurueck =
            buttons.add(
                "button",
                undefined,
                "Zurück"
            );


        var weiter =
            buttons.add(
                "button",
                undefined,
                "Weiter"
            );


        zurueck.onClick =
            function () {

                dlg.close(1);
            };


        weiter.onClick =
            function () {

                if (
                    feldSollAuflage.text != ""
                ) {

                    if (
                        !/^\d+$/.test(
                            feldSollAuflage.text
                        ) ||
                        parseInt(
                            feldSollAuflage.text,
                            10
                        ) <= 0
                    ) {

                        alert(
                            "Bitte bei der Soll-Auflage eine ganze positive Zahl eingeben."
                        );


                        feldSollAuflage.active =
                            true;

                        return;
                    }
                }


                dlg.close(2);
            };


        dlg.center();


        var ergebnis =
            dlg.show();


        if (ergebnis == 1) {

            zeigeStartseite();
        }


        if (ergebnis == 2) {

            zeigeDatenquelle();
        }
    }


    // ============================================================
    // DATENQUELLE
    // ============================================================

    function zeigeDatenquelle() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Datenquelle"
        );


        dlg.orientation =
            "column";

        dlg.alignChildren = [
            "fill",
            "top"
        ];

        dlg.spacing = 12;

        dlg.margins = 20;


        dlg.add(
            "statictext",
            undefined,
            "Datenquelle"
        );


        var bereich =
            dlg.add("panel");

        bereich.orientation =
            "column";

        bereich.alignChildren = [
            "fill",
            "top"
        ];

        bereich.margins =
            15;

        bereich.spacing =
            10;


        bereich.add(
            "statictext",
            undefined,
            "Excel- oder CSV-Datei für diesen Mailing-Auftrag auswählen."
        );


        var dateizeile =
            bereich.add("group");

        dateizeile.orientation =
            "row";

        dateizeile.alignChildren = [
            "fill",
            "center"
        ];


        var dateifeld =
            dateizeile.add(
                "edittext",
                undefined,
                ""
            );


        dateifeld.characters =
            42;

        dateifeld.enabled =
            false;


        var dateiAuswaehlen =
            dateizeile.add(
                "button",
                undefined,
                "Datei auswählen..."
            );


        var buttons =
            dlg.add("group");

        buttons.alignment =
            "right";


        var zurueck =
            buttons.add(
                "button",
                undefined,
                "Zurück"
            );


        var weiter =
            buttons.add(
                "button",
                undefined,
                "Weiter"
            );


        weiter.enabled =
            false;


        var ausgewaehlteDatei =
            null;


        dateiAuswaehlen.onClick =
            function () {

                var datei =
                    File.openDialog(
                        "Mailing-Datendatei auswählen",
                        "Mailing-Dateien:*.xlsx;*.csv"
                    );


                if (datei) {

                    ausgewaehlteDatei =
                        datei;


                    dateifeld.text =
                        datei.fsName;


                    weiter.enabled =
                        true;
                }
            };


        zurueck.onClick =
            function () {

                dlg.close(1);
            };


        weiter.onClick =
            function () {

                if (!ausgewaehlteDatei) {
                    return;
                }


                // XLSX kommt später
                if (
                    /\.xlsx$/i.test(
                        ausgewaehlteDatei.name
                    )
                ) {

                    alert(
                        "XLSX-Dateien können in diesem Entwicklungsschritt noch nicht eingelesen werden.\n\n" +
                        "Bitte für den aktuellen Test die CSV-Datei auswählen."
                    );

                    return;
                }


                // CSV
                if (
                    /\.csv$/i.test(
                        ausgewaehlteDatei.name
                    )
                ) {

                    try {

                        var csvDaten =
                            csvDateiLesen(
                                ausgewaehlteDatei
                            );


                        dlg.close(2);


                        zeigeCsvVorschau(
                            ausgewaehlteDatei,
                            csvDaten
                        );


                    } catch (fehler) {

                        alert(
                            "Die CSV-Datei konnte nicht gelesen werden.\n\n" +
                            "Fehler: " +
                            fehler
                        );

                        return;
                    }
                }
            };


        dlg.center();


        var ergebnis =
            dlg.show();


        if (ergebnis == 1) {

            zeigeNeuenAuftrag();
        }
    }


    // ============================================================
    // CSV-VORSCHAU
    // ============================================================

    function zeigeCsvVorschau(
        datei,
        csvDaten
    ) {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Datenvorschau"
        );


        dlg.orientation =
            "column";

        dlg.alignChildren = [
            "fill",
            "top"
        ];

        dlg.spacing =
            12;

        dlg.margins =
            20;


        dlg.add(
            "statictext",
            undefined,
            "CSV-Daten erfolgreich eingelesen"
        );


        var info =
            dlg.add("panel");

        info.orientation =
            "column";

        info.alignChildren = [
            "left",
            "top"
        ];

        info.margins =
            15;

        info.spacing =
            6;


        info.add(
            "statictext",
            undefined,
            "Datei: " +
            datei.name
        );


        info.add(
            "statictext",
            undefined,
            "Datensätze: " +
            csvDaten.anzahl
        );


        info.add(
            "statictext",
            undefined,
            "Spalten: " +
            csvDaten.spalten.length
        );


        var vorschauBereich =
            dlg.add("panel");

        vorschauBereich.text =
            "Vorschau – erste 10 Datensätze";

        vorschauBereich.orientation =
            "column";

        vorschauBereich.alignChildren = [
            "fill",
            "top"
        ];

        vorschauBereich.margins =
            15;


        var spaltenbreiten = [];

        var i;


        for (
            i = 0;
            i < csvDaten.spalten.length;
            i++
        ) {

            spaltenbreiten.push(120);
        }


        var liste =
            vorschauBereich.add(
                "listbox",
                undefined,
                [],
                {
                    numberOfColumns:
                        csvDaten.spalten.length,

                    showHeaders:
                        true,

                    columnTitles:
                        csvDaten.spalten,

                    columnWidths:
                        spaltenbreiten
                }
            );


        liste.preferredSize = [
            760,
            260
        ];


        var maximaleVorschau =
            Math.min(
                10,
                csvDaten.datensaetze.length
            );


        var zeile;
        var eintrag;
        var spalte;
        var wert;


        for (
            i = 0;
            i < maximaleVorschau;
            i++
        ) {

            zeile =
                csvDaten.datensaetze[i];


            wert =
                zeile.length > 0
                    ? zeile[0]
                    : "";


            eintrag =
                liste.add(
                    "item",
                    wert
                );


            for (
                spalte = 1;
                spalte < csvDaten.spalten.length;
                spalte++
            ) {

                wert =
                    spalte < zeile.length
                        ? zeile[spalte]
                        : "";


                eintrag.subItems[
                    spalte - 1
                ].text = wert;
            }
        }


        var hinweis =
            dlg.add(
                "statictext",
                undefined,
                maximaleVorschau +
                " von " +
                csvDaten.anzahl +
                " Datensätzen werden angezeigt."
            );


        var buttons =
            dlg.add("group");

        buttons.alignment =
            "right";


        var zurueck =
            buttons.add(
                "button",
                undefined,
                "Zurück"
            );


        var weiter =
            buttons.add(
                "button",
                undefined,
                "Weiter"
            );


        // Spaltenzuordnung ist der nächste Schritt.
        weiter.enabled =
            true;

        weiter.onClick =
            function () {

                dlg.close(2);
            };


        zurueck.onClick =
            function () {

                dlg.close(1);
            };


        dlg.center();


        var ergebnis =
            dlg.show();


        if (ergebnis == 1) {

            zeigeDatenquelle();
        }

        if (ergebnis == 2) {

            zeigeSpaltenzuordnung(
                datei,
                csvDaten
            );
        }
    }


    // ============================================================
    // SPALTENZUORDNUNG
    // ============================================================

    function zeigeSpaltenzuordnung(
        datei,
        csvDaten
    ) {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Spaltenzuordnung"
        );

        dlg.orientation =
            "column";

        dlg.alignChildren = [
            "fill",
            "top"
        ];

        dlg.spacing = 12;

        dlg.margins = 20;


        dlg.add(
            "statictext",
            undefined,
            "Spaltenzuordnung"
        );


        dlg.add(
            "statictext",
            undefined,
            "Ordne den internen Mailing-Feldern die passenden CSV-Spalten zu."
        );


        var bereich =
            dlg.add("panel");

        bereich.orientation =
            "column";

        bereich.alignChildren = [
            "fill",
            "top"
        ];

        bereich.margins =
            15;

        bereich.spacing =
            8;


        var interneFelder = [
            "Anrede",
            "Titel",
            "Vorname",
            "Nachname",
            "Firma",
            "Straße",
            "Hausnummer",
            "PLZ",
            "Ort",
            "Land",
            "Adresszusatz",
            "E-Mail",
            "Telefon",
            "Kundennummer",
            "Selektionsmerkmal",
            "Sonstiges"
        ];


        var csvSpalten = [
            "— nicht zugeordnet —"
        ];

        var i;
        var j;


        for (
            i = 0;
            i < csvDaten.spalten.length;
            i++
        ) {

            csvSpalten.push(
                csvDaten.spalten[i]
            );
        }


        var zuordnungen = [];


        for (
            i = 0;
            i < interneFelder.length;
            i++
        ) {

            var zeile =
                bereich.add("group");

            zeile.orientation =
                "row";

            zeile.alignChildren = [
                "center",
                "center"
            ];


            var label =
                zeile.add(
                    "statictext",
                    undefined,
                    interneFelder[i] + ":"
                );


            label.preferredSize.width =
                150;


            var auswahl =
                zeile.add(
                    "dropdownlist",
                    undefined,
                    csvSpalten
                );


            auswahl.preferredSize.width =
                300;


            auswahl.selection =
                0;


            zuordnungen.push(
                auswahl
            );
        }


        var hinweis =
            dlg.add(
                "statictext",
                undefined,
                "Noch keine Zuordnung wird gespeichert oder verarbeitet."
            );


        var buttons =
            dlg.add("group");

        buttons.alignment =
            "right";


        var zurueck =
            buttons.add(
                "button",
                undefined,
                "Zurück"
            );


        var weiter =
            buttons.add(
                "button",
                undefined,
                "Weiter"
            );


        zurueck.onClick =
            function () {

                dlg.close(1);
            };


        weiter.onClick =
            function () {

                dlg.close(2);
            };


        dlg.center();


        var ergebnis =
            dlg.show();


        if (ergebnis == 1) {

            zeigeCsvVorschau(
                datei,
                csvDaten
            );
        }
    }


    // ============================================================
    // START
    // ============================================================

    zeigeStartseite();

})();