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
        var auftragOeffnen = dlg.add("button", undefined, "Gespeicherten Auftrag öffnen");
        var auftragDuplizieren = dlg.add("button", undefined, "Auftrag duplizieren");
        var nachproduktion = dlg.add("button", undefined, "Nachproduktion");
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

        var zeileAuftrag = formular.add("group");
        zeileAuftrag.orientation = "row";
        var labelAuftrag = zeileAuftrag.add("statictext", undefined, "Auftragsnummer:");
        labelAuftrag.preferredSize.width = 160;
        var feldAuftrag = zeileAuftrag.add("edittext", undefined, "");
        feldAuftrag.characters = 30;

        var zeileKunde = formular.add("group");
        zeileKunde.orientation = "row";
        var labelKunde = zeileKunde.add("statictext", undefined, "Kunde:");
        labelKunde.preferredSize.width = 160;
        var feldKunde = zeileKunde.add("edittext", undefined, "");
        feldKunde.characters = 30;

        var zeileBezeichnung = formular.add("group");
        zeileBezeichnung.orientation = "row";
        var labelBezeichnung = zeileBezeichnung.add("statictext", undefined, "Bezeichnung:");
        labelBezeichnung.preferredSize.width = 160;
        var feldBezeichnung = zeileBezeichnung.add("edittext", undefined, "");
        feldBezeichnung.characters = 30;

        var zeileProduktionsdatum = formular.add("group");
        zeileProduktionsdatum.orientation = "row";
        var labelProduktionsdatum = zeileProduktionsdatum.add("statictext", undefined, "Produktionsdatum:");
        labelProduktionsdatum.preferredSize.width = 160;
        var feldProduktionsdatum = zeileProduktionsdatum.add("edittext", undefined, heutigesDatum());
        feldProduktionsdatum.characters = 30;

        var zeileVersanddatum = formular.add("group");
        zeileVersanddatum.orientation = "row";
        var labelVersanddatum = zeileVersanddatum.add("statictext", undefined, "Einlieferungs-/Versanddatum:");
        labelVersanddatum.preferredSize.width = 160;
        var feldVersanddatum = zeileVersanddatum.add("edittext", undefined, "");
        feldVersanddatum.characters = 30;

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zurück");
        var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () {
            alert("Auftragsnummer: " + feldAuftrag.text + "\nKunde: " + feldKunde.text + "\nBezeichnung: " + feldBezeichnung.text + "\nProduktionsdatum: " + feldProduktionsdatum.text + "\nEinlieferungs-/Versanddatum: " + feldVersanddatum.text);
        };
        dlg.center();
        var ergebnis = dlg.show();
        if (ergebnis == 1) { zeigeStartseite(); }
    }

    zeigeStartseite();
})();