"use strict";

/*******************
 * List operations *
 *******************/
function newList(id) {
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
    var index = lists.findIndex((list) => list.id == newlist.id);
    if(index >= 0) {
	lists[index] = newlist;
    } else {
	lists.push(newlist);
    }
    saveAll();
};

/****************
 * List storage *
 ****************/

// Load all lists from the addon storage
// Usage: loadAll().then(onSuccess, onError);
function loadAll() {
    return storage.get('lists').then(function(result){
	result = result['lists'];
	if(Array.isArray(result)) lists = result; 
    });
};

function saveAll() {
    // Sort lists by list name
    lists.sort((a,b) => a.name > b.name ? 1 : -1);
    // Sync to background task and persistent storage
    if(bgwindow) bgwindow.lists = lists;
    storage.set({lists});
    updateIcon();
}

function updateIcon() {
    // Count total mails and update browser action
    var mails = 0;
    lists.forEach((list) => mails += list.mails.length);
    browser.browserAction.setBadgeBackgroundColor({color: "red"});
    browser.browserAction.setBadgeText({text: mails ? mails.toString(10) : ''});
}

/***********
 * GLOBALS *
 ***********/
var storage = browser.storage.sync || browser.storage.local;
var bgwindow;
var lists = [];
