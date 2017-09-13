# Mailmanmod WebExtension
Manage and moderate all your mailman lists in one place

<img title="Main panel example" src="example.png" width="450px">

## WARNING
This extension was created and tested only with one server (mailman v2.1.23, german language)
and may not work on your server correctly. Please test the functionality with a test e-mail
before using this add-on in production to prevent data loss.

Mailman v3 uses a new web system and api and will most certainly not work. If you can provide me
with a test installation, i'll try my best to update this extension for it.

## Features
- Show pending messages in all your mailing lists
- Display individual mail headers and content
- Accept, Reject and Discard e-mails
- Automatic background checks

## Limitations
- Mailman v2 only
- Assumes that the moderation interface is located at *&lt;baseurl&gt;*/admindb/*&lt;listname&gt;*, which may or may not be the case for you
- Only available in English
