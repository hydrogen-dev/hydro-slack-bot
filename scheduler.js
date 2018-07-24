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

const getMillisNearest = (minute) => {
  if (minute < 0 || minute > 59) throw Error(`Invalid 'minute' argument: ${minute}`)

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

  return timeInNewYork.diff(nowInNewYork)
}

const hydroBeenWarned = {
  gas: true,
  balance: true
}

// GET /
const callIndex = () => {
  let options = {
    method: 'GET',
    timeout: 1000 * 10,
    url: process.env.API_URL,
    auth: {
      'bearer': process.env.ACCESS_TOKEN
    }
  }

  requestPromise(options)
}

// POST /gas
const callGas = (notify) => {
  if (notify === undefined) throw Error('Must notify at least one chat.')

  let options = {
    method: 'POST',
    timeout: 1000 * 10,
    url: `${process.env.API_URL}gas`,
    auth: {
      'bearer': process.env.ACCESS_TOKEN
    },
    body: {
      notify: notify
    },
    json: true
  }

  requestPromise(options)
    .then(warning => {
      // notify #hydro if there's a warning and they haven't been warned yet
      if (warning && !hydroBeenWarned.gas) {
        callGas(['hydro'])
          .then(() => {
            hydroBeenWarned.gas = true
          })
      }
      // reset flag once a non-warning notification successfully sends
      if (!warning) hydroBeenWarned.gas = false
    })
}

// POST /balance
const callBalance = (notify) => {
  if (notify === undefined) throw Error('Must notify at least one chat.')

  let options = {
    method: 'POST',
    timeout: 1000 * 10,
    url: `${process.env.API_URL}balance`,
    auth: {
      'bearer': process.env.ACCESS_TOKEN
    },
    body: {
      address: '0x0fccb4868b7f13ede288aff9298fce67541e3d38',
      thresholdBalance: 1,
      notify: notify
    },
    json: true
  }

  requestPromise(options)
    .then(warning => {
      // notify #hydro if there's a warning and they haven't been warned yet
      if (warning && !hydroBeenWarned.balance) {
        callBalance(['hydro'])
          .then(() => {
            hydroBeenWarned.balance = true
          })
      }
      // reset flag once a non-warning notification successfully sends
      if (!warning) hydroBeenWarned.balance = false
    })
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

const onceEvery = (call, minutes, callImmediately) => {
  let waitTime = getMillisNearest(0)
  let intervalTime = 1000 * 60 * minutes

  scheduleCall(call, waitTime, intervalTime, callImmediately)
}

const oncePerDay = (call, hour, callImmediately) => {
  let waitTime = getMillisUntilTime(hour)
  let intervalTime = millisInDay

  scheduleCall(call, waitTime, intervalTime, callImmediately)
}

// wait 2 seconds before beginning
setTimeout(() => {
  // make sure the app stays awake by calling it every 20 minutes
  onceEvery(callIndex, 20)

  // logs every interval
  onceEvery(() => { callGas(['logs']) }, 60) // log gas every hour
  onceEvery(() => { callBalance(['logs']) }, 60) // log balance every hour

  // notifications to hydro once per day
  oncePerDay(() => { callGas(['hydro']) }, 9) // call every day in hydro
  onceEvery(() => { callBalance(['hydro']) }, 9) // log balance every hour
}, 1000 * 2)
