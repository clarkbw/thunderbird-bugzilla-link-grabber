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
const Cc = Components.classes;
const Ci = Components.interfaces;

const SELECT_SQL = "SELECT url, title, bug_status, comment_count, last_comment FROM bugs WHERE url=?1";
const INSERT_SQL = "INSERT INTO bugs (url, title, bug_status, comment_count, last_comment) VALUES (?1, ?2, ?3, ?4, ?5)";

var bugzillaLinkSQL = {

  insertStatement : null,
  selectStatement : null, 

  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.dbInit();
  },

  bug: function(id, url) {
    var ret = { "id" : id, "url" : url };
    try {
      this.selectStatement.bindUTF8StringParameter(0, url);
      this.selectStatement.execute();
      var results = this.selectStatement.executeStep();
      if (results) {
        ret["title"] = this.selectStatement.getUTF8String(1) || "";
        ret["bug_status"] = this.selectStatement.getUTF8String(2) || "";
        ret["comment_count"] = this.selectStatement.getInt32(3) || 0;
        ret["last_comment"] = this.selectStatement.getUTF8String(4) || "";
      }
    } finally {
      this.selectStatement.reset();
    }

    // assume a title would have been set if we found the bug in the db
    if (!ret["title"]) {

      var req = new XMLHttpRequest();
      var loaded = function _bugXML() {
        if (req.responseXML) {
          var xmlDoc = req.responseXML;
          var nsResolver = xmlDoc.createNSResolver( xmlDoc.ownerDocument == null ? xmlDoc.documentElement : xmlDoc.ownerDocument.documentElement );

          var xpath = xmlDoc.evaluate("//short_desc", xmlDoc, nsResolver, XPathResult.ANY_TYPE, null );            
          var short_desc = xpath.iterateNext();
          ret["title"] = short_desc.textContent || "";

          var xpath = xmlDoc.evaluate("//bug_status", xmlDoc, nsResolver, XPathResult.ANY_TYPE, null );
          var bug_status = xpath.iterateNext();
          ret["bug_status"] = bug_status.textContent || "";

          var xpath = xmlDoc.evaluate("count(//long_desc)", xmlDoc, nsResolver, XPathResult.ANY_TYPE, null );
          ret["comment_count"] = xpath.numberValue || 0;

          var xpath = xmlDoc.evaluate("//long_desc[last()]/thetext", xmlDoc, nsResolver, XPathResult.ANY_TYPE, null );
          var last_comment = xpath.iterateNext();
          ret["last_comment"] = last_comment.textContent || "";

          try {
            bugzillaLinkSQL.insertStatement.bindUTF8StringParameter(0, url)
            bugzillaLinkSQL.insertStatement.bindUTF8StringParameter(1, ret["title"])
            bugzillaLinkSQL.insertStatement.bindUTF8StringParameter(2, ret["bug_status"])
            bugzillaLinkSQL.insertStatement.bindInt32Parameter(3, ret["comment_count"]);
            bugzillaLinkSQL.insertStatement.bindUTF8StringParameter(4, ret["last_comment"])
            bugzillaLinkSQL.insertStatement.execute();
          } finally {
            bugzillaLinkSQL.insertStatement.reset();
          }
        }
      };
      req.onload = loaded;
      req.open("GET",url + "&ctype=xml", false);
      req.send(null);
    }

    return ret;
  },

  dbConnection: null,

  dbSchema: {
     tables: {
       bugs:"url           TEXT PRIMARY KEY, \
             title         TEXT, \
             bug_status    TEXT, \
             comment_count INTEGER, \
             last_comment  TEXT"
    }
  },

  dbInit: function() {
    var dirService = Cc["@mozilla.org/file/directory_service;1"].
      getService(Ci.nsIProperties);

    var dbFile = dirService.get("ProfD", Ci.nsIFile);
    dbFile.append("bugzilla_links.sqlite");

    var dbService = Cc["@mozilla.org/storage/service;1"].
      getService(Ci.mozIStorageService);

    var dbConnection;

    if (!dbFile.exists())
      dbConnection = this._dbCreate(dbService, dbFile);
    else {
      dbConnection = dbService.openDatabase(dbFile);
    }
    this.dbConnection = dbConnection;

    try {
      this.selectStatement = dbConnection.createStatement(SELECT_SQL);
      this.insertStatement = dbConnection.createStatement(INSERT_SQL);
    } catch (e) {
      Application.console.log(e + '\n'+ dbConnection.lastErrorString);
    }
  },

  _dbCreate: function(aDBService, aDBFile) {
    var dbConnection = aDBService.openDatabase(aDBFile);
    this._dbCreateTables(dbConnection);
    return dbConnection;
  },

  _dbCreateTables: function(aDBConnection) {
    for(var name in this.dbSchema.tables)
      aDBConnection.createTable(name, this.dbSchema.tables[name]);
  },
};
window.addEventListener("load", function(e) { bugzillaLinkSQL.onLoad(e); }, false);

