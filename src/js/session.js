$.widget("confapp.session", {
	options: {
		database: false,
		session: false,
		userData: false,
		headerTag: "h5",
		expanded: false,
		columnClass: "",
		timeString: false,
		showBubbles: true,
		singular: false,
		collapseOtherSessions: true,
		annotationImageDirectory: false,
		mapImageDirectory: false,
		imageDirectory: false,
		debug: false
	},

	_create: function() {
		var session = this.option("session"),
			presentations = session.getSubEvents(),
			numPresentations = presentations.length;

		this.headerElement = $('<' + this.option("headerTag") + '/>')	.appendTo(this.element);
		this.timeElement = $('<span />').addClass('time')
										.appendTo(this.headerElement);
		this.nameElement = $('<span />').addClass('name')
										.appendTo(this.headerElement);

		this.infoElement = $("<div />").appendTo(this.element)
										.addClass('sessionInfo');
		this.typeElement = $("<span />").appendTo(this.infoElement);
		this.locationElement = $("<span />").appendTo(this.infoElement);

		this._addUserDataButtons();

		if(numPresentations > 1 && this.option("showBubbles") && !this._hasParallelPresentations()) {
			this.bubbles = $("<table />")	.appendTo(this.element)
											.slotBubbles({
												session: this.option("session"),
												userData: this.option("userData"),
												annotationImageDirectory: this.option('annotationImageDirectory'),
												mapImageDirectory: this.option('mapImageDirectory'),
												imageDirectory: this.option('imageDirectory'),
												debug: this.option('debug')
											});
		}

		if(this.option("expanded") || (session.isSingular() && this.option("singular"))) {
			//this._doExpand();
		} else {
			this._doCollapse();
		}

		if(numPresentations >= 1) {
			this._addEventListeners();
		}

		this._addClasses();
		this._updateHeader();
		this._addSearchListeners();
	},

	_destroy: function() {
		this._clearEvents();
		this._desteroyLocation();
		this._removeEventListeners();
		this.bubbles.slotBubbles("destroy");
		this._removeSearchListeners();
		this._removeUserDataButtons();
	},

	_checkIfUserDataActivated: function(dataType) {
		var session = this.option("session"),
			userData = this.option("userData"),
			presentations = session.getSubEvents(),
			numPresentations = presentations.length,
			i = 0, presentation;
		if(numPresentations === 0) {
			return userData.getField(session.getUniqueID(), dataType);
		}

		while(i < numPresentations) {
			presentation = presentations[i];

			if(!userData.getField(presentation.getUniqueID(), dataType)) {
				return false;
			}

			i++;
		}

		return true;
	},

	_setUserData: function(dataType, activated) {
		var session = this.option("session"),
			userData = this.option("userData"),
			presentations = session.getSubEvents(),
			numPresentations = presentations.length,
			i = 0, presentation,
			numSet = 0,
			onActivated = function() {
				numSet++;
				if(numSet === numPresentations) {
					userData.saveLocally();
				}
			};

		if(numPresentations === 0) {
			userData.setFieldAndSave(session.getUniqueID(), dataType, activated);
		}

		while(i < numPresentations) {
			presentation = presentations[i];

			userData.setField(presentation.getUniqueID(), dataType, activated, onActivated);
			i++;
		}
	},

	_addUserDataButtons: function() {
		var session = this.option("session"),
			userData = this.option("userData"),
			database = this.option('database'),
			iDir = this.option('imageDirectory'),
			conferenceInfo = database.getConferenceInfo(),
			hasUserData = conferenceInfo.schedule || conferenceInfo.reading_list ||
							 conferenceInfo.note,
			userDataElement = hasUserData ? $("<div />").appendTo(this.element)
														.addClass("user_data")
														.css({
															'margin-bottom': '3px'
														}) :
											false;

		//this.element.addClass("expanded").removeClass("collapsed");

		if(conferenceInfo.schedule) {
			this.scheduleToggle = $("<span />")	.appendTo(userDataElement)
												.addClass("schedule")
												.toggleButton({
													activated: this._checkIfUserDataActivated('schedule'),
													activatedLabel: " Schedule",
													deactivatedLabel: " Schedule",
													activatedImage: iDir + "schedule_selected.png",
													deactivatedImage: iDir + "schedule.png",
													debug: this.option('debug')
												}).on("toggled", $.proxy(function(event) {
													this._setUserData('schedule', event.activated);
												}, this))
												.css({
												});
		}

		if(conferenceInfo.reading_list) {
			this.readingListToggle = $("<span />")	.appendTo(userDataElement)
													.addClass("reading_list")
													.toggleButton({
														activated: this._checkIfUserDataActivated('reading_list'),
														activatedLabel: " Reading List",
														deactivatedLabel: " Reading List",
														activatedImage: iDir + "reading_list_selected.png",
														deactivatedImage: iDir + "reading_list.png",
														debug: this.option('debug')
													}).on("toggled", $.proxy(function(event) {
														this._setUserData('reading_list', event.activated);
													}, this))
													.css({
														'margin-left': conferenceInfo.schedule ? '10px': '0px'
													});
		}


/*
		if(conferenceInfo.note) {
			this.notes = $("<div />")	.appendTo(userDataElement)
										.addClass("note")
										.note({
											value: userData.getField(presentation_id, "note"),
											placeholder: "Add a private note",
										}).on("valueChange", $.proxy(function(event) {
											var value = event.value;
											userData.setFieldAndSave(presentation_id, "note", value+"");
										}, this));
		}
		*/

		$.each(session.getSubEvents(), $.proxy(function(i, presentation) {
			userData.onChange(presentation.getUniqueID(), this._updateToggleButton, this, "sessionDetectChange");
		}, this));
		userData.onChange(session.getUniqueID(), this._updateToggleButton, this, "sessionDetectChange");
	},

	_updateToggleButton: function() {
		if(this.scheduleToggle) {
			this.scheduleToggle.toggleButton('option', 'activated',
					this._checkIfUserDataActivated('schedule'));
		}

		if(this.readingListToggle) {
			this.readingListToggle.toggleButton('option', 'activated',
					this._checkIfUserDataActivated('reading_list'));
		}
	},

	_removeUserDataButtons: function() {
		var session = this.option('session'),
			userData = this.option("userData");

		if(this.readingListToggle) {
			this.readingListToggle.toggleButton("destroy");
		}
		if(this.scheduleToggle) {
			this.scheduleToggle.toggleButton("destroy");
		}

		if(this.voteToggle) {
			this.voteToggle.toggleButton("destroy");
		}
		if(this.notes) {
			this.notes.note("destroy");
		}

		$.each(session.getSubEvents(), function(presentation) {
			var presentation_id = presentation.getUniqueID();
			userData.offChange(presentation_id, "sessionDetectChange");
		});
	},

	_addSearchListeners: function() {
		var session = this.option('session'),
			sessionID = session.getID();

		$(window).on('ca_search.session_'+sessionID, $.proxy(function(event) {
			var eventIDs = event.eventIDs;
			if(eventIDs[sessionID]) {
				this.element.addClass('searchResult')
							.removeClass('notSearchResult');
			} else {
				this.element.addClass('notSearchResult')
							.removeClass('searchResult');
			}
		}, this)).on('ca_clear_search.session_'+sessionID, $.proxy(function(event){
			this.element.removeClass('notSearchResult searchResult');
		}, this));
	},
	_removeSearchListeners: function() {
		var session = this.option('session'),
			sessionID = session.getID();
		$(window).off('ca_search.session_'+sessionID).off('ca_search.session_'+sessionID);
	},

	_updateHeader: function() {
		var session = this.option('session'),
			location = session.getLocation(),
			type = session.getType(),
			timeString = this.option('timeString'),
			numPresentations = session.getNumSubEvents();

		if(timeString && timeString.trim()) {
			this.timeElement.html(timeString + ':&nbsp;');
			this.element.addClass('hasTime');
		} else {
			this.infoElement.removeClass('hasTime');
			this.element.removeClass('hasTime');
		}

		this.nameElement.text(session.isSingular() ? (session.getName() || session.getSubEvents()[0].getName()) : session.getName());
		this.typeElement.text((type && location) ? (type + ' / ') : type);
		this.locationElement.location({
			location: location,
			annotationImageDirectory: this.option('annotationImageDirectory'),
			mapImageDirectory: this.option('mapImageDirectory'),
			imageDirectory: this.option('imageDirectory')
		});
	},
	_removeEventListeners: function() {
		this.element.off('slot_bubble_selected.doscroll')
					.off('click.doexpand');
	},

	_destroyLocation: function() {
		this.locationElement.location("destroy");
	},

	_addEventListeners: function() {
		this.element.on("click.doexpand", $.proxy(function(event) {
			if(this.isExpanded()) {
				this.collapse();
				event.stopPropagation();
				event.preventDefault();
			} else {
				this.expand();
				event.stopPropagation();
				event.preventDefault();
			}
		}, this));

		this.element.on('slot_bubble_selected.doscroll', $.proxy(function(event) {
			var uniqueID = event.presentationUniqueID;

			if(!this.isExpanded()) {
				this.expand();
			}

			setTimeout(function() {
				scrollTo('#'+uniqueID);
			}, 10);
		}, this));
		/*

		this.headerElement.on("click", $.proxy(function(event) {
			if(this.option("expanded")) {
				this.collapse();
				event.stopPropagation();
				event.preventDefault();
			} else {
				this.expand();
				event.stopPropagation();
				event.preventDefault();
			}
		}, this));
		*/
	},

	_addClasses: function() {
		var session = this.option('session');
		this.element.addClass("session columns")
					.addClass(this.option("columnClass"))
					.attr({
						'id': session.getUniqueID()
					});
		this.headerElement.addClass("session_header");

		if(this.option("singular")) {
			this.element.addClass('singular');
			this.element.addClass("time_slot_header");
			this.headerElement.addClass("singular");
		}
	},

	_updatePresentations: function() {
		var session = this.option("session"),
			numPresentations = session.getNumSubEvents();

		this._clearPresentations();

		this.expansionRow = $("<div />").insertAfter(this.element.parent())
										.addClass("expanded_session row");

		var chair = session.getPeople()[0];
		if(chair) {
			var chairElement = $("<div />")	.appendTo(this.expansionRow)
											.person({
												person: chair,
												inline: true,
												prefix: 'Chair: ',
												debug: this.option('debug')
											})
											.addClass('chair');
		}
		this.subEvents = $("<div />").appendTo(this.expansionRow);

		$.each(session.getSubEvents(), $.proxy(function(index, presentation) {
			$("<div />").appendTo(this.subEvents)
						.presentation({
							database: this.option("database"),
							userData: this.option("userData"),
							presentation: presentation,
							expanded: numPresentations === 1,
							//showTitle: numPresentations > 1
							showTitle: true,
							annotationImageDirectory: this.option('annotationImageDirectory'),
							mapImageDirectory: this.option('mapImageDirectory'),
							imageDirectory: this.option('imageDirectory'),
							debug: this.option('debug')
						});
		}, this));
	},

	_clearPresentations: function() {
		if(this.expansionRow) {
			$.each(this.subEvents.children(), function(index, child) {
				$(child).presentation("destroy").remove();
			});
			this.expansionRow.remove();
			delete this.expansionRow;
		}
	},
	_setOption: function( key, value ) {
		this._super(key, value);
		if (key === "expanded") {
			if(value) {
				this._doExpand();
			} else {
				this._doCollapse();
			}
		}
	},
	expand: function() {
		if(this.option('collapseOtherSessions')) {
			$(".expanded.session").session("collapse");
		}
		this.option("expanded", true);
	},
	collapse: function() {
		this.option("expanded", false);
	},

	isExpanded: function() {
		return this.option('expanded');
	},

	_doExpand: function() {
		this.element.addClass("expanded");
		this._updatePresentations();
	},

	_doCollapse: function() {
		this.element.removeClass("expanded");
		this._clearPresentations();
	},

	_hasParallelPresentations: function() {
		var session = this.option("session"),
			presentations = session.getSubEvents(),
			numPresentations = presentations.length;

		if(numPresentations > 1) {
			var i = 0, presentation, lastEnd = 0, startTimestamp;
			for(; i<numPresentations; i++) {
				presentation = presentations[i];
				startTimestamp = presentation.getStartTimestamp();
				if(startTimestamp < lastEnd) {
					return true;
				} else {
					lastEnd = startTimestamp;
				}
			}
		} else {
			return false;
		}
	},
});
