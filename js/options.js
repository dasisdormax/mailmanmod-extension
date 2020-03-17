"use strict";
/*
 * Mailmanmod WebExtension - manage all your mailinglists in one place
 *
 * Copyright (C) 2017-2020 Maximilian Wende
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
    if(!file || (file.type.search(/json/i) < 0 && file.name.search(/.json$/i) < 0)) {
	status(_('errImportFiletype'));
	return;
    }
    // Read file contents using FileReader
    var reader = new FileReader();
    reader.onload = function(event){
	try {
	    var json = event.target.result;
	    var parsed = JSON.parse(json);
	    if(!Array.isArray(parsed)) throw 420;
	    var i;
	    for(i = 0; i < parsed.length; i++) {
		let item = parsed[i];
		if(listDataInvalid(item)) throw 420;
		let list = lists.find((list) => list.name === item.name) || newList();
		list.name     = item.name;
		list.baseurl  = item.baseurl + (item.compatible ? "/admindb" : '');
		list.password = item.password;
		delete list.exists;
		updateCredential(list);
	    }
	    status(_("statusImportSuccessful", [i]));
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
    lists.forEach(function(list) {
	var exp = {
	    name: list.name,
	    baseurl: list.baseurl.replace(/\/admindb$/, ""),
	    password: list.password
	};
	if(list.baseurl.search(/\/admindb$/) > -1) {
	    exp.compatible = true;
	}
	tmp.push(exp);
    });
    var json = JSON.stringify(tmp, null, 2);
    // Create data url to download the JSON from
    var dataurl = `data:text/json;base64,${btoa(json)}`;
    download(dataurl, "mmm.json", "text/json");
}

function promptClearLists() {
    status(_("warningClearLists"));
    $("#clearListsConfirm").removeClass("hidden");
    $("#clearLists").addClass("hidden");
}

function doClearLists() {
    var origLength = lists.length;
    var length = origLength;
    while(length) {
	deleteCredentialWithId(lists[0].id);
	if(--length != lists.length) {
	    status(_("errClearError"));
	    return;
	}
    }
    statusClick();
    status(_("statusClearSuccessful", [origLength]));
}

function toggleUseSync(event) {
    // Do interesting stuff here
    var checked = $("#useSync")[0].checked;
    if(checked == settings.useSync) return;
    settings.useSync = checked;
    saveSettings();
    // Note: saveSettings will set useSync to false if sync is not available
    if(settings.useSync) {
	chrome.storage.sync.get(null, function __toggleUseSync__getSync(items) {
	    readItems(items, 'sync');
	    // The lists to update => those in the local lists array that do not have a corresponding list in sync storage
	    var upload = lists.filter((list) => Object.keys(items).every((key) => items[key].name !== list.name));
	    upload.forEach(function __toggleUseSync__uploadNewList(list){
		updateCredential(list, true);
	    });
	});
    }
    $("#useSync")[0].checked = settings.useSync;
}

function openFileChooser() {
    $("#import-file").click();
}

function statusClick() {
    $("#clearListsConfirm").addClass("hidden");
    $("#status").addClass("hidden");
    status('');
}

function status(text) {
    if(text) {
	$("#status").removeClass("hidden");
	$("#status").text(text);
    } else {
	$("#useSync")[0].checked = settings.useSync;
	$("#clearLists").removeClass("hidden");
    }
}

/******************
 * INITIALIZATION *
 ******************/
var context = "[OPTNS]";

$(function(){
    $("body").html(localizeHtml);
    $("#status").click(statusClick);
    $("#import").click(openFileChooser);
    $("#export").click(doExport);
    $("#clearLists").click(promptClearLists);
    $("#clearListsConfirm").click(doClearLists);
    $("#useSync").change(toggleUseSync);
    $("#import-file").change(doImport);
    loadAll();
});
