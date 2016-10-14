/*jshint scripturl:true*/
$.widget("confapp.presentation", {
	options: {
		database: false,
		presentation: false,
		userData: false,
		headerTag: "h5",
		expanded: false,
		showTitle: true,
		requireDescriptionExpansion: false,
		imageDirectory: false,
		annotationImageDirectory: false,
		mapImageDirectory: false,
		debug: false,
		getAttachmentText: function() {
			return caWebOptions.getAttachmentText.apply(this, arguments);
		}
	},

	_create: function() {
		var presentation = this.option('presentation');

		if(this.option("showTitle")) {
			this.headerElement = $("<" + this.option("headerTag") + "/>")	.appendTo(this.element)
																			.addClass('presentationTitle')
																			.text(presentation.getName());
		}

		this.annotationsElement = $('<div />').appendTo(this.element);

		this.authorsElement = $("<div />")	.appendTo(this.element)
											.authorList({
												event: this.option("presentation")
											});
		this.descriptionElement = $("<div />").appendTo(this.element);

		this.upArrow = $('<a />')	.html('&uarr;')
									.attr({
										href: 'javascript:void(0)',
										title: 'Parent Session'
									})
									.addClass('scrollToTimeSlot')
									.appendTo(this.headerElement)
									.on('click', $.proxy(function() {
										var sessionParent = this.element.parents('.time_slot'),
											expandedSession = $('.session.expanded', sessionParent);
										scrollTo(expandedSession);
									}, this));

		this._updateAnnotations();
		this._addClasses();
		this._updateLocation();
		this._doExpand();
		this._addUserDataButtons();
		this._addEventListeners();
		this._addSearchListeners();
		this._updateSearchResults(caSearchQuery());
	},

	_destroy: function() {
		this.authorsElement.authorList("destroy");
		//this._clearAuthors();
		this._destroyLocation();
		this._removeUserDataButtons();
		this._removeSearchListeners();
	},

	_addSearchListeners: function() {
		var presentation = this.option('presentation'),
			presentationID = presentation.getID();
		$(window)	.on('ca_search.presentation_'+presentationID, $.proxy(this._updateSearchResults, this))
					.on('ca_clear_search.presentation_'+presentationID, $.proxy(this._updateSearchResults, this));
	},
	_removeSearchListeners: function() {
		var presentation = this.option('presentation'),
			presentationID = presentation.getID();
		$(window).off('ca_search.presentation_'+presentationID).off('ca_search.presentation_'+presentationID);
	},

	_updateSearchResults: function(event) {
		if(!event) {return;}

		var presentation = this.option('presentation'),
			presentationID = presentation.getID();

		if(event.type === 'ca_clear_search') {
			this.element.removeClass('notSearchResult searchResult');
		} else if(event.type === 'ca_search') {
			var eventIDs = event.eventIDs;
			if(eventIDs[presentationID]) {
				this.element.addClass('searchResult')
							.removeClass('notSearchResult');
			} else {
				this.element.addClass('notSearchResult')
							.removeClass('searchResult');
			}
		}
	},

	_addClasses: function() {
		var presentation = this.option("presentation");
		this.element.addClass("presentation")
					.attr({
						id: presentation.getUniqueID()
					});
		this.descriptionElement.addClass("row");
	},

	_updateAnnotations: function() {
		var presentation = this.option("presentation"),
			annotations = presentation.getAnnotations();

		if(this.option("showTitle")) {
			var location = presentation.getLocation(),
				type = presentation.getType();

			var typeRow = $("<span />")	.appendTo(this.annotationsElement)
										.text(type)
										.addClass('presentation_type');

			if(location && type) {
				this.annotationsElement.append(' / ');
			}
			this.locationElement = $("<span />").appendTo(this.annotationsElement)
												.location({
													location: location,
													mapImageDirectory: this.option('mapImageDirectory'),
													annotationImageDirectory: this.option('annotationImageDirectory'),
													imageDirectory: this.option('imageDirectory'),
													debug: this.option('debug')
												});
		}


		$.each(annotations, $.proxy(function(i, annotation) {
			var annotationElement = $('<span />').appendTo(this.annotationsElement)
													.addClass('annotation');

			var icon = annotation.getIcon();
			$("<img />").attr("src", annotation.getIconURL() || (this.option("annotationImageDirectory")+icon))
						.css({
							height: "18px",
							position: "relative",
							top: "3px"
						})
						.appendTo(annotationElement);
			$("<span />")	.text(annotation.getDescription())
							.appendTo(annotationElement);
		}, this));
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

	_addUserDataButtons: function() {
	},
	_removeUserDataButtons: function() {
		var userData = this.option("userData"),
			presentation = this.option("presentation"),
			presentation_id = presentation.getUniqueID();

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

		userData.offChange(presentation_id, "detectChange");
	},

	_addEventListeners: function() {
	/*
		this.element.on("click.expand", $.proxy(function() {
			if(!this.option("expanded")) {
				this.expand();
			}
		}, this));
		*/
	},

	_setWindowHash: function() {
		var presentation = this.option("presentation");
		window.location.hash = presentation.getUniqueID();
	},

	_updateLocation: function() {

		if(this.locationElement) {
		}
	},

	_destroyLocation: function() {
		if(this.locationElement) {
			this.locationElement.location("destroy");
		}
	},

	expand: function() {
		this.option("expanded", true);
	},
	collapse: function() {
		this.option("expanded", false);
	},

	_doExpand: function() {
		var userData = this.option("userData"),
			database = this.option('database'),
			iDir = this.option('imageDirectory'),
			conferenceInfo = database.getConferenceInfo(),
			presentation = this.option("presentation"),
			presentation_id = presentation.getUniqueID(),
			hasUserData = conferenceInfo.schedule || conferenceInfo.reading_list ||
							conferenceInfo.vote || conferenceInfo.note,
			userDataElement = hasUserData ? $("<div />").appendTo(this.descriptionElement)
														.addClass('user_data two columns') :
											false;

		this.element.addClass("expanded").removeClass("collapsed");

		if(conferenceInfo.schedule) {
			this.scheduleToggle = $("<div />")	.appendTo(userDataElement)
												.addClass("schedule")
												.toggleButton({
													activated: userData.getField(presentation_id, "schedule"),
													activatedLabel: " Schedule",
													deactivatedLabel: " Schedule",
													activatedImage: iDir + "schedule_selected.png",
													deactivatedImage: iDir + "schedule.png",
													debug: this.option('debug')
												}).on("toggled", $.proxy(function(event) {
													var activated = event.activated;
													userData.setFieldAndSave(presentation_id, "schedule", activated);
												}, this))
												.css({
												});
		}

		if(conferenceInfo.reading_list) {
			this.readingListToggle = $("<div />")	.appendTo(userDataElement)
													.addClass("reading_list")
													.toggleButton({
														activated: userData.getField(presentation_id, "reading_list"),
														activatedLabel: " Reading List",
														deactivatedLabel: " Reading List",
														activatedImage: iDir + "reading_list_selected.png",
														deactivatedImage: iDir + "reading_list.png",
														debug: this.option('debug')
													}).on("toggled", $.proxy(function(event) {
														var activated = event.activated;
														userData.setFieldAndSave(presentation_id, "reading_list", activated);
													}, this))
													.css({
													});
		}

		if(conferenceInfo.vote) {
			this.voteToggle = $("<div />")	.appendTo(userDataElement)
											.addClass("vote")
											.toggleButton({
												activated: userData.getField(presentation_id, "vote"),
												activatedLabel: " Best Talk",
												deactivatedLabel: " Best Talk",
												activatedImage: iDir + "vote_selected.png",
												deactivatedImage: iDir + "vote.png",
												checkBeforeActivating: $.proxy(function(val, onReady) {
													if(val) {
														if(presentation.getStartTimestamp() <= (new Date()).getTime() || this.option('debug')) {
															if(userData.isLoggedIn()) {
																onReady(val);
															} else {
																userData.requestLogin(function(err, isValid) {
																	if(isValid) {
																		onReady(val);
																	} else {
																		onReady(false);
																	}
																});
															}
														} else {
															alert('You cannot vote until the presentation has started');
															onReady(false);
														}
													} else {
														onReady(val);
													}
												}, this),
												debug: this.option('debug')
											}).on("toggled", $.proxy(function(event) {
												var activated = event.activated;
												userData.setFieldAndSave(presentation_id, "vote", activated);
											}, this))
											.css({
											});
		}

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

		var attachments = presentation.getAttachments(),
			videoAttachments = [],
			otherAttachments = [];

		$.each(attachments, function(i, attachment) {
			if(attachment.getType().toLowerCase() === "video") {
				if(getYoutubeVideoID(attachment.getURL())) {
					videoAttachments.push(attachment);
				}
			} else if(attachment.getURL()) { // if it has a URL
				otherAttachments.push(attachment);
			}
		});

		var numAbstractColumns,
			attachmentsCol;

		if(videoAttachments.length === 0 && otherAttachments.length === 0) {
			numAbstractColumns = hasUserData ? 10 : 12;
		} else {
			numAbstractColumns = hasUserData ? 8 : 6;
			attachmentsCol = $("<div />")	.prependTo(this.descriptionElement)
											.addClass(spellOutNum(hasUserData ? 2 : 4) + " columns");
		}

		if(videoAttachments.length > 0) {
			var videoAttachment = videoAttachments[0];

			var videoContainer = $("<div />")	.appendTo(attachmentsCol)
												.css({
													position: "relative",
													height: "0px",
													"padding-bottom": "60%",
													//overflow: "hidden"
												});
			var youtubeElement = $("<iframe />").attr({
													src: getYoutubeEmbedURL(getYoutubeVideoID(videoAttachment.getURL())),
													frameborder: 0,
													allowfullscreen: true
												})
												.css({
													position: "absolute",
													top: 0,
													left: 0,
													width: "100%",
													height: "100%"
												})
												.appendTo(videoContainer);
		}

		if(otherAttachments.length > 0) {
			each(otherAttachments, function(attachment, i) {
				var attachmentURL = attachment.getURL(),
					text = this.option('getAttachmentText')(attachment);

				var attachmentLink = $('<a />').text(text)
												.attr({
													href: attachmentURL,
													target: '_blank'
												})
												.appendTo(attachmentsCol);
			}, this);
		}

		var abstractContainer = $("<div />").prependTo(this.descriptionElement)
											.addClass(spellOutNum(numAbstractColumns) + ' columns');

		var description = presentation.getDescription();
		if(description) {
			var abstract = $("<p />")	.text(description)
										.appendTo(abstractContainer)
										.addClass("abstract");

			var abstractWord = $("<strong />")	.text("Abstract: ")
												.prependTo(abstract);
		} else {
			abstractContainer.addClass('no_abstract')
							.text('(no description)');
		}

		userData.onChange(presentation_id, function(name, value) {
			if(name === "reading_list") {
				this.readingListToggle.toggleButton("option", "activated", value);
			} else if(name === "schedule") {
				this.scheduleToggle.toggleButton("option", "activated", value);
			} else if(name === "vote") {
				this.voteToggle.toggleButton("option", "activated", value);
			} else if(name === "note") {
				this.notes.note("option", "value", value);
			}
		}, this, "detectChange");
	},

	_doCollapse: function() {
		var presentation = this.option("presentation");

		this.element.removeClass("expanded").addClass("collapsed");
		this.descriptionElement.hide();
	}
});
function getYoutubeVideoID(url) {
	//http://stackoverflow.com/questions/3452546/javascript-regex-how-to-get-youtube-video-id-from-url
    var regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if(match&&match[1].length===11) {
        return match[1];
    } else {
		return false;
    }
}

function getYoutubeEmbedURL(video_id) {
	return 'https://www.youtube.com/embed/' + video_id;
}
