"use strict";

/*******************
 * List operations *
 *******************/
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
};

function refreshList(list) {
    var url = list.baseurl + "/admindb/" + list.name;
    var data = {
	"adminpw":  list.password,
	"admlogin": "Login"
    }
    $.post(url, data, function(html) {
	parseAdmindb(list, html);
	saveAll();
	renderList(list);
    });
}

/**********************
 * XHR Result Parsers *
 **********************/
function parseAdmindb(list, html) {
    // Remove everything except the body contents
    html = html.replace(/^(.|\n)*?<body[^>]*>/i, '');
    html = html.replace(/<\/body(.|\n)*/i,       '');
    var result = $("#result");
    result.html(html);
    list.time = new Date().getTime();
    list.mails = [];
    if(result.find("form").length) {
	// Parse e-mails for each group (mails by the same sender)
	result.find("form>table>tbody>tr").each(function(){
	    var from = $(this).find("tbody>tr>td").html().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)[0];
	    // Parse individual mail entries
	    $(this).find("table table table").each(function(){
		var mlink = $(this).find("a");
		if(!mlink.length) return;
		var msgid = mlink.attr("href").match(/[0-9]+$/)[0];
		var data  = $(this).find("td:last-child");
		var mail  = {
		    msgid,
		    from,
		    "subject": $(data[0]).text(),
		    "size": Number.parseInt($(data[1]).text(), 10),
		    "time": $(data[3]).text()
		};
		list.mails.push(mail);
	    });
	});
    }
    result.empty();
}

function parseMailDetails(msgid, html) {
    // Remove everything except the body contents
    html = html.replace(/^(.|\n)*?<body[^>]*>/i, '');
    html = html.replace(/<\/body(.|\n)*/i,       '');
    var result = $("#result");
    var details = {};
    result.html(html);
    if(result.find("form").length) {
	details.csrftoken = result.find("input[name=csrf_token]").val();
	details.headers   = result.find('textarea[name="headers-' + msgid + '"]').val();
	details.text      = result.find('textarea[name="fulltext-' + msgid + '"]').val();
    }
    result.empty();
    return details;
}

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

function mailAction(action, list, msgid, csrftoken) {
    var value = 0;
    console.log("Executing action " + action + " on message #" + msgid + " in list " + list.name);
    switch(action) {
	case "accept":
	    value = 1; break;
	case "reject":
	    value = 2; break;
	case "discard":
	    value = 3; break;
	default:
	    value = 0;
    }
    var url = list.baseurl + "/admindb/" + list.name;
    var data = {
	"csrf_token": csrftoken,
	"submit": "Submit Data ..."
    }
    data[msgid] = value;
    console.log(data);
    $.post(url, data, function(html) {
	// We can directly parse the result and update the list object
	parseAdmindb(list, html);
	saveAll();
	renderList(list);
    });
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
    var url = list.baseurl + "/admindb/" + list.name;
    var data = {
	msgid
    };
    $.get(url, data, function(html) {
	var details = parseMailDetails(msgid, html);
	mailAction("accept", list, msgid, details.csrftoken);
    });
}

function mailDetailsClick() {
}

function detailActionClick() {
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
