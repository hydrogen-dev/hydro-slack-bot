require('dotenv').config()
const requestPromise = require('request-promise')
const { IncomingWebhook } = require('@slack/client')

var createError = require('http-errors')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var indexRouter = require('./routes/index')
var balanceRouter = require('./routes/balance')

var app = express()

// export webhook
const noahWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_NOAH)
app.set('webhooks', {
  noah: noahWebhook
})
sendWebhook = (webhook, text) => {
  return new Promise(function(resolve, reject) {
    webhook.send(text, function(err, res) {
        err === undefined ? reject() : resolve(res)
    })
  })
}
app.set('sendWebhook', sendWebhook)

// export webook
app.set('ETHERSCAN_API_KEY', process.env.ETHERSCAN_API_KEY)
getBalanceEtherscan = (address, apiKey) => {
  let balanceUrl =
    'https://api.etherscan.io/api?module=account&action=balance&address=' +
    address +
    `&tag=latest&apikey=${apiKey}`

  // inject url and authorization
  options = {
    url: balanceUrl,
    json: true
  }

  return requestPromise(options)
    .then(result => {
      return result.result
    })
}
app.set('getBalanceEtherscan', getBalanceEtherscan)

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/', indexRouter)
app.use('/balance', balanceRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404))
})

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app
