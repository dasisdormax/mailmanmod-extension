"use strict";

/*********************************************
 * Actions that can be initiated by the user *
 *********************************************/
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

function actionRefresh() {
    lists.forEach((list) => {list.time = null;});
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
	case "refresh":
	    actionRefresh(id); break;
	default:
	    status("Please select an action!");
    }
}

function mailAcceptClick() {
    var div   = $(this).parents(".mail");
    var list  = getListById(div.attr("data-listid"));
    var msgid = div.attr("data-msgid");
    mailAction("accept", list, msgid);
}

function mailDetailsClick() {
}

function detailActionClick() {
}

function editSaveClick() {
    var list      = newList($('#edit-id').val());
    list.name     = $('#edit-name').val().trim();
    list.baseurl  = $('#edit-baseurl').val().trim().replace(/\/+$/,"");
    list.password = $('#edit-password').val();
	
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

/*************
 * RENDERING *
 *************/
function renderList(list) {
    var id    = list.id;
    var div   = "div#d-" + id;
    var label = div + ">label";
    if(!$(div).length) {
	$("#mmm-lists").append($('<div id="d-' + id + '">'));
    }
    $(div).empty();
    $(div).append($('<label for="r-' + id + '">'));
    $(label).append($('<input type="radio" id="r-' + id + '" name="listid" value="' + id + '">'));
    $(label).append($('<span>'));
    $(label + ">span").text(list.name);

    if(list.time && list.time + 1800000 > new Date().getTime()) {
	$(div).attr('data-mails', list.mails.length);
	list.mails.forEach(function(mail) {
	    // Render individual e-mails
	    let mdiv     = '#m-' + mail.msgid;
	    let p        = mdiv + ">p";
	    let clearfix = mdiv + ">.clearfix";
	    $(div).append($('<div class="mail" id="m-' + mail.msgid + '">'));
	    $(mdiv).attr('data-msgid', mail.msgid);
	    $(mdiv).attr('data-listid', id);
	    $(mdiv).append($('<p>'));
	    $(p).append($('<strong>'));
	    $(p + ">strong").text(mail.subject);
	    $(p).append($('<br>'));
	    $(p).append("From: " + mail.from);
	    $(mdiv).append($('<div class="clearfix">'));
	    $(clearfix).append($('<button class="hw green" data-accept>Accept</button>'));
	    $(clearfix).append($('<button class="hw grey" data-details>Details</button>'));
	    $(clearfix + ">button[data-accept]" ).click(mailAcceptClick);
	    $(clearfix + ">button[data-details]").click(mailDetailsClick);
	});
    } else {
	$(div).removeAttr('data-mails');
	refreshList(list);
    }
}

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
}

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

// Begin execution
$(function() {
    $("#mmm-list-perform-action").click(listActionClick);
    $("#mmm-edit-cancel").click(showLists);
    $("#mmm-edit-save").click(editSaveClick);
    loadAll().then(showLists,showLists);
});
