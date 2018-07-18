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

  var nowInNewYork = now.clone().tz('America/New_York')
  var timeInNewYork = now.clone().tz('America/New_York').hour(hour).minute(minute).seconds(0).milliseconds(0)

  var diff = timeInNewYork.diff(nowInNewYork)
  if (diff < 0) diff += millisInDay // it's after the time, try again tomorrow

  return diff
}

const getMillisNearest = (minute, evenHour) => {
  if (minute < 0 || minute > 59) throw Error(`Invalid 'minute' argument: ${minute}`)
  if (evenHour === undefined) evenHour = false

  var now = moment()
  var nowInNewYork = now.clone().tz('America/New_York')

  var nextMinute = minute === 0 ? 0 : Math.ceil((nowInNewYork.minute() + 1) / minute) * minute
  var hoursToAdd = 0
  if (nextMinute >= 60 || nextMinute === 0) {
    hoursToAdd = 1
    nextMinute = minute
  }

  var timeInNewYork =
    now.clone().tz('America/New_York').add(hoursToAdd, 'hour').minute(nextMinute).seconds(0).milliseconds(0)

  // satisfy evenness
  if (evenHour && timeInNewYork.hour() % 2 !== 0) {
    timeInNewYork = now.clone().tz('America/New_York').add(1, 'hour').minute(minute).seconds(0).milliseconds(0)
  }

  return timeInNewYork.diff(nowInNewYork)
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
    intervals.push(intervals.push(setInterval(() => {
      call()
    }, intervalTime)))
  }, waitTime))
}

// schedule calls
const setKeepAwake = (everyXMinutes) => {
  var waitTime = getMillisNearest(1)
  var intervalTime = 1000 * 60 * everyXMinutes
  scheduleCall(callIndex, waitTime, intervalTime)
}

const setGasChecker = (callImmediately, logInterval, hour, minute) => {
  var waitTime = getMillisNearest(0)
  var intervalTime = 1000 * 60 * logInterval
  scheduleCall(callGas, waitTime, intervalTime, callImmediately)

  waitTime = getMillisUntilTime(hour, minute)
  intervalTime = millisInDay
  scheduleCall(() => { callGas(true) }, waitTime, intervalTime)
}

const setBalanceChecker = (callImmediately, logInterval, hour, minute) => {
  var waitTime = getMillisNearest(0)
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
  setGasChecker(false, 30, 9)
  setBalanceChecker(false, 30, 9)
}, 1000 * 5)

// const clearTimeoutsIntervals = () => {
//   timeouts.forEach(x => { clearTimeout(x) })
//   intervals.forEach(x => { clearInterval(x) })
//   timeouts = []
//   intervals = []
// }
