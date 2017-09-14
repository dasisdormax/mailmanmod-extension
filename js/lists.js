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
	name: "list",
	baseurl: "https://mailman.domain.tld",
	password: "listpwd",
	mails: [],
	time: null
    };
};

function getListById(id) {
    return lists.find((list) => list.id == id) || newList(id);
}

function updateList(newlist) {
    // Add or update a list to the global lists array
    var index = lists.findIndex((list) => list.id == newlist.id);
    if(index >= 0) {
	lists[index] = newlist;
    } else {
	lists.push(newlist);
    }
    saveAll();
};

function listUrl(list) {
    return list.baseurl + "/admindb/" + list.name;
}

function listHasError(list) {
    if (!list.name)
	return "List name is empty!";
    if (list.baseurl.search(/^https?:\/\//) !== 0)
	return "Base URL does not contain a protocol (http:// or https://)";
    if (list.baseurl.indexOf("*") !== -1)
	return "Base URL contains illegal characters!";
    if (!list.password)
	return "List password is empty!"
    return null;
}

/****************
 * List storage *
 ****************/

// Load all lists from the addon storage and execute function then when done
function loadAllAnd(then) {
    storage.get('lists', function(result){
	result = result['lists'];
	if(Array.isArray(result)) lists = result; 
	then();
    });
};

function saveAll() {
    // Sort lists by list name
    lists.sort((a,b) => a.name > b.name ? 1 : -1);
    // Sync to persistent storage and background task
    storage.set({lists}, invalidateLists);
    updateIcon();
}

// Count total mails and update browser action
function updateIcon() {
    var mails = 0;
    lists.forEach((list) => mails += list.mails.length);
    chrome.browserAction.setBadgeBackgroundColor({color: "red"});
    chrome.browserAction.setBadgeText({text: mails ? mails.toString(10) : ''});
}

// Background task and popup notify each other of changes of the lists object
function invalidateLists() {
    chrome.runtime.sendMessage({
	action: 'invalidateLists'
    });
}

/***********
 * GLOBALS *
 ***********/
var storage = chrome.storage.sync || chrome.storage.local;
var lists = [];
