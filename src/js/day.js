var MINS_IN_MS = 60*1000;

$.widget("confapp.caDay", {
	options: {
		database: false,
		dayTimestamp: false,
		userData: false,
		headerTag: "h3",
		annotationImageDirectory: false,
		mapImageDirectory: false,
		imageDirectory: false,
		debug: false
	},

	_create: function() {
		this.headerElement = $("<" + this.option("headerTag") + "/>").appendTo(this.element);
		this.dayOfWeekSpan = $("<span />").appendTo(this.headerElement);
		this.dateSpan = $("<span />").appendTo(this.headerElement);

		this.timeSlotsElement = $("<div />").appendTo(this.element);

		this._updateHeaderText();

		this._addClasses();

		this._updateTimeSlots();
	},

	_destroy: function() {
		this.headerElement.remove();
		this._clearTimeSlots();
	},

	_addClasses: function() {
		this.element.addClass("conference_day");
		this.headerElement.addClass("day_header");
		this.dayOfWeekSpan.addClass("day_of_week");
		this.dateSpan.addClass("date");
		this.timeSlotsElement.addClass("sessions");
	},

	_getDay: function() {
		var database = this.option("database"),
			dayTimestamp = this.option("dayTimestamp");

		if(dayTimestamp) {
			var utc_offset = database.getUTCOffset(),
				my_offset = new Date(dayTimestamp).getTimezoneOffset() * MINS_IN_MS,
				day = new Date(dayTimestamp + utc_offset + my_offset + 60*MINS_IN_MS); // add in an extra hour to be sure to compensate for any DST discrepancies
			return day;
		} else {
			return false;
		}
	},

	_updateHeaderText: function() {
		var day = this._getDay();

		if(day) {
			var dayOfWeekText = getLongWeekdayName(day),
				dateText = moment(day).format('ll');

			this.dayOfWeekSpan.text(dayOfWeekText);
			this.dateSpan.text(dateText);
		}
	},

	_updateTimeSlots: function() {
		var timeSlots = this._getTimeSlots(),
			totalSimultaneousSessions = 0,
			database = this.option("database");

		$.each(timeSlots, function(index, timeSlot) {
			var numSessions = timeSlot.numSessions;
			if(numSessions > totalSimultaneousSessions) { totalSimultaneousSessions = numSessions; }
		});

		this._clearTimeSlots();

		$.each(timeSlots, $.proxy(function(index, timeSlot) {
			$("<div />").appendTo(this.timeSlotsElement)
						.timeSlot({
							database: database,
							userData: this.option("userData"),
							numSessions: timeSlot.numSessions,
							startTimestamp: timeSlot.startTimestamp,
							endTimestamp: timeSlot.endTimestamp,
							sessions: timeSlot.sessions,
							totalSimultaneousSessions: totalSimultaneousSessions,
							annotationImageDirectory: this.option('annotationImageDirectory'),
							mapImageDirectory: this.option('mapImageDirectory'),
							imageDirectory: this.option('imageDirectory'),
							debug: this.option('debug')
						});
		}, this));

		if(!this.option('dayTimestamp')) {
			$('.session', this.element).session('option', 'collapseOtherSessions', false).session('expand');
		}
	},

	_clearTimeSlots: function() {
		$.each(this.timeSlotsElement.children(), function(index, child) {
			child.timeSlot("destroy").remove();
		});
	},

	_getTimeSlots: function() {
		var dayTimestamp = this.option("dayTimestamp"),
			database = this.option("database"),
			slot_map = {},
			slots = [];

		var events;

		if(dayTimestamp) {
			events = database.getDaySessions(dayTimestamp);

			$.each(events, function(index, e) {
				var time_id = "t" + e.getStartTimestamp() + "_" + e.getEndTimestamp();
				if(slot_map.hasOwnProperty(time_id)) {
					slot_map[time_id].push(e);
				} else {
					slot_map[time_id] = [e];
				}
			});

			$.each(slot_map, function(key, events) {
				var firstEvent = events[0],
					start_timestamp = firstEvent.getStartTimestamp(),
					end_timestamp = firstEvent.getEndTimestamp(),
					utc_offset = firstEvent.getUTCOffset();

				events.sort(function(a, b) {
					var aLocation = a.getLocation(),
						bLocation = b.getLocation(),
						aLocationSeq = aLocation ? aLocation.getSequence() : -1,
						bLocationSeq = bLocation ? bLocation.getSequence() : -1;
					return aLocationSeq - bLocationSeq;
				});
				slots.push({
					numSessions: events.length,
					sessions: events,
					startTimestamp: start_timestamp,
					endTimestamp: end_timestamp,
					utcOffset: utc_offset
				});
			});

			slots.sort(function(a, b) {
				if(a.startTimestamp === b.startTimestamp) {
					return a.endTimestamp - b.endTimestamp;
				} else {
					return a.startTimestamp - b.startTimestamp;
				}
			});
		} else {
			events = database.getAllSessions();
			$.each(events, function(index, e) {
				slots.push({
					numSessions: 1,
					sessions: [e],
					startTimestamp: e.getStartTimestamp(),
					endTimestamp: e.getEndTimestamp(),
					utc_offset: e.getUTCOffset()
				});
			});
		}

		return slots;
	}
});
