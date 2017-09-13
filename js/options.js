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
// NOTE: These functions are here as opening the file chooser
// closes and invalidates the popup

function doImport(file) {
    if(!file || file.type.search(/json/) < 0) {
	status("Invalid filetype! Only JSON files are allowed.");
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
	    status("Imported " + lists.length + " lists.");
	    saveAll();
	} catch(ex) {
	    status("The provided file contains invalid data!");
	}
    };
    reader.readAsText(file);
}

function doExport() {
    var tmp = [];
    lists.forEach((list) => tmp.push({
	name: list.name,
	baseurl: list.baseurl,
	password: list.password
    }));
    var json = JSON.stringify(tmp, null, 2);
    var url = "data:text/json;base64," + btoa(json);
    download(url, "mmm.json", "text/json");
}

function openFileChooser() {
    $("#import-file").click();
}

function beginImport() {
    var file = this.files[0];
    var then = () => doImport(file);
    loadAll().then(then, then);
}

function beginExport() {
    loadAll().then(doExport);
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
$(function(){
    $("#status").click(() => status(""));
    $("#import").click(openFileChooser);
    $("#export").click(beginExport);
    $("#import-file").change(beginImport);
});
