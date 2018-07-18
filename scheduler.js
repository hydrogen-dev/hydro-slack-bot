require('dotenv').config()
const requestPromise = require('request-promise')

const timeouts = []
const intervals = []

const millisInDay = 1000 * 60 * 60 * 24

const getMillisUntilTime = (hour, minute) => {
  var now = new Date()
  var millisTillTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0) - now
  if (millisTillTime < 0) {
    millisTillTime += millisInDay // it's after the time, try again tomorrow.
  }

  return millisTillTime
}

// keep the app awake by GETting / every 20 minutes
const getIndex = () => {
  requestPromise({
    method: 'GET',
    timeout: 10000, // 10 seconds
    url: process.env.HEROKU_URL
  })
    .catch(() => {})
}

const setKeepAwake = (minutes) => {
  getIndex()
  intervals.push(setInterval(() => { getIndex() }, 1000 * 60 * minutes))
}

// call /gas
const callGas = (notifyHydro) => {
  let options = {
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: `${process.env.HEROKU_URL}gas`,
    json: true
  }
  if (notifyHydro !== undefined) options.body = { notifyHydro: notifyHydro }

  requestPromise(options)
    .catch(() => {})
}

// schedule calls to /gas
const setGasChecker = (minutes) => {
  // call every hour without notifying #hydro
  callGas(false)
  intervals.push(setInterval(() => { callGas(false) }, 1000 * 60 * minutes))

  // notify #hydro at 9:30 every morning
  let millisTillTime = getMillisUntilTime(9, 30)

  timeouts.push(setTimeout(() => {
    intervals.push(setInterval(() => { callGas(true) }, millisInDay))
  }, millisTillTime))
}

// call /balance
const callBalance = (notifyHydro) => {
  let body = {
    address: '0x0fccb4868b7f13ede288aff9298fce67541e3d38',
    thresholdBalance: 1
  }
  if (notifyHydro !== undefined) body.notifyHydro = notifyHydro

  requestPromise({
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: `${process.env.HEROKU_URL}balance`,
    body: body,
    json: true
  })
    .catch(() => {})
}

// schedule calls to /balance
const setBalanceChecker = (minutes) => {
  // call every hour without notifying #hydro
  callBalance(false)
  intervals.push(setInterval(() => { callBalance(false) }, 1000 * 60 * minutes))

  // notify #hydro at 9:30 every morning
  let millisTillTime = getMillisUntilTime(9, 30)
  timeouts.push(setTimeout(() => {
    intervals.push(setInterval(() => { callBalance(true) }, millisInDay))
  }, millisTillTime))
}

// wait 5 seconds before beginning
setTimeout(() => {
  setKeepAwake(20)
  setGasChecker(60 * 2)
  setBalanceChecker(60 * 2)
}, 1000 * 5)

const clearTimeoutsIntervals = () => {
  timeouts.forEach(x => { clearTimeout(x) })
  intervals.forEach(x => { clearInterval(x) })
}

module.exports = {
  clearTimeoutsIntervals: clearTimeoutsIntervals
}
