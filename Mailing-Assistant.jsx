#target "InDesign"

(function () {

    function heutigesDatum() {
        var heute = new Date();
        var tag = heute.getDate();
        var monat = heute.getMonth() + 1;
        var jahr = heute.getFullYear();
        if (tag < 10) tag = "0" + tag;
        if (monat < 10) monat = "0" + monat;
        return tag + "." + monat + "." + jahr;
    }

    function trimText(text) {
        if (text === null || text === undefined) return "";
        return String(text).replace(/^\s+|\s+$/g, "");
    }

    function bereinigeSicherenText(text) {
        if (text === null || text === undefined) return "";
        var wert = String(text);
        wert = wert.replace(/\u00A0/g, " ");
        wert = wert.replace(/[\t\r\n]+/g, " ");
        wert = wert.replace(/ {2,}/g, " ");
        wert = wert.replace(/^\s+|\s+$/g, "");
        return wert;
    }

    function sichtbarerBereinigungstext(text) {
        if (text === null || text === undefined) return "[]";
        var wert = String(text);
        wert = wert.replace(/\u00A0/g, "\u00b7");
        wert = wert.replace(/\t/g, "[TAB]");
        wert = wert.replace(/\r\n/g, "[ZEILENUMBRUCH]");
        wert = wert.replace(/[\r\n]/g, "[ZEILENUMBRUCH]");
        wert = wert.replace(/ /g, "\u00b7");
        return "[" + wert + "]";
    }

    function sichereTextbereinigungAnwenden(csvDaten) {
        if (csvDaten.bereinigungsprotokoll) return csvDaten.bereinigungsprotokoll;
        var protokoll = [];
        var i;
        var j;
        var vorher;
        var nachher;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            for (j = 0; j < csvDaten.datensaetze[i].length; j++) {
                vorher = csvDaten.datensaetze[i][j];
                nachher = bereinigeSicherenText(vorher);
                if (String(vorher) != nachher) {
                    protokoll.push({datensatz: i + 1, spalte: j < csvDaten.spalten.length ? csvDaten.spalten[j] : "Spalte " + (j + 1), vorher: String(vorher), nachher: nachher});
                    csvDaten.datensaetze[i][j] = nachher;
                }
            }
        }
        csvDaten.bereinigungsprotokoll = protokoll;
        return protokoll;
    }

    function problematischeZeichenErkennen(csvDaten) {
        var fundstellen = [];
        var i;
        var j;
        var k;
        var wert;
        var code;
        var codeText;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            for (j = 0; j < csvDaten.datensaetze[i].length; j++) {
                wert = String(csvDaten.datensaetze[i][j]);
                for (k = 0; k < wert.length; k++) {
                    code = wert.charCodeAt(k);
                    if ((code >= 0 && code <= 8) || code == 11 || code == 12 || (code >= 14 && code <= 31) || code == 127 || code == 8203 || code == 8204 || code == 8205 || code == 8288 || code == 65279) {
                        codeText = code.toString(16).toUpperCase();
                        while (codeText.length < 4) codeText = "0" + codeText;
                        fundstellen.push({datensatz: i + 1, spalte: j < csvDaten.spalten.length ? csvDaten.spalten[j] : "Spalte " + (j + 1), zeichen: "U+" + codeText, wert: wert});
                    }
                }
            }
        }
        return fundstellen;
    }

    function mappingSpaltenindex(csvDaten, mapping, feld) {
        if (!mapping[feld] || mapping[feld] == "\u2014 nicht zugeordnet \u2014") return -1;
        var i;
        for (i = 0; i < csvDaten.spalten.length; i++) if (csvDaten.spalten[i] == mapping[feld]) return i;
        return -1;
    }

    function deutschePlzPruefen(csvDaten, mapping) {
        var fundstellen = [];
        var plzIndex = mappingSpaltenindex(csvDaten, mapping, "PLZ");
        var landIndex = mappingSpaltenindex(csvDaten, mapping, "Land");
        if (plzIndex < 0) return fundstellen;
        var i;
        var plz;
        var land;
        var landKlein;
        var istDeutschland;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            plz = plzIndex < csvDaten.datensaetze[i].length ? trimText(csvDaten.datensaetze[i][plzIndex]) : "";
            land = landIndex >= 0 && landIndex < csvDaten.datensaetze[i].length ? trimText(csvDaten.datensaetze[i][landIndex]) : "";
            landKlein = land.toLowerCase();
            istDeutschland = land == "" || landKlein == "deutschland" || landKlein == "de" || landKlein == "deu" || landKlein == "germany";
            if (istDeutschland && !/^\d{5}$/.test(plz)) {
                fundstellen.push({datensatz: i + 1, plz: plz, land: land, hinweis: "Deutsche PLZ muss aus genau 5 Ziffern bestehen."});
            }
        }
        return fundstellen;
    }

    function mappingWert(csvDaten, mapping, datensatz, feld) {
        var index = mappingSpaltenindex(csvDaten, mapping, feld);
        if (index < 0 || index >= datensatz.length) return "";
        return trimText(datensatz[index]);
    }

    function postalischePflichtfelderPruefen(csvDaten, mapping) {
        var fundstellen = [];
        var i;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            var datensatz = csvDaten.datensaetze[i];
            var firma = mappingWert(csvDaten, mapping, datensatz, "Firma");
            var vorname = mappingWert(csvDaten, mapping, datensatz, "Vorname");
            var nachname = mappingWert(csvDaten, mapping, datensatz, "Nachname");
            var strasse = mappingWert(csvDaten, mapping, datensatz, "Stra\u00dfe");
            var hausnummer = mappingWert(csvDaten, mapping, datensatz, "Hausnummer");
            var postfach = mappingWert(csvDaten, mapping, datensatz, "Postfach");
            var plz = mappingWert(csvDaten, mapping, datensatz, "PLZ");
            var ort = mappingWert(csvDaten, mapping, datensatz, "Ort");
            var hinweise = [];

            if (firma == "" && vorname == "" && nachname == "") hinweise.push("Empf\u00e4ngername/Firma fehlt.");
            if (postfach == "") {
                if (strasse == "") hinweise.push("Stra\u00dfe oder Postfach fehlt.");
                else if (hausnummer == "") hinweise.push("Hausnummer fehlt.");
            }
            if (plz == "") hinweise.push("PLZ fehlt.");
            if (ort == "") hinweise.push("Ort fehlt.");

            if (hinweise.length > 0) {
                fundstellen.push({
                    datensatz: i + 1,
                    empfaenger: verbindeTeile([firma, vorname, nachname]),
                    anschrift: postfach != "" ? "Postfach " + postfach : verbindeTeile([strasse, hausnummer]),
                    ort: verbindeTeile([plz, ort]),
                    hinweis: hinweise.join(" ")
                });
            }
        }
        return fundstellen;
    }

    function dublettenTextNormalisieren(text) {
        var wert = trimText(text).toLowerCase();
        wert = wert.replace(/\u00a0/g, " ");
        wert = wert.replace(/\s+/g, " ");
        return wert;
    }

    function eindeutigeDublettenPruefen(csvDaten, mapping) {
        var fundstellen = [];
        var gesehen = {};
        var i;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            var datensatz = csvDaten.datensaetze[i];
            var firma = mappingWert(csvDaten, mapping, datensatz, "Firma");
            var vorname = mappingWert(csvDaten, mapping, datensatz, "Vorname");
            var nachname = mappingWert(csvDaten, mapping, datensatz, "Nachname");
            var adresszusatz = mappingWert(csvDaten, mapping, datensatz, "Adresszusatz");
            var strasse = mappingWert(csvDaten, mapping, datensatz, "Stra\u00dfe");
            var hausnummer = mappingWert(csvDaten, mapping, datensatz, "Hausnummer");
            var postfach = mappingWert(csvDaten, mapping, datensatz, "Postfach");
            var plz = mappingWert(csvDaten, mapping, datensatz, "PLZ");
            var ort = mappingWert(csvDaten, mapping, datensatz, "Ort");
            var land = mappingWert(csvDaten, mapping, datensatz, "Land");

            var landNorm = dublettenTextNormalisieren(land);
            if (landNorm == "" || landNorm == "de" || landNorm == "deu" || landNorm == "germany") landNorm = "deutschland";

            var empfaenger = verbindeTeile([firma, vorname, nachname]);
            var anschrift = postfach != "" ? "Postfach " + postfach : verbindeTeile([strasse, hausnummer]);
            var schluesselTeile = [
                dublettenTextNormalisieren(firma),
                dublettenTextNormalisieren(vorname),
                dublettenTextNormalisieren(nachname),
                dublettenTextNormalisieren(adresszusatz),
                dublettenTextNormalisieren(postfach),
                dublettenTextNormalisieren(strasse),
                dublettenTextNormalisieren(hausnummer),
                dublettenTextNormalisieren(plz),
                dublettenTextNormalisieren(ort),
                landNorm
            ];

            var hatEmpfaenger = firma != "" || vorname != "" || nachname != "";
            var hatAnschrift = postfach != "" || strasse != "";
            var hatOrt = plz != "" || ort != "";
            if (!hatEmpfaenger || !hatAnschrift || !hatOrt) continue;

            var schluessel = schluesselTeile.join("|");
            if (gesehen[schluessel] !== undefined) {
                fundstellen.push({
                    datensatz: i + 1,
                    original: gesehen[schluessel] + 1,
                    empfaenger: empfaenger,
                    anschrift: anschrift,
                    ort: verbindeTeile([plz, ort])
                });
            } else {
                gesehen[schluessel] = i;
            }
        }
        return fundstellen;
    }

    function auffaelligeDatensaetzeSammeln(csvDaten, mapping, plzHinweise, postalHinweise, dublettenHinweise, problematischeZeichen) {
        var map = {};
        var i;
        function hinzufuegen(nr, grund) {
            if (!map[nr]) map[nr] = {datensatz:nr, gruende:[]};
            map[nr].gruende.push(grund);
        }
        for (i = 0; i < plzHinweise.length; i++) hinzufuegen(plzHinweise[i].datensatz, "PLZ: " + plzHinweise[i].hinweis);
        for (i = 0; i < postalHinweise.length; i++) hinzufuegen(postalHinweise[i].datensatz, postalHinweise[i].hinweis);
        for (i = 0; i < dublettenHinweise.length; i++) hinzufuegen(dublettenHinweise[i].datensatz, "Dublette von Datensatz " + dublettenHinweise[i].original + ".");
        for (i = 0; i < problematischeZeichen.length; i++) hinzufuegen(problematischeZeichen[i].datensatz, "Problematisches Zeichen " + problematischeZeichen[i].zeichen + " in " + problematischeZeichen[i].spalte + ".");
        var result = [];
        var key;
        for (key in map) if (map.hasOwnProperty(key)) result.push(map[key]);
        result.sort(function(a,b){ return a.datensatz - b.datensatz; });
        return result;
    }

    function zeigeProduktionsausgabeAuswahl(datei, csvDaten, mapping) {
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Produktionsausgabe");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        dlg.add("statictext", undefined, "Produktionsausgabe ausw\u00e4hlen");
        dlg.add("statictext", undefined, "Lege fest, wie die freigegebenen Mailingdaten weiterverarbeitet werden sollen.");

        var bereich = dlg.add("panel");
        bereich.orientation = "column";
        bereich.alignChildren = ["left", "top"];
        bereich.margins = 15;
        bereich.spacing = 10;

        var r1 = bereich.add("radiobutton", undefined, "InDesign \u2013 Adressdaten f\u00fcr Datenzusammenf\u00fchrung");
        var r2 = bereich.add("radiobutton", undefined, "CSV \u2013 bereinigte und freigegebene Datens\u00e4tze");
        var r3 = bereich.add("radiobutton", undefined, "XLSX \u2013 bereinigte und freigegebene Datens\u00e4tze");
        var r4 = bereich.add("radiobutton", undefined, "Nur Adressliste / Kontrollausgabe");
        r1.value = true;

        dlg.add("statictext", undefined, "In diesem Schritt wird noch keine Datei erzeugt. Wir legen nur die gew\u00fcnschte Ausgabe fest.");

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
        var weiter = buttons.add("button", undefined, "Weiter");

        zurueck.onClick = function(){ dlg.close(1); };
        weiter.onClick = function(){
            var ausgabe = r1.value ? "InDesign" : (r2.value ? "CSV" : (r3.value ? "XLSX" : "Adressliste"));
            csvDaten.produktionsausgabe = ausgabe;
            dlg.close(2);
        };

        dlg.center();
        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeMailingVerarbeitung(datei, csvDaten, mapping);
        } else if (ergebnis == 2) {
            alert("Produktionsausgabe gew\u00e4hlt: " + csvDaten.produktionsausgabe + "\n\nIm n\u00e4chsten Schritt bauen wir genau diese Ausgabe.");
        }
    }

    function zeigeMailingVerarbeitung(datei, csvDaten, mapping) {
        var freigegeben = csvDaten.freigegebeneDatensatznummern || [];
        var ausgeschlossen = csvDaten.ausgeschlosseneDatensatznummern || [];

        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Mailing-Verarbeitung");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        dlg.add("statictext", undefined, "Mailing-Verarbeitung");
        dlg.add("statictext", undefined, "Vorschau der freigegebenen Datens\u00e4tze. Ausgeschlossene Datens\u00e4tze sind hier bereits entfernt.");

        var info = dlg.add("panel");
        info.orientation = "column";
        info.alignChildren = ["left", "top"];
        info.margins = 15;
        info.spacing = 6;
        info.add("statictext", undefined, "Freigegebene Auflage: " + freigegeben.length);
        info.add("statictext", undefined, "Ausgeschlossen: " + ausgeschlossen.length);

        var bereich = dlg.add("panel");
        bereich.text = "Produktionsvorschau \u2013 erste 20 freigegebene Datens\u00e4tze";
        bereich.orientation = "column";
        bereich.alignChildren = ["fill", "top"];
        bereich.margins = 15;

        var liste = bereich.add("listbox", undefined, [], {
            numberOfColumns: 5,
            showHeaders: true,
            columnTitles: ["Datensatz", "Empf\u00e4nger", "Anschrift", "PLZ / Ort", "Land"],
            columnWidths: [70, 200, 220, 160, 120]
        });
        liste.preferredSize = [800, 320];

        var max = Math.min(20, freigegeben.length);
        var i;
        for (i = 0; i < max; i++) {
            var nr = freigegeben[i];
            var ds = csvDaten.datensaetze[nr - 1];
            var firma = mappingWert(csvDaten, mapping, ds, "Firma");
            var person = verbindeTeile([
                mappingWert(csvDaten, mapping, ds, "Anrede"),
                mappingWert(csvDaten, mapping, ds, "Titel"),
                mappingWert(csvDaten, mapping, ds, "Vorname"),
                mappingWert(csvDaten, mapping, ds, "Nachname")
            ]);
            var empfaenger = firma != "" ? (person != "" ? firma + " / " + person : firma) : person;
            if (empfaenger == "") empfaenger = "[ohne Empf\u00e4nger]";

            var postfach = mappingWert(csvDaten, mapping, ds, "Postfach");
            var anschrift = postfach != "" ? "Postfach " + postfach : verbindeTeile([
                mappingWert(csvDaten, mapping, ds, "Stra\u00dfe"),
                mappingWert(csvDaten, mapping, ds, "Hausnummer")
            ]);

            var plzOrt = verbindeTeile([
                mappingWert(csvDaten, mapping, ds, "PLZ"),
                mappingWert(csvDaten, mapping, ds, "Ort")
            ]);

            var land = mappingWert(csvDaten, mapping, ds, "Land");
            if (land == "") land = "Deutschland";

            var eintrag = liste.add("item", String(nr));
            eintrag.subItems[0].text = empfaenger;
            eintrag.subItems[1].text = anschrift;
            eintrag.subItems[2].text = plzOrt;
            eintrag.subItems[3].text = land;
        }

        dlg.add("statictext", undefined, max + " von " + freigegeben.length + " freigegebenen Datens\u00e4tzen werden angezeigt.");

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
        var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function(){ dlg.close(1); };
        weiter.onClick = function(){ dlg.close(2); };

        dlg.center();
        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeFinaleFreigabe(datei, csvDaten, mapping);
        } else if (ergebnis == 2) {
            zeigeProduktionsausgabeAuswahl(datei, csvDaten, mapping);
        }
    }

    function zeigeFinaleFreigabe(datei, csvDaten, mapping) {
        var status = csvDaten.freigabestatus || {};
        var freigegeben = [];
        var ausgeschlossen = [];
        var offen = [];
        var i;

        for (i = 1; i <= csvDaten.anzahl; i++) {
            var wert = status[i] || "\u00dcbernehmen";
            if (wert == "\u00dcbernehmen") freigegeben.push(i);
            else if (wert == "Ausschlie\u00dfen") ausgeschlossen.push(i);
            else offen.push(i);
        }

        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Finale Freigabe");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        dlg.add("statictext", undefined, "Finale Freigabe");

        var info = dlg.add("panel");
        info.orientation = "column";
        info.alignChildren = ["left", "top"];
        info.margins = 15;
        info.spacing = 6;
        info.add("statictext", undefined, "Gesamte Datens\u00e4tze: " + csvDaten.anzahl);
        info.add("statictext", undefined, "Freigegebene Auflage: " + freigegeben.length);
        info.add("statictext", undefined, "Ausgeschlossen: " + ausgeschlossen.length);
        info.add("statictext", undefined, "Noch offen: " + offen.length);

        if (ausgeschlossen.length > 0) {
            dlg.add("statictext", undefined, "Ausgeschlossene Datens\u00e4tze: " + ausgeschlossen.join(", "));
        }

        if (offen.length > 0) {
            dlg.add("statictext", undefined, "Offene Datens\u00e4tze: " + offen.join(", "));
            dlg.add("statictext", undefined, "Der Auftrag kann noch nicht final freigegeben werden.");
        } else {
            dlg.add("statictext", undefined, "Alle Datens\u00e4tze sind entschieden.");
            dlg.add("statictext", undefined, "Die freigegebene Auflage betr\u00e4gt " + freigegeben.length + ".");
        }

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
        var weiter = buttons.add("button", undefined, offen.length > 0 ? "Offene Datens\u00e4tze pr\u00fcfen" : "Weiter zur Mailing-Verarbeitung");

        zurueck.onClick = function(){ dlg.close(1); };
        weiter.onClick = function(){ dlg.close(offen.length > 0 ? 2 : 3); };

        dlg.center();
        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeFreigabeZusammenfassung(datei, csvDaten, mapping);
        } else if (ergebnis == 2) {
            zeigeDatensatzFreigabe(
                datei,
                csvDaten,
                mapping,
                deutschePlzPruefen(csvDaten, mapping),
                postalischePflichtfelderPruefen(csvDaten, mapping),
                eindeutigeDublettenPruefen(csvDaten, mapping),
                problematischeZeichenErkennen(csvDaten),
                true
            );
        } else if (ergebnis == 3) {
            csvDaten.freigegebeneDatensatznummern = freigegeben;
            csvDaten.ausgeschlosseneDatensatznummern = ausgeschlossen;
            zeigeMailingVerarbeitung(datei, csvDaten, mapping);
        }
    }

    function zeigeFreigabeZusammenfassung(datei, csvDaten, mapping) {
        var status = csvDaten.freigabestatus || {};
        var uebernehmen = 0;
        var ausschliessen = 0;
        var pruefen = 0;
        var offen = [];
        var i;

        for (i = 1; i <= csvDaten.anzahl; i++) {
            var wert = status[i] || "\u00dcbernehmen";
            if (wert == "\u00dcbernehmen") uebernehmen++;
            else if (wert == "Ausschlie\u00dfen") ausschliessen++;
            else {
                pruefen++;
                offen.push(i);
            }
        }

        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Freigabe\u00fcbersicht");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        dlg.add("statictext", undefined, "Freigabe\u00fcbersicht");

        var info = dlg.add("panel");
        info.orientation = "column";
        info.alignChildren = ["left", "top"];
        info.margins = 15;
        info.spacing = 6;
        info.add("statictext", undefined, "Gesamte Datens\u00e4tze: " + csvDaten.anzahl);
        info.add("statictext", undefined, "\u00dcbernehmen: " + uebernehmen);
        info.add("statictext", undefined, "Ausschlie\u00dfen: " + ausschliessen);
        info.add("statictext", undefined, "Pr\u00fcfen: " + pruefen);

        if (pruefen > 0) {
            dlg.add("statictext", undefined, "Noch offen: Datensatz " + offen.join(", "));
            dlg.add("statictext", undefined, "Der Mailing-Auftrag ist noch nicht vollst\u00e4ndig freigegeben.");
        } else {
            dlg.add("statictext", undefined, "Alle Datens\u00e4tze sind entschieden. Der Mailing-Auftrag kann weiterverarbeitet werden.");
        }

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
        var fertig = buttons.add("button", undefined, pruefen > 0 ? "Offene Datens\u00e4tze pr\u00fcfen" : "Fertig");

        zurueck.onClick = function () { dlg.close(1); };
        fertig.onClick = function () { dlg.close(pruefen > 0 ? 2 : 3); };

        dlg.center();
        var ergebnis = dlg.show();

        if (ergebnis == 1 || ergebnis == 2) {
            zeigeDatensatzFreigabe(
                datei,
                csvDaten,
                mapping,
                deutschePlzPruefen(csvDaten, mapping),
                postalischePflichtfelderPruefen(csvDaten, mapping),
                eindeutigeDublettenPruefen(csvDaten, mapping),
                problematischeZeichenErkennen(csvDaten),
                ergebnis == 2
            );
        } else if (ergebnis == 3) {
            zeigeFinaleFreigabe(datei, csvDaten, mapping);
        }
    }

    function mappingWertSetzen(csvDaten, mapping, datensatz, feld, wert) {
        var index = mappingSpaltenindex(csvDaten, mapping, feld);
        if (index < 0) return false;
        while (datensatz.length <= index) datensatz.push("");
        datensatz[index] = wert;
        return true;
    }

    function datensatzHatPruefhinweis(nr, plzHinweise, postalHinweise, dublettenHinweise, problematischeZeichen) {
        var i;
        for (i = 0; i < plzHinweise.length; i++) if (plzHinweise[i].datensatz == nr) return true;
        for (i = 0; i < postalHinweise.length; i++) if (postalHinweise[i].datensatz == nr) return true;
        for (i = 0; i < dublettenHinweise.length; i++) if (dublettenHinweise[i].datensatz == nr) return true;
        for (i = 0; i < problematischeZeichen.length; i++) if (problematischeZeichen[i].datensatz == nr) return true;
        return false;
    }

    function zeigeDatensatzBearbeiten(datei, csvDaten, mapping, nr, nurOffene) {
        var datensatz = csvDaten.datensaetze[nr - 1];
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Datensatz " + nr + " bearbeiten");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;

        dlg.add("statictext", undefined, "Datensatz " + nr + " bearbeiten");
        dlg.add("statictext", undefined, "Die Originaldatei bleibt unver\u00e4ndert. Ge\u00e4ndert wird nur die interne Arbeitskopie dieses Mailing-Auftrags.");

        var formular = dlg.add("panel"); formular.orientation = "column"; formular.alignChildren = ["fill", "top"]; formular.margins = 15; formular.spacing = 8;
        var felder = ["Firma", "Anrede", "Titel", "Vorname", "Nachname", "Adresszusatz", "Stra\u00dfe", "Hausnummer", "Postfach", "PLZ", "Ort", "Land"];
        var eingaben = [];
        var i;

        function fehlerhafteBearbeitungsfelder() {
            var fehler = {};
            var firma = mappingWert(csvDaten, mapping, datensatz, "Firma");
            var vorname = mappingWert(csvDaten, mapping, datensatz, "Vorname");
            var nachname = mappingWert(csvDaten, mapping, datensatz, "Nachname");
            var strasse = mappingWert(csvDaten, mapping, datensatz, "Stra\u00dfe");
            var hausnummer = mappingWert(csvDaten, mapping, datensatz, "Hausnummer");
            var postfach = mappingWert(csvDaten, mapping, datensatz, "Postfach");
            var plz = mappingWert(csvDaten, mapping, datensatz, "PLZ");
            var ort = mappingWert(csvDaten, mapping, datensatz, "Ort");
            var land = mappingWert(csvDaten, mapping, datensatz, "Land");
            var landKlein = land.toLowerCase();
            var istDeutschland = land == "" || landKlein == "deutschland" || landKlein == "de" || landKlein == "deu" || landKlein == "germany";

            if (firma == "" && vorname == "" && nachname == "") {
                fehler["Firma"] = "Empf\u00e4nger fehlt";
                fehler["Vorname"] = "Empf\u00e4nger fehlt";
                fehler["Nachname"] = "Empf\u00e4nger fehlt";
            }

            if (postfach == "") {
                if (strasse == "") {
                    fehler["Stra\u00dfe"] = "fehlt";
                    fehler["Postfach"] = "oder Stra\u00dfe";
                } else if (hausnummer == "") {
                    fehler["Hausnummer"] = "fehlt";
                }
            }

            if (plz == "") fehler["PLZ"] = "fehlt";
            else if (istDeutschland && !/^\d{5}$/.test(plz)) fehler["PLZ"] = "ung\u00fcltig";
            if (ort == "") fehler["Ort"] = "fehlt";

            return fehler;
        }

        var fehlerfelder = fehlerhafteBearbeitungsfelder();

        for (i = 0; i < felder.length; i++) {
            var feld = felder[i];
            var index = mappingSpaltenindex(csvDaten, mapping, feld);
            if (index < 0) continue;
            var zeile = formular.add("group"); zeile.orientation = "row";
            var label = zeile.add("statictext", undefined, feld + ":"); label.preferredSize.width = 130;
            var edit = zeile.add("edittext", undefined, mappingWert(csvDaten, mapping, datensatz, feld)); edit.characters = 34;

            if (fehlerfelder[feld]) {
                var hinweis = zeile.add("statictext", undefined, fehlerfelder[feld]);
                hinweis.preferredSize.width = 95;
                try {
                    var rotHinweis = hinweis.graphics.newPen(ScriptUIGraphics.PenType.SOLID_COLOR, [0.85, 0.2, 0.2], 1);
                    hinweis.graphics.foregroundColor = rotHinweis;
                } catch (e) {}
            } else {
                var platzhalter = zeile.add("statictext", undefined, "");
                platzhalter.preferredSize.width = 95;
            }

            eingaben.push({feld:feld, edit:edit});
        }

        if (eingaben.length == 0) dlg.add("statictext", undefined, "F\u00fcr diesen Datensatz sind keine bearbeitbaren Mailing-Felder zugeordnet.");

        var buttons = dlg.add("group"); buttons.alignment = "right";
        var abbrechen = buttons.add("button", undefined, "Abbrechen");
        var speichern = buttons.add("button", undefined, "Speichern");
        speichern.enabled = eingaben.length > 0;

        abbrechen.onClick = function(){ dlg.close(1); };
        speichern.onClick = function(){
            var j;
            for (j = 0; j < eingaben.length; j++) {
                mappingWertSetzen(csvDaten, mapping, datensatz, eingaben[j].feld, eingaben[j].edit.text);
            }

            var plzNeu = deutschePlzPruefen(csvDaten, mapping);
            var postalNeu = postalischePflichtfelderPruefen(csvDaten, mapping);
            var dublettenNeu = eindeutigeDublettenPruefen(csvDaten, mapping);
            var problemNeu = problematischeZeichenErkennen(csvDaten);

            if (!csvDaten.freigabestatus) csvDaten.freigabestatus = {};
            csvDaten.freigabestatus[nr] = datensatzHatPruefhinweis(nr, plzNeu, postalNeu, dublettenNeu, problemNeu) ? "Pr\u00fcfen" : "\u00dcbernehmen";

            dlg.close(2);

            if (csvDaten.freigabestatus[nr] == "\u00dcbernehmen") {
                alert("Datensatz " + nr + " wurde gespeichert und erneut gepr\u00fcft.\n\nEs sind keine Pr\u00fcfhinweise mehr offen. Der Datensatz wurde auf \u201e\u00dcbernehmen\u201c gesetzt.");
            } else {
                alert("Datensatz " + nr + " wurde gespeichert und erneut gepr\u00fcft.\n\nEs bestehen weiterhin Pr\u00fcfhinweise.");
            }

            zeigeDatensatzFreigabe(datei, csvDaten, mapping, plzNeu, postalNeu, dublettenNeu, problemNeu, nurOffene);
        };

        dlg.center();
        var ergebnis = dlg.show();

        if (ergebnis == 1) {
            zeigeDatensatzFreigabe(
                datei,
                csvDaten,
                mapping,
                deutschePlzPruefen(csvDaten, mapping),
                postalischePflichtfelderPruefen(csvDaten, mapping),
                eindeutigeDublettenPruefen(csvDaten, mapping),
                problematischeZeichenErkennen(csvDaten),
                nurOffene
            );
        }
    }

    function zeigeDatensatzFreigabe(datei, csvDaten, mapping, plzHinweise, postalHinweise, dublettenHinweise, problematischeZeichen, nurOffene) {
        var auffaellig = auffaelligeDatensaetzeSammeln(csvDaten, mapping, plzHinweise, postalHinweise, dublettenHinweise, problematischeZeichen);
        var vorhandenerStatus = csvDaten.freigabestatus || {};

        var sichtbar = [];
        var oi;
        for (oi = 0; oi < auffaellig.length; oi++) {
            var aktuellerStatus = vorhandenerStatus[auffaellig[oi].datensatz] || "Pr\u00fcfen";
            if (aktuellerStatus == "Ausschlie\u00dfen") continue;
            if (nurOffene && aktuellerStatus != "Pr\u00fcfen") continue;
            sichtbar.push(auffaellig[oi]);
        }
        auffaellig = sichtbar;
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Datensatzfreigabe");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Datensatzfreigabe");
        dlg.add("statictext", undefined, nurOffene ? "Hier werden nur noch offene Datens\u00e4tze angezeigt." : "Auff\u00e4llige Datens\u00e4tze werden nicht automatisch verworfen. Lege f\u00fcr jeden Datensatz fest, wie er behandelt werden soll.");

        var info = dlg.add("panel"); info.orientation = "column"; info.alignChildren = ["left", "top"]; info.margins = 15; info.spacing = 6;
        info.add("statictext", undefined, "Gesamte Datens\u00e4tze: " + csvDaten.anzahl);
        info.add("statictext", undefined, (nurOffene ? "Offene Datens\u00e4tze: " : "Auff\u00e4llige Datens\u00e4tze: ") + auffaellig.length);
        info.add("statictext", undefined, "Unauff\u00e4llige Datens\u00e4tze werden automatisch als \u201e\u00dcbernehmen\u201c behandelt.");

        var auswahl = [];
        if (auffaellig.length > 0) {
            var kopf = dlg.add("group"); kopf.orientation = "row";
            var k1 = kopf.add("statictext", undefined, "Datensatz"); k1.preferredSize.width = 70;
            var k2 = kopf.add("statictext", undefined, "Empf\u00e4nger"); k2.preferredSize.width = 180;
            var k3 = kopf.add("statictext", undefined, "Pr\u00fcfgrund"); k3.preferredSize.width = 420;
            var k4 = kopf.add("statictext", undefined, "Status"); k4.preferredSize.width = 120;
            kopf.add("statictext", undefined, "Aktion");

            var panel = dlg.add("panel"); panel.orientation = "column"; panel.alignChildren = ["fill", "top"]; panel.margins = 12; panel.spacing = 5;
            var i;
            for (i = 0; i < auffaellig.length; i++) {
                var nr = auffaellig[i].datensatz;
                var ds = csvDaten.datensaetze[nr - 1];
                var empfaenger = verbindeTeile([
                    mappingWert(csvDaten, mapping, ds, "Firma"),
                    mappingWert(csvDaten, mapping, ds, "Vorname"),
                    mappingWert(csvDaten, mapping, ds, "Nachname")
                ]);
                if (empfaenger == "") empfaenger = "[ohne Empf\u00e4nger]";
                var row = panel.add("group"); row.orientation = "row"; row.alignChildren = ["left", "center"];
                var nrt = row.add("statictext", undefined, String(nr)); nrt.preferredSize.width = 70;
                var et = row.add("statictext", undefined, empfaenger); et.preferredSize.width = 180;
                var gt = row.add("statictext", undefined, auffaellig[i].gruende.join(" ")); gt.preferredSize.width = 420;
                var dd = row.add("dropdownlist", undefined, ["Pr\u00fcfen", "\u00dcbernehmen", "Ausschlie\u00dfen"]); dd.preferredSize.width = 120;
                var bestehend = vorhandenerStatus[nr] || "Pr\u00fcfen";
                dd.selection = bestehend == "\u00dcbernehmen" ? 1 : (bestehend == "Ausschlie\u00dfen" ? 2 : 0);
                var bearbeiten = row.add("button", undefined, "Bearbeiten"); bearbeiten.preferredSize.width = 90;
                bearbeiten.datensatzNummer = nr;
                bearbeiten.onClick = function(){
                    var ziel = this.datensatzNummer;
                    var status = {};
                    var si;
                    var sk;

                    if (csvDaten.freigabestatus) {
                        for (sk in csvDaten.freigabestatus) {
                            if (csvDaten.freigabestatus.hasOwnProperty(sk)) status[sk] = csvDaten.freigabestatus[sk];
                        }
                    } else {
                        for (si = 0; si < csvDaten.anzahl; si++) status[si + 1] = "\u00dcbernehmen";
                    }

                    for (si = 0; si < auswahl.length; si++) {
                        status[auswahl[si].datensatz] = auswahl[si].dropdown.selection ? auswahl[si].dropdown.selection.text : "Pr\u00fcfen";
                    }

                    csvDaten.freigabestatus = status;
                    dlg.close(3);
                    zeigeDatensatzBearbeiten(datei, csvDaten, mapping, ziel, nurOffene);
                };
                auswahl.push({datensatz:nr, dropdown:dd});
            }
        } else {
            dlg.add("statictext", undefined, "Keine auff\u00e4lligen Datens\u00e4tze vorhanden.");
        }

        var buttons = dlg.add("group"); buttons.alignment = "right";
        var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
        var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function(){ dlg.close(1); };
        weiter.onClick = function(){
            var status = {};
            var i;
            var k0;
            if (csvDaten.freigabestatus) {
                for (k0 in csvDaten.freigabestatus) if (csvDaten.freigabestatus.hasOwnProperty(k0)) status[k0] = csvDaten.freigabestatus[k0];
            } else {
                for (i = 0; i < csvDaten.anzahl; i++) status[i + 1] = "\u00dcbernehmen";
            }
            for (i = 0; i < auswahl.length; i++) status[auswahl[i].datensatz] = auswahl[i].dropdown.selection ? auswahl[i].dropdown.selection.text : "Pr\u00fcfen";
            csvDaten.freigabestatus = status;
            dlg.close(2);
            var uebernehmen = 0, ausschliessen = 0, pruefen = 0, k;
            for (k in status) if (status.hasOwnProperty(k)) {
                if (status[k] == "\u00dcbernehmen") uebernehmen++;
                else if (status[k] == "Ausschlie\u00dfen") ausschliessen++;
                else pruefen++;
            }
            alert("Freigabestatus gespeichert.\n\n\u00dcbernehmen: " + uebernehmen + "\nAusschlie\u00dfen: " + ausschliessen + "\nPr\u00fcfen: " + pruefen);
            zeigeFreigabeZusammenfassung(datei, csvDaten, mapping);
        };
        dlg.center();
        var ergebnis = dlg.show();
        if (ergebnis == 1) zeigeDatenbereinigung(datei, csvDaten, mapping);
    }

    function verbindeTeile(teile) {
        var ergebnis = [];
        var i;
        for (i = 0; i < teile.length; i++) {
            var wert = trimText(teile[i]);
            if (wert != "") ergebnis.push(wert);
        }
        return ergebnis.join(" ");
    }


    function vbScriptText(path) { return String(path).replace(/"/g, '""'); }
    function temporareDateiPfad(prefix) { return Folder.temp.fsName + "/" + prefix + "_" + (new Date().getTime()) + ".txt"; }

    function xlsxTabellenblaetterLesen(datei) {
        var ausgabe=temporareDateiPfad("mailing_assistant_sheets"), vb="On Error Resume Next\r\n";
        vb+="Dim xl, wb, ws, stm\r\nSet xl=CreateObject(\"Excel.Application\")\r\nxl.Visible=False\r\n";
        vb+="Set wb=xl.Workbooks.Open(\"" + vbScriptText(datei.fsName) + "\",False,True)\r\nIf Err.Number<>0 Then WScript.Quit 1\r\n";
        vb+="Set stm=CreateObject(\"ADODB.Stream\")\r\nstm.Type=2\r\nstm.Charset=\"utf-8\"\r\nstm.Open\r\n";
        vb+="For Each ws In wb.Worksheets\r\n stm.WriteText ws.Name & vbCrLf\r\nNext\r\n";
        vb+="stm.SaveToFile \"" + vbScriptText(ausgabe) + "\",2\r\nstm.Close\r\nwb.Close False\r\nxl.Quit\r\n";
        app.doScript(vb,ScriptLanguage.VISUAL_BASIC);
        var f=File(ausgabe);if(!f.exists)throw new Error("Die Excel-Datei konnte nicht ge\u00f6ffnet werden. Ist Microsoft Excel installiert?");
        f.encoding="UTF-8";if(!f.open("r"))throw new Error("Die Tabellenbl\u00e4tter konnten nicht gelesen werden.");var t=f.read();f.close();try{f.remove();}catch(e){}
        var a=t.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n"),r=[],i;for(i=0;i<a.length;i++)if(a[i]!="")r.push(a[i]);
        if(!r.length)throw new Error("Die Excel-Datei enth\u00e4lt keine Tabellenbl\u00e4tter.");return r;
    }

    function xlsxZellwertDekodieren(text) {
        var w=text===null||text===undefined?"":String(text);
        if (w.indexOf("~")==0) {
            var hex=w.substring(1), ergebnis="", i, code;
            for(i=0;i+4<=hex.length;i+=4){code=parseInt(hex.substring(i,i+4),16);if(!isNaN(code))ergebnis+=String.fromCharCode(code);}
            return ergebnis;
        }
        return w.replace(/%7C/g,"|").replace(/%09/g,"\t").replace(/%0A/g,"\n").replace(/%0D/g,"\r").replace(/%25/g,"%");
    }

    function xlsxDatenLesen(datei,blatt) {
        var fortschritt = new Window("palette", "Mailing-Assistant \u2013 Daten werden eingelesen");
        fortschritt.orientation = "column";
        fortschritt.alignChildren = ["fill", "top"];
        fortschritt.spacing = 10;
        fortschritt.margins = 18;

        var statusText = fortschritt.add("statictext", undefined, "Excel-Datei wird ge\u00f6ffnet und vorbereitet ...");
        statusText.preferredSize.width = 430;

        var balken = fortschritt.add("progressbar", undefined, 0, 100);
        balken.preferredSize = [430, 18];
        balken.value = 2;

        var detail = fortschritt.add("statictext", undefined, "Bitte warten ...");
        detail.preferredSize.width = 430;

        fortschritt.center();
        fortschritt.show();
        try { fortschritt.update(); } catch (e0) {}

        var ausgabe = temporareDateiPfad("mailing_assistant_xlsx");
        var vb = "On Error Resume Next\r\n";
        vb += "Dim xl,wb,ws,stm,ur,firstRow,firstCol,lastRow,lastCol,r,col,v\r\nSet xl=CreateObject(\"Excel.Application\")\r\nxl.Visible=False\r\n";
        vb += "Set wb=xl.Workbooks.Open(\"" + vbScriptText(datei.fsName) + "\",False,True)\r\nIf Err.Number<>0 Then WScript.Quit 1\r\n";
        vb += "Set ws=wb.Worksheets(\"" + vbScriptText(blatt) + "\")\r\nSet ur=ws.UsedRange\r\nfirstRow=ur.Row:firstCol=ur.Column:lastRow=firstRow+ur.Rows.Count-1:lastCol=firstCol+ur.Columns.Count-1\r\n";
        vb += "ws.UsedRange.Columns.AutoFit\r\nSet stm=CreateObject(\"ADODB.Stream\")\r\nstm.Type=2\r\nstm.Charset=\"utf-8\"\r\nstm.Open\r\n";
        vb += "For r=firstRow To lastRow\r\n For col=firstCol To lastCol\r\n v=ws.Cells(r,col).Text\r\n";
        vb += " Dim n, ch, hx\r\n stm.WriteText \"~\"\r\n For n=1 To Len(v)\r\n  ch=AscW(Mid(v,n,1)):If ch<0 Then ch=ch+65536\r\n  hx=Hex(ch):hx=String(4-Len(hx),\"0\") & hx:stm.WriteText hx\r\n Next\r\n";
        vb += " If col<lastCol Then stm.WriteText \"|\"\r\n Next\r\n stm.WriteText vbCrLf\r\nNext\r\n";
        vb += "stm.SaveToFile \"" + vbScriptText(ausgabe) + "\",2\r\nstm.Close\r\nwb.Close False\r\nxl.Quit\r\n";

        try {
            app.doScript(vb, ScriptLanguage.VISUAL_BASIC);

            balken.value = 10;
            statusText.text = "Excel-Daten wurden vorbereitet. Datens\u00e4tze werden eingelesen ...";
            detail.text = "Fortschritt wird ermittelt ...";
            try { fortschritt.update(); } catch (e1) {}

            var f = File(ausgabe);
            if (!f.exists) throw new Error("Das Excel-Tabellenblatt konnte nicht gelesen werden.");
            f.encoding = "UTF-8";
            if (!f.open("r")) throw new Error("Die Excel-Daten konnten nicht gelesen werden.");
            var t = f.read();
            f.close();
            try { f.remove(); } catch (e2) {}

            var z = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
            var m = [];
            var i;
            var j;
            var q;
            var gesamt = 0;

            for (i = 0; i < z.length; i++) if (z[i] != "") gesamt++;
            if (gesamt < 1) gesamt = 1;

            var verarbeitet = 0;
            var startZeit = new Date().getTime();
            var letzteAktualisierung = -1;

            for (i = 0; i < z.length; i++) {
                if (z[i] == "") continue;

                q = z[i].split("|");
                for (j = 0; j < q.length; j++) q[j] = xlsxZellwertDekodieren(q[j]);
                m.push(q);
                verarbeitet++;

                var prozent = Math.round((verarbeitet / gesamt) * 100);
                if (prozent != letzteAktualisierung || verarbeitet == gesamt) {
                    letzteAktualisierung = prozent;
                    balken.value = 10 + Math.round(prozent * 0.9);
                    statusText.text = "Datens\u00e4tze eingelesen: " + verarbeitet + " von " + gesamt + " (" + prozent + " %)";

                    var vergangenMs = new Date().getTime() - startZeit;
                    var restText = "";
                    if (verarbeitet > 0 && vergangenMs > 300) {
                        var msProDatensatz = vergangenMs / verarbeitet;
                        var restSekunden = Math.round(((gesamt - verarbeitet) * msProDatensatz) / 1000);
                        if (restSekunden < 60) restText = "Gesch\u00e4tzte Restzeit: ca. " + restSekunden + " Sek.";
                        else restText = "Gesch\u00e4tzte Restzeit: ca. " + Math.ceil(restSekunden / 60) + " Min.";
                    } else {
                        restText = "Gesch\u00e4tzte Restzeit wird berechnet ...";
                    }
                    detail.text = restText;
                    try { fortschritt.update(); } catch (e3) {}
                }
            }

            if (!m.length) throw new Error("Das Excel-Tabellenblatt enth\u00e4lt keine Daten.");

            var first = -1;
            for (i = 0; i < m.length; i++) {
                for (j = 0; j < m[i].length; j++) {
                    if (trimText(m[i][j]) != "") {
                        first = i;
                        break;
                    }
                }
                if (first >= 0) break;
            }

            if (first < 0) throw new Error("Das Excel-Tabellenblatt enth\u00e4lt keine bef\u00fcllten Zellen.");
            if (first > 0) m = m.slice(first);

            balken.value = 100;
            statusText.text = "Einlesen abgeschlossen: " + m.length + " Zeilen verarbeitet.";
            detail.text = "100 %";
            try { fortschritt.update(); } catch (e4) {}
            $.sleep(250);
            fortschritt.close();

            return {rohzeilen:m};
        } catch (fehler) {
            try { fortschritt.close(); } catch (e5) {}
            throw fehler;
        }
    }

    function xlsxZeileIstWahrscheinlichUeberschrift(zeile){
        var bekannte=["anrede","titel","vorname","nachname","firma","stra\u00dfe","strasse","hausnummer","plz","ort","land","adresszusatz","e-mail","email","telefon","kundennummer","selektionsmerkmal","sonstiges"],treffer=0,i,j,w;
        for(i=0;i<zeile.length;i++){w=trimText(zeile[i]).toLowerCase();for(j=0;j<bekannte.length;j++){if(bekannte[j]===w){treffer++;break;}}}
        return treffer>=1;
    }
    function xlsxDatenInStruktur(roh,hat){var m=roh.rohzeilen,max=0,i,j;for(i=0;i<m.length;i++)if(m[i].length>max)max=m[i].length;var s=[],d=[];if(hat){for(j=0;j<max;j++)s.push(trimText(m[0][j]||"")||"Spalte "+(j+1));i=1;}else{for(j=0;j<max;j++)s.push("Spalte "+(j+1));i=0;}for(;i<m.length;i++){var z=m[i].slice(0);while(z.length<max)z.push("");if(!istCsvZeileLeer(z))d.push(z);}return{spalten:s,datensaetze:d,anzahl:d.length,trennzeichen:"|",xlsx:true};}

    function csvDateiLesen(datei) {
        if (!datei || !datei.exists) throw new Error("Die ausgew\u00e4hlte CSV-Datei wurde nicht gefunden.");
        datei.encoding = "UTF-8";
        if (!datei.open("r")) throw new Error("Die CSV-Datei konnte nicht ge\u00f6ffnet werden.");
        var inhalt = datei.read();
        datei.close();
        if (inhalt.length > 0 && inhalt.charCodeAt(0) == 65279) inhalt = inhalt.substring(1);
        if (trimText(inhalt) == "") throw new Error("Die CSV-Datei ist leer.");
        var ersteZeile = "";
        var inAnfuehrungszeichen = false;
        var i;
        var zeichen;
        for (i = 0; i < inhalt.length; i++) {
            zeichen = inhalt.charAt(i);
            if (zeichen == '"') {
                if (inAnfuehrungszeichen && i + 1 < inhalt.length && inhalt.charAt(i + 1) == '"') { ersteZeile += '""'; i++; continue; }
                inAnfuehrungszeichen = !inAnfuehrungszeichen;
                ersteZeile += zeichen; continue;
            }
            if (!inAnfuehrungszeichen && (zeichen == "\r" || zeichen == "\n")) break;
            ersteZeile += zeichen;
        }
        var anzahlSemikolon = zaehleTrennzeichen(ersteZeile, ";");
        var anzahlKomma = zaehleTrennzeichen(ersteZeile, ",");
        var anzahlTab = zaehleTrennzeichen(ersteZeile, "\t");
        var trennzeichen = ";";
        if (anzahlKomma > anzahlSemikolon && anzahlKomma >= anzahlTab) trennzeichen = ",";
        if (anzahlTab > anzahlSemikolon && anzahlTab > anzahlKomma) trennzeichen = "\t";
        var zeilen = [];
        var aktuelleZeile = [];
        var aktuellesFeld = "";
        inAnfuehrungszeichen = false;
        for (i = 0; i < inhalt.length; i++) {
            zeichen = inhalt.charAt(i);
            if (zeichen == '"') {
                if (inAnfuehrungszeichen && i + 1 < inhalt.length && inhalt.charAt(i + 1) == '"') { aktuellesFeld += '"'; i++; continue; }
                inAnfuehrungszeichen = !inAnfuehrungszeichen; continue;
            }
            if (!inAnfuehrungszeichen && zeichen == trennzeichen) { aktuelleZeile.push(aktuellesFeld); aktuellesFeld = ""; continue; }
            if (!inAnfuehrungszeichen && (zeichen == "\r" || zeichen == "\n")) {
                aktuelleZeile.push(aktuellesFeld); aktuellesFeld = "";
                if (!istCsvZeileLeer(aktuelleZeile)) zeilen.push(aktuelleZeile);
                aktuelleZeile = [];
                if (zeichen == "\r" && i + 1 < inhalt.length && inhalt.charAt(i + 1) == "\n") i++;
                continue;
            }
            aktuellesFeld += zeichen;
        }
        if (aktuellesFeld != "" || aktuelleZeile.length > 0) {
            aktuelleZeile.push(aktuellesFeld);
            if (!istCsvZeileLeer(aktuelleZeile)) zeilen.push(aktuelleZeile);
        }
        if (zeilen.length == 0) throw new Error("Die CSV-Datei enth\u00e4lt keine Daten.");
        var spalten = zeilen[0];
        var datensaetze = [];
        for (i = 1; i < zeilen.length; i++) if (!istCsvZeileLeer(zeilen[i])) datensaetze.push(zeilen[i]);
        return {spalten: spalten, datensaetze: datensaetze, anzahl: datensaetze.length, trennzeichen: trennzeichen};
    }

    function zaehleTrennzeichen(text, trennzeichen) {
        var anzahl = 0;
        var inAnfuehrungszeichen = false;
        var i;
        var zeichen;
        for (i = 0; i < text.length; i++) {
            zeichen = text.charAt(i);
            if (zeichen == '"') {
                if (inAnfuehrungszeichen && i + 1 < text.length && text.charAt(i + 1) == '"') { i++; continue; }
                inAnfuehrungszeichen = !inAnfuehrungszeichen; continue;
            }
            if (!inAnfuehrungszeichen && zeichen == trennzeichen) anzahl++;
        }
        return anzahl;
    }

    function istCsvZeileLeer(zeile) {
        var i;
        for (i = 0; i < zeile.length; i++) if (trimText(zeile[i]) != "") return false;
        return true;
    }

    function zeigeStartseite() {
        var dlg = new Window("dialog", "Mailing-Assistant");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Mailing-Assistant");
        var neuerAuftrag = dlg.add("button", undefined, "Neuer Mailing-Auftrag");
        dlg.add("button", undefined, "Gespeicherten Auftrag \u00f6ffnen");
        dlg.add("button", undefined, "Auftrag duplizieren");
        dlg.add("button", undefined, "Nachproduktion");
        var trennlinie = dlg.add("panel"); trennlinie.alignment = "fill";
        dlg.add("statictext", undefined, "Zuletzt verwendet");
        var zuletztListe = dlg.add("listbox", undefined, [], {multiselect: false}); zuletztListe.preferredSize = [520, 160]; zuletztListe.add("item", "Noch keine Mailing-Auftr\u00e4ge vorhanden");
        var buttons = dlg.add("group"); buttons.alignment = "right";
        var schliessen = buttons.add("button", undefined, "Schlie\u00dfen"); schliessen.onClick = function () { dlg.close(0); }; neuerAuftrag.onClick = function () { dlg.close(1); };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeNeuenAuftrag();
    }

    function zeigeNeuenAuftrag() {
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Neuer Auftrag");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Neuer Mailing-Auftrag");
        var formular = dlg.add("panel"); formular.orientation = "column"; formular.alignChildren = ["fill", "top"]; formular.margins = 15; formular.spacing = 10;
        function formularZeile(labelText, standardText) { var zeile = formular.add("group"); zeile.orientation = "row"; var label = zeile.add("statictext", undefined, labelText); label.preferredSize.width = 160; var feld = zeile.add("edittext", undefined, standardText || ""); feld.characters = 30; return feld; }
        var feldAuftrag = formularZeile("Auftragsnummer:", "");
        var feldKunde = formularZeile("Kunde:", "");
        var feldBezeichnung = formularZeile("Bezeichnung:", "");
        var feldProduktionsdatum = formularZeile("Produktionsdatum:", heutigesDatum());
        var feldVersanddatum = formularZeile("Versanddatum:", "");
        var zeileVersandart = formular.add("group"); zeileVersandart.orientation = "row";
        var labelVersandart = zeileVersandart.add("statictext", undefined, "Versandart:"); labelVersandart.preferredSize.width = 160;
        var feldVersandart = zeileVersandart.add("dropdownlist", undefined, ["Dialogpost", "Briefpost", "Sonstiges"]); feldVersandart.preferredSize.width = 308; feldVersandart.selection = 0;
        var zeileSonstiges = formular.add("group"); zeileSonstiges.orientation = "row"; zeileSonstiges.visible = false;
        var labelSonstiges = zeileSonstiges.add("statictext", undefined, "Sonstiges:"); labelSonstiges.preferredSize.width = 160;
        var feldSonstiges = zeileSonstiges.add("edittext", undefined, ""); feldSonstiges.characters = 30;
        feldVersandart.onChange = function () { zeileSonstiges.visible = !!(feldVersandart.selection && feldVersandart.selection.text == "Sonstiges"); dlg.layout.layout(true); };
        var feldSollAuflage = formularZeile("Soll-Auflage (optional):", "");
        var zeileSollHinweis = formular.add("group"); zeileSollHinweis.orientation = "row"; var abstandSollHinweis = zeileSollHinweis.add("statictext", undefined, ""); abstandSollHinweis.preferredSize.width = 160;
        zeileSollHinweis.add("statictext", undefined, "Leer lassen = Auflage wird automatisch aus den freigegebenen Datens\u00e4tzen ermittelt.");
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () { if (feldSollAuflage.text != "" && (!/^\d+$/.test(feldSollAuflage.text) || parseInt(feldSollAuflage.text, 10) <= 0)) { alert("Bitte bei der Soll-Auflage eine ganze positive Zahl eingeben."); feldSollAuflage.active = true; return; } dlg.close(2); };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeStartseite(); if (ergebnis == 2) zeigeDatenquelle();
    }

    function zeigeDatenquelle() {
        var dlg=new Window("dialog","Mailing-Assistant \u2013 Datenquelle");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.spacing=12;dlg.margins=20;
        dlg.add("statictext",undefined,"Datenquelle");var bereich=dlg.add("panel");bereich.orientation="column";bereich.alignChildren=["fill","top"];bereich.margins=15;bereich.spacing=10;
        bereich.add("statictext",undefined,"Excel- oder CSV-Datei f\u00fcr diesen Mailing-Auftrag ausw\u00e4hlen.");
        var dateizeile=bereich.add("group");dateizeile.orientation="row";dateizeile.alignChildren=["fill","center"];var dateifeld=dateizeile.add("edittext",undefined,"");dateifeld.characters=42;dateifeld.enabled=false;var dateiAuswaehlen=dateizeile.add("button",undefined,"Datei ausw\u00e4hlen...");
        var buttons=dlg.add("group");buttons.alignment="right";var zurueck=buttons.add("button",undefined,"Zur\u00fcck");var weiter=buttons.add("button",undefined,"Weiter");weiter.enabled=false;var ausgewaehlteDatei=null;
        dateiAuswaehlen.onClick=function(){var datei=File.openDialog("Mailing-Datendatei ausw\u00e4hlen","Mailing-Dateien:*.xlsx;*.csv");if(datei){ausgewaehlteDatei=datei;dateifeld.text=datei.fsName;weiter.enabled=true;}};
        zurueck.onClick=function(){dlg.close(1);};
        weiter.onClick=function(){if(!ausgewaehlteDatei)return;try{if(/\.xlsx$/i.test(ausgewaehlteDatei.name)){var blaetter=xlsxTabellenblaetterLesen(ausgewaehlteDatei);dlg.close(2);if(blaetter.length==1){var roh=xlsxDatenLesen(ausgewaehlteDatei,blaetter[0]);zeigeXlsxUeberschriftenentscheidung(ausgewaehlteDatei,blaetter[0],roh);}else zeigeXlsxBlattauswahl(ausgewaehlteDatei,blaetter);}else{var csvDaten=csvDateiLesen(ausgewaehlteDatei);dlg.close(2);zeigeCsvVorschau(ausgewaehlteDatei,csvDaten);}}catch(e){alert("Die Datei konnte nicht gelesen werden.\n\nFehler: "+e);}};
        dlg.center();var ergebnis=dlg.show();if(ergebnis==1)zeigeNeuenAuftrag();
    }

    function zeigeXlsxBlattauswahl(datei,blaetter){
        var dlg=new Window("dialog","Mailing-Assistant \u2013 Excel-Tabellenblatt");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.spacing=12;dlg.margins=20;
        dlg.add("statictext",undefined,"Excel-Tabellenblatt ausw\u00e4hlen");
        dlg.add("statictext",undefined,"Diese Datei enth\u00e4lt mehrere Tabellenbl\u00e4tter. Bitte w\u00e4hle das Blatt mit den Mailingdaten.");
        var liste=dlg.add("listbox",undefined,[],{multiselect:false});liste.preferredSize=[420,180];
        var i;for(i=0;i<blaetter.length;i++)liste.add("item",blaetter[i]);if(blaetter.length)liste.selection=0;
        var buttons=dlg.add("group");buttons.alignment="right";var zurueck=buttons.add("button",undefined,"Zur\u00fcck");var weiter=buttons.add("button",undefined,"Weiter");
        zurueck.onClick=function(){dlg.close(1);};
        weiter.onClick=function(){if(!liste.selection){alert("Bitte ein Tabellenblatt ausw\u00e4hlen.");return;}var sheet=liste.selection.text;dlg.close(2);try{var roh=xlsxDatenLesen(datei,sheet);zeigeXlsxUeberschriftenentscheidung(datei,sheet,roh);}catch(e){alert("Das Tabellenblatt konnte nicht gelesen werden.\n\nFehler: "+e);}};
        dlg.center();var ergebnis=dlg.show();if(ergebnis==1)zeigeDatenquelle();
    }

    function zeigeXlsxUeberschriftenentscheidung(datei,blatt,roh){
        var wahrscheinlich=xlsxZeileIstWahrscheinlichUeberschrift(roh.rohzeilen[0]);
        var dlg=new Window("dialog","Mailing-Assistant \u2013 Excel-Spalten");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.spacing=12;dlg.margins=20;
        dlg.add("statictext",undefined,"Excel-Daten erkannt");dlg.add("statictext",undefined,"Tabellenblatt: "+blatt);
        dlg.add("statictext",undefined,wahrscheinlich?"Die erste Zeile sieht nach Spalten\u00fcberschriften aus.":"Es konnten keine eindeutigen Spalten\u00fcberschriften erkannt werden.");
        dlg.add("statictext",undefined,"Bitte entscheiden \u2013 der Mailing-Assistant r\u00e4t nicht automatisch.");
        var gruppe=dlg.add("group");gruppe.orientation="column";gruppe.alignChildren=["left","top"];
        var mit=gruppe.add("radiobutton",undefined,"Erste Zeile enth\u00e4lt Spalten\u00fcberschriften");var ohne=gruppe.add("radiobutton",undefined,"Keine Spalten\u00fcberschriften vorhanden");
        if(wahrscheinlich)mit.value=true;else ohne.value=true;
        var buttons=dlg.add("group");buttons.alignment="right";var zurueck=buttons.add("button",undefined,"Zur\u00fcck");var weiter=buttons.add("button",undefined,"Weiter");
        zurueck.onClick=function(){dlg.close(1);};
        weiter.onClick=function(){var daten=xlsxDatenInStruktur(roh,mit.value);dlg.close(2);zeigeCsvVorschau(datei,daten);};
        dlg.center();var ergebnis=dlg.show();if(ergebnis==1){var blaetter=xlsxTabellenblaetterLesen(datei);if(blaetter.length==1)zeigeDatenquelle();else zeigeXlsxBlattauswahl(datei,blaetter);}
    }

    function zeigeCsvVorschau(datei, csvDaten) {
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Datenvorschau");
        dlg.orientation = "column";     function zeigeXlsxBlattauswahl(datei,blaetter){
        var dlg=new Window("dialog","Mailing-Assistant \u2013 Excel-Tabellenblatt");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.spacing=12;dlg.margins=20;
        dlg.add("statictext",undefined,"Excel-Tabellenblatt ausw\u00e4hlen");dlg.add("statictext",undefined,"Diese Datei enth\u00e4lt mehrere Tabellenbl\u00e4tter. Bitte w\u00e4hle das Blatt mit den Mailingdaten.");
        var liste=dlg.add("listbox",undefined,[],{multiselect:false});liste.preferredSize=[420,180];var i;for(i=0;i<blaetter.length;i++)liste.add("item",blaetter[i]);if(blaetter.length)liste.selection=0;
        var buttons=dlg.add("group");buttons.alignment="right";var zurueck=buttons.add("button",undefined,"Zur\u00fcck");var weiter=buttons.add("button",undefined,"Weiter");
        zurueck.onClick=function(){dlg.close(1);};weiter.onClick=function(){if(!liste.selection){alert("Bitte ein Tabellenblatt ausw\u00e4hlen.");return;}var sheet=liste.selection.text;dlg.close(2);try{var roh=xlsxDatenLesen(datei,sheet);zeigeXlsxUeberschriftenentscheidung(datei,sheet,roh);}catch(e){alert("Das Tabellenblatt konnte nicht gelesen werden.\n\nFehler: "+e);}};
        dlg.center();var ergebnis=dlg.show();if(ergebnis==1)zeigeDatenquelle();
    }
    function zeigeXlsxUeberschriftenentscheidung(datei,blatt,roh){
        var wahrscheinlich=xlsxZeileIstWahrscheinlichUeberschrift(roh.rohzeilen[0]),dlg=new Window("dialog","Mailing-Assistant \u2013 Excel-Spalten");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.spacing=12;dlg.margins=20;
        dlg.add("statictext",undefined,"Excel-Daten erkannt");dlg.add("statictext",undefined,"Tabellenblatt: "+blatt);dlg.add("statictext",undefined,wahrscheinlich?"Die erste Zeile sieht nach Spalten\u00fcberschriften aus.":"Es konnten keine eindeutigen Spalten\u00fcberschriften erkannt werden.");dlg.add("statictext",undefined,"Bitte entscheiden \u2013 der Mailing-Assistant r\u00e4t nicht automatisch.");
        var gruppe=dlg.add("group");gruppe.orientation="column";gruppe.alignChildren=["left","top"];var mit=gruppe.add("radiobutton",undefined,"Erste Zeile enth\u00e4lt Spalten\u00fcberschriften");var ohne=gruppe.add("radiobutton",undefined,"Keine Spalten\u00fcberschriften vorhanden");if(wahrscheinlich)mit.value=true;else ohne.value=true;
        var buttons=dlg.add("group");buttons.alignment="right";var zurueck=buttons.add("button",undefined,"Zur\u00fcck");var weiter=buttons.add("button",undefined,"Weiter");zurueck.onClick=function(){dlg.close(1);};weiter.onClick=function(){var daten=xlsxDatenInStruktur(roh,mit.value);dlg.close(2);zeigeCsvVorschau(datei,daten);};
        dlg.center();var ergebnis=dlg.show();if(ergebnis==1){var blaetter=xlsxTabellenblaetterLesen(datei);if(blaetter.length==1)zeigeDatenquelle();else zeigeXlsxBlattauswahl(datei,blaetter);}
    }

dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "CSV-Daten erfolgreich eingelesen");
        var info = dlg.add("panel"); info.orientation = "column"; info.alignChildren = ["left", "top"]; info.margins = 15; info.spacing = 6;
        info.add("statictext", undefined, "Datei: " + datei.name); info.add("statictext", undefined, "Datens\u00e4tze: " + csvDaten.anzahl); info.add("statictext", undefined, "Spalten: " + csvDaten.spalten.length);
        var vorschauBereich = dlg.add("panel"); vorschauBereich.text = "Vorschau \u2013 erste 10 Datens\u00e4tze"; vorschauBereich.orientation = "column"; vorschauBereich.alignChildren = ["fill", "top"]; vorschauBereich.margins = 15;
        var spaltenbreiten = []; var i; for (i = 0; i < csvDaten.spalten.length; i++) spaltenbreiten.push(120);
        var liste = vorschauBereich.add("listbox", undefined, [], {numberOfColumns: csvDaten.spalten.length, showHeaders: true, columnTitles: csvDaten.spalten, columnWidths: spaltenbreiten}); liste.preferredSize = [760, 260];
        var maximaleVorschau = Math.min(10, csvDaten.datensaetze.length); var zeile; var eintrag; var spalte; var wert;
        for (i = 0; i < maximaleVorschau; i++) { zeile = csvDaten.datensaetze[i]; wert = zeile.length > 0 ? zeile[0] : ""; eintrag = liste.add("item", wert); for (spalte = 1; spalte < csvDaten.spalten.length; spalte++) { wert = spalte < zeile.length ? zeile[spalte] : ""; eintrag.subItems[spalte - 1].text = wert; } }
        dlg.add("statictext", undefined, maximaleVorschau + " von " + csvDaten.anzahl + " Datens\u00e4tzen werden angezeigt.");
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var weiter = buttons.add("button", undefined, "Weiter");
        weiter.onClick = function () { dlg.close(2); }; zurueck.onClick = function () { dlg.close(1); };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeDatenquelle(); if (ergebnis == 2) zeigeSpaltenzuordnung(datei, csvDaten);
    }

    function zeigeSpaltenzuordnung(datei, csvDaten) {
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Spaltenzuordnung");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Spaltenzuordnung");
        dlg.add("statictext", undefined, "Ordne jeder Kundenspalte ein Mailing-Feld zu. Nicht ben\u00f6tigte Spalten bleiben auf \u201eNicht verwenden\u201c.");

        var interneFelder = ["Anrede", "Titel", "Vorname", "Nachname", "Firma", "Stra\u00dfe", "Hausnummer", "Postfach", "PLZ", "Ort", "Land", "Adresszusatz", "E-Mail", "Telefon", "Kundennummer", "Selektionsmerkmal", "Sonstiges"];
        var auswahlFelder = ["Nicht verwenden"];
        var i; var j;
        for (i = 0; i < interneFelder.length; i++) auswahlFelder.push(interneFelder[i]);

        function normalisiereSpaltenname(text) {
            var wert = trimText(text).toLowerCase();
            wert = wert.replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe").replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss");
            return wert.replace(/[^a-z0-9]/g, "");
        }

        function vorgeschlagenesFeld(spaltenname) {
            var name = normalisiereSpaltenname(spaltenname);
            var aliases = {
                "anrede":"Anrede", "salutation":"Anrede",
                "titel":"Titel", "title":"Titel",
                "vorname":"Vorname", "firstname":"Vorname", "first":"Vorname",
                "nachname":"Nachname", "lastname":"Nachname", "surname":"Nachname", "familienname":"Nachname",
                "firma":"Firma", "firmenname":"Firma", "unternehmen":"Firma", "company":"Firma",
                "strasse":"Stra\u00dfe", "street":"Stra\u00dfe", "streetname":"Stra\u00dfe",
                "hausnummer":"Hausnummer", "hausnr":"Hausnummer", "hnr":"Hausnummer", "streetnumber":"Hausnummer",
                "postfach":"Postfach", "postbox":"Postfach", "pobox":"Postfach",
                "plz":"PLZ", "postleitzahl":"PLZ", "zipcode":"PLZ", "zip":"PLZ", "postalcode":"PLZ",
                "ort":"Ort", "stadt":"Ort", "city":"Ort",
                "land":"Land", "country":"Land",
                "adresszusatz":"Adresszusatz", "adresszusatz1":"Adresszusatz", "zusatz":"Adresszusatz", "address2":"Adresszusatz",
                "email":"E-Mail", "emailadresse":"E-Mail", "mail":"E-Mail",
                "telefon":"Telefon", "telefonnummer":"Telefon", "phone":"Telefon", "tel":"Telefon",
                "kundennummer":"Kundennummer", "kundennr":"Kundennummer", "kundenummer":"Kundennummer", "customerid":"Kundennummer",
                "selektionsmerkmal":"Selektionsmerkmal", "selektion":"Selektionsmerkmal",
                "sonstiges":"Sonstiges"
            };
            return aliases[name] || null;
        }

        var kopf = dlg.add("group"); kopf.orientation = "row";
        var kopfQuelle = kopf.add("statictext", undefined, "Kundenspalte"); kopfQuelle.preferredSize.width = 260;
        kopf.add("statictext", undefined, "Mailing-Feld");

        var bereich = dlg.add("panel"); bereich.orientation = "column"; bereich.alignChildren = ["fill", "top"]; bereich.margins = 15; bereich.spacing = 6;
        var zuordnungen = [];
        var verwendet = {};

        for (i = 0; i < csvDaten.spalten.length; i++) {
            var zeile = bereich.add("group"); zeile.orientation = "row"; zeile.alignChildren = ["center", "center"];
            var label = zeile.add("statictext", undefined, csvDaten.spalten[i]); label.preferredSize.width = 260;
            var auswahl = zeile.add("dropdownlist", undefined, auswahlFelder); auswahl.preferredSize.width = 220; auswahl.selection = 0;

            var vorschlag = vorgeschlagenesFeld(csvDaten.spalten[i]);
            if (vorschlag && !verwendet[vorschlag]) {
                for (j = 1; j < auswahlFelder.length; j++) {
                    if (auswahlFelder[j] == vorschlag) {
                        auswahl.selection = j;
                        verwendet[vorschlag] = true;
                        break;
                    }
                }
            }
            zuordnungen.push(auswahl);
        }

        function pruefeDoppelteZuordnung(geaendert) {
            if (!geaendert.selection || geaendert.selection.index == 0) return;
            var feld = geaendert.selection.text;
            var k;
            for (k = 0; k < zuordnungen.length; k++) {
                if (zuordnungen[k] != geaendert && zuordnungen[k].selection && zuordnungen[k].selection.text == feld) {
                    alert("Das Mailing-Feld \u201e" + feld + "\u201c ist bereits der Kundenspalte \u201e" + csvDaten.spalten[k] + "\u201c zugeordnet.\n\nJedes Mailing-Feld kann nur einmal verwendet werden.");
                    geaendert.selection = 0;
                    return;
                }
            }
        }

        for (i = 0; i < zuordnungen.length; i++) {
            zuordnungen[i].onChange = function () { pruefeDoppelteZuordnung(this); };
        }

        dlg.add("statictext", undefined, "Vorschl\u00e4ge werden nur anhand eindeutiger Spaltennamen vorbelegt. Du kannst jede Zuordnung \u00e4ndern.");
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () {
            var mapping = {}; var k;
            for (k = 0; k < interneFelder.length; k++) mapping[interneFelder[k]] = "\u2014 nicht zugeordnet \u2014";
            for (k = 0; k < zuordnungen.length; k++) {
                if (zuordnungen[k].selection && zuordnungen[k].selection.index > 0) mapping[zuordnungen[k].selection.text] = csvDaten.spalten[k];
            }
            dlg.close(2);
            zeigeAdressvorschau(datei, csvDaten, mapping);
        };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeCsvVorschau(datei, csvDaten);
    }

    function zeigeAdressvorschau(datei, csvDaten, mapping) {
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Adressvorschau");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Postalische Adressvorschau");
        dlg.add("statictext", undefined, "W\u00e4hle links einen Datensatz aus. Rechts siehst du die zusammengesetzte postalische Anschrift.");
        function wertAusDatensatz(datensatz, feld) { if (!mapping[feld] || mapping[feld] == "\u2014 nicht zugeordnet \u2014") return ""; var s; for (s = 0; s < csvDaten.spalten.length; s++) { if (csvDaten.spalten[s] == mapping[feld]) return s < datensatz.length ? trimText(datensatz[s]) : ""; } return ""; }
        function postalischeAdresse(datensatz) {
            var zeilen = [];
            var firma = wertAusDatensatz(datensatz, "Firma");
            var person = verbindeTeile([wertAusDatensatz(datensatz, "Anrede"), wertAusDatensatz(datensatz, "Titel"), wertAusDatensatz(datensatz, "Vorname"), wertAusDatensatz(datensatz, "Nachname")]);
            var adresszusatz = wertAusDatensatz(datensatz, "Adresszusatz");
            var strasse = verbindeTeile([wertAusDatensatz(datensatz, "Stra\u00dfe"), wertAusDatensatz(datensatz, "Hausnummer")]);
            var postfach = wertAusDatensatz(datensatz, "Postfach");
            var ort = verbindeTeile([wertAusDatensatz(datensatz, "PLZ"), wertAusDatensatz(datensatz, "Ort")]);
            var land = wertAusDatensatz(datensatz, "Land");
            if (firma != "") zeilen.push(firma); if (person != "") zeilen.push(person); if (adresszusatz != "") zeilen.push(adresszusatz); if (postfach != "") zeilen.push("Postfach " + postfach); else if (strasse != "") zeilen.push(strasse); if (ort != "") zeilen.push(ort);
            var landKlein = land.toLowerCase(); if (land != "" && landKlein != "deutschland" && landKlein != "de" && landKlein != "germany" && landKlein != "deu") zeilen.push(land);
            return zeilen.join("\r");
        }
        var maximaleVorschau = Math.min(10, csvDaten.datensaetze.length);
        var bereich = dlg.add("panel"); bereich.text = "Erste 10 postalische Anschriften"; bereich.orientation = "row"; bereich.alignChildren = ["fill", "fill"]; bereich.margins = 15; bereich.spacing = 12;
        var liste = bereich.add("listbox", undefined, [], {multiselect: false}); liste.preferredSize = [250, 300];
        var vorschau = bereich.add("edittext", undefined, "", {multiline: true, scrolling: true, readonly: true}); vorschau.preferredSize = [360, 300];
        var i;
        for (i = 0; i < maximaleVorschau; i++) { var datensatz = csvDaten.datensaetze[i]; var name = verbindeTeile([wertAusDatensatz(datensatz, "Vorname"), wertAusDatensatz(datensatz, "Nachname")]); var firma = wertAusDatensatz(datensatz, "Firma"); var kennung = name != "" ? name : firma; if (kennung == "") kennung = "Datensatz " + (i + 1); liste.add("item", (i + 1) + ".  " + kennung); }
        function aktualisiereVorschau() { if (!liste.selection) { vorschau.text = ""; return; } var index = liste.selection.index; vorschau.text = postalischeAdresse(csvDaten.datensaetze[index]); }
        liste.onChange = aktualisiereVorschau; if (maximaleVorschau > 0) { liste.selection = 0; aktualisiereVorschau(); } else vorschau.text = "Keine Datens\u00e4tze vorhanden.";
        dlg.add("statictext", undefined, maximaleVorschau + " von " + csvDaten.anzahl + " Datens\u00e4tzen stehen zur Vorschau bereit.");
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var fertig = buttons.add("button", undefined, "Fertig");
        zurueck.onClick = function () { dlg.close(1); }; fertig.onClick = function () { dlg.close(2); };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeSpaltenzuordnung(datei, csvDaten); if (ergebnis == 2) zeigeDatenbereinigung(datei, csvDaten, mapping);
    }

    function zeigeDatenbereinigung(datei, csvDaten, mapping) {
        var protokoll = sichereTextbereinigungAnwenden(csvDaten);
        var problematischeZeichen = problematischeZeichenErkennen(csvDaten);
        var plzHinweise = deutschePlzPruefen(csvDaten, mapping);
        var postalHinweise = postalischePflichtfelderPruefen(csvDaten, mapping);
        var dublettenHinweise = eindeutigeDublettenPruefen(csvDaten, mapping);
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Datenbereinigung");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Sichere Textbereinigung");
        dlg.add("statictext", undefined, "Bereinigt werden nur eindeutige Formatierungsfehler: Rand-Leerzeichen, Mehrfach-Leerzeichen, Tabs und Zeilenumbr\u00fcche.");
        var info = dlg.add("panel"); info.orientation = "column"; info.alignChildren = ["left", "top"]; info.margins = 15; info.spacing = 6;
        info.add("statictext", undefined, "Automatisch bereinigte Felder: " + protokoll.length);
        info.add("statictext", undefined, "Problematische/versteckte Zeichen erkannt: " + problematischeZeichen.length);
        info.add("statictext", undefined, "PLZ-Pr\u00fcfhinweise: " + plzHinweise.length);
        info.add("statictext", undefined, "Postalische Pflichtfeld-Hinweise: " + postalHinweise.length);
        info.add("statictext", undefined, "Eindeutige Dubletten-Hinweise: " + dublettenHinweise.length);
        info.add("statictext", undefined, "Die Quelldatei bleibt unver\u00e4ndert. Die Korrekturen gelten nur intern f\u00fcr diesen Mailing-Auftrag.");
        if (protokoll.length > 0) {
            var bereich = dlg.add("panel"); bereich.text = "Bereinigungsprotokoll \u2013 erste 20 \u00c4nderungen"; bereich.orientation = "column"; bereich.alignChildren = ["fill", "top"]; bereich.margins = 15;
            var liste = bereich.add("listbox", undefined, [], {numberOfColumns: 4, showHeaders: true, columnTitles: ["Datensatz", "Spalte", "Vorher", "Nachher"], columnWidths: [70, 140, 220, 220]}); liste.preferredSize = [680, 260];
            var maximaleVorschau = Math.min(20, protokoll.length); var i; var eintrag;
            for (i = 0; i < maximaleVorschau; i++) { eintrag = liste.add("item", String(protokoll[i].datensatz)); eintrag.subItems[0].text = protokoll[i].spalte; eintrag.subItems[1].text = sichtbarerBereinigungstext(protokoll[i].vorher); eintrag.subItems[2].text = sichtbarerBereinigungstext(protokoll[i].nachher); }
            if (protokoll.length > maximaleVorschau) dlg.add("statictext", undefined, maximaleVorschau + " von " + protokoll.length + " \u00c4nderungen werden angezeigt.");
        } else dlg.add("statictext", undefined, "Keine sicheren Textbereinigungen erforderlich.");
        if (problematischeZeichen.length > 0) {
            var pruefbereich = dlg.add("panel"); pruefbereich.text = "Pr\u00fcfhinweise \u2013 problematische/versteckte Zeichen"; pruefbereich.orientation = "column"; pruefbereich.alignChildren = ["fill", "top"]; pruefbereich.margins = 15;
            var pruefliste = pruefbereich.add("listbox", undefined, [], {numberOfColumns: 4, showHeaders: true, columnTitles: ["Datensatz", "Spalte", "Zeichen", "Feldinhalt"], columnWidths: [70, 140, 90, 300]}); pruefliste.preferredSize = [640, 160];
            var maximalePruefung = Math.min(20, problematischeZeichen.length); var p; var fund;
            for (p = 0; p < maximalePruefung; p++) { fund = pruefliste.add("item", String(problematischeZeichen[p].datensatz)); fund.subItems[0].text = problematischeZeichen[p].spalte; fund.subItems[1].text = problematischeZeichen[p].zeichen; fund.subItems[2].text = problematischeZeichen[p].wert; }
            if (problematischeZeichen.length > maximalePruefung) dlg.add("statictext", undefined, maximalePruefung + " von " + problematischeZeichen.length + " Pr\u00fcfhinweisen werden angezeigt.");
            dlg.add("statictext", undefined, "Diese Zeichen werden nicht automatisch ver\u00e4ndert oder entfernt.");
        } else dlg.add("statictext", undefined, "Keine problematischen oder versteckten Steuerzeichen erkannt.");
        if (plzHinweise.length > 0) {
            var plzBereich = dlg.add("panel"); plzBereich.text = "Pr\u00fcfhinweise \u2013 deutsche PLZ"; plzBereich.orientation = "column"; plzBereich.alignChildren = ["fill", "top"]; plzBereich.margins = 15;
            var plzListe = plzBereich.add("listbox", undefined, [], {numberOfColumns: 4, showHeaders: true, columnTitles: ["Datensatz", "PLZ", "Land", "Hinweis"], columnWidths: [70, 90, 110, 320]}); plzListe.preferredSize = [620, 160];
            var maximalePlzPruefung = Math.min(20, plzHinweise.length); var z; var plzEintrag;
            for (z = 0; z < maximalePlzPruefung; z++) { plzEintrag = plzListe.add("item", String(plzHinweise[z].datensatz)); plzEintrag.subItems[0].text = plzHinweise[z].plz == "" ? "[leer]" : plzHinweise[z].plz; plzEintrag.subItems[1].text = plzHinweise[z].land == "" ? "[leer = DE]" : plzHinweise[z].land; plzEintrag.subItems[2].text = plzHinweise[z].hinweis; }
            if (plzHinweise.length > maximalePlzPruefung) dlg.add("statictext", undefined, maximalePlzPruefung + " von " + plzHinweise.length + " PLZ-Pr\u00fcfhinweisen werden angezeigt.");
            dlg.add("statictext", undefined, "PLZ-Werte werden nicht automatisch erg\u00e4nzt oder ver\u00e4ndert.");
        } else dlg.add("statictext", undefined, "Keine ung\u00fcltigen deutschen PLZ erkannt.");
        if (postalHinweise.length > 0) {
            var postalBereich = dlg.add("panel"); postalBereich.text = "Pr\u00fcfhinweise \u2013 postalische Pflichtfelder"; postalBereich.orientation = "column"; postalBereich.alignChildren = ["fill", "top"]; postalBereich.margins = 15;
            var postalListe = postalBereich.add("listbox", undefined, [], {numberOfColumns: 5, showHeaders: true, columnTitles: ["Datensatz", "Empf\u00e4nger", "Anschrift", "PLZ / Ort", "Hinweis"], columnWidths: [70, 150, 170, 130, 300]}); postalListe.preferredSize = [850, 180];
            var maximalePostalPruefung = Math.min(20, postalHinweise.length); var ph; var postalEintrag;
            for (ph = 0; ph < maximalePostalPruefung; ph++) {
                postalEintrag = postalListe.add("item", String(postalHinweise[ph].datensatz));
                postalEintrag.subItems[0].text = postalHinweise[ph].empfaenger == "" ? "[leer]" : postalHinweise[ph].empfaenger;
                postalEintrag.subItems[1].text = postalHinweise[ph].anschrift == "" ? "[leer]" : postalHinweise[ph].anschrift;
                postalEintrag.subItems[2].text = postalHinweise[ph].ort == "" ? "[leer]" : postalHinweise[ph].ort;
                postalEintrag.subItems[3].text = postalHinweise[ph].hinweis;
            }
            if (postalHinweise.length > maximalePostalPruefung) dlg.add("statictext", undefined, maximalePostalPruefung + " von " + postalHinweise.length + " postalischen Pr\u00fcfhinweisen werden angezeigt.");
            dlg.add("statictext", undefined, "Diese Datens\u00e4tze werden nur markiert; es erfolgt keine automatische Korrektur.");
        } else dlg.add("statictext", undefined, "Keine fehlenden postalischen Pflichtfelder erkannt.");

        if (dublettenHinweise.length > 0) {
            var dublettenBereich = dlg.add("panel"); dublettenBereich.text = "Pr\u00fcfhinweise \u2013 eindeutige Dubletten"; dublettenBereich.orientation = "column"; dublettenBereich.alignChildren = ["fill", "top"]; dublettenBereich.margins = 15;
            var dublettenListe = dublettenBereich.add("listbox", undefined, [], {numberOfColumns: 5, showHeaders: true, columnTitles: ["Datensatz", "Dublette von", "Empf\u00e4nger", "Anschrift", "PLZ / Ort"], columnWidths: [70, 90, 180, 190, 150]}); dublettenListe.preferredSize = [760, 180];
            var maximaleDubletten = Math.min(20, dublettenHinweise.length); var dh; var dublettenEintrag;
            for (dh = 0; dh < maximaleDubletten; dh++) {
                dublettenEintrag = dublettenListe.add("item", String(dublettenHinweise[dh].datensatz));
                dublettenEintrag.subItems[0].text = String(dublettenHinweise[dh].original);
                dublettenEintrag.subItems[1].text = dublettenHinweise[dh].empfaenger;
                dublettenEintrag.subItems[2].text = dublettenHinweise[dh].anschrift;
                dublettenEintrag.subItems[3].text = dublettenHinweise[dh].ort;
            }
            if (dublettenHinweise.length > maximaleDubletten) dlg.add("statictext", undefined, maximaleDubletten + " von " + dublettenHinweise.length + " Dubletten-Hinweisen werden angezeigt.");
            dlg.add("statictext", undefined, "Dubletten werden nur markiert. Es wird kein Datensatz automatisch entfernt oder zusammengef\u00fchrt.");
        } else dlg.add("statictext", undefined, "Keine eindeutigen postalischen Dubletten erkannt.");

        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var fertig = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); }; fertig.onClick = function () { dlg.close(2); };
        dlg.center(); var ergebnis = dlg.show();
        if (ergebnis == 1) zeigeAdressvorschau(datei, csvDaten, mapping);
        if (ergebnis == 2) zeigeDatensatzFreigabe(datei, csvDaten, mapping, plzHinweise, postalHinweise, dublettenHinweise, problematischeZeichen);
    }

    zeigeStartseite();

})();