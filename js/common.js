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
 * List operations *
 *******************/
function newList(id) {
    // Generate a random ID string
    id = id || new Date().getTime().toString(36) + Math.floor(Math.random() * 1.e9).toString(36);
    return {
	id,
	name:      "list",
	baseurl:   "https://mailman.domain.tld",
	password:  "listpwd",
    };
};

function copyList(src) {
    var dest = newList();
    if(src) {
	dest.name     = src.name;
	dest.baseurl  = src.baseurl;
	dest.password = src.password;
    }
    return dest;
}

function getListById(id) {
    return lists.find((list) => list.id == id) || newList(id);
}

// Add a list to the global lists array or update it
// - Makes sure that the list stays sorted with respect to the list names
// - Returns the index of the inserted or updated element, or -1
// NOTE that if a different list with an already existing name is provided,
// the newer list is kept and the older one is deleted
function updateList(list, isRename) {
    var nameAt = lists.findIndex((other) => other.name >= list.name);
    var idAt   = lists.findIndex((other) => other.id   == list.id);
    if(nameAt >= 0 && lists[nameAt].name == list.name && idAt !== nameAt) {
	// The new list has the same name, but a different ID
	console.log(context, `Merging two lists with the same name '${list.name}'`);
	var delId = list.id;
	if(list.changedAt > lists[nameAt].changedAt) {
	    list.id = lists[nameAt].id;
	    lists[nameAt] = list;
	} else {
	    list = lists[nameAt];
	}
	deleteCredentialWithId(delId);
	updateCredential(list);
	return false;
    } else if(idAt >= 0) {
	// The new list is an update to a previous list
	if(list.exists === undefined && lists[idAt].changedAt && lists[idAt].changedAt >= list.changedAt)
	{
	    // This test should prevent a list from being refreshed twice when a list is
	    // updated in both the local and sync storage areas
	    return false;
	}
	if(nameAt === idAt + 1 || (nameAt === -1 && idAt === lists.length - 1)) {
	    // If the name has changed but the list does not need to be moved, we're fine
	    nameAt = idAt;
	}
	if(idAt !== nameAt) {
	    // The list has been renamed and we have to update its position
	    // => we remove the list from the lists array and insert it back in the correct position
	    console.log(context, `Moving list '${list.name}' after the rename ...`);
	    lists.splice(idAt, 1);
	    return updateList(list, true);
	}
	lists[idAt] = list;
    } else if(nameAt >= 0) {
	// This is a new list that is inserted somewhere in the middle
	lists.splice(nameAt, 0, list);
    } else {
	// This is a new list that is added to the end
	nameAt = lists.length;
	lists.push(list);
    }

    // Render the updated list and pass the index as hint to where to place it
    if(typeof renderList === 'function') renderList(list, nameAt, isRename);
    return true;
};

function listUrl(list) {
    return list.baseurl + "/" + list.name.replace(/@.*$/, '');
}

// Loads a list, migrates older data and checks the list object for errors
// Returns the message code if an error was found, null otherwise
function listLoadInvalid(list) {
    // Update protocol from http:// to https://
    if(list.baseurl.indexOf("https://") !== 0) {
        list.baseurl = list.baseurl.replace("http://", "");
        list.baseurl = `https://${list.baseurl}`;
    }
    return listDataInvalid(list);
}

// Checks a list object for errors
// Returns the message code if an error was found, null otherwise
function listDataInvalid(list) {
    if (!list.name)
	return "listInvalidNameEmpty";
    if (list.name.search(/[/?]/) !== -1)
	return "listInvalidNameIllegal";
    if (list.baseurl.search(/^https:\/\//) !== 0)
	return "listInvalidProtoIllegal";
    if (list.baseurl.indexOf("*") !== -1)
	return "listInvalidUrlIllegal";
    if (!list.password)
	return "listInvalidPasswordEmpty";
    return null;
}

// Count total mails and update browser action
function updateIcon() {
    var mails = 0;
    lists.forEach((list) => mails += list.mails ? list.mails.length : 0);
    // Check for support of browser action functions before calling them
    let action = chrome.browserAction;
    action.setBadgeBackgroundColor && action.setBadgeBackgroundColor({color: "hsl(0,80%,50%)"});
    action.setBadgeText && action.setBadgeText({text: '' + (mails || '')});
    action.setTitle && action.setTitle({title: _("extensionName") + (mails ? ` (${mails})` : '')});
}

/*************
 * UTILITIES *
 *************/

// Shortcuts for getting a localized string
// Using two underscores will additionally escape html special characters
var _  = (msg, args) => chrome.i18n.getMessage(msg, args) || `__MSG_${msg}__`;
var __ = (msg, args) => $("<div>").text(_(msg, args)).html();

// If the last operation has a chrome.runtime.lastError, display its message
function handleError(pattern) {
    if(chrome.runtime.lastError) {
	if(pattern && typeof pattern == 'string')
	    status(_(pattern, [chrome.runtime.lastError.message]));
	else
	    status(chrome.runtime.lastError.message);
	return false;
    }
    return true;
}

// Suppresses error messages when not handling chrome.runtime.lastError
function suppressError() {
    chrome.runtime.lastError;
    return undefined;
}

// Replaces placeholders in the HTML with the actual localized texts
function localizeHtml(i, html) {
    return html.replace(/__MSG_([^<>"' ]+?)__/g, (match, msg) => __(msg));
}

/***********
 * GLOBALS *
 ***********/
var settings = {
    "useSync": false,
    "hasSync": undefined
};
var lists = [];
