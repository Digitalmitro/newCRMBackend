const moment = require("moment-timezone");

const TIMEZONE = "Asia/Kolkata";
// The attendance day runs from DAY_START_HOUR (IST) to the same hour the next
// day. Set to 9 because nobody clocks in before 9am. Anyone who clocks in
// before this hour is filed under the PREVIOUS day, so lower this value if
// early arrivals ever start. Open overnight shifts are handled separately by
// the carry-over lookup in getTodaysAttendanceforadmin.
const DAY_START_HOUR = 9;

/**
 * Returns the "attendance date" for a given moment (or now if not provided).
 * If current time is before 9am, it belongs to the previous calendar day.
 * e.g. 3am on June 3rd → attendance date is June 2nd (night shift)
 *      10am on June 3rd → attendance date is June 3rd (day shift)
 *
 * Returns a YYYY-MM-DD string in IST.
 */
const getAttendanceDate = (m) => {
  const now = m ? moment(m).tz(TIMEZONE) : moment().tz(TIMEZONE);
  if (now.hour() < DAY_START_HOUR) {
    return now.subtract(1, "day").format("YYYY-MM-DD");
  }
  return now.format("YYYY-MM-DD");
};

/**
 * Returns the start and end of an "attendance day" for a given date string.
 * Attendance day for "2026-06-03" = June 3rd 9:00am → June 4th 8:59:59am (IST)
 */
const getAttendanceDayBounds = (dateStr) => {
  const start = moment.tz(dateStr, "YYYY-MM-DD", TIMEZONE).hour(DAY_START_HOUR).startOf("hour");
  const end = start.clone().add(1, "day").subtract(1, "second");
  return { start: start.toDate(), end: end.toDate() };
};

/**
 * Returns today's attendance date window.
 */
const getTodayBounds = () => {
  const today = getAttendanceDate();
  return getAttendanceDayBounds(today);
};

module.exports = { getAttendanceDate, getAttendanceDayBounds, getTodayBounds, TIMEZONE, DAY_START_HOUR };
