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

// Instead of rendering the list ourselves, we send it to the popup
// to render it for us
function renderList(list) {
    chrome.runtime.sendMessage({
	action: "renderList",
	list
    }, function() {
	// Suppress error unchecked messages. We expect the communication
	// to fail when the popup is not open.
	return chrome.runtime.lastError;
    });
}

function status(text) {
    if(text) console.log(text);
}

/*******************
 * BACKGROUND TASK *
 *******************/
function bgRefreshAll() {
    if(refresh) {
	loadAllAnd(function() {
	    refresh = false;
	    bgRefreshAll();
	});
	return;
    }

    // the sorting makes sure that the oldest lists are updated first
    var sorted = lists.sort((a, b) => a.time > b.time ? 1 : -1);
    var time = new Date().getTime();
    for(let i = 0; i < sorted.length; i++) {
	let list = sorted[i];
	let diff = list.time ? time - list.time : 1e12;

	// Background update with a lower frequency -> once every 20 minutes
	if(diff > 1200000) refreshList(list);
	// Don't update more than one list in one go, except if they
	// are 'seriously outdated' (currently, more than 50 minutes)
	if(diff < 3000000) return;
    }
}

/*****************
 * COMMUNICATION *
 *****************/
// Note that the lists have been modified externally.
// We will refresh them before the next background update
function handleStorageChange(change, area) {
    refresh = true;
}

/******************
 * INITIALIZATION *
 ******************/
var refresh = false;

$(function(){
    var then = function() {
	updateIcon();
	chrome.storage.onChanged.addListener(handleStorageChange);
	// Execute our background update every 2 minutes
	setInterval(bgRefreshAll, 120000);
    };
    loadAllAnd(then);
});
