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
function updateList(list) {
    var nameAt = lists.findIndex((other) => other.name >= list.name);
    var idAt   = lists.findIndex((other) => other.id   == list.id);
    var index  = -1;
    if(nameAt >= 0 && lists[nameAt].name == list.name && idAt !== nameAt) {
	// The new list has the same name, but a different ID
	console.log(context, "Merging two lists with the same name '" + list.name + "'");
	var delId = list.id;
	if(list.changedAt > lists[nameAt].changedAt) {
	    list.id = lists[nameAt].id;
	    lists[nameAt] = list;
	    updateCredential(list);
	}
	deleteCredentialWithId(delId);
    } else if(idAt >= 0) {
	// The new list is an update to a previous list
	index = idAt;
	lists[idAt] = list;
    } else if(nameAt >= 0) {
	// This is a new list that is inserted somewhere in the middle
	index = nameAt;
	lists.splice(index, 0, list);
    } else {
	// This is a new list that is added to the end
	index = lists.length;
	lists.push(list);
    }

    // Render the updated list and pass the index as hint to where to place it
    if(typeof renderList === 'function' && index >= 0) renderList(list, index);
    return index;
};

function listUrl(list) {
    return list.baseurl + "/" + list.name.replace(/@.*$/, '');
}

// Checks a list object for errors
// Returns the message code if an error was found, null otherwise
function listHasError(list) {
    if (!list.name)
	return "errListNameEmpty";
    if (list.name.search(/[/?]/) !== -1)
	return "errListNameIllegal";
    if (list.baseurl.search(/^https?:\/\//) !== 0)
	return "errListBaseurlProtocol";
    if (list.baseurl.indexOf("*") !== -1)
	return "errListBaseurlIllegal";
    if (!list.password)
	return "errListPasswordEmpty";
    return null;
}

// Count total mails and update browser action
function updateIcon() {
    var mails = 0;
    lists.forEach((list) => mails += list.mails ? list.mails.length : 0);
    chrome.browserAction.setBadgeBackgroundColor({color: "red"});
    chrome.browserAction.setBadgeText({text: mails ? mails.toString(10) : ''});
}

/*************
 * UTILITIES *
 *************/

// Shortcuts for getting a localized string
// Using two underscores will additionally escape html special characters
var _  = (msg, args) => chrome.i18n.getMessage(msg, args) || "__MSG_" + msg + "__";
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
