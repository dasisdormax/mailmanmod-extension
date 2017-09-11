"use strict";

// a "dummy" renderList function
function renderList(list) {
    browser.runtime.sendMessage({
	event: "renderList",
	sender: "background.js",
	list
    });
}

/*******************
 * BACKGROUND TASK *
 *******************/
function bgRefreshAll() {
    time = new Date().getTime();
    for(let i = 0; i < lists.length; i++) {
	// Cancel if the list item has been deleted
	if(!lists[i]) continue;
	// Background update with a lower frequency -> once every 30 minutes
	// Also, don't update more than one list in one go
	list = lists[i];
	if(!list.time || time > list.time + 1800000) {
	    refreshList(list);
	    return;
	}
    }
}

/******************
 * INITIALIZATION *
 ******************/
$(function(){
    var then = function() {
	updateIcon();
	// Execute our background update every 60 seconds
	setInterval(bgRefreshAll, 60000);
    };
    // NOTE: we have to execute our 'then' function whether loadAll succeeds or not
    loadAll().then(then, then);
});
