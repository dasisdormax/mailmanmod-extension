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
    var id = list.id;
    var selector = "label#l-" + id;
    if(!$(selector).length) {
	$("#mmm-lists").append($('<label id="l-' + id + '" for="r-' + id + '">'));
    }
    var elem = $(selector);
    elem.text(list.name);
    elem.prepend($('<input type="radio" id="r-' + id + '" name="listid" value="' + id + '">'));
};

// Actions
function actionNew(id) {
    var newlist = newList();
    var oldlist = id ? getListById(id) : lists[0];
    if(oldlist) {
	newlist.name     = oldlist.name;
	newlist.baseurl  = oldlist.baseurl;
	newlist.password = oldlist.password;
    }
    showEditForm(newlist);
}

function actionEdit(id) {
    if(!id) {
	status("Please select a mailing list to edit!");
	return;
    }
    showEditForm(getListById(id));
}

function actionDelete(id) {
    if(!id) {
	status("Please select a mailing list to delete!");
	return;
    }
    lists = lists.filter((list) => list.id != id);
    saveAll();
    showLists();
}

function listActionClick() {
    var id = $("input[name=listid]:checked").val();
    var action = $("#mmm-select-action").val();
    console.log("Executing action " + action + " on item " + id + " ...");
    switch(action) {
	case "new":
	    actionNew(id); break;
	case "edit":
	    actionEdit(id); break;
	case "delete":
	    actionDelete(id); break;
	default:
	    status("Please select an action!");
    }
}

function editSaveClick() {
    var list = {
	"id":       $('#edit-id').val(),
	"name":     $('#edit-name').val().trim(),
	"baseurl":  $('#edit-baseurl').val().trim().replace(/\/+$/,""),
	"password": $('#edit-password').val()
    };
	
    // Validate
    if(list.name.length < 1 || list.baseurl.search(/^https?:\/\//) < 0 || list.baseurl.indexOf("*") >= 0) {
	status(
	    "Validation failed! Please make sure to specify a list name and " +
	    "the protocol of the base URL (http or https)."
	);
    } else {
	updateList(list);
	showLists();
    }
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
    status("");
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
    $("#mmm-list-perform-action").click(listActionClick);
    $("#mmm-edit-cancel").click(showLists);
    $("#mmm-edit-save").click(editSaveClick);
    loadAll().then(showLists,showLists);
});
