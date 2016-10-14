$.widget("confapp.timeSlot", {
	options: {
		database: false,
		userData: false,
		slot: false,
		numSessions: 0,
		sessions: [],
		startTimestamp: 0,
		endTimestamp: 0,
		totalSimultaneousSessions: 0,
		headerTag: "h5",
		numColumns: 4,
		gridColumns: 12,
		annotationImageDirectory: false,
		mapImageDirectory: false,
		imageDirectory: false,
		debug: false,
		getHeaderText: function(startTimestamp, endTimestamp, utc_offset, my_offset) {
			if(startTimestamp >= 0) {
				var startTime = new Date(startTimestamp + utc_offset + my_offset),
					endTime = new Date(endTimestamp + utc_offset + my_offset),
					ampmRegex = /(AM|PM)$/,
					startTimeString = moment(startTime).format('LT'),
					endTimeString = moment(endTime).format('LT'),
					startAmPmMatch = startTimeString.match(ampmRegex),
					endAmPmMatch = endTimeString.match(ampmRegex);

				if(startAmPmMatch) {
					startAmPmMatch = startAmPmMatch[0];
				}
				if(endAmPmMatch) {
					endAmPmMatch = endAmPmMatch[0];
				}

				if(startAmPmMatch && (startAmPmMatch === endAmPmMatch)) {
					startTimeString = startTimeString.replace(ampmRegex, '').trim();
				}
				var parentElem = $('<span />');

				var weekdayElem = $('<span />')	.text(getShortWeekdayName(startTime))
												.addClass('weekday');

				var timeElem = $('<span />')	.html(startTimeString + '&nbsp;&ndash;&nbsp;' + endTimeString)
												.addClass('start_end_time');

				parentElem.append(weekdayElem, '&nbsp;', timeElem);

				return parentElem.html();
			} else {
				return '';
			}
		}
	},

	_create: function() {
		if(this.option("numSessions") > 1) {
			this.headerElement = $("<" + this.option("headerTag") + "/>")	.appendTo(this.element)
																			.html(this._getHeaderText());
		}

		this.sessionsElement = $("<div />").appendTo(this.element);
		this._updateSessions();
		this._addClasses();
	},

	_destroy: function() {
		this._clearSessions();
	},

	_addClasses: function() {
		this.element.addClass("time_slot");
		this.sessionsElement.addClass("sessions");

		if(this.headerElement) {
			this.headerElement.addClass("time_slot_header");
		}

		this.element.add(this.sessionsElement, this.headerElement).addClass(
			this._isSingular() ? 'singular' : 'plural'
		);
	},

	_getHeaderText: function() {
		var startTimestamp = this.option("startTimestamp"),
			endTimestamp = this.option("endTimestamp"),
			startTime = new Date(startTimestamp),
			getHeaderText = this.option("getHeaderText"),
			database = this.option("database"),
			utc_offset = database.getUTCOffset(),
			my_offset = new Date(startTimestamp).getTimezoneOffset()*60*1000,
			dayOfWeek = this.option('dayOfWeek') || '';

		var text = dayOfWeek + ' ' + getHeaderText(startTimestamp, endTimestamp, utc_offset, my_offset);

		return text;
	},

	_isSingular: function() {
		return this.option('numSessions') === 1;
	},

	_updateSessions: function() {
		var sessions = this.option("sessions"),
			row = [],
			rows = [row],
			numSessions = this.option("numSessions"),
			isSingular = this._isSingular(),
			gridColumns = this.option("gridColumns"),
			columnClass,
			numColumns;

		if(numSessions <= 3) {
			numColumns = numSessions;
		} else {
			numColumns = this.option('numColumns');
		}

		columnClass = spellOutNum(Math.round(gridColumns/numColumns));

		$.each(sessions, function(index, session) {
			if(row.length >= numColumns) {
				row = [];
				rows.push(row);
			}
			row.push(session);
		});

		this._clearSessions();
		$.each(rows, $.proxy(function(i, row) {
			var rowElement = $("<div />")	.addClass("row")
											.appendTo(this.sessionsElement);

			$.each(row, $.proxy(function(j, session) {
				$("<div />").appendTo(rowElement)
							.session({
								session: session,
								database: this.option("database"),
								userData: this.option("userData"),
								columnClass: columnClass,
								timeString: isSingular ? this._getHeaderText() : false,
								singular: isSingular,
								annotationImageDirectory: this.option('annotationImageDirectory'),
								mapImageDirectory: this.option('mapImageDirectory'),
								imageDirectory: this.option('imageDirectory'),
								debug: this.option('debug')
							});
			}, this));
		}, this));
	},

	_clearSessions: function() {
		$.each(this.sessionsElement.children(), function(i, row) {
			if(!$(row).is(".expanded_session ")) {
				$.each(row.children(), function(j, child) {
					child.session("destroy").remove();
				});
				$(row).remove();
			}
		});
	}
});
