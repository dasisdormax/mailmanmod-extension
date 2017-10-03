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

/****************
 * List storage *
 ****************/

// Load all lists from the addon storage and execute function then when done
function loadAll() {
    chrome.storage.local.get(null, function(items){
	// We cannot proceed when the local storage is not accessible
	if(!handleError("errStorageAccess")) return;

	readItems(items);

	if(settings.hasSync === undefined || settings.useSync) {
	    // Check if the sync storage is supported and read its settings
	    if(chrome.storage.sync) {
		chrome.storage.sync.get(null, function(syncItems) {
		    // If the query fails, we know that sync is not supported
		    if(chrome.runtime.lastError) {
			settings.hasSync = false;
			saveSettings();
			return;
		    }
		    readItems(syncItems);
		    settings.hasSync = true;
		    saveSettings();
		});
		return;
	    } else {
		settings.hasSync = false;
		saveSettings();
	    }
	}
    });
};

// Reads the items returned when getting the storage
// This also converts the data from previous MMM versions to the current format
function readItems(items) {
    if(!items) return;

    // Read settings, if stored
    if(items.settings) settings = items.settings;

    var key;
    for(key in items) {
	if(key.indexOf("list_") === 0) {
	    // Plausibility check
	    let list = items[key];
	    let id = list.id;
	    if("list_" + list.id !== key)
		continue;
	    if(listHasError(list))
		continue;

	    // If this is a new list or the credentials have changed, load it!
	    let index = lists.findIndex((list) => list.id === id);
	    if(index === -1 || list.changedAt > lists[index].changedAt) {
		updateList(list);
	    }
	}
    }
    if(lists.length === 0 && Array.isArray(items.lists) && items.lists.length > 0) {
	items.lists.forEach((list) => listHasError(list) || updateCredential(list));
	// If the user has used a previous version with syncing not optional, assume
	// that the user wants to continue using that behaviour unless he explicitly
	// disables it
	settings.useSync = true;
    }
}

function saveSettings() {
    chrome.storage.local.set({settings}, handleError);
    if(settings.hasSync && settings.useSync)
	chrome.storage.sync.set({settings}, suppressError);
}

function updateCredential(list) {
    list = {
	id:        list.id,
	name:      list.name,
	baseurl:   list.baseurl,
	password:  list.password,
	changedAt: new Date().getTime()
    };
    updateList(list);
}

function deleteCredentialWithId(id) {
    console.log("Removing credential ", id);
    lists = lists.filter((list) => list.id !== id);
    var key = "list_" + id;
    chrome.storage.local.remove(key, handleError);
    if(settings.hasSync && settings.useSync)
	chrome.storage.sync.remove(key, suppressError);
}

function saveList(list) {
    if(updateList(list) === -1) return;
    var key = "list_" + list.id;
    var obj = {};
    obj[key] = list;
    chrome.storage.local.set(obj, handleError);
}

function saveAll() {
    // Sync to persistent storage and background task
    var listObj = {};
    lists.forEach(function(list) {
	var key = "list_" + list.id;
	listObj[key] = list;
    });
    chrome.storage.local.set(listObj, handleError);
    updateIcon();
}
