"use strict";
/*
 * Mailmanmod WebExtension - manage all your mailinglists in one place
 *
 * Copyright (C) 2017-2020 Maximilian Wende
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

/*******************
 * Network actions *
 *******************/

// Checks if a list exists, without sending the password
function checkList(list, oldList) {
    console.log(context, "Checking if list '" + list.name + "' exists ...");
    var url = listUrl(list) + "/logout";
    // The function executed when the request fails OR does not land on an admin page
    var onError = function() {
	if(!oldList && list.baseurl.search("/admindb$") === -1) {
	    var newList = copyList(list);
	    newList.id      = list.id;
	    newList.baseurl = list.baseurl + "/admindb";
	    checkList(newList, list);
	} else {
	    if(oldList) list = oldList;
	    list.exists = false;
	    list.error  = "listErrNotFound";
	    list.time   = new Date().getTime();
	    saveList(list);
	}
    };
    // NOTE: /logout should show the login page, without sending an error code
    $.get(url, {}, function(html){
	if(parseLoginPage(html)) {
	    list.exists = true;
	    if(oldList)
		updateCredential(list);
	    else
		saveList(list);
	} else {
	    onError();
	}
    }).fail(onError);
}

// Updates a single list object
function refreshList(list) {
    if(!list.exists) {
	if(list.exists === undefined)
	    checkList(list);
	return;
    }
    console.log(context, "Refreshing list '" + list.name + "' ...");
    var url = listUrl(list);
    var data = {
	adminpw:  list.password,
	admlogin: "Login"
    }
    list.error = null;
    $.post(url, data, function(html) {
	parseAdmindb(list, html);
	saveList(list);
    }).fail(function(request){
	console.log(context, "Error refreshing list '" + list.name + "', request object:", request);
	switch(request.status) {
	    case 401:
		list.error = 'listErrBadPassword'; break;
	    case 404:
		list.error = 'listErrNotFound'; break;
	    case 0:
		// Network is not available - try again later
		list.error = 'listErrNoNetwork';
		saveList(list);
		return;
	    default:
		list.error = 'listErrUnknown';
	}
	list.time = new Date().getTime();
	saveList(list);
    });
}

// gets mail details asynchronously
// Usage: getMailDetails(list, mail).then(callback);
function getMailDetails(list, mail) {
    // return a promise that resolves with the details object
    // if the response could be parsed correctly
    return new Promise((resolve, reject) => {
	if(!mail.size) {
	    // this mail object is a join request and we cannot
	    // get more details than we already have
	    resolve(mail);
	    return;
	}
	// Create request to detail page
	var url = listUrl(list);
	var msgid = mail.msgid;
	$.get(url, {msgid}).done(function(html){
	    let details = parseMailDetails(msgid, html);
	    if(details) {
		// Add data from mail object
		details.msgid   = msgid;
		details.from    = mail.from;
		details.subject = mail.subject;
		details.time    = mail.time;
		details.size    = mail.size;
		resolve(details);
	    } else {
		// That e-mail has already been moderated
		refreshList(list);
		reject();
	    }
	}).fail(function() {
	    reject();
	});
    });
}

// Executes an action (accept, reject, discard) for a single mail
function mailAction(action, list, mail, isRepeat) {
    if(list.error) return;
    var url   = listUrl(list);
    var msgid = mail.msgid;
    var type  = mail.size ? "mail" : "join request"
    var csrf_token = (type === "join request") ? list.csrf_token : mail.csrf_token;

    // Try to get a CSRF Token before proceeding
    // If this does not work, try without one
    if(csrf_token === undefined) {
	if(!isRepeat) {
	    getMailDetails(list, mail).then(function(details) {
		mailAction(action, list, details, true);
	    });
	    return;
	}
    }

    // Convert action into its numeric value
    var value = 0;
    switch(action) {
	case "accept":
	    // Note that accepting a join request uses a value of 4 instead of 1
	    value = (type === "join request") ? 4 : 1;
	    break;
	case "reject":
	    value = 2; break;
	case "discard":
	    value = 3; break;
	default:
	    action = "--";
	    value = 0;
    }
    console.log(context, "Executing action " + action + " on " + type + " #" + msgid + " in list " + list.name);
    var data = {
	csrf_token,
	submit: "Submit Data ..."
    }
    data[msgid] = value;
    data["comment-" + msgid] = '';
    console.log(context, "POST data:", data);

    // Send data to the server
    $.post(url, data, function(html) {
	// We can directly parse the result and update the list object with it
	parseAdmindb(list, html);
	saveList(list);
    });
}

