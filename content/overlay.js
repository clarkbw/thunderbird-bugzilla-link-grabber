/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bugzilla Link Grabber.
 *
 * The Initial Developer of the Original Code is
 * Bryan Clark.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */
const EXTENSION_ID = "bugzillalinkgrabber@bryan.clark";

var bugzillalinkgrabber = {
  initialized: false,
  strings: null,

  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("bugzillalinkgrabber-strings");

    document.getElementById("messagePaneContext").
             addEventListener("popupshowing", function(e) { bugzillalinkgrabber.showContextMenu(e); }, false);

    Application.events.addListener("messageShow", bugzillalinkgrabber);
  },

  showContextMenu: function(event) {
    if (gContextMenu.onLink && !gContextMenu.onMailtoLink) {
      document.getElementById("context-bugzillalinkgrabber").hidden = false;
      document.getElementById("context-bugzillalinkgrabber").setAttribute("label", this.strings.getString("label").replace("%s", gContextMenu.linkURL));
    }
    else { document.getElementById("context-bugzillalinkgrabber").hidden = true; }
  },

  onMenuItemCommand: function(linkURL) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  },

  getBugzillas : function() {
    try {
      var bgs = Components.classes["@mozilla.org/preferences-service;1"].
                           getService(Components.interfaces.nsIPrefService).
                           getBranch("extensions."+EXTENSION_ID+".bugzillas.");

      var children = bgs.getChildList("", {});

      var bugzillas = {}
      for(var i = 0; i < children.length; i++) {
        var url = bgs.getCharPref(children[i]);
        bugzillas[children[i]] = url;
      }
    } catch (e) { Application.console.log(e); }
    return bugzillas;
  },
  createBugAnchor : function(bugMatch) {
    var number = bugMatch.match(/(\d+)/i)[1];
    var cDoc = document.getElementById('messagepane').contentDocument;
    var anchor = cDoc.createElementNS("http://www.w3.org/1999/xhtml", "html:a");
        // Application.extensions.get(EXTENSION_ID).prefs.get("default.url").replace("%s", number)
        anchor.setAttribute("href", Application.prefs.get("extensions."+EXTENSION_ID+".default.url").value.replace("%s", number));
        anchor.setAttribute("class", "bugzilla-link");
        anchor.setAttribute("target", "_content");
        anchor.setAttribute("title", "(we'll be getting the title soon!)");
        anchor.appendChild(cDoc.createTextNode(bugMatch));
    return anchor;
  },
  handleEvent : function (event) {
    // FIXME: for now we can just assume the message has rendered in the message pane

    try {
      // Reach in and grab the Nodes we need
      var cDoc = document.getElementById('messagepane').contentDocument;
      var msgHTMLDoc = cDoc.childNodes.item(0);
      var text = msgHTMLDoc.childNodes.item(1).textContent;  // this is the BODY node text
      var bugx = /(?:\s|\W|^)(bug\s+#?\d{3,6})/ig;
      var bugMatches = bugx.exec(text);

      if (bugMatches) {
        // A snapshot is necessary because we are going to mess with the DOM as we traverse
        var nodesSnapshot = cDoc.evaluate("//text()", cDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE , null );

        for ( var i=0 ; i < nodesSnapshot.snapshotLength; i++ ) {
          var nssi = nodesSnapshot.snapshotItem(i);
          for (var index = 1; index < bugMatches.length; index++) {
            if ( nssi.textContent.indexOf(bugMatches[index]) != -1 ) {
              var t = nssi.splitText(nssi.textContent.indexOf(bugMatches[index]));
              t.replaceData(t.textContent.indexOf(bugMatches[index]),bugMatches[index].length, "");
              nssi.parentNode.insertBefore(this.createBugAnchor(bugMatches[index]),t);
            }
          }
        }

      }
    } catch (e) { Application.console.log(e); }

    var bugzillas = this.getBugzillas();
    var linkNodes = document.getElementById('messagepane').contentDocument.links;
    for (var index = 0; index < linkNodes.length; index++) {
      // FIXME: with a lot of bugzillas included this could get slow.
      for each (var bugzilla in bugzillas) {
        if (linkNodes[index].href.indexOf(bugzilla.replace("%s", "")) == 0) {
          linkNodes[index].replaceChild(cDoc.createTextNode("bug " + linkNodes[index].href.substr(bugzilla.replace("%s", "").length, linkNodes[index].href.length)),linkNodes[index].firstChild);
        }
      }
    }
   },
};
window.addEventListener("load", function(e) { bugzillalinkgrabber.onLoad(e); }, false);
