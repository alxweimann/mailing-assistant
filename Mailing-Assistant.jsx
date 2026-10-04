#target "InDesign"

(function () {

    var aktuellerAuftrag = {
        auftragsnummer: "",
        kunde: "",
        bezeichnung: "",
        produktionsdatum: "",
        versanddatum: "",
        versandart: "",
        sollAuflage: ""
    };

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
        var i;
        for (i = 0; i < csvDaten.datensaetze.length; i++) {
            var datensatz = csvDaten.datensaetze[i];
            var plz = mappingWert(csvDaten, mapping, datensatz, "PLZ");
            var ort = mappingWert(csvDaten, mapping, datensatz, "Ort");
            var land = mappingWert(csvDaten, mapping, datensatz, "Land");
            var analyse = plzOrtAnalysieren(plz, ort, land);

            if (analyse.ungueltigeDePlz) {
                fundstellen.push({
                    datensatz: i + 1,
                    plz: analyse.plz,
                    land: land,
                    hinweis: "Deutsche PLZ muss aus genau 5 Ziffern bestehen."
                });
            }
        }
        return fundstellen;
    }

    function mappingWert(csvDaten, mapping, datensatz, feld) {
        var index = mappingSpaltenindex(csvDaten, mapping, feld);
        if (index < 0 || index >= datensatz.length) return "";
        return trimText(datensatz[index]);
    }

    function strassenHausnummerAnalysieren(strasse, hausnummer) {
        strasse = trimText(strasse);
        hausnummer = trimText(hausnummer);

        var ergebnis = {
            zeile: "",
            erkannteHausnummer: "",
            hausnummerVorhanden: false,
            konflikt: false,
            hinweis: ""
        };

        if (strasse == "") {
            ergebnis.zeile = hausnummer;
            ergebnis.hausnummerVorhanden = hausnummer != "";
            return ergebnis;
        }

        // Typische Hausnummern am Ende einer bereits kompletten Straßenzeile:
        // 12, 12a, 12 a, 10-12, 10–12, 12/1
        var treffer = strasse.match(/(?:^|\s)(\d+\s*[A-Za-z]?(?:\s*(?:-|\u2013|\/)\s*\d+\s*[A-Za-z]?)?)$/);
        if (treffer) ergebnis.erkannteHausnummer = trimText(treffer[1]);

        function vergleichswert(wert) {
            return trimText(wert).toLowerCase()
                .replace(/\s+/g, "")
                .replace(/\u2013/g, "-");
        }

        if (ergebnis.erkannteHausnummer != "") {
            ergebnis.hausnummerVorhanden = true;
            ergebnis.zeile = strasse;

            if (hausnummer != "" &&
                vergleichswert(ergebnis.erkannteHausnummer) != vergleichswert(hausnummer)) {
                ergebnis.konflikt = true;
                var ue = String.fromCharCode(252);
                var ss = String.fromCharCode(223);
                var ae = String.fromCharCode(228);
                ergebnis.hinweis = "Hausnummer widerspr" + ue + "chlich: Stra" + ss + "e enth" + ae + "lt " +
                    ergebnis.erkannteHausnummer + ", separates Feld enth" + ae + "lt " + hausnummer + ".";
            }
            return ergebnis;
        }

        ergebnis.hausnummerVorhanden = hausnummer != "";
        ergebnis.zeile = verbindeTeile([strasse, hausnummer]);
        return ergebnis;
    }

    function postfachZeileNormalisieren(postfach) {
        var wert = trimText(postfach);
        if (wert == "") return "";

        // Bereits vorhandene Bezeichnungen wie "Postfach" oder "PF"/"PF."
        // werden entfernt und einheitlich wieder vorangestellt.
        wert = wert.replace(/^\s*(?:postfach|pf\.?)(?:\s+|$)/i, "");
        wert = trimText(wert);

        return wert == "" ? "Postfach" : "Postfach " + wert;
    }

    function plzOrtAnalysieren(plz, ort, land) {
        plz = trimText(plz);
        ort = trimText(ort);
        land = trimText(land);

        var landKlein = land.toLowerCase();
        var istDeutschland = land == "" || landKlein == "deutschland" || landKlein == "de" || landKlein == "deu" || landKlein == "germany";

        var ergebnis = {
            plz: "",
            ort: "",
            zeile: "",
            plzVorhanden: false,
            ortVorhanden: false,
            ungueltigeDePlz: false,
            konflikt: false,
            hinweis: ""
        };

        function norm(text) {
            return trimText(text).toLowerCase().replace(/\s+/g, " ");
        }

        function zerlegeKombiniert(text) {
            text = trimText(text);
            var m = text.match(/^(\d{4,6})\s+(.+)$/);
            return m ? {plz: trimText(m[1]), ort: trimText(m[2])} : null;
        }

        var plzKombi = zerlegeKombiniert(plz);
        var ortKombi = zerlegeKombiniert(ort);

        var plzCode = plzKombi ? plzKombi.plz : plz;
        var ortAusPlz = plzKombi ? plzKombi.ort : "";

        var ortCode = ortKombi ? ortKombi.plz : "";
        var ortName = ortKombi ? ortKombi.ort : ort;

        if (plzCode != "" && ortCode != "" && norm(plzCode) != norm(ortCode)) {
            ergebnis.konflikt = true;
            ergebnis.hinweis = "PLZ widerspr\u00fcchlich: PLZ-Feld enth\u00e4lt " + plzCode +
                ", Ort-Feld enth\u00e4lt " + ortCode + ".";
        }

        if (ortAusPlz != "" && ortName != "" && norm(ortAusPlz) != norm(ortName)) {
            ergebnis.konflikt = true;
            if (ergebnis.hinweis != "") ergebnis.hinweis += " ";
            ergebnis.hinweis += "Ort widerspr\u00fcchlich: PLZ-Feld enth\u00e4lt " + ortAusPlz +
                ", Ort-Feld enth\u00e4lt " + ortName + ".";
        }

        ergebnis.plz = plzCode != "" ? plzCode : ortCode;
        ergebnis.ort = ortName != "" ? ortName : ortAusPlz;
        ergebnis.plzVorhanden = ergebnis.plz != "";
        ergebnis.ortVorhanden = ergebnis.ort != "";
        ergebnis.ungueltigeDePlz = istDeutschland && ergebnis.plzVorhanden && !/^\d{5}$/.test(ergebnis.plz);
        ergebnis.zeile = verbindeTeile([ergebnis.plz, ergebnis.ort]);

        return ergebnis;
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
            var land = mappingWert(csvDaten, mapping, datensatz, "Land");
            var hinweise = [];
            var strassenAnalyse = strassenHausnummerAnalysieren(strasse, hausnummer);
            var plzOrtAnalyse = plzOrtAnalysieren(plz, ort, land);

            if (firma == "" && vorname == "" && nachname == "") hinweise.push("Empf\u00e4ngername/Firma fehlt.");
            if (postfach == "") {
                if (strasse == "") hinweise.push("Stra\u00dfe oder Postfach fehlt.");
                else if (!strassenAnalyse.hausnummerVorhanden) hinweise.push("Hausnummer fehlt.");
                if (strassenAnalyse.konflikt) hinweise.push(strassenAnalyse.hinweis);
            }
            if (!plzOrtAnalyse.plzVorhanden) hinweise.push("PLZ fehlt.");
            if (!plzOrtAnalyse.ortVorhanden) hinweise.push("Ort fehlt.");
            if (plzOrtAnalyse.konflikt) hinweise.push(plzOrtAnalyse.hinweis);

            if (hinweise.length > 0) {
                fundstellen.push({
                    datensatz: i + 1,
                    empfaenger: verbindeTeile([firma, vorname, nachname]),
                    anschrift: postfach != "" ? postfachZeileNormalisieren(postfach) : strassenAnalyse.zeile,
                    ort: plzOrtAnalyse.zeile,
                    hinweis: hinweise.join(" ")
                });
            }
        }
        return fundstellen;
    }

    function dublettenTextNormalisieren(text) {
        var wert = trimText(text).toLowerCase();
        wert = wert.replace(/\u00a0/g, " ");
        wert = wert.replace(/\u00e4/g, "ae");
        wert = wert.replace(/\u00f6/g, "oe");
        wert = wert.replace(/\u00fc/g, "ue");
        wert = wert.replace(/\u00df/g, "ss");
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
            var strassenAnalyse = strassenHausnummerAnalysieren(strasse, hausnummer);
            var anschrift = postfach != "" ? "Postfach " + postfach : strassenAnalyse.zeile;
            var schluesselTeile = [
                dublettenTextNormalisieren(firma),
                dublettenTextNormalisieren(vorname),
                dublettenTextNormalisieren(nachname),
                dublettenTextNormalisieren(adresszusatz),
                dublettenTextNormalisieren(postfach),
                dublettenTextNormalisieren(strassenAnalyse.zeile),
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
                fehler["Firma"] = "fehlt";
                fehler["Vorname"] = "fehlt";
                fehler["Nachname"] = "fehlt";
            }

            if (postfach == "") {
                if (strasse == "") {
                    fehler["Stra\u00dfe"] = "fehlt";
                    fehler["Postfach"] = "fehlt";
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

        function base64ZuBinary(base64) {
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var output = "";
            var i = 0;
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;

            base64 = String(base64).replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < base64.length) {
                enc1 = chars.indexOf(base64.charAt(i++));
                enc2 = chars.indexOf(base64.charAt(i++));
                enc3 = chars.indexOf(base64.charAt(i++));
                enc4 = chars.indexOf(base64.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output += String.fromCharCode(chr1);
                if (base64.charAt(i - 2) != "=") output += String.fromCharCode(chr2);
                if (base64.charAt(i - 1) != "=") output += String.fromCharCode(chr3);
            }

            return output;
        }

        function validierungsBildDatei(typ) {
            var fehltB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAABj0lEQVR4nO3WP0scYRDH8e8FwVZIsFE5hKf4BaJVbIRUKTy0CRI7QRBSSLTLK4hgZfAg6XwFB4FoYbBKLzYJQZhiClET1Ag2ggjxT3Eql4055Nggd84HFnZ5hpln59ndZyGEEEII4d5wqdeldZd+u/TmFvG7Lj35x9imS0/zn2XreJC5ngHWgPZkNp9nIZd2YjH+lG1+EfiazE7vYjL3TdvViUurwBAw6tIi0Af8At4Dz4EjoJzMFjI5Si5VgB7gMzCRzE5qA1z6CHQB6y4BzCSzD//nlprH9ZOfzErAMvAqmRWADeATsAckqgsz5dJIJscwUAJEdcHGs0WS2UvgBzCQzArR+Kq2OmP9wGPg2eVn6NClMjAGrNTEvU1m2wAuLQE3bsDhb/WaXwQ6gBOXCsDV8SUTd1Bzfgw8zHOCraxe87eBn0B3MjvPodZZDjlaSvZvp9Y3YAt451KnS49cmnTpdYO19oG+y7coUKf5yewMeAF0At+pbsCDQKXBWnPALHDq0nSDOUIIIYQQQtO4AIinbOnTR4fGAAAAAElFTkSuQmCC";
            var ungueltigB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAAB40lEQVR4nO3Xu2sUURTH8U80hVpoY2UULQY8RVJpOkvBB6KiaQRBFEQLtbKwSKVilSKFjRb+BT4LHwiWVmohItziIpEYEySVCL4SsdgJbIKPdXezcXW+1Rzu3N/v8JvLYS4VFRUVFRUdJEeM5YitS91Hp+ntlFGO6MVXDGAUD4qURn7y7hvsL1J6WtZjGJqr/xU6Fn6R0gx6ynL7H+7d1PaG/gLmhZ8jZrC+SGmqrEfxoUhpuKynMIKj2IB7OFKk9DlH9OMaNuMxpvG2SOlcI9p1PVxHH57kCDiNs+pO/u+8uoVlTezZjZ0ItRFyOEcsxy3cVfsoV3ComYaKlIYwgcEipZ4ipcv16+30WmqaGTvni5TGIUfcRj+2YA0uFinN4k6OuN+2LufTSa9FpZmTP133/BErsQ4TZRhzvG6lsV/QSa9FZWH4n7Cirl7boM4k+sqRMMfGFrS/tejVFSwM/wWO5YhVOWIHDjSo8wzvMZwjVueIvdjVgvY7DOSInh+sNeLVFSwM/4xaKJM4iRuNiJS/kQexB+Pl3pv40qT2JVzAbI441YTX/02OeJgjjv9rXu2kbZesHHECL/Fc7WRuU7sPtJ1Oei0m7bzhPsJVDOIV9hUpTbRRf6m8KioqKioqKrqZ7wchwxpvNbfmAAAAAElFTkSuQmCC";
            var pruefenB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAAB+ElEQVR4nO3XO2gUURTG8d/GFOIjah1BBAVtxMLYprGxs1SrIILYhkVFJAg2mkawNT5AhAiigikUBQsLQVPYJBaKNhokosHgC0GPxd7AOCTrRuNuHvcPA/eec+4953wz3Jkhk8lkMplZENwKhoL2IIKekr8tGAg+JP+OFpW69Aj2JOE7W13LfKKtSXk24VWFN03Kt3AI7qdj4VowHrwPzkTh5hRiBoPJ4EGyPw2qpf0Gg4E0vp6OmqnrRVAJetP4WzAaHJympvPBleBt8C44FyxrhiZNIzUawZFgbdCdmu0txfwMDgWrCva64qf5sWC4MO8LRoKdwYqUbzzYW8r3I+gJVqfYj8GB/6dEC0iNPi7ZqsHrUszdadbOSvxgefAp2FVa0xfcK+W7UYq5Glz62z7nG+2F8XDJ9wSdQUeFyWQbmYOcW7ESd6I2rxSul6XY56X5BNbPQQ3zgqL40UD89wb3rfcin/JtqzD6h30aqWnBUhSpq+TrwljhqZ+JCawr2TbXiX+Gr9jdUIWLmN/ETy/cNUE3juJsA3s8xP5gS1p7HNtnCq7wBf1qZ/y+oCPYEBwOTvxDLwuO4rFzUe3Ps5rsFzQmfj824hE+4yZu11tQ4WQwrib2ZYxhCKdmV/4iIH1ZnG51HUuNZv3hZqYhi5/JZDKZTBP4BTCg1JhOA9zCAAAAAElFTkSuQmCC";
            var dateiTyp = typ == "ung\u00fcltig" ? "ungueltig" : (typ == "pr\u00fcfen" ? "pruefen" : "fehlt");
            var bildInhalt = typ == "ung\u00fcltig" ? ungueltigB64 : (typ == "pr\u00fcfen" ? pruefenB64 : fehltB64);
            var pfad = Folder.temp.fsName + "/mailing_assistant_hint_" + dateiTyp + ".png";
            var bild = File(pfad);

            if (!bild.exists) {
                bild.encoding = "BINARY";
                if (!bild.open("w")) return null;
                bild.write(base64ZuBinary(bildInhalt));
                bild.close();
            }

            return bild;
        }

        for (i = 0; i < felder.length; i++) {
            var feld = felder[i];
            var index = mappingSpaltenindex(csvDaten, mapping, feld);
            if (index < 0) continue;
            var zeile = formular.add("group"); zeile.orientation = "row";
            var label = zeile.add("statictext", undefined, feld + ":"); label.preferredSize.width = 130;
            var edit = zeile.add("edittext", undefined, mappingWert(csvDaten, mapping, datensatz, feld)); edit.characters = 34;

            if (fehlerfelder[feld]) {
                var bildDatei = validierungsBildDatei(fehlerfelder[feld]);
                var hinweis;
                if (bildDatei && bildDatei.exists) {
                    hinweis = zeile.add("image", undefined, bildDatei);
                    hinweis.preferredSize = [95, 22];
                } else {
                    hinweis = zeile.add("statictext", undefined, fehlerfelder[feld]);
                    hinweis.preferredSize.width = 95;
                }
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

        var statusText = fortschritt.add("statictext", undefined, "Excel-Datei wird ge\u00f6ffnet ...");
        statusText.preferredSize.width = 430;

        var balkenZeile = fortschritt.add("group");
        balkenZeile.orientation = "row";
        balkenZeile.alignChildren = ["left", "center"];
        balkenZeile.spacing = 10;

        var balkenTrack = balkenZeile.add("group");
        balkenTrack.orientation = "row";
        balkenTrack.alignChildren = ["left", "fill"];
        balkenTrack.spacing = 0;
        balkenTrack.preferredSize = [370, 20];
        balkenTrack.minimumSize = [370, 20];
        balkenTrack.maximumSize = [370, 20];

        var balkenHell = balkenTrack.add("panel");
        var balkenDunkel = balkenTrack.add("panel");

        function flaecheZeichnen(element, farbe) {
            element.onDraw = function () {
                var g = this.graphics;
                var b = g.newBrush(g.BrushType.SOLID_COLOR, farbe);
                g.newPath();
                g.rectPath(0, 0, this.size.width, this.size.height);
                g.fillPath(b);
            };
        }

        flaecheZeichnen(balkenHell, [0.92, 0.92, 0.92, 1]);
        flaecheZeichnen(balkenDunkel, [0.18, 0.18, 0.18, 1]);

        var balkenProzent = balkenZeile.add("statictext", undefined, "1 %");
        balkenProzent.preferredSize.width = 50;

        function balkenSetzen(prozent) {
            prozent = parseInt(prozent, 10);
            if (isNaN(prozent)) prozent = 0;
            if (prozent < 0) prozent = 0;
            if (prozent > 100) prozent = 100;

            var gesamtBreite = 370;
            var hellBreite = Math.round((gesamtBreite * prozent) / 100);
            var dunkelBreite = gesamtBreite - hellBreite;

            if (hellBreite < 1) hellBreite = 1;
            if (dunkelBreite < 1) dunkelBreite = 1;

            balkenHell.preferredSize = [hellBreite, 20];
            balkenHell.minimumSize = [hellBreite, 20];
            balkenHell.maximumSize = [hellBreite, 20];

            balkenDunkel.preferredSize = [dunkelBreite, 20];
            balkenDunkel.minimumSize = [dunkelBreite, 20];
            balkenDunkel.maximumSize = [dunkelBreite, 20];

            balkenProzent.text = prozent + " %";

            try { balkenTrack.layout.layout(true); } catch (e0) {}
            try { fortschritt.layout.layout(true); } catch (e1) {}
            try { fortschritt.update(); } catch (e2) {}
        }

        balkenSetzen(1);

        var detail = fortschritt.add("statictext", undefined, "Bitte warten ...");
        detail.preferredSize.width = 430;

        fortschritt.center();
        fortschritt.show();
        try { fortschritt.update(); } catch (e0) {}

        var stamp = new Date().getTime();
        var ausgabe = Folder.temp.fsName + "/mailing_assistant_xlsx_" + stamp + ".txt";
        var statusPfad = Folder.temp.fsName + "/mailing_assistant_progress_" + stamp + ".txt";
        var fertigPfad = Folder.temp.fsName + "/mailing_assistant_done_" + stamp + ".txt";
        var fehlerPfad = Folder.temp.fsName + "/mailing_assistant_error_" + stamp + ".txt";
        var scriptPfad = Folder.temp.fsName + "/mailing_assistant_import_" + stamp + ".vbs";

        function fortschrittSauberSchliessen() {
            try { fortschritt.hide(); } catch (e0) {}
            try { fortschritt.update(); } catch (e1) {}
            $.sleep(120);
            try { fortschritt.close(); } catch (e2) {}
            $.sleep(120);
        }

        function dateiLoeschen(pfad) {
            try {
                var x = File(pfad);
                if (x.exists) x.remove();
            } catch (e) {}
        }

        function textDateiLesen(pfad) {
            try {
                var x = File(pfad);
                if (!x.exists) return "";
                x.encoding = "UTF-8";
                if (!x.open("r")) return "";
                var inhalt = x.read();
                x.close();
                return inhalt;
            } catch (e) {
                return "";
            }
        }

        function statusAktualisieren(inhalt, startZeit) {
            if (!inhalt) return;
            var teile = inhalt.replace(/\r/g, "").replace(/\n/g, "").split("|");
            if (teile.length < 3) return;

            var phase = teile[0];
            var aktuell = parseInt(teile[1], 10);
            var gesamt = parseInt(teile[2], 10);
            if (isNaN(aktuell)) aktuell = 0;
            if (isNaN(gesamt) || gesamt < 1) gesamt = 1;

            if (phase == "OPEN") {
                balkenSetzen(2);
                statusText.text = "Excel-Datei wird ge\u00f6ffnet ...";
                detail.text = "Bitte warten ...";
            } else if (phase == "PREP") {
                balkenSetzen(5);
                statusText.text = "Tabellenblatt wird vorbereitet ...";
                detail.text = "Datens\u00e4tze werden gez\u00e4hlt ...";
            } else if (phase == "READ") {
                var prozent = Math.round((aktuell / gesamt) * 100);
                if (prozent < 0) prozent = 0;
                if (prozent > 100) prozent = 100;
                balkenSetzen(prozent);
                statusText.text = "Datens\u00e4tze eingelesen: " + aktuell + " von " + gesamt + " (" + prozent + " %)";

                var vergangenMs = new Date().getTime() - startZeit;
                if (aktuell > 0 && vergangenMs > 1000) {
                    var msProDatensatz = vergangenMs / aktuell;
                    var restSekunden = Math.round(((gesamt - aktuell) * msProDatensatz) / 1000);
                    if (restSekunden < 0) restSekunden = 0;
                    if (restSekunden < 60) detail.text = "Gesch\u00e4tzte Restzeit: ca. " + restSekunden + " Sek.";
                    else detail.text = "Gesch\u00e4tzte Restzeit: ca. " + Math.ceil(restSekunden / 60) + " Min.";
                } else {
                    detail.text = "Gesch\u00e4tzte Restzeit wird berechnet ...";
                }
            } else if (phase == "SAVE") {
                balkenSetzen(99);
                statusText.text = "Daten werden abgeschlossen ...";
                detail.text = "Bitte noch einen Moment warten.";
            }
            try { fortschritt.update(); } catch (e) {}
        }

        dateiLoeschen(ausgabe);
        dateiLoeschen(statusPfad);
        dateiLoeschen(fertigPfad);
        dateiLoeschen(fehlerPfad);
        dateiLoeschen(scriptPfad);

        var vb = "";
        vb += "On Error Resume Next\r\n";
        vb += "Dim xl,wb,ws,stm,ur,firstRow,firstCol,lastRow,lastCol,r,col,v,n,ch,hx,fso,pf,donef,errf,totalRows,currentRow\r\n";
        vb += "Set fso=CreateObject(\"Scripting.FileSystemObject\")\r\n";
        vb += "Sub WriteProgress(phaseName,currentValue,totalValue)\r\n";
        vb += " On Error Resume Next\r\n";
        vb += " Dim p\r\n Set p=fso.CreateTextFile(\"" + vbScriptText(statusPfad) + "\",True,False)\r\n";
        vb += " p.Write phaseName & \"|\" & currentValue & \"|\" & totalValue\r\n p.Close\r\n";
        vb += "End Sub\r\n";
        vb += "Call WriteProgress(\"OPEN\",0,1)\r\n";
        vb += "Set xl=CreateObject(\"Excel.Application\")\r\n";
        vb += "xl.Visible=False\r\n";
        vb += "Set wb=xl.Workbooks.Open(\"" + vbScriptText(datei.fsName) + "\",False,True)\r\n";
        vb += "If Err.Number<>0 Then\r\n";
        vb += " Set errf=fso.CreateTextFile(\"" + vbScriptText(fehlerPfad) + "\",True,True)\r\n errf.Write \"Excel-Datei konnte nicht geoeffnet werden: \" & Err.Description\r\n errf.Close\r\n WScript.Quit 1\r\nEnd If\r\n";
        vb += "Call WriteProgress(\"PREP\",0,1)\r\n";
        vb += "Set ws=wb.Worksheets(\"" + vbScriptText(blatt) + "\")\r\n";
        vb += "If Err.Number<>0 Then\r\n";
        vb += " Set errf=fso.CreateTextFile(\"" + vbScriptText(fehlerPfad) + "\",True,True)\r\n errf.Write \"Tabellenblatt konnte nicht geoeffnet werden: \" & Err.Description\r\n errf.Close\r\n wb.Close False\r\n xl.Quit\r\n WScript.Quit 1\r\nEnd If\r\n";
        vb += "Set ur=ws.UsedRange\r\n";
        vb += "firstRow=ur.Row:firstCol=ur.Column:lastRow=firstRow+ur.Rows.Count-1:lastCol=firstCol+ur.Columns.Count-1\r\n";
        vb += "totalRows=lastRow-firstRow+1\r\n";
        vb += "If totalRows<1 Then totalRows=1\r\n";
        vb += "Set stm=CreateObject(\"ADODB.Stream\")\r\n";
        vb += "stm.Type=2\r\nstm.Charset=\"utf-8\"\r\nstm.Open\r\n";
        vb += "currentRow=0\r\n";
        vb += "For r=firstRow To lastRow\r\n";
        vb += " currentRow=currentRow+1\r\n";
        vb += " For col=firstCol To lastCol\r\n";
        vb += "  v=ws.Cells(r,col).Text\r\n";
        vb += "  stm.WriteText \"~\"\r\n";
        vb += "  For n=1 To Len(v)\r\n";
        vb += "   ch=AscW(Mid(v,n,1)):If ch<0 Then ch=ch+65536\r\n";
        vb += "   hx=Hex(ch):hx=String(4-Len(hx),\"0\") & hx:stm.WriteText hx\r\n";
        vb += "  Next\r\n";
        vb += "  If col<lastCol Then stm.WriteText \"|\"\r\n";
        vb += " Next\r\n";
        vb += " stm.WriteText vbCrLf\r\n";
        vb += " If currentRow=1 Or currentRow=totalRows Or (currentRow Mod 10)=0 Then Call WriteProgress(\"READ\",currentRow,totalRows)\r\n";
        vb += "Next\r\n";
        vb += "Call WriteProgress(\"SAVE\",totalRows,totalRows)\r\n";
        vb += "stm.SaveToFile \"" + vbScriptText(ausgabe) + "\",2\r\n";
        vb += "stm.Close\r\n";
        vb += "wb.Close False\r\n";
        vb += "xl.Quit\r\n";
        vb += "Set donef=fso.CreateTextFile(\"" + vbScriptText(fertigPfad) + "\",True,True)\r\n";
        vb += "donef.Write \"OK\"\r\ndonef.Close\r\n";

        var scriptDatei = File(scriptPfad);
        scriptDatei.encoding = "UTF-8";
        if (!scriptDatei.open("w")) {
            fortschrittSauberSchliessen();
            throw new Error("Tempor\u00e4res Importskript konnte nicht erstellt werden.");
        }
        scriptDatei.write(vb);
        scriptDatei.close();

        try {
            var launcher = "Dim sh\r\nSet sh=CreateObject(\"WScript.Shell\")\r\n";
            launcher += 'sh.Run "cscript.exe //nologo ""' + vbScriptText(scriptPfad) + '""",0,False\r\n';
            app.doScript(launcher, ScriptLanguage.VISUAL_BASIC);

            var startZeit = new Date().getTime();
            var timeoutMs = 60 * 60 * 1000;
            var letzterStatus = "";

            while (true) {
                var fehlerText = textDateiLesen(fehlerPfad);
                if (fehlerText != "") throw new Error(fehlerText);

                var statusInhalt = textDateiLesen(statusPfad);
                if (statusInhalt != "" && statusInhalt != letzterStatus) {
                    letzterStatus = statusInhalt;
                    statusAktualisieren(statusInhalt, startZeit);
                }

                if (File(fertigPfad).exists) break;

                if ((new Date().getTime() - startZeit) > timeoutMs) {
                    throw new Error("Zeit\u00fcberschreitung beim Einlesen der Excel-Datei.");
                }

                $.sleep(120);
            }

            balkenSetzen(100);
            statusText.text = "Excel-Daten vollst\u00e4ndig eingelesen.";
            detail.text = "100 %";
            try { fortschritt.update(); } catch (e7) {}

            var f = File(ausgabe);
            if (!f.exists) throw new Error("Das Excel-Tabellenblatt konnte nicht gelesen werden.");
            f.encoding = "UTF-8";
            if (!f.open("r")) throw new Error("Die Excel-Daten konnten nicht gelesen werden.");
            var t = f.read();
            f.close();

            var z = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
            var m = [];
            var i;
            var j;
            var q;

            for (i = 0; i < z.length; i++) {
                if (z[i] == "") continue;
                q = z[i].split("|");
                for (j = 0; j < q.length; j++) q[j] = xlsxZellwertDekodieren(q[j]);
                m.push(q);
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

            fortschrittSauberSchliessen();

            dateiLoeschen(ausgabe);
            dateiLoeschen(statusPfad);
            dateiLoeschen(fertigPfad);
            dateiLoeschen(fehlerPfad);
            dateiLoeschen(scriptPfad);

            return {rohzeilen:m};
        } catch (fehler) {
            fortschrittSauberSchliessen();
            dateiLoeschen(ausgabe);
            dateiLoeschen(statusPfad);
            dateiLoeschen(fertigPfad);
            dateiLoeschen(scriptPfad);
            throw fehler;
        }
    }

    function xlsxZeileIstWahrscheinlichUeberschrift(zeile){
        var bekannte=["anrede","titel","vorname","nachname","firma","stra\u00dfe","strasse","hausnummer","plz","ort","land","adresszusatz","e-mail","email","telefon","kundennummer","selektionsmerkmal","sonstiges"],treffer=0,i,j,w;
        for(i=0;i<zeile.length;i++){w=trimText(zeile[i]).toLowerCase();for(j=0;j<bekannte.length;j++){if(bekannte[j]===w){treffer++;break;}}}
        return treffer>=1;
    }
    function xlsxDatenInStruktur(roh,hat){
        var m=roh.rohzeilen,max=0,i,j;
        for(i=0;i<m.length;i++)if(m[i].length>max)max=m[i].length;

        var s=[],d=[],quellzeilen=[];
        if(hat){
            for(j=0;j<max;j++)s.push(trimText(m[0][j]||"")||"Spalte "+(j+1));
            i=1;
        }else{
            for(j=0;j<max;j++)s.push("Spalte "+(j+1));
            i=0;
        }

        for(;i<m.length;i++){
            var z=m[i].slice(0);
            while(z.length<max)z.push("");
            if(!istCsvZeileLeer(z)){
                d.push(z);
                // Excel-Zeilen sind 1-basiert. i ist der echte Index in den eingelesenen Rohzeilen.
                quellzeilen.push(i+1);
            }
        }

        return{
            spalten:s,
            datensaetze:d,
            anzahl:d.length,
            trennzeichen:"|",
            xlsx:true,
            quellzeilen:quellzeilen
        };
    }

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
        weiter.onClick = function () {
            if (feldSollAuflage.text != "" && (!/^\d+$/.test(feldSollAuflage.text) || parseInt(feldSollAuflage.text, 10) <= 0)) {
                alert("Bitte bei der Soll-Auflage eine ganze positive Zahl eingeben.");
                feldSollAuflage.active = true;
                return;
            }

            aktuellerAuftrag.auftragsnummer = trimText(feldAuftrag.text);
            aktuellerAuftrag.kunde = trimText(feldKunde.text);
            aktuellerAuftrag.bezeichnung = trimText(feldBezeichnung.text);
            aktuellerAuftrag.produktionsdatum = trimText(feldProduktionsdatum.text);
            aktuellerAuftrag.versanddatum = trimText(feldVersanddatum.text);
            aktuellerAuftrag.versandart = feldVersandart.selection ? feldVersandart.selection.text : "";
            if (aktuellerAuftrag.versandart == "Sonstiges") aktuellerAuftrag.versandart = trimText(feldSonstiges.text);
            aktuellerAuftrag.sollAuflage = trimText(feldSollAuflage.text);

            dlg.close(2);
        };
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

    function zeigeDatenWizardFenster(datei, csvDaten, startMitMapping, startSeite, wiederaufnahmeMapping) {
        var dlg = new Window("dialog", startMitMapping ? "Mailing-Assistant \u2013 Spaltenzuordnung" : "Mailing-Assistant \u2013 Datenvorschau");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = 20;

        var seitenHost = dlg.add("group");
        seitenHost.orientation = "stack";
        seitenHost.alignChildren = ["fill", "fill"];
        seitenHost.alignment = ["fill", "fill"];

        var seitenContainer = null;
        var aktuellesMapping = wiederaufnahmeMapping || null;
        var letzteNachricht = "";

        function leeren() {
            if (seitenContainer) {
                try { seitenContainer.visible = false; } catch (e0) {}
            }

            seitenContainer = seitenHost.add("group");
            seitenContainer.orientation = "column";
            seitenContainer.alignChildren = ["fill", "top"];
            seitenContainer.alignment = ["fill", "fill"];
            seitenContainer.spacing = 12;
            seitenContainer.margins = 0;
            seitenContainer.visible = true;
        }

        function neuLayouten() {
            try {
                seitenHost.layout.layout(true);
                dlg.layout.layout(true);
                dlg.update();
            } catch (e) {}
        }

        function wertAusDatensatz(mapping, datensatz, feld) {
            if (!mapping || !mapping[feld] || mapping[feld] == "\u2014 nicht zugeordnet \u2014") return "";
            var s;
            for (s = 0; s < csvDaten.spalten.length; s++) {
                if (csvDaten.spalten[s] == mapping[feld]) return s < datensatz.length ? trimText(datensatz[s]) : "";
            }
            return "";
        }

        function mappingWertSetzenLokal(mapping, datensatz, feld, wert) {
            var index = mappingSpaltenindex(csvDaten, mapping, feld);
            if (index < 0) return false;
            while (datensatz.length <= index) datensatz.push("");
            datensatz[index] = wert;
            return true;
        }

        function pruefungen(mapping) {
            return {
                problem: problematischeZeichenErkennen(csvDaten),
                plz: deutschePlzPruefen(csvDaten, mapping),
                postal: postalischePflichtfelderPruefen(csvDaten, mapping),
                // Dubletten werden bewusst erst nach Bereinigung und Freigabe gepr\u00fcft.
                dubletten: []
            };
        }

        function datensatzHatPruefhinweisLokal(nr, p) {
            var i;
            for (i = 0; i < p.plz.length; i++) if (p.plz[i].datensatz == nr) return true;
            for (i = 0; i < p.postal.length; i++) if (p.postal[i].datensatz == nr) return true;
            for (i = 0; i < p.dubletten.length; i++) if (p.dubletten[i].datensatz == nr) return true;
            for (i = 0; i < p.problem.length; i++) if (p.problem[i].datensatz == nr) return true;
            return false;
        }

        function auffaelligeSammelnLokal(mapping, p) {
            return auffaelligeDatensaetzeSammeln(csvDaten, mapping, p.plz, p.postal, p.dubletten, p.problem);
        }

        function base64ZuBinary(base64) {
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var output = "";
            var i = 0;
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            base64 = String(base64).replace(/[^A-Za-z0-9\+\/\=]/g, "");
            while (i < base64.length) {
                enc1 = chars.indexOf(base64.charAt(i++));
                enc2 = chars.indexOf(base64.charAt(i++));
                enc3 = chars.indexOf(base64.charAt(i++));
                enc4 = chars.indexOf(base64.charAt(i++));
                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;
                output += String.fromCharCode(chr1);
                if (base64.charAt(i - 2) != "=") output += String.fromCharCode(chr2);
                if (base64.charAt(i - 1) != "=") output += String.fromCharCode(chr3);
            }
            return output;
        }

        function validierungsBildDatei(typ) {
            var fehltB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAABj0lEQVR4nO3WP0scYRDH8e8FwVZIsFE5hKf4BaJVbIRUKTy0CRI7QRBSSLTLK4hgZfAg6XwFB4FoYbBKLzYJQZhiClET1Ag2ggjxT3Eql4055Nggd84HFnZ5hpln59ndZyGEEEII4d5wqdeldZd+u/TmFvG7Lj35x9imS0/zn2XreJC5ngHWgPZkNp9nIZd2YjH+lG1+EfiazE7vYjL3TdvViUurwBAw6tIi0Af8At4Dz4EjoJzMFjI5Si5VgB7gMzCRzE5qA1z6CHQB6y4BzCSzD//nlprH9ZOfzErAMvAqmRWADeATsAckqgsz5dJIJscwUAJEdcHGs0WS2UvgBzCQzArR+Kq2OmP9wGPg2eVn6NClMjAGrNTEvU1m2wAuLQE3bsDhb/WaXwQ6gBOXCsDV8SUTd1Bzfgw8zHOCraxe87eBn0B3MjvPodZZDjlaSvZvp9Y3YAt451KnS49cmnTpdYO19oG+y7coUKf5yewMeAF0At+pbsCDQKXBWnPALHDq0nSDOUIIIYQQQtO4AIinbOnTR4fGAAAAAElFTkSuQmCC";
            var ungueltigB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAAB40lEQVR4nO3Xu2sUURTH8U80hVpoY2UULQY8RVJpOkvBB6KiaQRBFEQLtbKwSKVilSKFjRb+BT4LHwiWVmohItziIpEYEySVCL4SsdgJbIKPdXezcXW+1Rzu3N/v8JvLYS4VFRUVFRUdJEeM5YitS91Hp+ntlFGO6MVXDGAUD4qURn7y7hvsL1J6WtZjGJqr/xU6Fn6R0gx6ynL7H+7d1PaG/gLmhZ8jZrC+SGmqrEfxoUhpuKynMIKj2IB7OFKk9DlH9OMaNuMxpvG2SOlcI9p1PVxHH57kCDiNs+pO/u+8uoVlTezZjZ0ItRFyOEcsxy3cVfsoV3ComYaKlIYwgcEipZ4ipcv16+30WmqaGTvni5TGIUfcRj+2YA0uFinN4k6OuN+2LufTSa9FpZmTP133/BErsQ4TZRhzvG6lsV/QSa9FZWH4n7Cirl7boM4k+sqRMMfGFrS/tejVFSwM/wWO5YhVOWIHDjSo8wzvMZwjVueIvdjVgvY7DOSInh+sNeLVFSwM/4xaKJM4iRuNiJS/kQexB+Pl3pv40qT2JVzAbI441YTX/02OeJgjjv9rXu2kbZesHHECL/Fc7WRuU7sPtJ1Oei0m7bzhPsJVDOIV9hUpTbRRf6m8KioqKioqKrqZ7wchwxpvNbfmAAAAAElFTkSuQmCC";
            var pruefenB64 = "iVBORw0KGgoAAAANSUhEUgAAAF8AAAAWCAYAAACmG0BRAAAB+ElEQVR4nO3XO2gUURTG8d/GFOIjah1BBAVtxMLYprGxs1SrIILYhkVFJAg2mkawNT5AhAiigikUBQsLQVPYJBaKNhokosHgC0GPxd7AOCTrRuNuHvcPA/eec+4953wz3Jkhk8lkMplZENwKhoL2IIKekr8tGAg+JP+OFpW69Aj2JOE7W13LfKKtSXk24VWFN03Kt3AI7qdj4VowHrwPzkTh5hRiBoPJ4EGyPw2qpf0Gg4E0vp6OmqnrRVAJetP4WzAaHJympvPBleBt8C44FyxrhiZNIzUawZFgbdCdmu0txfwMDgWrCva64qf5sWC4MO8LRoKdwYqUbzzYW8r3I+gJVqfYj8GB/6dEC0iNPi7ZqsHrUszdadbOSvxgefAp2FVa0xfcK+W7UYq5Glz62z7nG+2F8XDJ9wSdQUeFyWQbmYOcW7ESd6I2rxSul6XY56X5BNbPQQ3zgqL40UD89wb3rfcin/JtqzD6h30aqWnBUhSpq+TrwljhqZ+JCawr2TbXiX+Gr9jdUIWLmN/ETy/cNUE3juJsA3s8xP5gS1p7HNtnCq7wBf1qZ/y+oCPYEBwOTvxDLwuO4rFzUe3Ps5rsFzQmfj824hE+4yZu11tQ4WQwrib2ZYxhCKdmV/4iIH1ZnG51HUuNZv3hZqYhi5/JZDKZTBP4BTCg1JhOA9zCAAAAAElFTkSuQmCC";
            var dateiTyp = typ == "ung\u00fcltig" ? "ungueltig" : (typ == "pr\u00fcfen" ? "pruefen" : "fehlt");
            var bildInhalt = typ == "ung\u00fcltig" ? ungueltigB64 : (typ == "pr\u00fcfen" ? pruefenB64 : fehltB64);
            var pfad = Folder.temp.fsName + "/mailing_assistant_hint_" + dateiTyp + ".png";
            var bild = File(pfad);
            if (!bild.exists) {
                bild.encoding = "BINARY";
                if (!bild.open("w")) return null;
                bild.write(base64ZuBinary(bildInhalt));
                bild.close();
            }
            return bild;
        }

        function zeigeNachricht(text) {
            if (!text) return;
            var n = seitenContainer.add("statictext", undefined, text);
            n.characters = 85;
        }

        function zeigeVorschauSeite() {
            leeren();
            dlg.text = "Mailing-Assistant \u2013 Datenvorschau";
            seitenContainer.add("statictext", undefined, "Daten erfolgreich eingelesen");

            var info = seitenContainer.add("panel");
            info.orientation = "column"; info.alignChildren = ["left", "top"]; info.margins = 15; info.spacing = 6;
            info.add("statictext", undefined, "Datei: " + datei.name);
            info.add("statictext", undefined, "Datens\u00e4tze: " + csvDaten.anzahl);
            info.add("statictext", undefined, "Spalten: " + csvDaten.spalten.length);

            var vorschauBereich = seitenContainer.add("panel");
            vorschauBereich.text = "Vorschau \u2013 erste 10 Datens\u00e4tze";
            vorschauBereich.orientation = "column"; vorschauBereich.alignChildren = ["fill", "top"]; vorschauBereich.margins = 15;

            var spaltenbreiten = []; var i;
            for (i = 0; i < csvDaten.spalten.length; i++) spaltenbreiten.push(120);

            var liste = vorschauBereich.add("listbox", undefined, [], {
                numberOfColumns: csvDaten.spalten.length, showHeaders: true,
                columnTitles: csvDaten.spalten, columnWidths: spaltenbreiten
            });
            liste.preferredSize = [760, 260];

            var max = Math.min(10, csvDaten.datensaetze.length);
            var zeile, eintrag, spalte, wert;
            for (i = 0; i < max; i++) {
                zeile = csvDaten.datensaetze[i];
                wert = zeile.length > 0 ? zeile[0] : "";
                eintrag = liste.add("item", wert);
                for (spalte = 1; spalte < csvDaten.spalten.length; spalte++) {
                    wert = spalte < zeile.length ? zeile[spalte] : "";
                    eintrag.subItems[spalte - 1].text = wert;
                }
            }
            seitenContainer.add("statictext", undefined, max + " von " + csvDaten.anzahl + " Datens\u00e4tzen werden angezeigt.");

            var buttons = seitenContainer.add("group"); buttons.alignment = "right";
            var zurueck = buttons.add("button", undefined, "Zur\u00fcck");
            var weiter = buttons.add("button", undefined, "Weiter");
            zurueck.onClick = function(){ dlg.close(1); };
            weiter.onClick = function(){ zeigeMappingSeite(aktuellesMapping); };
            neuLayouten();
        }

        function zeigeMappingSeite(vorhandenesMapping) {
            leeren();
            dlg.text = "Mailing-Assistant \u2013 Spaltenzuordnung";
            seitenContainer.add("statictext", undefined, "Spaltenzuordnung");
            seitenContainer.add("statictext", undefined, "Ordne jeder Kundenspalte ein Mailing-Feld zu. Nicht ben\u00f6tigte Spalten bleiben auf \u201eNicht verwenden\u201c.");

            var interneFelder = ["Anrede","Titel","Vorname","Nachname","Firma","Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land","Adresszusatz","E-Mail","Telefon","Kundennummer","Selektionsmerkmal","Sonstiges"];
            var auswahlFelder = ["Nicht verwenden"];
            var i,j;
            for (i=0;i<interneFelder.length;i++) auswahlFelder.push(interneFelder[i]);

            function normalisiere(text) {
                var wert=trimText(text).toLowerCase();
                wert=wert.replace(/\u00e4/g,"ae").replace(/\u00f6/g,"oe").replace(/\u00fc/g,"ue").replace(/\u00df/g,"ss");
                return wert.replace(/[^a-z0-9]/g,"");
            }
            function vorgeschlagenesFeld(spaltenname) {
                var name=normalisiere(spaltenname);
                var aliases={
                    "anrede":"Anrede","salutation":"Anrede","titel":"Titel","title":"Titel",
                    "vorname":"Vorname","firstname":"Vorname","first":"Vorname",
                    "nachname":"Nachname","lastname":"Nachname","surname":"Nachname","familienname":"Nachname",
                    "firma":"Firma","firmenname":"Firma","unternehmen":"Firma","company":"Firma",
                    "strasse":"Stra\u00dfe","street":"Stra\u00dfe","streetname":"Stra\u00dfe",
                    "hausnummer":"Hausnummer","hausnr":"Hausnummer","hnr":"Hausnummer","streetnumber":"Hausnummer",
                    "postfach":"Postfach","postbox":"Postfach","pobox":"Postfach",
                    "plz":"PLZ","postleitzahl":"PLZ","zipcode":"PLZ","zip":"PLZ","postalcode":"PLZ",
                    "ort":"Ort","stadt":"Ort","city":"Ort","land":"Land","country":"Land",
                    "adresszusatz":"Adresszusatz","adresszusatz1":"Adresszusatz","zusatz":"Adresszusatz","address2":"Adresszusatz",
                    "email":"E-Mail","emailadresse":"E-Mail","mail":"E-Mail",
                    "telefon":"Telefon","telefonnummer":"Telefon","phone":"Telefon","tel":"Telefon",
                    "kundennummer":"Kundennummer","kundennr":"Kundennummer","kundenummer":"Kundennummer","customerid":"Kundennummer",
                    "selektionsmerkmal":"Selektionsmerkmal","selektion":"Selektionsmerkmal","sonstiges":"Sonstiges"
                };
                return aliases[name]||null;
            }
            function feldFuerSpalte(spaltenname){
                var key;
                if(vorhandenesMapping){
                    for(key in vorhandenesMapping) if(vorhandenesMapping.hasOwnProperty(key) && vorhandenesMapping[key]==spaltenname) return key;
                }
                return vorgeschlagenesFeld(spaltenname);
            }

            var kopf=seitenContainer.add("group"); kopf.orientation="row";
            var kq=kopf.add("statictext",undefined,"Kundenspalte"); kq.preferredSize.width=260;
            kopf.add("statictext",undefined,"Mailing-Feld");

            var bereich=seitenContainer.add("panel"); bereich.orientation="column"; bereich.alignChildren=["fill","top"]; bereich.margins=15; bereich.spacing=6;
            var zuordnungen=[], verwendet={};

            for(i=0;i<csvDaten.spalten.length;i++){
                var zeile=bereich.add("group"); zeile.orientation="row"; zeile.alignChildren=["center","center"];
                var label=zeile.add("statictext",undefined,csvDaten.spalten[i]); label.preferredSize.width=260;
                var auswahl=zeile.add("dropdownlist",undefined,auswahlFelder); auswahl.preferredSize.width=220; auswahl.selection=0;
                var vorschlag=feldFuerSpalte(csvDaten.spalten[i]);
                if(vorschlag && !verwendet[vorschlag]){
                    for(j=1;j<auswahlFelder.length;j++) if(auswahlFelder[j]==vorschlag){auswahl.selection=j;verwendet[vorschlag]=true;break;}
                }
                zuordnungen.push(auswahl);
            }

            function pruefeDoppelte(geaendert){
                if(!geaendert.selection || geaendert.selection.index==0) return;
                var feld=geaendert.selection.text,k;
                for(k=0;k<zuordnungen.length;k++){
                    if(zuordnungen[k]!=geaendert && zuordnungen[k].selection && zuordnungen[k].selection.text==feld){
                        alert("Das Mailing-Feld \u201e"+feld+"\u201c ist bereits der Kundenspalte \u201e"+csvDaten.spalten[k]+"\u201c zugeordnet.\n\nJedes Mailing-Feld kann nur einmal verwendet werden.");
                        geaendert.selection=0; return;
                    }
                }
            }
            for(i=0;i<zuordnungen.length;i++) zuordnungen[i].onChange=function(){pruefeDoppelte(this);};

            seitenContainer.add("statictext",undefined,"Vorschl\u00e4ge werden nur anhand eindeutiger Spaltennamen vorbelegt. Du kannst jede Zuordnung \u00e4ndern.");

            var buttons=seitenContainer.add("group"); buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,"Weiter");
            zurueck.onClick=function(){zeigeVorschauSeite();};
            weiter.onClick=function(){
                var mapping={},k;
                for(k=0;k<interneFelder.length;k++) mapping[interneFelder[k]]="\u2014 nicht zugeordnet \u2014";
                for(k=0;k<zuordnungen.length;k++) if(zuordnungen[k].selection && zuordnungen[k].selection.index>0) mapping[zuordnungen[k].selection.text]=csvDaten.spalten[k];
                aktuellesMapping=mapping;
                zeigeAdressSeite(mapping);
            };
            neuLayouten();
        }

        function zeigeAdressSeite(mapping) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Adressvorschau";
            seitenContainer.add("statictext",undefined,"Postalische Adressvorschau");
            seitenContainer.add("statictext",undefined,"W\u00e4hle links einen Datensatz aus. Rechts siehst du die zusammengesetzte postalische Anschrift.");

            function postalischeAdresse(datensatz){
                var zeilen=[];
                var firma=wertAusDatensatz(mapping,datensatz,"Firma");
                var person=verbindeTeile([wertAusDatensatz(mapping,datensatz,"Anrede"),wertAusDatensatz(mapping,datensatz,"Titel"),wertAusDatensatz(mapping,datensatz,"Vorname"),wertAusDatensatz(mapping,datensatz,"Nachname")]);
                var zusatz=wertAusDatensatz(mapping,datensatz,"Adresszusatz");
                var strassenAnalyse=strassenHausnummerAnalysieren(
                    wertAusDatensatz(mapping,datensatz,"Stra\u00dfe"),
                    wertAusDatensatz(mapping,datensatz,"Hausnummer")
                );
                var strasse=strassenAnalyse.zeile;
                var postfach=wertAusDatensatz(mapping,datensatz,"Postfach");
                var land=wertAusDatensatz(mapping,datensatz,"Land");
                var plzOrtAnalyse=plzOrtAnalysieren(
                    wertAusDatensatz(mapping,datensatz,"PLZ"),
                    wertAusDatensatz(mapping,datensatz,"Ort"),
                    land
                );
                var ort=plzOrtAnalyse.zeile;
                if(firma!="")zeilen.push(firma); if(person!="")zeilen.push(person); if(zusatz!="")zeilen.push(zusatz);
                if(postfach!="")zeilen.push(postfachZeileNormalisieren(postfach)); else if(strasse!="")zeilen.push(strasse);
                if(ort!="")zeilen.push(ort);
                var lk=land.toLowerCase(); if(land!=""&&lk!="deutschland"&&lk!="de"&&lk!="germany"&&lk!="deu")zeilen.push(land);
                return zeilen.join("\r\n");
            }

            var max=Math.min(10,csvDaten.datensaetze.length);
            var bereich=seitenContainer.add("panel"); bereich.text="Erste 10 postalische Anschriften"; bereich.orientation="row"; bereich.alignChildren=["fill","fill"]; bereich.margins=15; bereich.spacing=12;
            var liste=bereich.add("listbox",undefined,[],{multiselect:false}); liste.preferredSize=[250,300];
            var vorschau=bereich.add("edittext",undefined,"",{multiline:true,scrolling:true,readonly:true}); vorschau.preferredSize=[360,300];
            var i;
            for(i=0;i<max;i++){
                var ds=csvDaten.datensaetze[i];
                var name=verbindeTeile([wertAusDatensatz(mapping,ds,"Vorname"),wertAusDatensatz(mapping,ds,"Nachname")]);
                var firma=wertAusDatensatz(mapping,ds,"Firma");
                var kennung=name!=""?name:firma; if(kennung=="")kennung="Datensatz "+(i+1);
                liste.add("item",(i+1)+".  "+kennung);
            }
            function update(){if(!liste.selection){vorschau.text="";return;}vorschau.text=postalischeAdresse(csvDaten.datensaetze[liste.selection.index]);}
            liste.onChange=update; if(max>0){liste.selection=0;update();} else vorschau.text="Keine Datens\u00e4tze vorhanden.";
            seitenContainer.add("statictext",undefined,max+" von "+csvDaten.anzahl+" Datens\u00e4tzen stehen zur Vorschau bereit.");

            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,"Weiter");
            zurueck.onClick=function(){zeigeMappingSeite(mapping);};
            weiter.onClick=function(){zeigeBereinigungSeite(mapping);};
            neuLayouten();
        }

        function exportierePrueflistePdf(mapping) {
            var protokoll=sichereTextbereinigungAnwenden(csvDaten);
            var p=pruefungen(mapping);
            var auff=auffaelligeSammelnLokal(mapping,p);
            var alleDubletten=eindeutigeDublettenPruefen(csvDaten,mapping);

            function datensaetzeExaktGleichPdf(nr1,nr2){
                var a=csvDaten.datensaetze[nr1-1];
                var b=csvDaten.datensaetze[nr2-1];
                if(!a||!b)return false;
                var max=a.length>b.length?a.length:b.length;
                var j;
                for(j=0;j<max;j++){
                    var av=j<a.length?String(a[j]):"";
                    var bv=j<b.length?String(b[j]):"";
                    if(av!=bv)return false;
                }
                return true;
            }

            if(auff.length==0 && protokoll.length==0 && alleDubletten.length==0){
                alert("Es gibt keine Pr\u00fcfhinweise, automatischen Bereinigungen oder Dubletten f\u00fcr eine Pr\u00fcfliste.");
                return;
            }

            function quellzeileFuerDatensatz(nr){
                if(csvDaten.quellzeilen && csvDaten.quellzeilen.length>=nr)return csvDaten.quellzeilen[nr-1];
                return nr+1;
            }

            function dateinameTeil(text) {
                var wert=trimText(text);
                if(wert=="")return "";
                wert=wert.replace(/[\\\/:*?"<>|]+/g,"_");
                wert=wert.replace(/\s+/g,"_");
                wert=wert.replace(/_+/g,"_");
                return wert.replace(/^_+|_+$/g,"");
            }

            function pdfByte(code) {
                var map={
                    0x20AC:128,0x201A:130,0x0192:131,0x201E:132,0x2026:133,0x2020:134,0x2021:135,
                    0x02C6:136,0x2030:137,0x0160:138,0x2039:139,0x0152:140,0x017D:142,
                    0x2018:145,0x2019:146,0x201C:147,0x201D:148,0x2022:149,0x2013:150,0x2014:151,
                    0x02DC:152,0x2122:153,0x0161:154,0x203A:155,0x0153:156,0x017E:158,0x0178:159
                };
                if(code<=255)return code;
                if(map[code]!==undefined)return map[code];
                return 63;
            }

            function pdfText(text) {
                text=String(text===undefined||text===null?"":text);
                var out="",i,code,b,oct;
                for(i=0;i<text.length;i++){
                    code=text.charCodeAt(i);
                    b=pdfByte(code);
                    if(b==40||b==41||b==92){
                        out+="\\"+String.fromCharCode(b);
                    }else if(b>=32&&b<=126){
                        out+=String.fromCharCode(b);
                    }else{
                        oct=b.toString(8);
                        while(oct.length<3)oct="0"+oct;
                        out+="\\"+oct;
                    }
                }
                return out;
            }

            function textBrechen(text,maxLen) {
                var worte=String(text).replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").split(" ");
                var zeilen=[],akt="",i,w;
                for(i=0;i<worte.length;i++){
                    w=worte[i];
                    if(w=="")continue;
                    if(akt==""){akt=w;continue;}
                    if((akt+" "+w).length<=maxLen)akt+=" "+w;
                    else{zeilen.push(akt);akt=w;}
                }
                if(akt!="")zeilen.push(akt);
                if(zeilen.length==0)zeilen.push("");
                return zeilen;
            }

            function zeichneText(stream,x,y,text,font,size) {
                stream.push("BT /"+font+" "+size+" Tf 1 0 0 1 "+x+" "+y+" Tm ("+pdfText(text)+") Tj ET\n");
            }

            function zeichneLinie(stream,x1,y1,x2,y2,grau,breite) {
                stream.push(grau+" G "+breite+" w "+x1+" "+y1+" m "+x2+" "+y2+" l S\n");
            }

            var teile=[];
            var t=dateinameTeil(aktuellerAuftrag.auftragsnummer);if(t!="")teile.push(t);
            t=dateinameTeil(aktuellerAuftrag.kunde);if(t!="")teile.push(t);
            t=dateinameTeil(aktuellerAuftrag.bezeichnung);if(t!="")teile.push(t);
            if(teile.length==0)teile.push("Mailing");

            var heute=new Date();
            var jm=heute.getMonth()+1;
            var jt=heute.getDate();
            if(jm<10)jm="0"+jm;
            if(jt<10)jt="0"+jt;
            teile.push(String(heute.getFullYear())+String(jm)+String(jt));
            teile.push("Pruefliste");

            var vorgeschlagen=File(Folder.myDocuments.fsName+"/"+teile.join("_")+".pdf");
            var ziel=vorgeschlagen.saveDlg("Pr\u00fcfliste als PDF speichern","PDF:*.pdf");
            if(!ziel)return;
            if(!/\.pdf$/i.test(ziel.name))ziel=File(ziel.fsName+".pdf");

            try{
                var seiten=[];
                var stream=[];
                var y=800;
                var linkerRand=42;
                var rechterRand=553;
                var datensatzProSeite=0;
                var seiteNummer=1;
                var i;

                function neueSeite() {
                    stream=[];
                    y=800;
                    datensatzProSeite=0;

                    zeichneText(stream,linkerRand,y,"MAILING-ASSISTANT  |  PR\u00dcFLISTE","F2",15);
                    y-=22;
                    zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.65",0.6);
                    y-=18;

                    zeichneText(stream,linkerRand,y,"Auftragsnummer: "+(aktuellerAuftrag.auftragsnummer||"-"),"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Kunde: "+(aktuellerAuftrag.kunde||"-"),"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Bezeichnung: "+(aktuellerAuftrag.bezeichnung||"-"),"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Produktionsdatum: "+(aktuellerAuftrag.produktionsdatum||"-"),"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Auff\u00e4llige Datens\u00e4tze: "+auff.length,"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Automatisch bereinigte Felder: "+protokoll.length,"F1",9); y-=13;
                    zeichneText(stream,linkerRand,y,"Gefundene Dublettenpaare: "+alleDubletten.length,"F1",9); y-=18;
                    zeichneText(stream,linkerRand,y,"Die Pr\u00fcfliste dokumentiert offene Pr\u00fcfhinweise, automatische Bereinigungen und Dubletten.","F1",9); y-=22;
                }

                function seiteAbschliessen() {
                    zeichneLinie(stream,linkerRand,35,rechterRand,35,"0.75",0.5);
                    zeichneText(stream,linkerRand,22,"Mailing-Assistant Pr\u00fcfliste","F1",8);
                    zeichneText(stream,485,22,"Seite "+seiteNummer,"F1",8);
                    seiten.push(stream.join(""));
                    seiteNummer++;
                }

                neueSeite();

                for(i=0;i<auff.length;i++){
                    var nr=auff[i].datensatz;
                    var ds=csvDaten.datensaetze[nr-1];

                    var emp=verbindeTeile([
                        wertAusDatensatz(mapping,ds,"Firma"),
                        wertAusDatensatz(mapping,ds,"Vorname"),
                        wertAusDatensatz(mapping,ds,"Nachname")
                    ]);
                    if(emp=="")emp="[ohne Empf\u00e4nger]";

                    var strasse=wertAusDatensatz(mapping,ds,"Stra\u00dfe");
                    var hn=wertAusDatensatz(mapping,ds,"Hausnummer");
                    var pf=wertAusDatensatz(mapping,ds,"Postfach");
                    var land=wertAusDatensatz(mapping,ds,"Land");
                    var po=plzOrtAnalysieren(
                        wertAusDatensatz(mapping,ds,"PLZ"),
                        wertAusDatensatz(mapping,ds,"Ort"),
                        land
                    );
                    var anschrift=pf!=""?postfachZeileNormalisieren(pf):strassenHausnummerAnalysieren(strasse,hn).zeile;
                    var adr=verbindeTeile([anschrift,po.zeile]);
                    var grund=auff[i].gruende.join(" ");
                    var grundZeilen=textBrechen(grund,92);

                    var benoetigt=88+(grundZeilen.length-1)*11;
                    if(y-benoetigt<55){
                        seiteAbschliessen();
                        neueSeite();
                    }

                    zeichneText(stream,linkerRand,y,"Datensatz "+nr+"  |  Quellzeile "+quellzeileFuerDatensatz(nr),"F2",10);
                    zeichneText(stream,205,y,emp,"F2",10);
                    y-=15;
                    zeichneText(stream,linkerRand,y,adr,"F1",9);
                    y-=15;

                    zeichneText(stream,linkerRand,y,"Pr\u00fcfgrund:","F2",9);
                    var gz;
                    for(gz=0;gz<grundZeilen.length;gz++){
                        zeichneText(stream,105,y,grundZeilen[gz],"F1",9);
                        y-=11;
                    }

                    y-=3;
                    zeichneText(stream,linkerRand,y,"Korrektur / Bemerkung:","F1",8.5);
                    y-=13;
                    zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.70",0.5);
                    y-=16;
                    zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.85",0.5);
                    y-=16;
                    zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.85",0.5);
                    y-=18;
                    datensatzProSeite++;
                }

                if(protokoll.length>0){
                    if(y<690){
                        seiteAbschliessen();
                        neueSeite();
                    }

                    zeichneText(stream,linkerRand,y,"AUTOMATISCH BEREINIGTE FELDER","F2",12);
                    y-=17;
                    zeichneText(stream,linkerRand,y,"Diese \u00c4nderungen wurden eindeutig erkannt und automatisch angewendet.","F1",8.5);
                    y-=20;

                    var bi;
                    for(bi=0;bi<protokoll.length;bi++){
                        var bp=protokoll[bi];
                        var vorherText=sichtbarerBereinigungstext(bp.vorher);
                        var nachherText=sichtbarerBereinigungstext(bp.nachher);
                        var vorherZeilen=textBrechen(vorherText,86);
                        var nachherZeilen=textBrechen(nachherText,86);
                        var maxZeilen=vorherZeilen.length>nachherZeilen.length?vorherZeilen.length:nachherZeilen.length;
                        var hoehe=62+(maxZeilen-1)*11;

                        if(y-hoehe<55){
                            seiteAbschliessen();
                            neueSeite();
                            zeichneText(stream,linkerRand,y,"AUTOMATISCH BEREINIGTE FELDER (FORTSETZUNG)","F2",12);
                            y-=22;
                        }

                        zeichneText(
                            stream,
                            linkerRand,
                            y,
                            "Datensatz "+bp.datensatz+"  |  Quellzeile "+quellzeileFuerDatensatz(bp.datensatz)+"  |  Feld: "+bp.spalte,
                            "F2",
                            9
                        );
                        y-=14;

                        zeichneText(stream,linkerRand,y,"Vorher:","F2",8.5);
                        var bz;
                        for(bz=0;bz<vorherZeilen.length;bz++){
                            zeichneText(stream,92,y,vorherZeilen[bz],"F1",8.5);
                            y-=11;
                        }

                        zeichneText(stream,linkerRand,y,"Nachher:","F2",8.5);
                        for(bz=0;bz<nachherZeilen.length;bz++){
                            zeichneText(stream,92,y,nachherZeilen[bz],"F1",8.5);
                            y-=11;
                        }

                        y-=5;
                        zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.82",0.45);
                        y-=12;
                    }
                }

                if(alleDubletten.length>0){
                    if(y<650){
                        seiteAbschliessen();
                        neueSeite();
                    }

                    zeichneText(stream,linkerRand,y,"DUBLETTENPR\u00dcFUNG","F2",12);
                    y-=17;
                    zeichneText(stream,linkerRand,y,"Gefundene Dublettenpaare werden mit Herkunft und Abweichungen dokumentiert.","F1",8.5);
                    y-=20;

                    var di;
                    for(di=0;di<alleDubletten.length;di++){
                        var dub=alleDubletten[di];
                        var nrL=dub.original;
                        var nrR=dub.datensatz;
                        var dsL=csvDaten.datensaetze[nrL-1];
                        var dsR=csvDaten.datensaetze[nrR-1];

                        var firmaL=wertAusDatensatz(mapping,dsL,"Firma");
                        var personL=verbindeTeile([
                            wertAusDatensatz(mapping,dsL,"Anrede"),
                            wertAusDatensatz(mapping,dsL,"Titel"),
                            wertAusDatensatz(mapping,dsL,"Vorname"),
                            wertAusDatensatz(mapping,dsL,"Nachname")
                        ]);
                        var empL=firmaL!=""?(personL!=""?firmaL+" / "+personL:firmaL):personL;

                        var firmaR=wertAusDatensatz(mapping,dsR,"Firma");
                        var personR=verbindeTeile([
                            wertAusDatensatz(mapping,dsR,"Anrede"),
                            wertAusDatensatz(mapping,dsR,"Titel"),
                            wertAusDatensatz(mapping,dsR,"Vorname"),
                            wertAusDatensatz(mapping,dsR,"Nachname")
                        ]);
                        var empR=firmaR!=""?(personR!=""?firmaR+" / "+personR:firmaR):personR;

                        var strL=strassenHausnummerAnalysieren(
                            wertAusDatensatz(mapping,dsL,"Stra\u00dfe"),
                            wertAusDatensatz(mapping,dsL,"Hausnummer")
                        ).zeile;
                        var pfL=wertAusDatensatz(mapping,dsL,"Postfach");
                        var poL=plzOrtAnalysieren(
                            wertAusDatensatz(mapping,dsL,"PLZ"),
                            wertAusDatensatz(mapping,dsL,"Ort"),
                            wertAusDatensatz(mapping,dsL,"Land")
                        ).zeile;
                        var adrL=verbindeTeile([pfL!=""?postfachZeileNormalisieren(pfL):strL,poL]);

                        var strR=strassenHausnummerAnalysieren(
                            wertAusDatensatz(mapping,dsR,"Stra\u00dfe"),
                            wertAusDatensatz(mapping,dsR,"Hausnummer")
                        ).zeile;
                        var pfR=wertAusDatensatz(mapping,dsR,"Postfach");
                        var poR=plzOrtAnalysieren(
                            wertAusDatensatz(mapping,dsR,"PLZ"),
                            wertAusDatensatz(mapping,dsR,"Ort"),
                            wertAusDatensatz(mapping,dsR,"Land")
                        ).zeile;
                        var adrR=verbindeTeile([pfR!=""?postfachZeileNormalisieren(pfR):strR,poR]);

                        var exakt=datensaetzeExaktGleichPdf(nrL,nrR);
                        var key=String(nrL)+"-"+String(nrR);
                        var statusText="Manuell zu pr\u00fcfen";
                        if(exakt)statusText="Vollst\u00e4ndig identisch";
                        if(csvDaten.dublettenstatus && csvDaten.dublettenstatus[key]){
                            var dsStatus=csvDaten.dublettenstatus[key];
                            if(dsStatus=="links")statusText="Linken Datensatz behalten";
                            else if(dsStatus=="rechts")statusText="Rechten Datensatz behalten";
                            else if(dsStatus=="beide")statusText="Beide behalten";
                            else if(dsStatus=="zusammengefuehrt")statusText="Zusammengef\u00fchrt";
                        }else if(csvDaten.autoDublettenEntfernt && csvDaten.autoDublettenEntfernt[key]){
                            statusText="Identische Dublette automatisch entfernt";
                        }

                        var diffFelder=[];
                        var pruefFelder=[
                            "Firma","Anrede","Titel","Vorname","Nachname","Adresszusatz",
                            "Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land",
                            "E-Mail","Telefon","Kundennummer","Selektionsmerkmal","Sonstiges"
                        ];
                        var fj;
                        for(fj=0;fj<pruefFelder.length;fj++){
                            var fName=pruefFelder[fj];
                            var lv=wertAusDatensatz(mapping,dsL,fName);
                            var rv=wertAusDatensatz(mapping,dsR,fName);
                            if(trimText(lv).toLowerCase().replace(/\s+/g," ") != trimText(rv).toLowerCase().replace(/\s+/g," ")){
                                diffFelder.push(fName+": "+(lv!=""?lv:"[leer]")+" <> "+(rv!=""?rv:"[leer]"));
                            }
                        }

                        var benoetigt=90+diffFelder.length*11;
                        if(y-benoetigt<55){
                            seiteAbschliessen();
                            neueSeite();
                            zeichneText(stream,linkerRand,y,"DUBLETTENPR\u00dcFUNG (FORTSETZUNG)","F2",12);
                            y-=22;
                        }

                        zeichneText(stream,linkerRand,y,"Paar "+(di+1)+"  |  Status: "+statusText,"F2",9); y-=14;
                        zeichneText(stream,linkerRand,y,"Links: Datensatz "+nrL+" | Quellzeile "+quellzeileFuerDatensatz(nrL)+" | "+(empL||"[ohne Empf\u00e4nger]"),"F1",8.5); y-=11;
                        zeichneText(stream,linkerRand,y,"       "+adrL,"F1",8.5); y-=11;
                        zeichneText(stream,linkerRand,y,"Rechts: Datensatz "+nrR+" | Quellzeile "+quellzeileFuerDatensatz(nrR)+" | "+(empR||"[ohne Empf\u00e4nger]"),"F1",8.5); y-=11;
                        zeichneText(stream,linkerRand,y,"        "+adrR,"F1",8.5); y-=13;

                        if(diffFelder.length==0){
                            zeichneText(stream,linkerRand,y,"Abweichungen: keine","F1",8.5); y-=11;
                        }else{
                            zeichneText(stream,linkerRand,y,"Abweichende Felder:","F2",8.5); y-=11;
                            for(fj=0;fj<diffFelder.length;fj++){
                                var diffZeilen=textBrechen(diffFelder[fj],90);
                                var dz;
                                for(dz=0;dz<diffZeilen.length;dz++){
                                    zeichneText(stream,60,y,diffZeilen[dz],"F1",8.2);
                                    y-=10;
                                }
                            }
                        }

                        y-=5;
                        zeichneLinie(stream,linkerRand,y,rechterRand,y,"0.82",0.45);
                        y-=12;
                    }
                }

                seiteAbschliessen();

                var objekte=[];
                function addObj(inhalt){objekte.push(inhalt);return objekte.length;}

                var catalogId=addObj("");
                var pagesId=addObj("");
                var fontRegularId=addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
                var fontBoldId=addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

                var pageIds=[];
                var s;
                for(s=0;s<seiten.length;s++){
                    var content=seiten[s];
                    var contentId=addObj("<< /Length "+content.length+" >>\nstream\n"+content+"endstream");
                    var pageId=addObj("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+fontRegularId+" 0 R /F2 "+fontBoldId+" 0 R >> >> /Contents "+contentId+" 0 R >>");
                    pageIds.push(pageId);
                }

                objekte[catalogId-1]="<< /Type /Catalog /Pages "+pagesId+" 0 R >>";

                var kids=[];
                for(s=0;s<pageIds.length;s++)kids.push(pageIds[s]+" 0 R");
                objekte[pagesId-1]="<< /Type /Pages /Count "+pageIds.length+" /Kids [ "+kids.join(" ")+" ] >>";

                var pdf="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
                var offsets=[0];
                var oid;
                for(oid=1;oid<=objekte.length;oid++){
                    offsets[oid]=pdf.length;
                    pdf+=oid+" 0 obj\n"+objekte[oid-1]+"\nendobj\n";
                }

                var xrefOffset=pdf.length;
                pdf+="xref\n0 "+(objekte.length+1)+"\n";
                pdf+="0000000000 65535 f \n";
                for(oid=1;oid<=objekte.length;oid++){
                    var off=String(offsets[oid]);
                    while(off.length<10)off="0"+off;
                    pdf+=off+" 00000 n \n";
                }
                pdf+="trailer\n<< /Size "+(objekte.length+1)+" /Root "+catalogId+" 0 R >>\n";
                pdf+="startxref\n"+xrefOffset+"\n%%EOF";

                ziel.encoding="BINARY";
                if(!ziel.open("w"))throw new Error("Zieldatei konnte nicht ge\u00f6ffnet werden.");
                ziel.write(pdf);
                ziel.close();

                alert("Pr\u00fcfliste wurde erstellt:\r\r"+ziel.fsName);
            }catch(e){
                try{if(ziel&&ziel.opened)ziel.close();}catch(e2){}
                alert("Die Pr\u00fcfliste konnte nicht als PDF erstellt werden.\r\rFehler: "+e);
            }
        }

        function zeigeBereinigungSeite(mapping) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Datenbereinigung";
            var protokoll=sichereTextbereinigungAnwenden(csvDaten);
            var p=pruefungen(mapping);
            var auff=auffaelligeSammelnLokal(mapping,p);

            seitenContainer.add("statictext",undefined,"Datenbereinigung abgeschlossen");
            seitenContainer.add("statictext",undefined,"Der Mailing-Assistant hat die Datei gepr\u00fcft. Details werden im n\u00e4chsten Schritt bearbeitet.");

            var info=seitenContainer.add("panel");
            info.orientation="column";
            info.alignChildren=["left","top"];
            info.margins=18;
            info.spacing=8;

            info.add("statictext",undefined,"Gesamte Datens\u00e4tze: "+csvDaten.anzahl);
            info.add("statictext",undefined,"Auff\u00e4llige Datens\u00e4tze: "+auff.length);
            info.add("statictext",undefined,"Automatisch bereinigte Felder: "+protokoll.length);

            var trennung=info.add("statictext",undefined,"");
            trennung.preferredSize.height=4;

            info.add("statictext",undefined,"PLZ-Pr\u00fcfhinweise: "+p.plz.length);
            info.add("statictext",undefined,"Postalische Hinweise: "+p.postal.length);
            info.add("statictext",undefined,"Problematische/versteckte Zeichen: "+p.problem.length);

            seitenContainer.add("statictext",undefined,"Die Quelldatei bleibt unver\u00e4ndert. Korrekturen gelten nur f\u00fcr diesen Mailing-Auftrag.");

            var aktionen=seitenContainer.add("panel");
            aktionen.text="N\u00e4chster Schritt";
            aktionen.orientation="row";
            aktionen.alignChildren=["left","center"];
            aktionen.margins=15;
            aktionen.spacing=12;

            var pdf=aktionen.add("button",undefined,"Pr\u00fcfliste als PDF");
            pdf.enabled=auff.length>0 || protokoll.length>0 || eindeutigeDublettenPruefen(csvDaten,mapping).length>0;
            var freigabe=aktionen.add("button",undefined,"Weiter zur Datensatzfreigabe");

            pdf.onClick=function(){ aktuellesMapping=mapping; dlg.close(7); };
            freigabe.onClick=function(){zeigeFreigabeSeite(mapping,false);};

            var buttons=seitenContainer.add("group");
            buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            zurueck.onClick=function(){zeigeAdressSeite(mapping);};

            neuLayouten();
        }

        function zeigeFreigabeSeite(mapping,nurOffene) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Datensatzfreigabe";
            var p=pruefungen(mapping);
            var auff=auffaelligeSammelnLokal(mapping,p);
            var status=csvDaten.freigabestatus||{};
            var sichtbar=[],i;
            for(i=0;i<auff.length;i++){
                var st=status[auff[i].datensatz]||"Pr\u00fcfen";
                if(st=="Ausschlie\u00dfen")continue;
                if(nurOffene&&st!="Pr\u00fcfen")continue;
                sichtbar.push(auff[i]);
            }

            seitenContainer.add("statictext",undefined,"Datensatzfreigabe");
            seitenContainer.add("statictext",undefined,nurOffene?"Hier werden nur noch offene Datens\u00e4tze angezeigt.":"Auff\u00e4llige Datens\u00e4tze werden nicht automatisch verworfen. Lege f\u00fcr jeden Datensatz fest, wie er behandelt werden soll.");
            if(letzteNachricht!=""){zeigeNachricht(letzteNachricht);letzteNachricht="";}

            var info=seitenContainer.add("panel");info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=6;
            info.add("statictext",undefined,"Gesamte Datens\u00e4tze: "+csvDaten.anzahl);
            info.add("statictext",undefined,(nurOffene?"Offene Datens\u00e4tze: ":"Auff\u00e4llige Datens\u00e4tze: ")+sichtbar.length);
            info.add("statictext",undefined,"Unauff\u00e4llige Datens\u00e4tze werden automatisch als \u201e\u00dcbernehmen\u201c behandelt.");

            var sammelAktionen=seitenContainer.add("group");
            sammelAktionen.orientation="row";
            sammelAktionen.alignChildren=["left","center"];
            sammelAktionen.add("statictext",undefined,"Sammelaktion:");
            var alleUebernehmen=sammelAktionen.add("button",undefined,"Alle \u00fcbernehmen");
            var alleAusschliessen=sammelAktionen.add("button",undefined,"Alle ausschlie\u00dfen");

            var auswahl=[];
            if(sichtbar.length>0){
                var kopf=seitenContainer.add("group");kopf.orientation="row";
                var a=kopf.add("statictext",undefined,"Datensatz");a.preferredSize.width=70;
                var b=kopf.add("statictext",undefined,"Empf\u00e4nger");b.preferredSize.width=180;
                var cc=kopf.add("statictext",undefined,"Pr\u00fcfgrund");cc.preferredSize.width=420;
                var d=kopf.add("statictext",undefined,"Status");d.preferredSize.width=120;
                kopf.add("statictext",undefined,"Aktion");

                var panel=seitenContainer.add("panel");panel.orientation="column";panel.alignChildren=["fill","top"];panel.margins=12;panel.spacing=5;
                for(i=0;i<sichtbar.length;i++){
                    var nr=sichtbar[i].datensatz,ds=csvDaten.datensaetze[nr-1];
                    var emp=verbindeTeile([wertAusDatensatz(mapping,ds,"Firma"),wertAusDatensatz(mapping,ds,"Vorname"),wertAusDatensatz(mapping,ds,"Nachname")]);if(emp=="")emp="[ohne Empf\u00e4nger]";
                    var row=panel.add("group");row.orientation="row";row.alignChildren=["left","center"];
                    var nrt=row.add("statictext",undefined,String(nr));nrt.preferredSize.width=70;
                    var et=row.add("statictext",undefined,emp);et.preferredSize.width=180;
                    var gt=row.add("statictext",undefined,sichtbar[i].gruende.join(" "));gt.preferredSize.width=420;
                    var dd=row.add("dropdownlist",undefined,["Pr\u00fcfen","\u00dcbernehmen","Ausschlie\u00dfen"]);dd.preferredSize.width=120;
                    var bst=status[nr]||"Pr\u00fcfen";dd.selection=bst=="\u00dcbernehmen"?1:(bst=="Ausschlie\u00dfen"?2:0);
                    var bearbeiten=row.add("button",undefined,"Bearbeiten");bearbeiten.preferredSize.width=90;bearbeiten.datensatzNummer=nr;
                    bearbeiten.onClick=function(){
                        var si,k0,newStatus={};
                        if(csvDaten.freigabestatus){for(k0 in csvDaten.freigabestatus)if(csvDaten.freigabestatus.hasOwnProperty(k0))newStatus[k0]=csvDaten.freigabestatus[k0];}
                        else for(si=0;si<csvDaten.anzahl;si++)newStatus[si+1]="\u00dcbernehmen";
                        for(si=0;si<auswahl.length;si++)newStatus[auswahl[si].datensatz]=auswahl[si].dropdown.selection?auswahl[si].dropdown.selection.text:"Pr\u00fcfen";
                        csvDaten.freigabestatus=newStatus;
                        zeigeBearbeitenSeite(mapping,this.datensatzNummer,nurOffene);
                    };
                    auswahl.push({datensatz:nr,dropdown:dd});
                }
            } else seitenContainer.add("statictext",undefined,"Keine offenen auff\u00e4lligen Datens\u00e4tze vorhanden.");

            alleUebernehmen.enabled=auswahl.length>0;
            alleAusschliessen.enabled=auswahl.length>0;

            alleUebernehmen.onClick=function(){
                var ai;
                for(ai=0;ai<auswahl.length;ai++)auswahl[ai].dropdown.selection=1;
            };

            alleAusschliessen.onClick=function(){
                var ai;
                for(ai=0;ai<auswahl.length;ai++)auswahl[ai].dropdown.selection=2;
            };

            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,"Weiter");
            zurueck.onClick=function(){zeigeBereinigungSeite(mapping);};
            weiter.onClick=function(){
                var st={},ii,k0;
                if(csvDaten.freigabestatus){for(k0 in csvDaten.freigabestatus)if(csvDaten.freigabestatus.hasOwnProperty(k0))st[k0]=csvDaten.freigabestatus[k0];}
                else for(ii=0;ii<csvDaten.anzahl;ii++)st[ii+1]="\u00dcbernehmen";
                for(ii=0;ii<auswahl.length;ii++)st[auswahl[ii].datensatz]=auswahl[ii].dropdown.selection?auswahl[ii].dropdown.selection.text:"Pr\u00fcfen";
                csvDaten.freigabestatus=st;
                zeigeFreigabeUebersichtSeite(mapping);
            };
            neuLayouten();
        }

        function zeigeBearbeitenSeite(mapping,nr,nurOffene) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Datensatz "+nr+" bearbeiten";
            var datensatz=csvDaten.datensaetze[nr-1];
            seitenContainer.add("statictext",undefined,"Datensatz "+nr+" bearbeiten");
            seitenContainer.add("statictext",undefined,"Die Originaldatei bleibt unver\u00e4ndert. Ge\u00e4ndert wird nur die interne Arbeitskopie dieses Mailing-Auftrags.");

            function fehlerfelder(){
                var fehler={};
                var firma=wertAusDatensatz(mapping,datensatz,"Firma"),vor=wertAusDatensatz(mapping,datensatz,"Vorname"),nach=wertAusDatensatz(mapping,datensatz,"Nachname");
                var str=wertAusDatensatz(mapping,datensatz,"Stra\u00dfe"),hn=wertAusDatensatz(mapping,datensatz,"Hausnummer"),pf=wertAusDatensatz(mapping,datensatz,"Postfach");
                var plz=wertAusDatensatz(mapping,datensatz,"PLZ"),ort=wertAusDatensatz(mapping,datensatz,"Ort"),land=wertAusDatensatz(mapping,datensatz,"Land"),lk=land.toLowerCase();
                var de=land==""||lk=="deutschland"||lk=="de"||lk=="deu"||lk=="germany";
                if(firma==""&&vor==""&&nach==""){fehler["Firma"]="fehlt";fehler["Vorname"]="fehlt";fehler["Nachname"]="fehlt";}
                if(pf==""){
                    var strassenAnalyse=strassenHausnummerAnalysieren(str,hn);
                    if(str==""){fehler["Stra\u00dfe"]="fehlt";fehler["Postfach"]="fehlt";}
                    else if(!strassenAnalyse.hausnummerVorhanden)fehler["Hausnummer"]="fehlt";
                    if(strassenAnalyse.konflikt){fehler["Stra\u00dfe"]="pr\u00fcfen";fehler["Hausnummer"]="pr\u00fcfen";}
                }
                var plzOrtAnalyse=plzOrtAnalysieren(plz,ort,land);
                if(!plzOrtAnalyse.plzVorhanden)fehler["PLZ"]="fehlt";
                else if(plzOrtAnalyse.ungueltigeDePlz)fehler["PLZ"]="ung\u00fcltig";
                if(!plzOrtAnalyse.ortVorhanden)fehler["Ort"]="fehlt";
                if(plzOrtAnalyse.konflikt){fehler["PLZ"]="pr\u00fcfen";fehler["Ort"]="pr\u00fcfen";}
                return fehler;
            }
            var fehler=fehlerfelder();
            var formular=seitenContainer.add("panel");formular.orientation="column";formular.alignChildren=["fill","top"];formular.margins=15;formular.spacing=8;
            var felder=["Firma","Anrede","Titel","Vorname","Nachname","Adresszusatz","Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land"];
            var eingaben=[],i;
            for(i=0;i<felder.length;i++){
                var feld=felder[i],idx=mappingSpaltenindex(csvDaten,mapping,feld);if(idx<0)continue;
                var zeile=formular.add("group");zeile.orientation="row";
                var lab=zeile.add("statictext",undefined,feld+":");lab.preferredSize.width=130;
                var edit=zeile.add("edittext",undefined,wertAusDatensatz(mapping,datensatz,feld));edit.characters=34;
                if(fehler[feld]){
                    var bild=validierungsBildDatei(fehler[feld]);
                    if(bild&&bild.exists){var im=zeile.add("image",undefined,bild);im.preferredSize=[95,22];}
                    else {var tx=zeile.add("statictext",undefined,fehler[feld]);tx.preferredSize.width=95;}
                }else{var ph=zeile.add("statictext",undefined,"");ph.preferredSize.width=95;}
                eingaben.push({feld:feld,edit:edit});
            }

            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var abbrechen=buttons.add("button",undefined,"Abbrechen");
            var speichern=buttons.add("button",undefined,"Speichern");
            abbrechen.onClick=function(){zeigeFreigabeSeite(mapping,nurOffene);};
            speichern.onClick=function(){
                var j;for(j=0;j<eingaben.length;j++)mappingWertSetzenLokal(mapping,datensatz,eingaben[j].feld,eingaben[j].edit.text);
                var pp=pruefungen(mapping);
                if(!csvDaten.freigabestatus)csvDaten.freigabestatus={};
                csvDaten.freigabestatus[nr]=datensatzHatPruefhinweisLokal(nr,pp)?"Pr\u00fcfen":"\u00dcbernehmen";
                letzteNachricht=csvDaten.freigabestatus[nr]=="\u00dcbernehmen"?"Datensatz "+nr+" wurde gespeichert und erfolgreich erneut gepr\u00fcft.":"Datensatz "+nr+" wurde gespeichert. Es bestehen weiterhin Pr\u00fcfhinweise.";
                zeigeFreigabeSeite(mapping,nurOffene);
            };
            neuLayouten();
        }

        function zeigeFreigabeUebersichtSeite(mapping) {
            leeren();dlg.text="Mailing-Assistant \u2013 Freigabe\u00fcbersicht";
            var status=csvDaten.freigabestatus||{},ue=0,aus=0,pr=0,offen=[],i;
            for(i=1;i<=csvDaten.anzahl;i++){var w=status[i]||"\u00dcbernehmen";if(w=="\u00dcbernehmen")ue++;else if(w=="Ausschlie\u00dfen")aus++;else{pr++;offen.push(i);}}
            seitenContainer.add("statictext",undefined,"Freigabe\u00fcbersicht");
            var info=seitenContainer.add("panel");info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=6;
            info.add("statictext",undefined,"Gesamte Datens\u00e4tze: "+csvDaten.anzahl);
            info.add("statictext",undefined,"\u00dcbernehmen: "+ue);info.add("statictext",undefined,"Ausschlie\u00dfen: "+aus);info.add("statictext",undefined,"Pr\u00fcfen: "+pr);
            if(pr>0){seitenContainer.add("statictext",undefined,"Noch offen: Datensatz "+offen.join(", "));seitenContainer.add("statictext",undefined,"Der Mailing-Auftrag ist noch nicht vollst\u00e4ndig freigegeben.");}
            else seitenContainer.add("statictext",undefined,"Alle Datens\u00e4tze sind entschieden. Der Mailing-Auftrag kann weiterverarbeitet werden.");
            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,pr>0?"Offene Datens\u00e4tze pr\u00fcfen":"Weiter");
            zurueck.onClick=function(){zeigeFreigabeSeite(mapping,false);};
            weiter.onClick=function(){if(pr>0)zeigeFreigabeSeite(mapping,true);else zeigeFinaleFreigabeSeite(mapping);};
            neuLayouten();
        }

        function zeigeFinaleFreigabeSeite(mapping) {
            leeren();dlg.text="Mailing-Assistant \u2013 Finale Freigabe";
            var status=csvDaten.freigabestatus||{},frei=[],aus=[],offen=[],i;
            for(i=1;i<=csvDaten.anzahl;i++){var w=status[i]||"\u00dcbernehmen";if(w=="\u00dcbernehmen")frei.push(i);else if(w=="Ausschlie\u00dfen")aus.push(i);else offen.push(i);}
            seitenContainer.add("statictext",undefined,"Finale Freigabe");
            var info=seitenContainer.add("panel");info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=6;
            info.add("statictext",undefined,"Gesamte Datens\u00e4tze: "+csvDaten.anzahl);
            info.add("statictext",undefined,"Freigegebene Auflage: "+frei.length);
            info.add("statictext",undefined,"Ausgeschlossen: "+aus.length);
            info.add("statictext",undefined,"Noch offen: "+offen.length);
            if(aus.length>0)seitenContainer.add("statictext",undefined,"Ausgeschlossene Datens\u00e4tze: "+aus.join(", "));
            if(offen.length>0)seitenContainer.add("statictext",undefined,"Offene Datens\u00e4tze: "+offen.join(", "));
            else{seitenContainer.add("statictext",undefined,"Alle Datens\u00e4tze sind entschieden.");seitenContainer.add("statictext",undefined,"Die freigegebene Auflage betr\u00e4gt "+frei.length+".");}
            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,offen.length>0?"Offene Datens\u00e4tze pr\u00fcfen":"Weiter zur Mailing-Verarbeitung");
            zurueck.onClick=function(){zeigeFreigabeUebersichtSeite(mapping);};
            weiter.onClick=function(){
                if(offen.length>0){zeigeFreigabeSeite(mapping,true);return;}
                csvDaten.freigegebeneDatensatznummern=frei;
                csvDaten.ausgeschlosseneDatensatznummern=aus;
                zeigeDublettenPruefungSeite(mapping);
            };
            neuLayouten();
        }

        function zeigeDublettenZusammenfuehrenSeite(mapping, originalNr, dubletteNr) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Dublette zusammenf\u00fchren";

            var linksDs=csvDaten.datensaetze[originalNr-1];
            var rechtsDs=csvDaten.datensaetze[dubletteNr-1];
            var felder=[
                "Firma","Anrede","Titel","Vorname","Nachname","Adresszusatz",
                "Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land",
                "E-Mail","Telefon","Kundennummer","Selektionsmerkmal","Sonstiges"
            ];

            var paare=csvDaten.aktuelleDublettenpaare||[];
            var paarIndex=csvDaten.dublettenSeitenIndex||0;
            var pi;
            for(pi=0;pi<paare.length;pi++){
                if(paare[pi].original==originalNr&&paare[pi].datensatz==dubletteNr){
                    paarIndex=pi;
                    break;
                }
            }
            csvDaten.dublettenSeitenIndex=paarIndex;

            function norm(wert){
                return trimText(wert).toLowerCase().replace(/\s+/g," ");
            }

            var unterschiede=[];
            var identisch=0;
            var i;
            for(i=0;i<felder.length;i++){
                var feld=felder[i];
                var lv=wertAusDatensatz(mapping,linksDs,feld);
                var rv=wertAusDatensatz(mapping,rechtsDs,feld);
                if(lv==""&&rv=="")continue;
                if(norm(lv)==norm(rv))identisch++;
                else unterschiede.push({feld:feld,links:lv,rechts:rv});
            }

            seitenContainer.add("statictext",undefined,"Dublette zusammenf\u00fchren");
            seitenContainer.add("statictext",undefined,"W\u00e4hle nur bei den abweichenden Feldern den richtigen Wert. Identische Felder werden automatisch \u00fcbernommen.");

            var info=seitenContainer.add("panel");
            info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=5;
            info.add("statictext",undefined,"Datensatz "+originalNr+"  +  Datensatz "+dubletteNr);
            if(paare.length>0)info.add("statictext",undefined,"Dublettenpaar "+(paarIndex+1)+" von "+paare.length);
            info.add("statictext",undefined,"Abweichende Felder: "+unterschiede.length);
            info.add("statictext",undefined,"Identische Felder automatisch \u00fcbernommen: "+identisch);

            var eingaben=[];

            for(i=0;i<unterschiede.length;i++){
                var u=unterschiede[i];

                var feldPanel=seitenContainer.add("panel");
                feldPanel.text=u.feld;
                feldPanel.orientation="column";
                feldPanel.alignChildren=["fill","top"];
                feldPanel.margins=12;
                feldPanel.spacing=7;

                var problemKopf=feldPanel.add("group");
                problemKopf.orientation="row";
                problemKopf.alignChildren=["left","center"];
                problemKopf.spacing=8;

                var problemMarker=problemKopf.add("panel");
                problemMarker.preferredSize=[9,18];
                problemMarker.minimumSize=[9,18];
                problemMarker.maximumSize=[9,18];
                problemMarker.onDraw=function(){
                    var g=this.graphics;
                    var b=g.newBrush(g.BrushType.SOLID_COLOR,[0.95,0.55,0.10,1]);
                    g.newPath();
                    g.rectPath(0,0,this.size.width,this.size.height);
                    g.fillPath(b);
                };

                problemKopf.add("statictext",undefined,"Abweichender Wert");

                var quellwahl=feldPanel.add("group");
                quellwahl.orientation="row";
                quellwahl.alignChildren=["left","center"];
                quellwahl.spacing=16;

                var linksRadio=quellwahl.add("radiobutton",undefined,"Datensatz "+originalNr+": "+(u.links!=""?u.links:"[leer]"));
                linksRadio.preferredSize.width=330;
                var rechtsRadio=quellwahl.add("radiobutton",undefined,"Datensatz "+dubletteNr+": "+(u.rechts!=""?u.rechts:"[leer]"));
                rechtsRadio.preferredSize.width=330;

                var eigen=feldPanel.add("group");
                eigen.orientation="row";
                eigen.alignChildren=["left","center"];
                var eigenRadio=eigen.add("radiobutton",undefined,"Eigener Wert:");
                eigenRadio.preferredSize.width=105;
                var eigenEdit=eigen.add("edittext",undefined,"");
                eigenEdit.preferredSize.width=555;

                linksRadio.value=true;

                eigenEdit.onChanging=function(){
                    if(this.text!="")this.eigenRadio.value=true;
                };
                eigenEdit.eigenRadio=eigenRadio;

                eingaben.push({
                    feld:u.feld,
                    links:u.links,
                    rechts:u.rechts,
                    linksRadio:linksRadio,
                    rechtsRadio:rechtsRadio,
                    eigenRadio:eigenRadio,
                    eigenEdit:eigenEdit
                });
            }

            var navigation=seitenContainer.add("group");
            navigation.orientation="row";
            navigation.alignment="fill";

            var navLinks=navigation.add("group");
            navLinks.alignment="left";
            var vorherigeDublette=navLinks.add("button",undefined,"Vorherige Dublette");
            vorherigeDublette.enabled=paare.length>0&&paarIndex>0;

            var paarAnzeige=navLinks.add("statictext",undefined,paare.length>0?"Paar "+(paarIndex+1)+" von "+paare.length:"");
            paarAnzeige.preferredSize.width=90;

            var naechsteDublette=navLinks.add("button",undefined,"N\u00e4chste Dublette");
            naechsteDublette.enabled=paare.length>0&&paarIndex<paare.length-1;

            var buttons=navigation.add("group");
            buttons.alignment="right";
            var abbrechen=buttons.add("button",undefined,"Zur\u00fcck");
            var speichern=buttons.add("button",undefined,"Zusammenf\u00fchren");

            vorherigeDublette.onClick=function(){
                if(paarIndex<=0||paare.length==0)return;
                csvDaten.dublettenSeitenIndex=paarIndex-1;
                var p=paare[paarIndex-1];
                zeigeDublettenZusammenfuehrenSeite(mapping,p.original,p.datensatz);
            };

            naechsteDublette.onClick=function(){
                if(paarIndex>=paare.length-1||paare.length==0)return;
                csvDaten.dublettenSeitenIndex=paarIndex+1;
                var p=paare[paarIndex+1];
                zeigeDublettenZusammenfuehrenSeite(mapping,p.original,p.datensatz);
            };

            abbrechen.onClick=function(){zeigeDublettenPruefungSeite(mapping);};

            speichern.onClick=function(){
                var j;
                for(j=0;j<eingaben.length;j++){
                    var e=eingaben[j];
                    var zielwert=e.links;
                    if(e.rechtsRadio.value)zielwert=e.rechts;
                    else if(e.eigenRadio.value)zielwert=e.eigenEdit.text;
                    mappingWertSetzenLokal(mapping,linksDs,e.feld,zielwert);
                }

                if(!csvDaten.freigabestatus)csvDaten.freigabestatus={};
                csvDaten.freigabestatus[originalNr]="\u00dcbernehmen";
                csvDaten.freigabestatus[dubletteNr]="Ausschlie\u00dfen";

                if(!csvDaten.dublettenstatus)csvDaten.dublettenstatus={};
                csvDaten.dublettenstatus[String(originalNr)+"-"+String(dubletteNr)]="zusammengefuehrt";

                letzteNachricht="Datensatz "+originalNr+" wurde zusammengef\u00fchrt; Datensatz "+dubletteNr+" wurde ausgeschlossen.";
                zeigeDublettenPruefungSeite(mapping);
            };

            neuLayouten();
        }

        function zeigeDublettenPruefungSeite(mapping) {
            leeren();
            dlg.text="Mailing-Assistant \u2013 Dublettenpr\u00fcfung";

            if(!csvDaten.freigabestatus)csvDaten.freigabestatus={};
            if(!csvDaten.dublettenstatus)csvDaten.dublettenstatus={};
            if(!csvDaten.autoDublettenEntfernt)csvDaten.autoDublettenEntfernt={};

            var status=csvDaten.freigabestatus;
            var ausgeschlossen={};
            var i;
            for(i=1;i<=csvDaten.anzahl;i++) {
                if((status[i]||"\u00dcbernehmen")=="Ausschlie\u00dfen") ausgeschlossen[i]=true;
            }

            function datensaetzeExaktGleich(nr1,nr2) {
                var a=csvDaten.datensaetze[nr1-1];
                var b=csvDaten.datensaetze[nr2-1];
                if(!a||!b)return false;
                var max=a.length>b.length?a.length:b.length;
                var j;
                for(j=0;j<max;j++){
                    var av=j<a.length?String(a[j]):"";
                    var bv=j<b.length?String(b[j]):"";
                    if(av!=bv)return false;
                }
                return true;
            }

            var alle=eindeutigeDublettenPruefen(csvDaten,mapping);
            var dubletten=[];

            for(i=0;i<alle.length;i++) {
                var autoKey=String(alle[i].original)+"-"+String(alle[i].datensatz);

                if(datensaetzeExaktGleich(alle[i].original,alle[i].datensatz)){
                    if(!csvDaten.autoDublettenEntfernt[autoKey]){
                        csvDaten.autoDublettenEntfernt[autoKey]=true;
                        status[alle[i].datensatz]="Ausschlie\u00dfen";
                    }
                    ausgeschlossen[alle[i].datensatz]=true;
                    continue;
                }

                if(ausgeschlossen[alle[i].datensatz]||ausgeschlossen[alle[i].original])continue;
                dubletten.push(alle[i]);
            }

            csvDaten.aktuelleDublettenpaare=[];
            for(i=0;i<dubletten.length;i++){
                csvDaten.aktuelleDublettenpaare.push({
                    original:dubletten[i].original,
                    datensatz:dubletten[i].datensatz
                });
            }

            var automatischEntfernt=0;
            var ak;
            for(ak in csvDaten.autoDublettenEntfernt){
                if(csvDaten.autoDublettenEntfernt.hasOwnProperty(ak)&&csvDaten.autoDublettenEntfernt[ak])automatischEntfernt++;
            }

            function norm(wert){
                return trimText(wert).toLowerCase().replace(/\s+/g," ");
            }

            function differenzen(nr1,nr2){
                var ds1=csvDaten.datensaetze[nr1-1];
                var ds2=csvDaten.datensaetze[nr2-1];
                var felder=[
                    "Firma","Anrede","Titel","Vorname","Nachname","Adresszusatz",
                    "Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land",
                    "E-Mail","Telefon","Kundennummer","Selektionsmerkmal","Sonstiges"
                ];
                var diff=[],gleich=0,j;
                for(j=0;j<felder.length;j++){
                    var feld=felder[j];
                    var l=wertAusDatensatz(mapping,ds1,feld);
                    var r=wertAusDatensatz(mapping,ds2,feld);
                    if(l==""&&r=="")continue;
                    if(norm(l)==norm(r))gleich++;
                    else diff.push({feld:feld,links:l,rechts:r});
                }
                return {diff:diff,gleich:gleich};
            }

            function adressKurz(nr){
                var ds=csvDaten.datensaetze[nr-1];
                var firma=wertAusDatensatz(mapping,ds,"Firma");
                var person=verbindeTeile([
                    wertAusDatensatz(mapping,ds,"Anrede"),
                    wertAusDatensatz(mapping,ds,"Titel"),
                    wertAusDatensatz(mapping,ds,"Vorname"),
                    wertAusDatensatz(mapping,ds,"Nachname")
                ]);
                var name=firma!=""?(person!=""?firma+" / "+person:firma):person;
                var postfach=wertAusDatensatz(mapping,ds,"Postfach");
                var strasse=strassenHausnummerAnalysieren(
                    wertAusDatensatz(mapping,ds,"Stra\u00dfe"),
                    wertAusDatensatz(mapping,ds,"Hausnummer")
                ).zeile;
                var plzOrt=plzOrtAnalysieren(
                    wertAusDatensatz(mapping,ds,"PLZ"),
                    wertAusDatensatz(mapping,ds,"Ort"),
                    wertAusDatensatz(mapping,ds,"Land")
                ).zeile;
                return {
                    name:name!=""?name:"[ohne Empf\u00e4nger]",
                    adresse:verbindeTeile([postfach!=""?postfachZeileNormalisieren(postfach):strasse,plzOrt])
                };
            }

            seitenContainer.add("statictext",undefined,"Dublettenpr\u00fcfung");
            seitenContainer.add("statictext",undefined,"Nur abweichende Werte werden angezeigt. Vollst\u00e4ndig identische Dubletten entfernt der Mailing-Assistant automatisch.");

            var info=seitenContainer.add("panel");
            info.orientation="row";info.alignChildren=["left","center"];info.margins=15;info.spacing=24;
            info.add("statictext",undefined,"Manuell zu pr\u00fcfen: "+dubletten.length);
            info.add("statictext",undefined,"Identische automatisch entfernt: "+automatischEntfernt);

            if(dubletten.length==0) {
                delete csvDaten.dublettenSeitenIndex;
                seitenContainer.add("statictext",undefined,automatischEntfernt>0?"Alle Dubletten sind bereinigt.":"Keine Dubletten gefunden.");
                var buttonsLeer=seitenContainer.add("group");buttonsLeer.alignment="right";
                var zurueckLeer=buttonsLeer.add("button",undefined,"Zur\u00fcck");
                var weiterLeer=buttonsLeer.add("button",undefined,"Weiter zur Mailing-Verarbeitung");
                zurueckLeer.onClick=function(){zeigeFinaleFreigabeSeite(mapping);};
                weiterLeer.onClick=function(){
                    var frei=[],aus=[],j;
                    for(j=1;j<=csvDaten.anzahl;j++){
                        var w=(csvDaten.freigabestatus||{})[j]||"\u00dcbernehmen";
                        if(w=="Ausschlie\u00dfen")aus.push(j);else frei.push(j);
                    }
                    csvDaten.freigegebeneDatensatznummern=frei;
                    csvDaten.ausgeschlosseneDatensatznummern=aus;
                    zeigeMailingSeite(mapping);
                };
                neuLayouten();
                return;
            }

            var index=csvDaten.dublettenSeitenIndex||0;
            if(index<0)index=0;
            if(index>=dubletten.length)index=dubletten.length-1;
            csvDaten.dublettenSeitenIndex=index;

            var d=dubletten[index];
            var schluessel=String(d.original)+"-"+String(d.datensatz);
            var vergleich=differenzen(d.original,d.datensatz);
            var linksKurz=adressKurz(d.original);
            var rechtsKurz=adressKurz(d.datensatz);

            function quellzeileFuerDatensatzLokal(nr){
                if(csvDaten.quellzeilen && csvDaten.quellzeilen.length>=nr)return csvDaten.quellzeilen[nr-1];
                return nr+1;
            }

            function entscheidungsText(wert){
                if(wert=="links")return "Datensatz "+d.original+" behalten";
                if(wert=="rechts")return "Datensatz "+d.datensatz+" behalten";
                if(wert=="beide")return "Beide behalten";
                if(wert=="zusammengefuehrt")return "Zusammengef\u00fchrt";
                return "Noch nicht entschieden";
            }

            // Auf dieser Seite bewusst kompakter als die langen Freigabe-Ansichten.
            try{
                seitenHost.preferredSize=[930,520];
                seitenContainer.preferredSize=[930,520];
            }catch(eSize){}

            var oben=seitenContainer.add("group");
            oben.orientation="row";
            oben.alignment="fill";
            oben.alignChildren=["left","center"];

            var titelGruppe=oben.add("group");
            titelGruppe.orientation="column";
            titelGruppe.alignChildren=["left","top"];
            titelGruppe.add("statictext",undefined,"Dublettenpr\u00fcfung");
            titelGruppe.add("statictext",undefined,"Nur Unterschiede entscheiden \u2013 identische Felder bleiben unver\u00e4ndert.");

            var statusGruppe=oben.add("group");
            statusGruppe.alignment="right";
            statusGruppe.orientation="column";
            statusGruppe.alignChildren=["right","top"];
            statusGruppe.add("statictext",undefined,"Paar "+(index+1)+" von "+dubletten.length);
            statusGruppe.add("statictext",undefined,dubletten.length+" manuell  \u00b7  "+automatischEntfernt+" automatisch entfernt");

            var karten=seitenContainer.add("group");
            karten.orientation="row";
            karten.alignChildren=["fill","top"];
            karten.spacing=16;

            var linksInfo=karten.add("panel");
            linksInfo.text="Datensatz "+d.original+"  \u00b7  Excel-Zeile "+quellzeileFuerDatensatzLokal(d.original);
            linksInfo.orientation="column";
            linksInfo.alignChildren=["left","top"];
            linksInfo.margins=14;
            linksInfo.preferredSize.width=445;
            var li1=linksInfo.add("statictext",undefined,linksKurz.name);
            li1.preferredSize.width=410;
            var li2=linksInfo.add("statictext",undefined,linksKurz.adresse);
            li2.preferredSize.width=410;

            var rechtsInfo=karten.add("panel");
            rechtsInfo.text="Datensatz "+d.datensatz+"  \u00b7  Excel-Zeile "+quellzeileFuerDatensatzLokal(d.datensatz);
            rechtsInfo.orientation="column";
            rechtsInfo.alignChildren=["left","top"];
            rechtsInfo.margins=14;
            rechtsInfo.preferredSize.width=445;
            var ri1=rechtsInfo.add("statictext",undefined,rechtsKurz.name);
            ri1.preferredSize.width=410;
            var ri2=rechtsInfo.add("statictext",undefined,rechtsKurz.adresse);
            ri2.preferredSize.width=410;

            var diffPanel=seitenContainer.add("panel");
            diffPanel.text="Abweichungen";
            diffPanel.orientation="column";
            diffPanel.alignChildren=["fill","top"];
            diffPanel.margins=12;
            diffPanel.spacing=5;

            var dh=diffPanel.add("group");
            dh.orientation="row";
            var dh0=dh.add("statictext",undefined,"Feld");dh0.preferredSize.width=145;
            var dh1=dh.add("statictext",undefined,"Datensatz "+d.original);dh1.preferredSize.width=345;
            var dh2=dh.add("statictext",undefined,"Datensatz "+d.datensatz);dh2.preferredSize.width=345;

            for(i=0;i<vergleich.diff.length;i++){
                var dr=diffPanel.add("group");
                dr.orientation="row";
                dr.alignChildren=["left","center"];

                var dm=dr.add("panel");
                dm.preferredSize=[6,18];
                dm.minimumSize=[6,18];
                dm.maximumSize=[6,18];
                dm.onDraw=function(){
                    var g=this.graphics;
                    var b=g.newBrush(g.BrushType.SOLID_COLOR,[0.95,0.55,0.10,1]);
                    g.newPath();
                    g.rectPath(0,0,this.size.width,this.size.height);
                    g.fillPath(b);
                };

                var f1=dr.add("statictext",undefined,vergleich.diff[i].feld);
                f1.preferredSize.width=139;
                var f2=dr.add("statictext",undefined,vergleich.diff[i].links!=""?vergleich.diff[i].links:"[leer]");
                f2.preferredSize.width=345;
                var f3=dr.add("statictext",undefined,vergleich.diff[i].rechts!=""?vergleich.diff[i].rechts:"[leer]");
                f3.preferredSize.width=345;
            }

            var identisch=diffPanel.add("statictext",undefined,vergleich.gleich+" weitere Felder identisch");
            identisch.alignment="left";

            var alt=csvDaten.dublettenstatus[schluessel]||"pruefen";

            var aktStatus=seitenContainer.add("statictext",undefined,"Aktuelle Entscheidung: "+entscheidungsText(alt));
            aktStatus.alignment="left";

            var entscheidung=seitenContainer.add("panel");
            entscheidung.text="Entscheidung";
            entscheidung.orientation="column";
            entscheidung.alignChildren=["fill","top"];
            entscheidung.margins=12;
            entscheidung.spacing=8;

            var aktionsZeile=entscheidung.add("group");
            aktionsZeile.orientation="row";
            aktionsZeile.alignChildren=["fill","center"];
            aktionsZeile.spacing=10;

            var linksBehalten=aktionsZeile.add("button",undefined,String(d.original)+" behalten");
            linksBehalten.preferredSize.width=180;

            var zusammenfuehren=aktionsZeile.add("button",undefined,"Zusammenf\u00fchren");
            zusammenfuehren.preferredSize.width=200;

            var rechtsBehalten=aktionsZeile.add("button",undefined,String(d.datensatz)+" behalten");
            rechtsBehalten.preferredSize.width=180;

            var beideBehalten=aktionsZeile.add("button",undefined,"Beide behalten");
            beideBehalten.preferredSize.width=180;

            function entscheidungSpeichern(wert){
                csvDaten.dublettenstatus[schluessel]=wert;
            }

            function zumNaechstenOderAbschluss(){
                if(index<dubletten.length-1){
                    csvDaten.dublettenSeitenIndex=index+1;
                    zeigeDublettenPruefungSeite(mapping);
                    return;
                }

                var offen=[],j;
                for(j=0;j<dubletten.length;j++){
                    var dj=dubletten[j];
                    var key=String(dj.original)+"-"+String(dj.datensatz);
                    var e0=csvDaten.dublettenstatus[key]||"pruefen";
                    if(e0=="pruefen")offen.push(j);
                }

                if(offen.length>0){
                    csvDaten.dublettenSeitenIndex=offen[0];
                    letzteNachricht="Noch nicht entschieden: "+offen.length+" Dublettenpaar(e).";
                    zeigeDublettenPruefungSeite(mapping);
                    return;
                }

                for(j=0;j<dubletten.length;j++){
                    var a=dubletten[j];
                    var key2=String(a.original)+"-"+String(a.datensatz);
                    var e=csvDaten.dublettenstatus[key2];

                    if(e=="links"){
                        csvDaten.freigabestatus[a.original]="\u00dcbernehmen";
                        csvDaten.freigabestatus[a.datensatz]="Ausschlie\u00dfen";
                    }else if(e=="rechts"){
                        csvDaten.freigabestatus[a.original]="Ausschlie\u00dfen";
                        csvDaten.freigabestatus[a.datensatz]="\u00dcbernehmen";
                    }else if(e=="beide"){
                        csvDaten.freigabestatus[a.original]="\u00dcbernehmen";
                        csvDaten.freigabestatus[a.datensatz]="\u00dcbernehmen";
                    }
                }

                var frei=[],aus=[],n;
                for(n=1;n<=csvDaten.anzahl;n++){
                    var w=csvDaten.freigabestatus[n]||"\u00dcbernehmen";
                    if(w=="Ausschlie\u00dfen")aus.push(n);else frei.push(n);
                }
                csvDaten.freigegebeneDatensatznummern=frei;
                csvDaten.ausgeschlosseneDatensatznummern=aus;
                delete csvDaten.dublettenSeitenIndex;
                zeigeMailingSeite(mapping);
            }

            linksBehalten.onClick=function(){
                entscheidungSpeichern("links");
                zumNaechstenOderAbschluss();
            };

            rechtsBehalten.onClick=function(){
                entscheidungSpeichern("rechts");
                zumNaechstenOderAbschluss();
            };

            beideBehalten.onClick=function(){
                entscheidungSpeichern("beide");
                zumNaechstenOderAbschluss();
            };

            zusammenfuehren.onClick=function(){
                zeigeDublettenZusammenfuehrenSeite(mapping,d.original,d.datensatz);
            };

            var navigation=seitenContainer.add("group");
            navigation.orientation="row";
            navigation.alignment="fill";

            var navLinks=navigation.add("group");
            navLinks.alignment="left";
            var zurFreigabe=navLinks.add("button",undefined,"Zur\u00fcck zur Freigabe");
            var vorheriges=navLinks.add("button",undefined,"\u2190 Vorheriges Paar");
            vorheriges.enabled=index>0;

            var navRechts=navigation.add("group");
            navRechts.alignment="right";
            var naechstes=navRechts.add("button",undefined,index<dubletten.length-1?"N\u00e4chstes Paar \u2192":"Pr\u00fcfung abschlie\u00dfen");

            zurFreigabe.onClick=function(){
                delete csvDaten.dublettenSeitenIndex;
                zeigeFinaleFreigabeSeite(mapping);
            };

            vorheriges.onClick=function(){
                csvDaten.dublettenSeitenIndex=index-1;
                zeigeDublettenPruefungSeite(mapping);
            };

            naechstes.onClick=function(){
                var ent=csvDaten.dublettenstatus[schluessel]||"pruefen";
                if(ent=="pruefen"){
                    letzteNachricht="Bitte zuerst eine Entscheidung treffen oder die Datens\u00e4tze zusammenf\u00fchren.";
                    zeigeDublettenPruefungSeite(mapping);
                    return;
                }
                zumNaechstenOderAbschluss();
            };

            if(letzteNachricht!=""){zeigeNachricht(letzteNachricht);letzteNachricht="";}
            neuLayouten();
        }

        function zeigeMailingSeite(mapping) {
            leeren();dlg.text="Mailing-Assistant \u2013 Mailing-Verarbeitung";
            var frei=csvDaten.freigegebeneDatensatznummern||[],aus=csvDaten.ausgeschlosseneDatensatznummern||[];
            seitenContainer.add("statictext",undefined,"Mailing-Verarbeitung");
            seitenContainer.add("statictext",undefined,"Vorschau der freigegebenen Datens\u00e4tze. Ausgeschlossene Datens\u00e4tze sind hier bereits entfernt.");
            var info=seitenContainer.add("panel");info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=6;
            info.add("statictext",undefined,"Freigegebene Auflage: "+frei.length);info.add("statictext",undefined,"Ausgeschlossen: "+aus.length);
            var bereich=seitenContainer.add("panel");bereich.text="Produktionsvorschau \u2013 erste 20 freigegebene Datens\u00e4tze";bereich.orientation="column";bereich.alignChildren=["fill","top"];bereich.margins=15;
            var liste=bereich.add("listbox",undefined,[],{numberOfColumns:5,showHeaders:true,columnTitles:["Datensatz","Empf\u00e4nger","Anschrift","PLZ / Ort","Land"],columnWidths:[70,200,220,160,120]});liste.preferredSize=[800,320];
            var max=Math.min(20,frei.length),i;
            for(i=0;i<max;i++){
                var nr=frei[i],ds=csvDaten.datensaetze[nr-1];
                var firma=wertAusDatensatz(mapping,ds,"Firma");
                var person=verbindeTeile([wertAusDatensatz(mapping,ds,"Anrede"),wertAusDatensatz(mapping,ds,"Titel"),wertAusDatensatz(mapping,ds,"Vorname"),wertAusDatensatz(mapping,ds,"Nachname")]);
                var emp=firma!=""?(person!=""?firma+" / "+person:firma):person;if(emp=="")emp="[ohne Empf\u00e4nger]";
                var pf=wertAusDatensatz(mapping,ds,"Postfach");
                var strassenAnalyse=strassenHausnummerAnalysieren(
                    wertAusDatensatz(mapping,ds,"Stra\u00dfe"),
                    wertAusDatensatz(mapping,ds,"Hausnummer")
                );
                var ansch=pf!=""?postfachZeileNormalisieren(pf):strassenAnalyse.zeile;
                var land=wertAusDatensatz(mapping,ds,"Land");
                var plzOrtAnalyse=plzOrtAnalysieren(
                    wertAusDatensatz(mapping,ds,"PLZ"),
                    wertAusDatensatz(mapping,ds,"Ort"),
                    land
                );
                var po=plzOrtAnalyse.zeile;
                if(land=="")land="Deutschland";
                var en=liste.add("item",String(nr));en.subItems[0].text=emp;en.subItems[1].text=ansch;en.subItems[2].text=po;en.subItems[3].text=land;
            }
            seitenContainer.add("statictext",undefined,max+" von "+frei.length+" freigegebenen Datens\u00e4tzen werden angezeigt.");
            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var weiter=buttons.add("button",undefined,"Weiter");
            zurueck.onClick=function(){zeigeFinaleFreigabeSeite(mapping);};
            weiter.onClick=function(){zeigeAusgabeSeite(mapping);};
            neuLayouten();
        }

        function exportiereInDesignDatenquelle(mapping) {
            var freigegeben = csvDaten.freigegebeneDatensatznummern || [];
            if (freigegeben.length == 0) {
                letzteNachricht = "Es sind keine freigegebenen Datensätze vorhanden.";
                return null;
            }

            var exportFelder = ["Anrede","Titel","Vorname","Nachname","Firma","Adresszusatz","Stra\u00dfe","Hausnummer","Postfach","PLZ","Ort","Land","E-Mail","Telefon","Kundennummer","Selektionsmerkmal","Sonstiges"];
            var i;

            function bereinigeExportWert(wert) {
                wert = wert === null || wert === undefined ? "" : String(wert);
                wert = wert.replace(/\t/g, " ");
                wert = wert.replace(/[\r\n]+/g, " ");
                return wert;
            }

            function headerName(feld) {
                if (feld == "Stra\u00dfe") return "Strasse";
                if (feld == "E-Mail") return "E_Mail";
                return feld;
            }

            function normalisiereExportSpaltenname(text) {
                var wert = trimText(text).toLowerCase();
                wert = wert.replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe").replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss");
                return wert.replace(/[^a-z0-9]/g, "");
            }

            var strassenQuellIndex = -1;
            var si;
            for (si = 0; si < csvDaten.spalten.length; si++) {
                var spaltennameNorm = normalisiereExportSpaltenname(csvDaten.spalten[si]);
                if (spaltennameNorm == "strasse" || spaltennameNorm == "street" || spaltennameNorm == "streetname") {
                    strassenQuellIndex = si;
                    break;
                }
            }

            function exportWert(datensatz, feld) {
                // Straße bewusst direkt aus der erkannten Quellspalte lesen.
                // Damit umgehen wir jede Mapping-/Alias-Abweichung im Export.
                if (feld == "Stra\u00dfe" && strassenQuellIndex >= 0) {
                    return strassenQuellIndex < datensatz.length ? trimText(datensatz[strassenQuellIndex]) : "";
                }

                var index = mappingSpaltenindex(csvDaten, mapping, feld);
                if (index >= 0 && index < datensatz.length) {
                    return trimText(datensatz[index]);
                }

                return "";
            }

            function produktionsFelder(datensatz) {
                var anrede = exportWert(datensatz, "Anrede");
                var titel = exportWert(datensatz, "Titel");
                var vorname = exportWert(datensatz, "Vorname");
                var nachname = exportWert(datensatz, "Nachname");
                var strasse = exportWert(datensatz, "Stra\u00dfe");
                var hausnummer = exportWert(datensatz, "Hausnummer");
                var postfach = exportWert(datensatz, "Postfach");
                var plz = exportWert(datensatz, "PLZ");
                var ort = exportWert(datensatz, "Ort");

                var person = verbindeTeile([anrede, titel, vorname, nachname]);
                var strassenAnalyse = strassenHausnummerAnalysieren(strasse, hausnummer);
                var strassenzeile = postfach != "" ? "" : strassenAnalyse.zeile;
                var postfachzeile = postfach != "" ? postfachZeileNormalisieren(postfach) : "";
                var land = exportWert(datensatz, "Land");
                var plzOrtAnalyse = plzOrtAnalysieren(plz, ort, land);
                var plzOrt = plzOrtAnalyse.zeile;

                var landNorm = trimText(land).toLowerCase();
                var landzeile = "";
                if (
                    landNorm != "" &&
                    landNorm != "deutschland" &&
                    landNorm != "de" &&
                    landNorm != "deu" &&
                    landNorm != "germany"
                ) {
                    landzeile = land;
                }

                return {
                    person: person,
                    strassenzeile: strassenzeile,
                    postfachzeile: postfachzeile,
                    plzOrt: plzOrt,
                    landzeile: landzeile
                };
            }

            var zeilen = [];
            var header = ["Datensatz", "Quellzeile", "Person", "Strassenzeile", "Postfachzeile", "PLZ_Ort", "Landzeile"];
            for (i = 0; i < exportFelder.length; i++) header.push(headerName(exportFelder[i]));
            zeilen.push(header.join("\t"));

            var r;
            for (r = 0; r < freigegeben.length; r++) {
                var nr = freigegeben[r];
                var ds = csvDaten.datensaetze[nr - 1];
                var prod = produktionsFelder(ds);
                var quellzeile = csvDaten.quellzeilen && csvDaten.quellzeilen.length >= nr
                    ? csvDaten.quellzeilen[nr - 1]
                    : (nr + 1);

                var werte = [
                    String(nr),
                    String(quellzeile),
                    bereinigeExportWert(prod.person),
                    bereinigeExportWert(prod.strassenzeile),
                    bereinigeExportWert(prod.postfachzeile),
                    bereinigeExportWert(prod.plzOrt),
                    bereinigeExportWert(prod.landzeile)
                ];
                for (i = 0; i < exportFelder.length; i++) {
                    var feld = exportFelder[i];
                    var wert = exportWert(ds, feld);
                    werte.push(bereinigeExportWert(wert));
                }
                zeilen.push(werte.join("\t"));
            }

            var heute = new Date();
            var jahr = heute.getFullYear();
            var monat = heute.getMonth() + 1;
            var tag = heute.getDate();
            if (monat < 10) monat = "0" + monat;
            if (tag < 10) tag = "0" + tag;
            var datumsCode = String(jahr) + String(monat) + String(tag);

            function dateinameTeil(text) {
                var wert = trimText(text);
                if (wert == "") return "";
                wert = wert.replace(/[\\\/:*?"<>|]+/g, "_");
                wert = wert.replace(/\s+/g, "_");
                wert = wert.replace(/_+/g, "_");
                wert = wert.replace(/^_+|_+$/g, "");
                return wert;
            }

            var dateinameTeile = [];
            var teil;

            teil = dateinameTeil(aktuellerAuftrag.auftragsnummer);
            if (teil != "") dateinameTeile.push(teil);

            teil = dateinameTeil(aktuellerAuftrag.kunde);
            if (teil != "") dateinameTeile.push(teil);

            teil = dateinameTeil(aktuellerAuftrag.bezeichnung);
            if (teil != "") dateinameTeile.push(teil);

            if (dateinameTeile.length == 0) {
                teil = datei && datei.name ? dateinameTeil(datei.name.replace(/\.[^.]+$/, "")) : "Mailing";
                if (teil == "") teil = "Mailing";
                dateinameTeile.push(teil);
            }

            dateinameTeile.push(datumsCode);
            dateinameTeile.push("InDesign-Daten");

            var vorgeschlagenerName = dateinameTeile.join("_") + ".txt";

            var vorgeschlageneDatei = File(Folder.myDocuments.fsName + "/" + vorgeschlagenerName);
            var ziel = vorgeschlageneDatei.saveDlg(
                "InDesign-Datenquelle speichern",
                "Textdatei:*.txt"
            );
            if (!ziel) return null;

            if (!/\.txt$/i.test(ziel.name)) ziel = File(ziel.fsName + ".txt");
            ziel.encoding = "UTF-8";
            ziel.lineFeed = "Windows";

            if (!ziel.open("w")) {
                letzteNachricht = "Die InDesign-Datenquelle konnte nicht gespeichert werden.";
                return null;
            }

            ziel.write("\uFEFF" + zeilen.join("\r\n"));
            ziel.close();

            return {
                datei: ziel,
                datensaetze: freigegeben.length,
                felder: exportFelder.length + 7
            };
        }

        function zeigeAusgabeSeite(mapping) {
            leeren();dlg.text="Mailing-Assistant \u2013 Produktionsausgabe";
            seitenContainer.add("statictext",undefined,"Produktionsausgabe ausw\u00e4hlen");
            seitenContainer.add("statictext",undefined,"Lege fest, wie die freigegebenen Mailingdaten weiterverarbeitet werden sollen.");
            var bereich=seitenContainer.add("panel");bereich.orientation="column";bereich.alignChildren=["left","top"];bereich.margins=15;bereich.spacing=10;
            var r1=bereich.add("radiobutton",undefined,"InDesign \u2013 Adressdaten f\u00fcr Datenzusammenf\u00fchrung");
            var r2=bereich.add("radiobutton",undefined,"CSV \u2013 bereinigte und freigegebene Datens\u00e4tze");
            var r3=bereich.add("radiobutton",undefined,"XLSX \u2013 bereinigte und freigegebene Datens\u00e4tze");
            var r4=bereich.add("radiobutton",undefined,"Nur Adressliste / Kontrollausgabe");
            var akt=csvDaten.produktionsausgabe||"InDesign";r1.value=akt=="InDesign";r2.value=akt=="CSV";r3.value=akt=="XLSX";r4.value=akt=="Adressliste";
            seitenContainer.add("statictext",undefined,"In diesem Schritt wird noch keine Datei erzeugt. Wir legen nur die gew\u00fcnschte Ausgabe fest.");
            var buttons=seitenContainer.add("group");buttons.alignment="right";
            var zurueck=buttons.add("button",undefined,"Zur\u00fcck");
            var fertig=buttons.add("button",undefined,"Weiter");
            zurueck.onClick=function(){zeigeMailingSeite(mapping);};
            fertig.onClick=function(){
                csvDaten.produktionsausgabe=r1.value?"InDesign":(r2.value?"CSV":(r3.value?"XLSX":"Adressliste"));

                if (csvDaten.produktionsausgabe == "InDesign") {
                    var ergebnis = exportiereInDesignDatenquelle(mapping);
                    if (!ergebnis) {
                        if (letzteNachricht != "") {
                            leeren(); dlg.text="Mailing-Assistant \u2013 Produktionsausgabe";
                            seitenContainer.add("statictext",undefined,letzteNachricht);
                            var bx=seitenContainer.add("group"); bx.alignment="right";
                            var zurueckX=bx.add("button",undefined,"Zur\u00fcck");
                            zurueckX.onClick=function(){letzteNachricht="";zeigeAusgabeSeite(mapping);};
                            neuLayouten();
                        }
                        return;
                    }

                    leeren();dlg.text="Mailing-Assistant \u2013 InDesign-Datenquelle";
                    seitenContainer.add("statictext",undefined,"InDesign-Datenquelle erfolgreich erstellt.");
                    var info=seitenContainer.add("panel");info.orientation="column";info.alignChildren=["left","top"];info.margins=15;info.spacing=6;
                    info.add("statictext",undefined,"Freigegebene Datens\u00e4tze: "+ergebnis.datensaetze);
                    info.add("statictext",undefined,"Exportierte Spalten: "+ergebnis.felder);
                    info.add("statictext",undefined,"Datei: "+ergebnis.datei.fsName);
                    seitenContainer.add("statictext",undefined,"Format: UTF-8, tabulatorgetrennt. Die Datei kann direkt als Datenquelle in InDesign verwendet werden.");

                    var b=seitenContainer.add("group");b.alignment="right";
                    var zurueck= b.add("button",undefined,"Zur\u00fcck");
                    var schliessen=b.add("button",undefined,"Schlie\u00dfen");
                    zurueck.onClick=function(){zeigeAusgabeSeite(mapping);};
                    schliessen.onClick=function(){dlg.close(0);};
                    neuLayouten();
                    return;
                }

                leeren();dlg.text="Mailing-Assistant \u2013 Produktionsausgabe";
                seitenContainer.add("statictext",undefined,"Produktionsausgabe gew\u00e4hlt: "+csvDaten.produktionsausgabe);
                seitenContainer.add("statictext",undefined,"Dieser Ausgabeweg wird als N\u00e4chstes umgesetzt.");
                var b=seitenContainer.add("group");b.alignment="right";
                var zurueckAndere=b.add("button",undefined,"Zur\u00fcck");
                var schliessen=b.add("button",undefined,"Schlie\u00dfen");
                zurueckAndere.onClick=function(){zeigeAusgabeSeite(mapping);};
                schliessen.onClick=function(){dlg.close(0);};
                neuLayouten();
            };
            neuLayouten();
        }

        if(startSeite=="bereinigung" && aktuellesMapping) zeigeBereinigungSeite(aktuellesMapping);
        else if(startMitMapping) zeigeMappingSeite(aktuellesMapping);
        else zeigeVorschauSeite();

        dlg.center();
        var ergebnis=dlg.show();

        if(ergebnis==1){
            zeigeDatenquelle();
        }else if(ergebnis==7){
            var mappingFuerPdf=aktuellesMapping;

            function prueflisteNachModalemDialog(){
                exportierePrueflistePdf(mappingFuerPdf);
                zeigeDatenWizardFenster(datei,csvDaten,true,"bereinigung",mappingFuerPdf);
            }

            try{
                var idleName="MailingAssistant_Pruefliste_"+String(new Date().getTime());
                var idleTask=app.idleTasks.add({name:idleName,sleep:250});
                var idleHandler=function(event){
                    try{idleTask.removeEventListener(IdleEvent.ON_IDLE,idleHandler);}catch(e0){}
                    try{idleTask.remove();}catch(e1){}
                    prueflisteNachModalemDialog();
                };
                idleTask.addEventListener(IdleEvent.ON_IDLE,idleHandler);
            }catch(eIdle){
                // Fallback: InDesign kurz Zeit geben, den modalen Zustand vollstaendig abzubauen.
                $.sleep(350);
                prueflisteNachModalemDialog();
            }
        }
    }

    function zeigeCsvVorschau(datei, csvDaten) {
        return zeigeDatenWizardFenster(datei, csvDaten, false);
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
        return zeigeDatenWizardFenster(datei, csvDaten, true);
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
            return zeilen.join("\n");
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
        return zeigeDatenWizardFenster(datei, csvDaten, true);

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