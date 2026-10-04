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
        var ausgabe=temporareDateiPfad("mailing_assistant_xlsx"),vb="On Error Resume Next\r\n";
        vb+="Dim xl,wb,ws,stm,ur,firstRow,firstCol,lastRow,lastCol,r,col,v\r\nSet xl=CreateObject(\"Excel.Application\")\r\nxl.Visible=False\r\n";
        vb+="Set wb=xl.Workbooks.Open(\"" + vbScriptText(datei.fsName) + "\",False,True)\r\nIf Err.Number<>0 Then WScript.Quit 1\r\n";
        vb+="Set ws=wb.Worksheets(\"" + vbScriptText(blatt) + "\")\r\nSet ur=ws.UsedRange\r\nfirstRow=ur.Row:firstCol=ur.Column:lastRow=firstRow+ur.Rows.Count-1:lastCol=firstCol+ur.Columns.Count-1\r\n";
        vb+="ws.UsedRange.Columns.AutoFit\r\nSet stm=CreateObject(\"ADODB.Stream\")\r\nstm.Type=2\r\nstm.Charset=\"utf-8\"\r\nstm.Open\r\n";
        vb+="For r=firstRow To lastRow\r\n For col=firstCol To lastCol\r\n v=ws.Cells(r,col).Text\r\n";
        vb+=" Dim n, ch, hx\r\n stm.WriteText \"~\"\r\n For n=1 To Len(v)\r\n  ch=AscW(Mid(v,n,1)):If ch<0 Then ch=ch+65536\r\n  hx=Hex(ch):hx=String(4-Len(hx),\"0\") & hx:stm.WriteText hx\r\n Next\r\n";
        vb+=" If col<lastCol Then stm.WriteText \"|\"\r\n Next\r\n stm.WriteText vbCrLf\r\nNext\r\n";
        vb+="stm.SaveToFile \"" + vbScriptText(ausgabe) + "\",2\r\nstm.Close\r\nwb.Close False\r\nxl.Quit\r\n";
        app.doScript(vb,ScriptLanguage.VISUAL_BASIC);
        var f=File(ausgabe);if(!f.exists)throw new Error("Das Excel-Tabellenblatt konnte nicht gelesen werden.");f.encoding="UTF-8";if(!f.open("r"))throw new Error("Die Excel-Daten konnten nicht gelesen werden.");
        var t=f.read();f.close();try{f.remove();}catch(e){}var z=t.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n"),m=[],i,j,q;
        for(i=0;i<z.length;i++){if(z[i]=="")continue;q=z[i].split("|");for(j=0;j<q.length;j++)q[j]=xlsxZellwertDekodieren(q[j]);m.push(q);}
        if(!m.length)throw new Error("Das Excel-Tabellenblatt enth\u00e4lt keine Daten.");var first=-1;for(i=0;i<m.length;i++){for(j=0;j<m[i].length;j++){if(trimText(m[i][j])!=""){first=i;break;}}if(first>=0)break;}if(first<0)throw new Error("Das Excel-Tabellenblatt enth\u00e4lt keine bef\u00fcllten Zellen.");if(first>0)m=m.slice(first);return{rohzeilen:m};
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
        dlg.add("statictext", undefined, "Spaltenzuordnung"); dlg.add("statictext", undefined, "Ordne den internen Mailing-Feldern die passenden CSV-Spalten zu.");
        var bereich = dlg.add("panel"); bereich.orientation = "column"; bereich.alignChildren = ["fill", "top"]; bereich.margins = 15; bereich.spacing = 8;
        var interneFelder = ["Anrede", "Titel", "Vorname", "Nachname", "Firma", "Stra\u00dfe", "Hausnummer", "PLZ", "Ort", "Land", "Adresszusatz", "E-Mail", "Telefon", "Kundennummer", "Selektionsmerkmal", "Sonstiges"];
        var csvSpalten = ["\u2014 nicht zugeordnet \u2014"]; var i; var j; for (i = 0; i < csvDaten.spalten.length; i++) csvSpalten.push(csvDaten.spalten[i]);
        var zuordnungen = [];
        for (i = 0; i < interneFelder.length; i++) { var zeile = bereich.add("group"); zeile.orientation = "row"; zeile.alignChildren = ["center", "center"]; var label = zeile.add("statictext", undefined, interneFelder[i] + ":"); label.preferredSize.width = 150; var auswahl = zeile.add("dropdownlist", undefined, csvSpalten); auswahl.preferredSize.width = 300; auswahl.selection = 0; for (j = 0; j < csvDaten.spalten.length; j++) if (csvDaten.spalten[j].toLowerCase() == interneFelder[i].toLowerCase()) { auswahl.selection = j + 1; break; } zuordnungen.push(auswahl); }
        dlg.add("statictext", undefined, "Noch keine Zuordnung wird gespeichert oder verarbeitet.");
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var weiter = buttons.add("button", undefined, "Weiter");
        zurueck.onClick = function () { dlg.close(1); };
        weiter.onClick = function () { var mapping = {}; var k; for (k = 0; k < interneFelder.length; k++) mapping[interneFelder[k]] = zuordnungen[k].selection ? zuordnungen[k].selection.text : null; dlg.close(2); zeigeAdressvorschau(datei, csvDaten, mapping); };
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
            var ort = verbindeTeile([wertAusDatensatz(datensatz, "PLZ"), wertAusDatensatz(datensatz, "Ort")]);
            var land = wertAusDatensatz(datensatz, "Land");
            if (firma != "") zeilen.push(firma); if (person != "") zeilen.push(person); if (adresszusatz != "") zeilen.push(adresszusatz); if (strasse != "") zeilen.push(strasse); if (ort != "") zeilen.push(ort);
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
        var dlg = new Window("dialog", "Mailing-Assistant \u2013 Datenbereinigung");
        dlg.orientation = "column"; dlg.alignChildren = ["fill", "top"]; dlg.spacing = 12; dlg.margins = 20;
        dlg.add("statictext", undefined, "Sichere Textbereinigung");
        dlg.add("statictext", undefined, "Bereinigt werden nur eindeutige Formatierungsfehler: Rand-Leerzeichen, Mehrfach-Leerzeichen, Tabs und Zeilenumbr\u00fcche.");
        var info = dlg.add("panel"); info.orientation = "column"; info.alignChildren = ["left", "top"]; info.margins = 15; info.spacing = 6;
        info.add("statictext", undefined, "Automatisch bereinigte Felder: " + protokoll.length);
        info.add("statictext", undefined, "Problematische/versteckte Zeichen erkannt: " + problematischeZeichen.length);
        info.add("statictext", undefined, "PLZ-Pr\u00fcfhinweise: " + plzHinweise.length);
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
        var buttons = dlg.add("group"); buttons.alignment = "right"; var zurueck = buttons.add("button", undefined, "Zur\u00fcck"); var fertig = buttons.add("button", undefined, "Fertig");
        zurueck.onClick = function () { dlg.close(1); }; fertig.onClick = function () { dlg.close(2); };
        dlg.center(); var ergebnis = dlg.show(); if (ergebnis == 1) zeigeAdressvorschau(datei, csvDaten, mapping);
    }

    zeigeStartseite();

})();