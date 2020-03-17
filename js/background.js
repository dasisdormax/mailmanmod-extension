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
    if(text) console.log(context, `Status: '${text}'`);
}

// RenderList -> executed when a list is loaded or updated from storage
// Refreshes this list if the last refresh is more than 30 minutes ago
function renderList(list) {
    scheduleNextRefresh();
    // Note: This condition should make sure that we do not refresh the same time
    // that the popup does
    if(list.time && list.exists && new Date().getTime() - list.time > 1800000) {
	refreshList(list);
    } else {
	updateIcon();
    }
}

/**********************
 * BACKGROUND REFRESH *
 **********************/
function bgRefreshAll() {
    scheduleNextRefresh();
    // the sorting makes sure that the oldest lists are updated first
    // NOTE: As sort modifies the array it is called on, we have to work on a copy,
    // such as one created by slice() or filter()
    var sorted = lists.filter((list) => list.exists !== false).sort((a, b) => a.time > b.time ? 1 : -1);
    var time = new Date().getTime();
    for(let i = 0; i < sorted.length; i++) {
	let list = sorted[i];
	let diff = list.time ? time - list.time : 1e12;

	// Background update with a lower frequency -> once every 15 minutes
	if(diff >  900000) refreshList(list);
	// Using this, the lists are not refreshed all at once, but no list
	// refresh will be more than 30 minutes ago. 
	if(diff < 1800000) return;
    }
}

var scheduleNextRefresh;
(function(){
    var timeout;
    scheduleNextRefresh = function() {
	if(timeout !== undefined)
	    clearTimeout(timeout);
	// Refresh once every minute
	timeout = setTimeout(bgRefreshAll, 60000);
    };
})();

/******************
 * INITIALIZATION *
 ******************/
var context = "[BKGND]";

$(function(){
    loadAll();
});
