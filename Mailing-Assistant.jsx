#target "InDesign"

(function () {

    function heutigesDatum() {
        var heute = new Date();
        var tag = heute.getDate();
        var monat = heute.getMonth() + 1;
        var jahr = heute.getFullYear();
        if (tag < 10) { tag = "0" + tag; }
        if (monat < 10) { monat = "0" + monat; }
        return tag + "." + monat + "." + jahr;
    }

    function zeigeStartseite() {
        var dlg = new Window("dialog", "Mailing-Assistant");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;
        dlg.add("statictext", undefined, "Mailing-Assistant");
        var neuerAuftrag = dlg.add("button", undefined, "Neuer Mailing-Auftrag");
        dlg.add("button", undefined, "Gespeicherten Auftrag öffnen");
        dlg.add("button", undefined, "Auftrag duplizieren");
        dlg.add("button", undefined, "Nachproduktion");
        var trennlinie = dlg.add("panel");
        trennlinie.alignment = "fill";
        dlg.add("statictext", undefined, "Zuletzt verwendet");
        var zuletztListe = dlg.add("listbox", undefined, [], { multiselect: false });
        zuletztListe.preferredSize = [520, 160];
        zuletztListe.add("item", "Noch keine Mailing-Aufträge vorhanden");
        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var schliessen = buttons.add("button", undefined, "Schließen");
        schliessen.onClick = function () { dlg.close(0); };
        neuerAuftrag.onClick = function () { dlg.close(1); };
        dlg.center();
        var ergebnis = dlg.show();
        if (ergebnis == 1) { zeigeNeuenAuftrag(); }
    }

    function zeigeNeuenAuftrag() {
        var dlg = new Window("dialog", "Mailing-Assistant – Neuer Auftrag");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;
        dlg.add("statictext", undefined, "Neuer Mailing-Auftrag");
        var formular = dlg.add("panel");
        formular.orientation = "column";
        formular.alignChildren = ["fill", "top"];
        formular.margins = 15;
        formular.spacing = 10;

        function feldZeile(label, wert) {
            var zeile = formular.add("group");
            zeile.orientation = "row";
            var beschriftung = zeile.add("statictext", undefined, label);
            beschriftung.preferredSize.width = 160;
            var feld = zeile.add("edittext", undefined, wert || "");
            feld.characters = 30;
            return feld;
        }

        var feldAuftrag = feldZeile("Auftragsnummer:", "");
        var feldKunde = feldZeile("Kunde:", "");
        var feldBezeichnung = feldZeile("Bezeichnung:", "");
        var feldProduktionsdatum = feldZeile("Produktionsdatum:", heutigesDatum());
        var feldVersanddatum = feldZeile("Versanddatum:", "");

        var zeileVersandart = formular.add("group");
        zeileVersandart.orientation = "row";
        var labelVersandart = zeileVersandart.add("statictext", undefined, "Versandart:");
        labelVersandart.preferredSize.width = 160;
        var feldVersandart = zeileVersandart.add("dropdownlist", undefined, ["Dialogpost", "Briefpost", "Sonstiges"]);
        feldVersandart.preferredSize.width = 308;
        feldVersandart.selection = 0;

        var zeileSonstiges = formular.add("group");
        zeileSonstiges.orientation = "row";
        zeileSonstiges.visible = false;
        var labelSonstiges = zeileSonstiges.add("statictext", undefined, "Sonstiges:");
        labelSonstiges.preferredSize.width = 160;
        var feldSonstiges = zeileSonstiges.add("edittext", undefined, "");
        feldSonstiges.characters = 30;

        feldVersandart.onChange = function () {
            zeileSonstiges.visible = !!(feldVersandart.selection && feldVersandart.selection.text == "Sonstiges");
            dlg.layout.layout(true);
        };

        var feldSollAuflage = feldZeile("Soll-Auflage (optional):", "");
        var zeileSollHinweis = formular.add("group");
        zeileSollHinweis.orientation = "row";
        var abstandSollHinweis = zeileSollHinweis.add("statictext", undefined, "");
        abstandSollHinweis.preferredSize.width = 160;
        zeileSollHinweis.add("statictext", undefined, "Leer lassen = Auflage wird automatisch aus den freigegebenen Datensätzen ermittelt.");

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zurück");
        var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () {
            if (feldSollAuflage.text != "" && (!/^\d+$/.test(feldSollAuflage.text) || parseInt(feldSollAuflage.text, 10) <= 0)) {
                alert("Bitte bei der Soll-Auflage eine ganze positive Zahl eingeben.");
                feldSollAuflage.active = true;
                return;
            }
            dlg.close(2);
        };
        dlg.center();
        var ergebnis = dlg.show();
        if (ergebnis == 1) { zeigeStartseite(); }
        if (ergebnis == 2) { zeigeDatenquelle(); }
    }

    function zeigeDatenquelle() {
        var dlg = new Window("dialog", "Mailing-Assistant – Datenquelle");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;
        dlg.add("statictext", undefined, "Datenquelle");
        var bereich = dlg.add("panel");
        bereich.orientation = "column";
        bereich.alignChildren = ["fill", "top"];
        bereich.margins = 15;
        bereich.spacing = 10;
        bereich.add("statictext", undefined, "Excel-Datei für diesen Mailing-Auftrag auswählen.");
        var dateizeile = bereich.add("group");
        dateizeile.orientation = "row";
        dateizeile.alignChildren = ["fill", "center"];
        var dateifeld = dateizeile.add("edittext", undefined, "");
        dateifeld.characters = 42;
        dateifeld.enabled = false;
        var dateiAuswaehlen = dateizeile.add("button", undefined, "Datei auswählen...");
        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zurück");
        var weiter = buttons.add("button", undefined, "Weiter");
        weiter.enabled = false;
        dateiAuswaehlen.onClick = function () {
            var datei = File.openDialog("Excel-Datei auswählen", "*.xlsx");
            if (datei) {
                dateifeld.text = datei.fsName;
                weiter.enabled = true;
            }
        };
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () { dlg.close(2); };
        dlg.center();
        var ergebnis = dlg.show();
        if (ergebnis == 1) { zeigeNeuenAuftrag(); }
        if (ergebnis == 2) {
            alert("Datenquelle ausgewählt.\n\nDer eigentliche Excel-Import folgt im nächsten Schritt.");
            zeigeDatenquelle();
        }
    }

    zeigeStartseite();
})();