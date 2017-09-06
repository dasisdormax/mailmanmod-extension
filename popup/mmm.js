"use strict";

// Creates a new list
function newList(id) {
    id = id || new Date().getTime().toString(36) + Math.floor(Math.random() * 1.e9).toString(36);
    return {
	id,
	"name": "list",
	"baseurl": "https://mailman.domain.tld",
	"password": "listpwd",
	"mails": [],
	"validUntil": null
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

function renderList(list) {
    var id = "list-" + list.id;
    var selector = "label#" + id;
    if(!$(selector).length) {
	$("#mmm-lists").append($('<label id="' + id + '">'));
    }
    var elem = $(selector);
    elem.text(list.name);
};

// Actions
function listAddClick() {
    showEditForm(newList());
}

function listUpdateClick() {
    var list = getListById($('#edit-id').val());
    list.name     = $('#edit-name').val().trim();
    list.baseurl  = $('#edit-baseurl').val().trim();
    list.baseurl  = list.baseurl.replace(/\/+$/,"");
    list.password = $('#edit-password').val();

    // Validate
    if(list.name.length < 1 || list.baseurl.search(/^https?:\/\//) < 0 || list.baseurl.indexOf("*") >= 0) {
	status(
	    "Validation failed! Please make sure to specify a list name and " +
	    "the protocol of the base URL (http or https)."
	);
	return;
    }

    updateList(list);
    showLists();
}

// Storage
function loadAll() {
    return storage.get('lists').then(function(result){
	result = result['lists'];
	if(Array.isArray(result)) lists = result; 
    });
};

function saveAll() {
    lists.sort((a,b) => a.name > b.name ? 1 : -1);
    storage.set({lists});
}

// Rendering
function status(text) {
    $("p#status").remove();
    if(text) {
	$("body").append('<p id="status">');
	$("p#status").text(text);
    }
}

function select(selection) {
    var panes = ["#main", "#edit"];
    for(var i = 0; i < panes.length; i++) {
	var id = panes[i];
	if(id === selection) {
	    $(id).removeClass("hidden");
	} else {
	    $(id).addClass("hidden");
	}
    }
}

function renderAll() {
    $("#mmm-lists").empty();
    if(!lists || lists.length == 0) {
	$("#mmm-lists").append("<p>No lists found!</p>");
	return;
    } else {
	for(var i = 0; i < lists.length; i++) {
	    renderList(lists[i]);
	}
    }
};

function showLists() {
    select("#main");
    status("");
    renderAll();
}

function showEditForm(list) {
    select("#edit");
    $('#edit-id').val(list.id);
    $('#edit-name').val(list.name);
    $('#edit-baseurl').val(list.baseurl);
    $('#edit-password').val(list.password);
}

var storage = browser.storage.sync || browser.storage.local;
var lists = [];

$(function() {
    $("#mmm-list-add").click(listAddClick);
    $("#mmm-edit-cancel").click(showLists);
    $("#mmm-edit-update").click(listUpdateClick);
    loadAll().then(showLists,showLists);
});
