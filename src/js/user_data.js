var USER_DATA_LOCAL_STORAGE = "CONFAPP_USER_DATA";
var USER_DATA_OTHER_STORAGE = "CONFAPP_USER_DATA_OTHER";

var voter_id, id_token;
var endsWith = function(str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

var getFieldDefault = function(field_name) {
		if(field_name === "created_at" || endsWith(field_name, "updated_at")) {
			return new Date(0);
		} else if(field_name === "note") {
			return "";
		} else {
			return false;
		}
};

var dataRowFields = ["schedule", "reading_list", "note", "vote"];
var UserDataRow = function(event_id, userData, options) {
	this._event_id = event_id;
	this._options = options;
	this._userData = userData;
	this._listeners = userData._row_listeners[event_id] || [];
	delete userData._row_listeners[event_id];

	if(this._listeners.length > 0) {
		$.each(dataRowFields, $.proxy(function(i, field_name) {
			if(this._options.hasOwnProperty(field_name)) {
				this._notifyListeners(field_name, this._options[field_name]);
			}
		}, this));
	}

	this.$onValue = $.proxy(this._onValue, this);
	//this.setFirebaseRef(firebaseRef);
};
(function(My) {
	var proto = My.prototype;

	proto.getFirebaseRef = function() {
		return this._firebaseRef;
	};
	proto.setFirebaseRef = function(ref) {
		var oldFirebaseRef = this._firebaseRef;

		if(oldFirebaseRef) {
			oldFirebaseRef.off('value', this.$onValue);
		}

		this._firebaseRef = ref;

		if(this._firebaseRef) {
			this._firebaseRef.on('value', this.$onValue);
		}
	};

	proto._onValue = function(dataSnapshot) {
		var dataVal = dataSnapshot.val();
		if(dataVal) {
			var remoteRow = this.getParent().webDataToRow(dataVal);
			this.mergeAndSave(remoteRow);
		} else {
			this.pushToWeb();
		}
	};

	proto._doSetField = function(field_name, field_value, updated_at) {
		this._options[field_name] = field_value;
		this._doSetUpdatedAtField(field_name, updated_at);
		this._notifyListeners.apply(this, arguments);
	};

	proto._doSetUpdatedAtField = function(field_name, updated_at) {
		this._options[field_name+"_updated_at"] = updated_at;
	};

	proto._notifyListeners = function(field_name, field_value) {
		$.each(this._listeners, function(index, info) {
			info.callback.call(info.thisArg || this, field_name, field_value);
		});
	};

	proto.setField = function(field_name, field_value, callback, thisArg) {
		var timestamp = new Date((new Date()).getTime()),
			args = rest(arguments, 0);

		args.splice(2, 0, timestamp); // insert a timestamp into the arguments

		this._doSetField.apply(this, args);
		this.pushToWeb(function() {
			return callback.call(thisArg||this);
		});
	};
	proto.setFieldAndSave = function(field_name, field_value, callback, thisArg) {
		return this.setField(field_name, field_value, function() {
			var userData = this.getParent();
			userData.saveLocally();
			if(callback) {
				callback.apply(thisArg || this, arguments);
			}
		}, this);
	};
	proto.getField = function(field_name) {
		if(this._options.hasOwnProperty(field_name)) {
			return this._options[field_name];
		} else {
			return getFieldDefault(field_name);
		}
	};
	proto.getFieldUpdatedAt = function(field_name) {
		return this.getField(field_name+"_updated_at");
	};
	proto.merge = function(otherRow) {
		var needToPushToWeb = false;
		each(dataRowFields, function(field_name, index) {
			var updated_at = this.getFieldUpdatedAt(field_name),
				other_updated_at = otherRow.getFieldUpdatedAt(field_name),
				updated_at_timestamp = updated_at.getTime(),
				other_updated_at_timestamp = other_updated_at.getTime(),
				other_value = otherRow.getField(field_name),
				my_value = this.getField(field_name);

			if(other_updated_at_timestamp >= updated_at_timestamp) {
				this._doSetField(field_name, other_value, other_updated_at);
			} else {
				needToPushToWeb = true;
			}
		}, this);

		return needToPushToWeb;
	};
	proto.mergeAndSave = function() {
		if(this.merge.apply(this, arguments)) {
			this.pushToWeb();
		}
	};
	proto.getParent = function() {
		return this._userData;
	};
	proto.onChange = function(callback, thisArg, name) {
		this._listeners.push({
			callback: callback,
			thisArg: thisArg,
			name: name
		});
	};
	proto.offChange = function(name) {
		for(var i = 0; i<this._listeners.length; i++) {
			var listener = this._listeners[i];
			if(listener.name === name) {
				this._listeners.splice(i, 1);
				i--;
			}
		}
	};
	proto.serialize = function() {
		var obj = {};
		$.each(this._options, function(property_name, value) {
			if(property_name === "created_at" || endsWith(property_name, "updated_at")) {
				obj[property_name] = value.getTime();
			} else  {
				obj[property_name] = value;
			}
		});
		return obj;
	};
	proto.getWebObject = function() {
		var rv = {
			event_id: this.getEventID()
		};
		each(dataRowFields, function(field_name, index) {
			var updated_at = this.getFieldUpdatedAt(field_name),
				value = this.getField(field_name);

			rv[field_name] = {
				value: value,
				updated_at: updated_at.getTime()
			};
		}, this);
		return rv;
	};
	proto.getEventID = function() {
		return this._event_id;
	};

	proto.pushToWeb = function(callback, thisArg) {
		var userData = this.getParent();

		if(userData.canWebSync()) {
			var event_id = this.getEventID();

			var firebaseRef = this.getFirebaseRef();
			if(firebaseRef) {
				var webObject = this.getWebObject();
				firebaseRef.child('event_id').set(event_id);
				each(dataRowFields, function(field_name) {
					var fieldRef = firebaseRef.child(field_name);
					fieldRef.set(webObject[field_name]);
					/*

					fieldRef.transaction($.proxy(function(currentData) {
						if(currentData) {
							var data = this.getParent().webDataToRow(currentData);
							this.merge(data);
						}

						if(callback) {
							callback.call(thisArg || this);
						}

						return this.getWebObject();
					}, this), $.proxy(function(err, committed, dataSnapshot) {
						if(!err) {
							var data = this.getParent().webDataToRow(dataSnapshot);
							this.merge(data);
						}
					}, this));
					*/
				}, this);
				/*
				firebaseRef.transaction($.proxy(function(currentData) {
					if(currentData) {
						var data = this.getParent().webDataToRow(currentData);
						this.merge(data);
					}

					if(callback) {
						callback.call(thisArg || this);
					}

					return this.getWebObject();
				}, this), $.proxy(function(err, committed, dataSnapshot) {
					if(!err) {
						var data = this.getParent().webDataToRow(dataSnapshot);
						this.merge(data);
					}
				}, this));
				*/
			} else {
				if(callback) {
					callback.call(thisArg || this, new Error('No Firebase ref'));
				}
			}
		}
	};
}(UserDataRow));

var UserData = function(firebaseRef, conference_id, canWebSync, callback, thisArg) {
	this._firebaseRef = firebaseRef;
	this._canWebSync = canWebSync;
	this._conference_id = conference_id;
	this._loaded = false;
	this._load_listeners = [];
	this._row_listeners = {};
	this._listeners = {};
	this.rows = {};

	if(callback) {
		this.onLoad(callback, thisArg);
	}
	this.loadLocally();

	this.$onChildAdded = $.proxy(this._onChildAdded, this);

	if(this._firebaseRef) {
		this._firebaseRef.onAuth(this._onAuth, this);
	}
};
(function(My) {
	var proto = My.prototype;

	var merge_rows = function(row, event_id) {
		try {
			var existing_row = this.rows[event_id];
			if(existing_row) {
				existing_row.mergeAndSave(row);
			} else {
				this.rows[event_id] = row;
				row.setFirebaseRef(this.getEventFirebaseRef(row.getEventID()));
			}
		} catch(e) {
			console.error('Problem with event ' + event_id + ': ' + e);
		}
	};

	proto.mergeRows = function() {
		return merge_rows.apply(this, arguments);
	};

	proto._onAuth = function(authData) {
		this.updateRowFirebaseRefs();
		if(authData) {
			this.webSync();
		}
	};

	proto.updateRowFirebaseRefs = function() {
		var oldFirebaseRef = this._currentFirebaseRef;
		if(oldFirebaseRef) {
			oldFirebaseRef.off('child_added', this.$onChildAdded);
		}
		this._currentFirebaseRef = this.getFirebaseRef();
		if(this._currentFirebaseRef) {
			this._currentFirebaseRef.on('child_added', this.$onChildAdded);
		}
		each(this.rows, function(row, event_id) {
			row.setFirebaseRef(this.getEventFirebaseRef(event_id));
		}, this);
	};

	proto._onChildAdded = function(childSnapshot) {
		var event_id = childSnapshot.key(),
			row = this.webDataToRow(childSnapshot.val());

		this.mergeRows(row, event_id);
	};

	proto.getFirebaseRef = function() {
		var rootRef = this._firebaseRef;
		var authInfo = rootRef.getAuth();
		if(authInfo) {
			var conference_id = sanitizeFirebaseKey(this.getConferenceID()),
				user_id = authInfo.uid;
			return rootRef.child('user_data').child(conference_id).child(user_id);
		}
	};

	proto.getEventFirebaseRef = function(event_id) {
		var userFirebaseRef = this.getFirebaseRef();
		if(userFirebaseRef) {
			return userFirebaseRef.child(event_id);
		}
	};

	proto.webSync = function() {
		if(this.canWebSync()) {
			var found_rows = {};
			each(this.rows, function(value, key) {
				found_rows[key] = false;
			});

			this.getAllWebData(function(err, rows) {
				if(!err) {
					var do_merge_rows = $.proxy(merge_rows, this);
					each(rows, do_merge_rows);

					each(rows, function(row, key) {
						found_rows[key] = true;
					});

					each(found_rows, $.proxy(function(was_found, event_id) {
						if(!was_found) {
							var otherRow = new UserDataRow(event_id, this, {event_id: event_id});
							do_merge_rows(otherRow, event_id);
						}
					}, this));
				}
			}, this);
		}
	};
	proto.getRow = function(event_id, avoid_create) {
		if(this.rows.hasOwnProperty(event_id)) {
			return this.rows[event_id];
		} else if(!avoid_create) {
			var row = new UserDataRow(event_id, this, {event_id: event_id});
			this.rows[event_id] = row;
			row.setFirebaseRef(this.getEventFirebaseRef(row.getEventID()));
			return row;
		}
	};
	proto.loadLocally = function() {
		var do_merge_rows = $.proxy(merge_rows, this);

		each(this.getLocalStorageRows(this.getConferenceID()), do_merge_rows);
		this._onLoaded();
		/*

		var other_str = localStorage.getItem(USER_DATA_OTHER_STORAGE);
		if(other_str) {
			try {
				var other_obj = JSON.parse(other_str);
				if(other_obj.voter_id) {
					this.setVoterID(other_obj.voter_id);
				}
			} catch(e) {
				console.error(e);
			}
		}
		*/

		return this;
	};
	proto._onLoaded = function() {
		this._loaded = true;
		$.each(this._load_listeners, function(index, info) {
			info.callback.call(info.thisArg);
		});
		this._load_listeners = [];
	};
	proto.onLoad = function(callback, thisArg) {
		if(!thisArg) { thisArg = this; }

		if(this.isLoaded()) {
			callback.call(thisArg);
		} else {
			this._load_listeners.push({
				callback: callback,
				thisArg: thisArg
			});
		}

		return this;
	};
	proto.isLoaded = function() {
		return this._loaded;
	};
	proto.getField = function(event_id, field_name) {
		var row = this.getRow(event_id, true);
		if(row) {
			return row.getField(field_name);
		} else {
			return getFieldDefault(field_name);
		}
	};
	proto.setField = function(event_id) {
		var row = this.getRow(event_id);
		return row.setField.apply(row, rest(arguments, 1));
	};
	proto.setGoogleIDToken = function(id_token) {
		this._google_id_token = id_token;
		this.webSync();
	};
	proto.getGoogleIDToken = function() {
		return this._google_id_token;
	};
	proto.serialize = function() {
		var rv = {};
		$.each(this.rows, function(event_id, row) {
			rv[event_id] = row.serialize();
		});
		return rv;
	};
	proto.setFieldAndSave = function(event_id, field_name, field_value, callback, thisArg) {
		var row = this.getRow(event_id);
		return row.setFieldAndSave.apply(row, rest(arguments, 1));
	};
	proto.stringify = function() {
		return JSON.stringify(this.serialize());
	};
	/*
	proto.setVoterID = function(id) {
		this._voter_id = id;
		var listeners = this._listeners.voter_id;
		if(listeners) {
			$.each(listeners, function(index, info) {
				info.callback.call(info.thisArg || this, id);
			});
		}
		this.webSync();
	};
	*/
	proto.isLoggedIn = function() {
		var ref = this.getFirebaseRef();
		return !!ref;
	};
	proto.requestLogin = function(callback, thisArg) {
		this._firebaseRef.authWithOAuthPopup("google", $.proxy(function(error, authData) {
			if(callback) {
				callback.apply(thisArg||this, arguments);
			}
		}, this));
	};
	//proto.getVoterID = function() {
		//return this._voter_id;
	//};
	proto.saveLocally = function() {
		localStorage.setItem(USER_DATA_LOCAL_STORAGE, this.stringify());
		/*
		localStorage.setItem(USER_DATA_OTHER_STORAGE, JSON.stringify({
			voter_id: this.getVoterID()
		}));
		*/
	};
	proto.canWebSync = function() {
		return this._canWebSync;
	};
	proto.getURL = function() { return this._url; };
	proto.getConferenceID = function() { return this._conference_id; };

	proto.onSetVoterID = function(callback, thisArg, name) {
		var event_type = 'voter_id';
		var listeners = this._listeners[event_type];
		if(!listeners) {
			listeners = this._listeners[event_type] = [];
		}
		listeners.push({
			callback: callback,
			thisArg: thisArg,
			name: name
		});
	};
	proto.onChange = function(event_id, callback, thisArg, name) {
		var row = this.getRow(event_id, true);
		if(row) {
			row.onChange.apply(row, rest(arguments, 1));
		} else {
			var listeners = this._row_listeners[event_id];
			if(!listeners) {
				listeners = this._row_listeners[event_id] = [];
			}
			listeners.push({
				callback: callback,
				thisArg: thisArg,
				name: name
			});
		}
	};
	proto.offChange = function(event_id, name) {
		var row = this.getRow(event_id, true);
		if(row) {
			row.offChange.apply(row, rest(arguments, 1));
		} else {
			var listeners = this._row_listeners[event_id];
			for(var i = 0; i<listeners.length; i++) {
				var listener = listeners[i];
				if(listener.name === name) {
					listeners.splice(i, 1);
					i--;
				}
			}
		}
	};

	proto.getLocalStorageRows = function() {
		var data_str = localStorage.getItem(USER_DATA_LOCAL_STORAGE);
		if(data_str) {
			try {
				var data_obj = JSON.parse(data_str),
					rv = {};

				$.each(data_obj, $.proxy(function(event_id, row) {
					var obj = this.parseSerializedRow(row);
					rv[event_id] = obj;
				}, this));

				return rv;
			} catch(e) {
				console.error(e);
				return {};
			}
		} else {
			return {};
		}
	};

	proto.parseSerializedRow = function(row) {
		var options = {};
		$.each(row, function(property_name, value) {
			if(property_name === "created_at" || endsWith(property_name, "updated_at")) {
				options[property_name] = new Date(value);
			} else  {
				options[property_name] = value;
			}
		});
		return new UserDataRow(options.event_id, this, options);
	};

	proto.webDataToRow = function(row) { // accepts row from mysql db rv
		var options = {
			event_id: row.event_id
		};
		each(dataRowFields, function(field) {
			var obj = row[field];
			if(obj) {
				options[field] = obj.value;
				options[field+"_updated_at"] = new Date(obj.updated_at);
			} else {
				options[field] = getFieldDefault(field);
				options[field+"_updated_at"] = new Date(0);
			}
		}, this);
			/*
		each(row, function(value, property_name) {


			if(property_name === "created_at" || endsWith(property_name, "updated_at")) {
				if(value === "0000-00-00 00:00:00") {
					options[property_name] = new Date(0);
				} else {
					options[property_name] = new Date(value);
				}
			} else if(property_name === "note") {
				options[property_name] = value || "";
			} else if(property_name === "vote" || property_name === "reading_list" || property_name === "schedule") {
				options[property_name] = value;
			} else {
				options[property_name] = value;
			}
		});
			*/
		var event_id = options.event_id;
		return new UserDataRow(event_id, this, options);
	};
	/*

	proto.getWebDataRow = function(url, google_id_token, voter_id, conference_id, event_id, callback, thisArg) {
		$.ajax({
			url: url,
			method: "POST",
			data: {
				command: "get_fields",
				id_token: google_id_token,
				voter_id: voter_id,
				event_id: event_id,
				conference_id: conference_id
			},
			success: $.proxy(function(rv) {
				if(rv.result === "error") {
					callback.call(thisArg || this, rv.error);
				} else {
					var row = rv.value,
						data = this.sqlToRow(row);
					callback.call(thisArg || this, false, data);
				}
			}, this),
			error: function(jqXHR, textStatus, errorThrown) {
				callback.call(thisArg || this, errorThrown);
			}
		});
	};
	*/

	proto.getAllWebData = function(callback, thisArg) {
		if(this.canWebSync()) {
			var ref = this.getFirebaseRef();
			ref.once('value', function(snapshot) {
				var rv = {};
				snapshot.forEach($.proxy(function(childSnapshot) {
					var key = childSnapshot.key();
					rv[key] = this.webDataToRow(childSnapshot.val());
				}, this));

				callback.call(thisArg || this, false, rv);
			}, this);
			/*
			$.ajax({
				url: this.getURL(),
				method: "POST",
				data: {
					command: "get_all_fields",
					id_token: this.getGoogleIDToken(),
					voter_id: this.getVoterID(),
					conference_id: this.getConferenceID()
				},
				success: $.proxy(function(rv) {
					if(rv.result === "error") {
						callback.call(thisArg || this, rv.error);
					} else {
						var rows = rv.value,
							data = {};

						$.each(rows, $.proxy(function(index, row) {
							var event_id = row.event_id;
							data[event_id] = this.sqlToRow(row);
						}, this));
						callback.call(thisArg || this, false, data);
					}
				}, this),
				error: function(jqXHR, textStatus, errorThrown) {
					callback.call(thisArg || this, errorThrown);
				}
			});
			*/
		}
	};
	proto.checkVoterID = function(id, callback, thisArg) {
		var len = id.length;
		if(len === 6) {
			if(id.match(/^[a-zA-Z0-9]{6}$/)) {
				$.ajax({
					url: this.getURL(),
					method: "POST",
					data: {
						command: "check_voter_id",
						voter_id: id,
						conference_id: this.getConferenceID()
					},
					success: $.proxy(function(data) {
						if(data.result === "error") {
							callback.call(thisArg || this, data.error);
						} else {
							if(data.valid && data.valid != 'false') {
								callback.call(thisArg || this, false, id);
							} else {
								callback.call(thisArg || this, 'We could not find this voter ID in our records');
							}
						}
					}, this),
					error: function(jqXHR, textStatus, errorThrown) {
						callback.call(thisArg || this, errorThrown);
					}
				});
			} else {
				callback('Voter ID should be alphanumeric');
			}
		} else {
			callback('Voter ID should be six characters');
		}
	};
}(UserData));