#!/bin/bash
#
# Mailmanmod WebExtension - manage all your mailinglists in one place
#
# Copyright (C) 2017 Maximilian Wende
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the Affero GNU General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# Affero GNU General Public License for more details.
#
# You should have received a copy of the Affero GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

FILES=(
    manifest.json
    agpl-3.0.txt
    html/background.html
    html/options.html
    html/popup.html
    css/options.css
    css/popup.css
    js/lists.js
    js/network.js
    js/background.js
    js/options.js
    js/popup.js
    icons/mmm-192.png
    icons/mmm-96.png
    extern/downloadjs/download.js
    extern/downloadjs/LICENSE.md
    extern/jquery/jquery-3.2.1.min.js
    extern/jquery/LICENSE.txt
)

cd $(dirname $0)

echo "Clearing previous build ..."
rm mailmanmod.zip 2>/dev/null
mkdir tmp || { echo "Error preparing the build" >&2; exit; }

echo "Copying files into build directory ..."
(
    cd ..
    for file in ${FILES[@]}; do
	echo ">> $file"
	mkdir -p "build/tmp/$(dirname $file)"
	cp "$file" "build/tmp/$file"
    done
)

echo "Creating archive ..."
(
    cd tmp
    zip -r -T ../mailmanmod.zip *
)

rm -r tmp
echo "Done!"
