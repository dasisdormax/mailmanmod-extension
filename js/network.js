"use strict";

/*******************
 * Network actions *
 *******************/

// Updates a single list object
function refreshList(list) {
    var url = list.baseurl + "/admindb/" + list.name;
    var data = {
	adminpw:  list.password,
	admlogin: "Login"
    }
    $.post(url, data, function(html) {
	parseAdmindb(list, html);
	saveAll();
	renderList(list);
    });
}

// Executes an action (accept, reject, discard) for a single mail
function mailAction(action, list, msgid, csrf_token) {
    var url = list.baseurl + "/admindb/" + list.name;
    if(csrf_token === undefined) {
	$.get(url, {msgid}, function(html) {
	    var details = parseMailDetails(msgid, html);
	    if(details.csrf_token === undefined) return;
	    mailAction("accept", list, msgid, details.csrf_token);
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
    // Remove everything except the body contents
    html = html.replace(/^(.|\n)*?<body[^>]*>/i, '');
    html = html.replace(/<\/body(.|\n)*/i,       '');
    var result = $("#result");
    var details = {};
    result.html(html);
    if(result.find("form").length) {
	details.csrf_token = result.find("input[name=csrf_token]").val() || '';
	details.headers    = result.find('textarea[name="headers-' + msgid + '"]').val();
	details.text       = result.find('textarea[name="fulltext-' + msgid + '"]').val();
    }
    result.empty();
    return details;
}
