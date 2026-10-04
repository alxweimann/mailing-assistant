#target "InDesign"

(function () {

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


    function csvDatensaetzeZaehlen(datei) {

        if (!datei || !datei.exists) {
            throw new Error("Die ausgewählte CSV-Datei wurde nicht gefunden.");
        }

        datei.encoding = "UTF-8";

        if (!datei.open("r")) {
            throw new Error("Die CSV-Datei konnte nicht geöffnet werden.");
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


        /*
            CSV zeilenweise zerlegen.

            Zeilenumbrüche innerhalb von Anführungszeichen
            werden dabei nicht als neuer Datensatz behandelt.
        */

        var zeilen = [];
        var aktuelleZeile = "";
        var inAnfuehrungszeichen = false;
        var i;
        var zeichen;

        for (i = 0; i < inhalt.length; i++) {

            zeichen = inhalt.charAt(i);

            if (zeichen == '"') {

                // Doppeltes Anführungszeichen innerhalb eines Feldes
                if (
                    inAnfuehrungszeichen &&
                    i + 1 < inhalt.length &&
                    inhalt.charAt(i + 1) == '"'
                ) {
                    aktuelleZeile += '""';
                    i++;
                    continue;
                }

                inAnfuehrungszeichen = !inAnfuehrungszeichen;
                aktuelleZeile += zeichen;
                continue;
            }


            if (
                !inAnfuehrungszeichen &&
                (zeichen == "\r" || zeichen == "\n")
            ) {

                zeilen.push(aktuelleZeile);
                aktuelleZeile = "";

                if (
                    zeichen == "\r" &&
                    i + 1 < inhalt.length &&
                    inhalt.charAt(i + 1) == "\n"
                ) {
                    i++;
                }

                continue;
            }

            aktuelleZeile += zeichen;
        }


        if (aktuelleZeile != "") {
            zeilen.push(aktuelleZeile);
        }


        // Komplett leere Zeilen entfernen
        var nichtLeereZeilen = [];

        for (i = 0; i < zeilen.length; i++) {

            var pruefzeile = zeilen[i];

            // Trennzeichen, Leerzeichen und Anführungszeichen
            // für die Leerprüfung entfernen
            var bereinigt = pruefzeile.replace(
                /[\s;,\t"]/g,
                ""
            );

            if (bereinigt != "") {
                nichtLeereZeilen.push(pruefzeile);
            }
        }


        // Keine Kopfzeile vorhanden
        if (nichtLeereZeilen.length == 0) {
            return 0;
        }


        // Erste nicht-leere Zeile = Spaltenüberschriften
        return nichtLeereZeilen.length - 1;
    }


    function zeigeStartseite() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant"
        );

        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
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

        var trennlinie = dlg.add("panel");
        trennlinie.alignment = "fill";

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

        zuletztListe.preferredSize = [520, 160];

        zuletztListe.add(
            "item",
            "Noch keine Mailing-Aufträge vorhanden"
        );

        var buttons = dlg.add("group");
        buttons.alignment = "right";

        var schliessen = buttons.add(
            "button",
            undefined,
            "Schließen"
        );

        schliessen.onClick = function () {
            dlg.close(0);
        };

        neuerAuftrag.onClick = function () {
            dlg.close(1);
        };

        dlg.center();

        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeNeuenAuftrag();
        }
    }


    function zeigeNeuenAuftrag() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Neuer Auftrag"
        );

        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        dlg.add(
            "statictext",
            undefined,
            "Neuer Mailing-Auftrag"
        );

        var formular = dlg.add("panel");
        formular.orientation = "column";
        formular.alignChildren = ["fill", "top"];
        formular.margins = 15;
        formular.spacing = 10;


        // Auftragsnummer
        var zeileAuftrag = formular.add("group");
        zeileAuftrag.orientation = "row";

        var labelAuftrag = zeileAuftrag.add(
            "statictext",
            undefined,
            "Auftragsnummer:"
        );

        labelAuftrag.preferredSize.width = 160;

        var feldAuftrag = zeileAuftrag.add(
            "edittext",
            undefined,
            ""
        );

        feldAuftrag.characters = 30;


        // Kunde
        var zeileKunde = formular.add("group");
        zeileKunde.orientation = "row";

        var labelKunde = zeileKunde.add(
            "statictext",
            undefined,
            "Kunde:"
        );

        labelKunde.preferredSize.width = 160;

        var feldKunde = zeileKunde.add(
            "edittext",
            undefined,
            ""
        );

        feldKunde.characters = 30;


        // Bezeichnung
        var zeileBezeichnung = formular.add("group");
        zeileBezeichnung.orientation = "row";

        var labelBezeichnung = zeileBezeichnung.add(
            "statictext",
            undefined,
            "Bezeichnung:"
        );

        labelBezeichnung.preferredSize.width = 160;

        var feldBezeichnung = zeileBezeichnung.add(
            "edittext",
            undefined,
            ""
        );

        feldBezeichnung.characters = 30;


        // Produktionsdatum
        var zeileProduktionsdatum = formular.add("group");
        zeileProduktionsdatum.orientation = "row";

        var labelProduktionsdatum = zeileProduktionsdatum.add(
            "statictext",
            undefined,
            "Produktionsdatum:"
        );

        labelProduktionsdatum.preferredSize.width = 160;

        var feldProduktionsdatum = zeileProduktionsdatum.add(
            "edittext",
            undefined,
            heutigesDatum()
        );

        feldProduktionsdatum.characters = 30;


        // Versanddatum
        var zeileVersanddatum = formular.add("group");
        zeileVersanddatum.orientation = "row";

        var labelVersanddatum = zeileVersanddatum.add(
            "statictext",
            undefined,
            "Versanddatum:"
        );

        labelVersanddatum.preferredSize.width = 160;

        var feldVersanddatum = zeileVersanddatum.add(
            "edittext",
            undefined,
            ""
        );

        feldVersanddatum.characters = 30;


        // Versandart
        var zeileVersandart = formular.add("group");
        zeileVersandart.orientation = "row";

        var labelVersandart = zeileVersandart.add(
            "statictext",
            undefined,
            "Versandart:"
        );

        labelVersandart.preferredSize.width = 160;

        var feldVersandart = zeileVersandart.add(
            "dropdownlist",
            undefined,
            [
                "Dialogpost",
                "Briefpost",
                "Sonstiges"
            ]
        );

        feldVersandart.preferredSize.width = 308;
        feldVersandart.selection = 0;


        // Sonstiges
        var zeileSonstiges = formular.add("group");
        zeileSonstiges.orientation = "row";
        zeileSonstiges.visible = false;

        var labelSonstiges = zeileSonstiges.add(
            "statictext",
            undefined,
            "Sonstiges:"
        );

        labelSonstiges.preferredSize.width = 160;

        var feldSonstiges = zeileSonstiges.add(
            "edittext",
            undefined,
            ""
        );

        feldSonstiges.characters = 30;


        feldVersandart.onChange = function () {

            if (
                feldVersandart.selection &&
                feldVersandart.selection.text == "Sonstiges"
            ) {
                zeileSonstiges.visible = true;
            } else {
                zeileSonstiges.visible = false;
            }

            dlg.layout.layout(true);
        };


        // Soll-Auflage
        var zeileSollAuflage = formular.add("group");
        zeileSollAuflage.orientation = "row";

        var labelSollAuflage = zeileSollAuflage.add(
            "statictext",
            undefined,
            "Soll-Auflage (optional):"
        );

        labelSollAuflage.preferredSize.width = 160;

        var feldSollAuflage = zeileSollAuflage.add(
            "edittext",
            undefined,
            ""
        );

        feldSollAuflage.characters = 30;


        // Hinweis
        var zeileSollHinweis = formular.add("group");
        zeileSollHinweis.orientation = "row";

        var abstandSollHinweis = zeileSollHinweis.add(
            "statictext",
            undefined,
            ""
        );

        abstandSollHinweis.preferredSize.width = 160;

        zeileSollHinweis.add(
            "statictext",
            undefined,
            "Leer lassen = Auflage wird automatisch aus den freigegebenen Datensätzen ermittelt."
        );


        // Buttons
        var buttons = dlg.add("group");
        buttons.alignment = "right";

        var zurueck = buttons.add(
            "button",
            undefined,
            "Zurück"
        );

        var weiter = buttons.add(
            "button",
            undefined,
            "Weiter"
        );


        zurueck.onClick = function () {
            dlg.close(1);
        };


        weiter.onClick = function () {

            if (feldSollAuflage.text != "") {

                if (
                    !/^\d+$/.test(feldSollAuflage.text) ||
                    parseInt(feldSollAuflage.text, 10) <= 0
                ) {
                    alert(
                        "Bitte bei der Soll-Auflage eine ganze positive Zahl eingeben."
                    );

                    feldSollAuflage.active = true;
                    return;
                }
            }

            dlg.close(2);
        };


        dlg.center();

        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeStartseite();
        }

        if (ergebnis == 2) {
            zeigeDatenquelle();
        }
    }


    function zeigeDatenquelle() {

        var dlg = new Window(
            "dialog",
            "Mailing-Assistant – Datenquelle"
        );

        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;


        dlg.add(
            "statictext",
            undefined,
            "Datenquelle"
        );


        var bereich = dlg.add("panel");
        bereich.orientation = "column";
        bereich.alignChildren = ["fill", "top"];
        bereich.margins = 15;
        bereich.spacing = 10;


        bereich.add(
            "statictext",
            undefined,
            "Excel- oder CSV-Datei für diesen Mailing-Auftrag auswählen."
        );


        var dateizeile = bereich.add("group");
        dateizeile.orientation = "row";
        dateizeile.alignChildren = ["fill", "center"];


        var dateifeld = dateizeile.add(
            "edittext",
            undefined,
            ""
        );

        dateifeld.characters = 42;
        dateifeld.enabled = false;


        var dateiAuswaehlen = dateizeile.add(
            "button",
            undefined,
            "Datei auswählen..."
        );


        var buttons = dlg.add("group");
        buttons.alignment = "right";


        var zurueck = buttons.add(
            "button",
            undefined,
            "Zurück"
        );


        var weiter = buttons.add(
            "button",
            undefined,
            "Weiter"
        );

        weiter.enabled = false;


        var ausgewaehlteDatei = null;


        dateiAuswaehlen.onClick = function () {

          var datei = File.openDialog(
    "Mailing-Datendatei auswählen",
    "Mailing-Dateien:*.xlsx;*.csv"
);

            if (datei) {

                ausgewaehlteDatei = datei;

                dateifeld.text = datei.fsName;
                weiter.enabled = true;
            }
        };


        zurueck.onClick = function () {
            dlg.close(1);
        };


        weiter.onClick = function () {

            if (!ausgewaehlteDatei) {
                return;
            }


            if (/\.xlsx$/i.test(ausgewaehlteDatei.name)) {

                alert(
                    "XLSX-Dateien können in diesem Entwicklungsschritt noch nicht eingelesen werden.\n\n" +
                    "Bitte für den aktuellen Test die CSV-Datei auswählen."
                );

                return;
            }


            if (/\.csv$/i.test(ausgewaehlteDatei.name)) {

                try {

                    var anzahl = csvDatensaetzeZaehlen(
                        ausgewaehlteDatei
                    );

                    alert(
                        "CSV-Datei erfolgreich gelesen.\n\n" +
                        anzahl +
                        " Datensätze gefunden."
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

        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeNeuenAuftrag();
        }
    }


    zeigeStartseite();

})();