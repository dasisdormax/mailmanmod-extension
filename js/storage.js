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
	status('');

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
    updateIcon();
}

var saveSettings;
var saveList;
var saveAll;
var updateCredential;
var deleteCredentialWithId;

// Create an isolated environment for storage operations
(function(){
    //
    // PRIVATE SECTION
    //
    var ownChanges = [];

    var set = function(storage, object, handler) {
	for(name in object) {
	    ownChanges.push({name, value: object[name]});
	}
	storage.set(object, handler);
    };

    var setLocal = function(object) {
	set(chrome.storage.local, object, handleError);
    };

    var setAll = function(object) {
	setLocal(object);
	if(settings.hasSync && settings.useSync)
	    set(chrome.storage.sync, object, suppressError);
    };

    (function(){
	var isOwnChange = function(name, change) {
	    var keys = change.newValue ? Object.keys(change.newValue).sort() : [];
	    var i;
	    ocloop: for(i = 0; i < ownChanges.length; i++) {
		// Test name
		let oc = ownChanges[i];
		if(oc.name != name)
		    continue ocloop;

		// Test keys and their values
		let ok = Object.keys(oc.value).sort();
		if(ok.length !== keys.length);
		let j;
		keyloop: for(j in ok) {
		    let key = keys[j];
		    if(key !== ok[j])
			continue ocloop;

		    // Note: As equal arrays compare to false, assume two arrays to be equal
		    if(Array.isArray(change.newValue[key]) && Array.isArray(oc.value[key]))
			continue keyloop;

		    if(change.newValue[key] !== oc.value[key])
			continue ocloop;
		}

		ownChanges.splice(i, 1);
		return true;
	    }
	    return false;
	};

	// React to storage change events
	var handleStorageChanges = function(changes, area) {
	    var key;
	    if(area == 'sync' && settings.useSync) {
		for(key in changes) {
		    let change = changes[key];
		    if(key.indexOf('list_') !== 0 || isOwnChange(key, change))
			continue;
		    console.log(context, area + " '" + key + "' changed:", change);
		    if( change.newValue && key == 'list_' + change.newValue.id)
			saveList(change.newValue);
		    if(!change.newValue && key == 'list_' + change.oldValue.id)
			deleteCredentialWithId(change.oldValue.id);
		    updateIcon();
		}
	    }
	    if(area == 'local') {
		for(key in changes) {
		    let change = changes[key];
		    if(key.indexOf('list_') !== 0 || isOwnChange(key, change))
			continue;
		    console.log(context, area + " '" + key + "' changed:", change);
		    if( change.newValue && key == 'list_' + change.newValue.id)
			updateList(changes[key].newValue);
		    if(!change.newValue && key == 'list_' + change.oldValue.id)
			lists = lists.filter((list) => list.id !== change.oldValue.id);
		    updateIcon();
		}
	    }
	};
	// Listen to storage changes
	chrome.storage.onChanged.addListener(handleStorageChanges);
    })();

    //
    // PUBLIC SECTION
    //
    saveSettings = function() {
	setAll({settings});
    };

    saveList = function(list) {
	if(updateList(list) === -1) return;
	var key = "list_" + list.id;
	var obj = {};
	obj[key] = list;
	setLocal(obj);
	updateIcon();
    };

    saveAll = function() {
	// Sync to persistent storage and background task
	var listObj = {};
	lists.forEach(function(list) {
	    var key = "list_" + list.id;
	    listObj[key] = list;
	});
	setLocal(listObj);
	updateIcon();
    };

    updateCredential = function(list) {
	list = {
	    id:        list.id,
	    name:      list.name,
	    baseurl:   list.baseurl,
	    password:  list.password,
	    exists:    list.exists,
	    changedAt: new Date().getTime()
	};
	saveList(list);
    };

    deleteCredentialWithId = function(id) {
	console.log(context, "Removing credential ", id);
	lists = lists.filter((list) => list.id !== id);
	var key = "list_" + id;
	chrome.storage.local.remove(key, handleError);
	if(settings.hasSync && settings.useSync)
	    chrome.storage.sync.remove(key, suppressError);
	updateIcon();
    };
})();
