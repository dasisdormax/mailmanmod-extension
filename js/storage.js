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

// Functions to export to the outside
var loadAll;
var readItems;

var saveSettings;
var saveList;
var updateCredential;
var deleteCredentialWithId;

// Create an isolated environment for storage operations
(function(){
    //
    // PRIVATE SECTION
    //
    var ownChanges = [];
    var syncedAt = 0;

    // handles the result of adding/removing elements in the sync storage
    function handleSyncResult() {
	if(!chrome.runtime.lastError) {
	    syncedAt = new Date().getTime();
	    var sao = { syncedAt };
	    setLocal(sao);
	}
    }

    // Adds storage values to a single storage area
    // NOTE: We add an entry in the ownChanges array, so
    // we can filter out the related storageChange event
    function set(storage, object, handler) {
	for(name in object) {
	    ownChanges.push({name, value: object[name]});
	}
	storage.set(object, handler);
    }

    // Removes a single key from a single storage area
    // NOTE: We add an entry in the ownChanges array, so
    // we can filter out the related storageChange event
    function remove(storage, name, handler) {
	ownChanges.push({name, value: undefined});
	storage.remove(name, handler);
    }

    // Sets storage values only in the local storage
    function setLocal(object) {
	set(chrome.storage.local, object, handleError);
    }

    // Sets storage values in all storage areas
    function setAll(object) {
	setLocal(object);
	if(settings.hasSync && settings.useSync)
	    set(chrome.storage.sync, object, handleSyncResult);
    }

    // Removes a single storage key from all storage areas
    function removeAll(name) {
	remove(chrome.storage.local, name, handleError);
	if(settings.hasSync && settings.useSync)
	    remove(chrome.storage.sync, name, handleSyncResult);
    }

    // Deletes a list from the lists array and removes it from the UI
    function deleteListLocally(id) {
	lists = lists.filter((list) => list.id !== id);
	if(typeof unrenderListById === 'function') unrenderListById(id);
    }

    // Extra section for handling storage updates, the functions inside
    // do not need to be exposed to anything else
    (function(){
	// Determine if a storage change has previously been recorded to
	// the ownChanges array -> then it does not need to be processed
	// again in this frame
	function isOwnChange(name, change) {
	    var keys = change.newValue ? Object.keys(change.newValue).sort() : [];
	    var i;
	    ocloop: for(i = 0; i < ownChanges.length; i++) {
		// Test name
		let oc = ownChanges[i];
		if(oc.name != name)
		    continue ocloop;

		// Do not test further if both values are undefined
		if(oc.value === change.newValue) return true;

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
	}

	// React to storage change events
	function handleStorageChanges(changes, area) {
	    var key;
	    if(area == 'sync' && settings.useSync && context === "[BKGND]") {
		for(key in changes) {
		    let change = changes[key];
		    if(isOwnChange(key, change))
			continue;
		    console.log(context, area + " '" + key + "' changed:", change);

		    if(key === 'settings' && change.newValue) {
			// Update settings
			settings = change.newValue;
		    }

		    else if(key.indexOf('list_') === 0) {
			// Update a list
			if( change.newValue && key == 'list_' + change.newValue.id)
			    saveList(change.newValue);
			if(!change.newValue && key == 'list_' + change.oldValue.id)
			    deleteCredentialWithId(change.oldValue.id);
			updateIcon();
		    }
		}
	    }
	    if(area == 'local') {
		for(key in changes) {
		    let change = changes[key];
		    if(isOwnChange(key, change))
			continue;
		    console.log(context, area + " '" + key + "' changed:", change);

		    if(key === 'settings' && change.newValue) {
			// Update settings
			settings = change.newValue;
		    }

		    if(key === 'syncedAt' && change.newValue) {
			// Update last sync time
			syncedAt = change.newValue;
		    }

		    if(key.indexOf('list_') === 0) {
			// Update a list that has been changed by another local script
			if( change.newValue && key == 'list_' + change.newValue.id)
			    updateList(changes[key].newValue);
			if(!change.newValue && key == 'list_' + change.oldValue.id)
			    deleteListLocally(change.oldValue.id);
			updateIcon();
		    }
		}
	    }
	}
	// Start storage event listener
	chrome.storage.onChanged.addListener(handleStorageChanges);
    })();

    //
    // PUBLIC SECTION
    //

    // Load all lists from the addon storage and execute function then when done
    loadAll = function() {
	chrome.storage.local.get(null, function loadAll__localGet(items){
	    // We cannot proceed when the local storage is not accessible
	    if(!handleError("errStorageAccess")) return;

	    readItems(items, 'local');
	    status('');

	    if(settings.hasSync === undefined || (settings.useSync && context === "[BKGND]")) {
		// Check if the sync storage is supported and read its settings
		if(chrome.storage.sync) {
		    chrome.storage.sync.get(null, function loadAll__syncGet(syncItems) {
			// If the query fails, we know that sync is not supported
			if(chrome.runtime.lastError) {
			    settings.hasSync = false;
			    saveSettings();
			    return;
			}
			// Remove all lists that have been removed remotely
			lists.filter(function(list) {
			    var key = "list_" + list.id;
			    return (key in syncItems) || (list.changedAt > syncedAt);
			});
			// Update lists that have been changed remotely
			readItems(syncItems, 'sync');
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
    // - area: The storage area this is loaded from (either 'local' or 'sync')
    readItems = function(items, area) {
	if(!items) return;

	// Read settings, if stored
	if(items.settings && !settings.hasSync) {
	    settings = items.settings;
	}

	var update;
	if(area == 'local') {
	    // Read last sync time from local storage or ...
	    syncedAt = items.syncedAt ? items.syncedAt : 0;
	    update = updateList;
	} else {
	    // Update last sync time
	    handleSyncResult();
	    update = saveList;
	}

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
		    update(list);
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
    };

    // Saves an updated settings object to storage
    saveSettings = function() {
	var obj = { settings };
	setAll(obj);
    };

    // Saves a single list to local storage
    saveList = function(list) {
	if(updateList(list) === -1) return;
	var key = "list_" + list.id;
	var obj = {};
	obj[key] = list;
	setLocal(obj);
	updateIcon();
    };

    // Saves updated list credentials to local and cloud storage
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

    // Deletes list credentials from local and cloud storage
    deleteCredentialWithId = function(id) {
	var key = "list_" + id;
	console.log(context, "Removing '" + key + "'");
	deleteListLocally(id);
	removeAll(key);
	updateIcon();
    };
})();
