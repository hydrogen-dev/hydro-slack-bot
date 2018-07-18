require('dotenv').config()
const moment = require('moment-timezone')
const requestPromise = require('request-promise')

var timeouts = []
var intervals = []

const millisInHour = 1000 * 60 * 60
const millisInDay = millisInHour * 24

const getMillisUntilTime = (hour, minute) => {
  if (minute === undefined) minute = 0
  var now = moment()

  var nowInNewYork = now.clone().tz('America/New_York').utc()
  var timeInNewYork = now.clone().tz('America/New_York').hour(hour).minute(minute).seconds(0).milliseconds(0).utc()

  var diff = timeInNewYork.diff(nowInNewYork)
  if (diff < 0) diff += millisInDay // it's after the time, try again tomorrow

  return diff
}

const getMillisNearest = (minute, evenHour) => {
  if (evenHour === undefined) evenHour = false

  var now = moment()
  var nowInNewYork = now.clone().tz('America/New_York').utc()

  var nearestMinute = Math.ceil(nowInNewYork.minute() / minute) * minute
  if (nearestMinute >= 60) nearestMinute = minute // if we overflowed, reset back to the smaller interval

  var nearestInNewYork = now.clone().tz('America/New_York').minute(nearestMinute).seconds(0).milliseconds(0).utc()

  var diff = nearestInNewYork.diff(nowInNewYork)
  if (diff < 0) diff += millisInHour // try again in the next hour
  if (evenHour && (now.clone().add(diff).hour() % 2) !== 0) diff += millisInHour // satisfy evenness

  return diff
}

// GET /
const callIndex = () => {
  requestPromise({
    method: 'GET',
    timeout: 10000, // 10 seconds
    url: process.env.HEROKU_URL
  })
    .catch(() => {})
}

// POST /gas
const callGas = (notifyHydro) => {
  if (notifyHydro === undefined) notifyHydro = false

  let options = {
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: `${process.env.HEROKU_URL}gas`,
    body: {
      notifyHydro: notifyHydro
    },
    json: true
  }

  requestPromise(options)
    .catch(() => {})
}

// POST /balance
const callBalance = (notifyHydro) => {
  if (notifyHydro === undefined) notifyHydro = false

  requestPromise({
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: `${process.env.HEROKU_URL}balance`,
    body: {
      address: '0x0fccb4868b7f13ede288aff9298fce67541e3d38',
      thresholdBalance: 1,
      notifyHydro: notifyHydro
    },
    json: true
  })
    .catch(() => {})
}

const scheduleCall = (call, waitTime, intervalTime, callImmediately) => {
  if (callImmediately === true) call()

  timeouts.push(setTimeout(() => {
    call()
    intervals.push(setInterval(() => {
      call()
    }, intervalTime))
  }, waitTime))
}

// schedule calls
const setKeepAwake = (everyXMinutes) => {
  var waitTime = getMillisNearest(20, false)
  var intervalTime = 1000 * 60 * everyXMinutes
  scheduleCall(callIndex, waitTime, intervalTime)
}

const setGasChecker = (callImmediately, logInterval, hour, minute) => {
  var waitTime = getMillisNearest(0, true)
  var intervalTime = 1000 * 60 * logInterval
  scheduleCall(callGas, waitTime, intervalTime, callImmediately)

  waitTime = getMillisUntilTime(hour, minute)
  intervalTime = millisInDay
  scheduleCall(() => { callGas(true) }, waitTime, intervalTime)
}

const setBalanceChecker = (callImmediately, logInterval, hour, minute) => {
  var waitTime = getMillisNearest(0, true)
  var intervalTime = 1000 * 60 * logInterval
  scheduleCall(callBalance, waitTime, intervalTime, callImmediately)

  waitTime = getMillisUntilTime(hour, minute)
  intervalTime = millisInDay
  scheduleCall(() => { callBalance(true) }, waitTime, intervalTime)
}

// wait 5 seconds before beginning
setTimeout(() => {
  // make sure the app stays awake by calling it every 20 minutes
  setKeepAwake(20)
  // log every hour, call at 9am every day in #hydro
  setGasChecker(true, 60, 9)
  setBalanceChecker(true, 60, 9)
}, 1000 * 5)

// const clearTimeoutsIntervals = () => {
//   timeouts.forEach(x => { clearTimeout(x) })
//   intervals.forEach(x => { clearInterval(x) })
//   timeouts = []
//   intervals = []
// }
