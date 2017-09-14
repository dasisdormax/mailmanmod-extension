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

/*******************
 * Network actions *
 *******************/

// Updates a single list object
function refreshList(list) {
    console.log("Refreshing list " + list.name + " ...");
    var url = list.baseurl + "/admindb/" + list.name;
    var data = {
	adminpw:  list.password,
	admlogin: "Login"
    }
    list.error = null;
    $.post(url, data, function(html) {
	parseAdmindb(list, html);
	saveAll();
	renderList(list);
    }).fail(function(request){
	switch(request.status) {
	    case 401:
		list.error = 'badpass'; break;
	    case 404:
		list.error = 'notfound'; break;
	    default:
		list.error = 'unknown';
	}
	list.time = new Date().getTime();
	saveAll();
	renderList(list);
    });
}

// gets mail details asynchronously
// Usage: getMailDetails(list, msgid).then(callback);
function getMailDetails(list, msgid) {
    var url = list.baseurl + "/admindb/" + list.name;
    // return a promise that resolves with the details object
    // if the response could be parsed correctly
    return new Promise((resolve, reject) => {
	$.get(url, {msgid}).done(function(html){
	    let details = parseMailDetails(msgid, html);
	    if(details) {
		// Add data from mail object
		let mail = list.mails.find((mail) => mail.msgid == msgid);
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
function mailAction(action, list, msgid, csrf_token) {
    if(list.error) return;
    var url = list.baseurl + "/admindb/" + list.name;

    // Get a CSRF Token before proceeding
    if(csrf_token === undefined) {
	getMailDetails(list, msgid).then(function(details) {
	    mailAction(action, list, msgid, details.csrf_token);
	});
	return;
    }
    var value = 0;
    switch(action) {
	case "accept":
	    value = 1; break;
	case "reject":
	    value = 2; break;
	case "discard":
	    value = 3; break;
	default:
	    action = "--";
	    value = 0;
    }
    console.log("Executing action " + action + " on message #" + msgid + " in list " + list.name);
    var data = {
	csrf_token,
	submit: "Submit Data ..."
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

/**********************
 * XHR Result Parsers *
 **********************/
function prepareHtml(html) {
    // Remove everything except the body contents
    html = html.replace(/^(.|\n)*?<body[^>]*>/i, '');
    html = html.replace(/<\/body(.|\n)*/i,       '');
    // Remove external content, such as scripts and images
    html = html.replace(/<img[^>]*>/gi,                   '');
    html = html.replace(/<script(\n|.)*?(\/script>|$)/gi, '');
    html = html.replace(/<iframe(\n|.)*?(\/iframe>|$)/gi, '');
    return html;
}

function parseAdmindb(list, html) {
    var result = $("#result");
    result.html(prepareHtml(html));
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
		    subject: $(data[0]).text(),
		    size: Number.parseInt($(data[1]).text(), 10),
		    time: $(data[3]).text()
		};
		list.mails.push(mail);
	    });
	});
    }
    result.empty();
}

function parseMailDetails(msgid, html) {
    var result = $("#result");
    var details = null;
    result.html(prepareHtml(html));
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