/**********************
 * XHR Result Parsers *
 **********************/

// prepare the HTML before inserting it into the result div
function prepareHtml(html) {
    // Remove everything except the body contents
    html = html.replace(/^(.|\n)*?<body[^>]*>/i, '');
    html = html.replace(/<\/body(.|\n)*/i,       '');
    // Remove external content, such as scripts and images
    // Scripts should be blocked by the content security policy, but better be safe than sorry
    html = html.replace(/<img[^>]*>/gi,                   '');
    html = html.replace(/<script(\n|.)*?(\/script>|$)/gi, '');
    html = html.replace(/<iframe(\n|.)*?(\/iframe>|$)/gi, '');
    return html;
}

function parseLoginPage(html) {
    var result = $("#result");
    result.html(prepareHtml(html));
    if(result.find('input[name="adminpw"]'))
	return true;
    return false;
}

function parseAdmindb(list, html) {
    var result = $("#result");
    result.html(prepareHtml(html));
    list.time = new Date().getTime();
    list.mails = [];
    if(result.find("form").length) {
	// Parse e-mails for each group (mails by the same sender)
	list.csrf_token = result.find('input[name="csrf_token"]').val();
	result.find("form>table>tbody>tr").each(function(){
	    var row = $(this);
	    if(row.find("table table").length) {
		// this row is a mail group
		parseAdmindbMailGroup(list, row);
	    } else if (row.find('input[name^="ban-"]').length) {
		// this row is a join request
		parseAdmindbJoinRequest(list, row);
	    }
	});
    }
    result.empty();
}

function parseAdmindbJoinRequest(list, row) {
    // Get user requesting join and optionally the name
    var name = row.find("td em").text().trim();
    row.find("td em").remove();
    var from = row.find("td").first().text().trim();
    from = name ? name + " (" + from + ")" : from;
    // Get request ID: the name of the first radio button
    var msgid = row.find(':radio').attr("name");
    var mail  = {
	msgid,
	from,
	subject: _("listJoinRequest"),
	size: null,
	time: null,
    }
    list.mails.push(mail);
}

function parseAdmindbMailGroup(list, row) {
    var from = row.find("tbody>tr>td").html().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)[0];
    // Parse individual mail entries
    row.find("table table table").each(function(){
	var mlink = $(this).find("a");
	if(!mlink.length) {
	    // E-mails have an anchor that points to the message detail page
	    // Checking for this, we filter out all tables that don't
	    // correspond to an actual e-mail
	    return;
	}
	var msgid = mlink.attr("href").match(/[0-9]+$/)[0];
	// The last column contains the information we need
	var data  = $(this).find("td:last-child");
	var mail  = {
	    msgid,
	    from,
	    subject: $(data[0]).text(),
	    size: Number.parseInt($(data[1]).text(), 10),
	    time: $(data[3]).text()
	};
	list.mails.push(mail);
    });
}

function parseMailDetails(msgid, html) {
    var result = $("#result");
    var details = null;
    result.html(prepareHtml(html));
    // By checking for the textarea, we know if the mail has already been moderated or not
    if(result.find("textarea").length) {
	details = {
	    csrf_token: result.find("input[name=csrf_token]").val() || '',
	    headers:    result.find('textarea[name="headers-'  + msgid + '"]').val(),
	    text:       result.find('textarea[name="fulltext-' + msgid + '"]').val()
	};
    }
    result.empty();
    return details;
}
