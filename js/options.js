"use strict";
/*
 * Mailmanmod WebExtension - manage all your mailinglists in one place
 *
 * Copyright (C) 2017 Maximilian Wende
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Affero GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*******************
 * IMPORT / EXPORT *
 *******************/
// NOTE: we cannot put these function into the popup directly as it would
// get closed when opening the file chooser dialog

function doImport() {
    var file = this.files[0];
    if(!file || file.type.search(/json/) < 0) {
	status(_('errImportFiletype'));
	return;
    }
    // Read file contents using FileReader
    var reader = new FileReader();
    reader.onload = function(event){
	try {
	    var json = event.target.result;
	    var parsed = JSON.parse(json);
	    if(!Array.isArray(parsed)) throw 5;
	    var tmp = [];
	    parsed.forEach(function(list) {
		if(listHasError(list)) throw 5;
		var newlist = newList();
		newlist.name     = list.name;
		newlist.baseurl  = list.baseurl;
		newlist.password = list.password;
		tmp.push(newlist);
	    });
	    lists = tmp;
	    status(_("statusImportSuccessful", tmp.length));
	    saveAll();
	} catch(ex) {
	    status(_("errImportParseError"));
	}
    };
    reader.readAsText(file);
}

function doExport() {
    // Create temporary array to store only
    // the important properties for each list
    var tmp = [];
    lists.forEach((list) => tmp.push({
	name: list.name,
	baseurl: list.baseurl.replace(/\/admindb$/, ""),
	password: list.password
    }));
    var json = JSON.stringify(tmp, null, 2);
    // Create data url to download the JSON from
    var dataurl = "data:text/json;base64," + btoa(json);
    download(dataurl, "mmm.json", "text/json");
}

function doClearSync() {
    chrome.storage.sync.clear(suppressError);
}

function toggleUseSync(event) {
    // Do interesting stuff here
}

function openFileChooser() {
    $("#import-file").click();
}

function status(text) {
    if(text) {
	$("#status").removeClass("hidden");
	$("#status").text(text);
    } else {
	$("#status").addClass("hidden");
    }
}

/******************
 * INITIALIZATION *
 ******************/
var context = "[OPTIONS]";

$(function(){
    $("body").html(localizeHtml);
    $("#status").click(() => status(""));
    $("#import").click(openFileChooser);
    $("#export").click(doExport);
    $("#clearSync").click(doClearSync);
    $("#useSync").change(toggleUseSync);
    $("#import-file").change(doImport);
    loadAll();
});
