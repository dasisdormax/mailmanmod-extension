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

/*********************************************
 * Actions that can be initiated by the user *
 *********************************************/
function actionNew(id) {
    var first   = lists.length > 0 ? lists[0] : null;
    var current = id ? getListById(id) : null;
    showEditForm(copyList(current || first));
}

function actionEdit(id) {
    if(!id) {
	status(_("errNoListSelected"));
	return;
    }
    showEditForm(getListById(id));
}

function actionDelete(id) {
    if(!id) {
	status(_("errNoListSelected"));
	return;
    }
    deleteCredentialWithId(id);
    showLists();
}

function actionRefresh() {
    // Resetting list.time will cause the list to be refreshed
    // when rendering the next time
    lists.forEach((list) => {list.time = null;});
    showLists();
}

// Execute an action on the selected mailinglist
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
	    status(_("errNoActionSelected"));
    }
}

// Accept an e-mail directly from the main panel
function mailAcceptClick() {
    var div   = $(this).parents(".mail");
    var list  = getListById(div.attr("data-listid"));
    var msgid = div.attr("data-msgid");
    var mail  = list.mails.find((mail) => mail.msgid === msgid);
    mailAction("accept", list, mail);
}

// Open the details view for a specifc e-mail
function mailDetailsClick() {
    var div   = $(this).parents(".mail");
    var list  = getListById(div.attr("data-listid"));
    var msgid = div.attr("data-msgid");
    var mail  = list.mails.find((mail) => mail.msgid === msgid);
    getMailDetails(list, mail).then((details) => renderMailDetails(list, details));
}

// Execute an action on a specific mail from its detail page
function detailActionClick() {
    var list        = getListById($("#mail-listid").val());
    var msgid       = $("#mail-msgid").val();
    var mail        = list.mails.find((mail) => mail.msgid === msgid);
    mail.csrf_token = $("#mail-csrftoken").val();
    var action      = $(this).attr("data-mailaction");
    mailAction(action, list, mail);
    showLists();
}

// Save the changes made to a mailinglist on the edit/create page
function editSaveClick() {
    var list = copyList({
	name:     $('#edit-name').val().trim(),
	baseurl:  $('#edit-baseurl').val().trim().replace(/\/+$/,""),
	password: $('#edit-password').val()
    });
    list.id = $('#edit-id').val();

    // Validate
    var error = listHasError(list);
    if(error) {
	status(_(error));
    } else {
	updateCredential(list);
    }
}

// Opens the About & Options Page
function optionsClick() {
    chrome.runtime.openOptionsPage();
}

/*************
 * RENDERING *
 *************/
function renderList(list, index) {
    var id    = list.id;
    var div   = "div#d-" + id;
    var label = div + ">label";
    if(!$(div).length) {
	let html = '<div id="d-' + id + '">';
	if(lists[index+1]) {
	    $("div#d-" + lists[index+1].id).before(html);
	} else {
	    $("#mmm-lists").append(html);
	}
    }
    // reset div contents and attributes
    $(div).empty();

    // create list label and radio button
    $(div).append('<label for="r-' + id + '">');
    $(label).text(list.name);

    if(!list.time) {
	$(label).prepend("<span>" + __("listLoading") + "</span> ");
	refreshList(list);
    } else {
	if(list.error) {
	    // Display error message
	    $(label).append(' <span class="error">' + __(list.error) || __("listErrUnknown") + '</span>');
	} else if(list.mails && list.mails.length > 0) {
	    list.mails.forEach(function(mail) {
		let mdiv     = '#m-' + mail.msgid;
		let p        = mdiv + ">p";
		let clearfix = mdiv + ">.clearfix";
		// Create child div for each e-mail
		$(div).append('<div class="mail" id="m-' + mail.msgid + '">');
		$(mdiv).attr('data-msgid', mail.msgid);
		$(mdiv).attr('data-listid', id);
		$(mdiv).append('<p>');
		$(p).append('<strong>');
		$(p + ">strong").text(mail.subject);
		$(p).append('<br>');
		$(p).append(__("mailFrom", mail.from));
		$(mdiv).append('<div class="clearfix">');
		$(clearfix).append('<button class="hw green" data-accept>' + __('buttonAccept')  + "</button>");
		$(clearfix).append('<button class="hw grey" data-details>' + __('buttonDetails') + "</button>");
		$(clearfix + ">button[data-accept]" ).click(mailAcceptClick);
		$(clearfix + ">button[data-details]").click(mailDetailsClick);
	    });
	} else {
	    $(label).append(' <span>' + __("listNoMessages") + '</span>');
	}
    }
    $(label).prepend('<input type="radio" id="r-' + id + '" name="listid" value="' + id + '">');
}

function renderMailDetails(list, details) {
    $("#details > h3 > span").text(_("headingDetails", [details.msgid, list.name]));
    $("#summary").empty();
    $("#summary").append('<strong>');
    $("#summary > strong").text(details.subject);
    $("#summary").append('<br>');
    $("#summary").append(__('mailFrom', details.from));
    if(details.size) {
	$("#mail").removeClass('hidden');
	$("#summary").append('<br>');
	$("#summary").append(__('mailSize', details.size));
	$("#summary").append('<br>');
	$("#summary").append(__('mailTime', details.time));
	$("#headers").text(details.headers);
	var text = details.text;
	text = text.replace(/<style[^<]*/i,'');             // Remove content of <style> elements
	text = text.replace(/<[a-zA-Z!\/-][^>]*(>|$)/g,''); // Remove HTML tags and comments
	text = text.replace(/\n\s+\n/g,"\n\n");             // Remove unnecessary whitespace and linebreaks
	text = text.trim();                                 // Remove leading and trailing whitespace
	$("#fulltext").text(text);
    } else {
	$("#mail").addClass('hidden');
    }
    $("#mail-listid").val(list.id);
    $("#mail-msgid").val(details.msgid);
    $("#mail-csrftoken").val(details.csrf_token || '');
    select("#details");
}

function status(text) {
    if(text) {
	$("#status").removeClass("hidden");
	$("#status").text(text);
    } else {
	$("#status").addClass("hidden");
    }
}

// Select the page to show: all others will be hidden
function select(selection) {
    $("body > div").addClass("hidden");
    $(selection).removeClass("hidden");
    status("");
}

function renderAll() {
    $("#mmm-lists").empty();
    for(var i = 0; i < lists.length; i++) {
	renderList(lists[i]);
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

/*****************
 * COMMUNICATION *
 *****************/
function handleMessage(msg) {
    switch(msg.action) {
	case 'renderList':
	    renderList(msg.list); break;
	default:
    }
}

/******************
 * INITIALIZATION *
 ******************/
var context = "[POPUP]";

$(function() {
    $("body").html(localizeHtml);
    $("#mmm-list-perform-action").click(listActionClick);
    $("#mmm-edit-save").click(editSaveClick);
    $("#mmm-options").click(optionsClick);
    $("#status").click(() => status(''));
    $("button[data-cancel]").click(showLists);
    $("button[data-mailaction]").click(detailActionClick);
    chrome.storage.onChanged.addListener(handleStorageChanges);
    showLists();
    loadAll();
});
