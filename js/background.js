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

function status(text) {
    if(text) console.log(text);
}

/*******************
 * BACKGROUND TASK *
 *******************/
function bgRefreshAll() {
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

/******************
 * INITIALIZATION *
 ******************/
var context = "[BACKGROUND]";

$(function(){
    loadAll();
    // Listen to storage changes
    chrome.storage.onChanged.addListener(handleStorageChanges);
    // Execute our background update right now and every 2 minutes
    setTimeout(bgRefreshAll, 5000);
    setInterval(bgRefreshAll, 120000);
});
