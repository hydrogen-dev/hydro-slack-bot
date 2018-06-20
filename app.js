require('dotenv').config()
const requestPromise = require('request-promise')
const { IncomingWebhook } = require('@slack/client')
const wwwhisper = require('connect-wwwhisper')

var createError = require('http-errors')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var indexRouter = require('./routes/index')
var balanceRouter = require('./routes/balance')
var slashCommandsRouter = require('./routes/slashCommands')

var app = express()
app.use(wwwhisper())

// export webhook
const noahWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_NOAH)
const hydroWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_HYDRO)
app.set('webhooks', {
  noah: noahWebhook,
  hydro: hydroWebhook
})
let sendWebhook = (webhook, text, attachments) => {
  let payload = attachments === undefined ? text : { text: text, attachments: attachments }
  return webhook.send(payload)
}
app.set('sendWebhook', sendWebhook)

// export etherscan balance query
app.set('ETHERSCAN_API_KEY', process.env.ETHERSCAN_API_KEY)
let getBalanceEtherscan = (address, apiKey) => {
  let balanceUrl =
  'https://api.etherscan.io/api?module=account&action=balance&address=' +
  address +
  `&tag=latest&apikey=${apiKey}`

  let options = {
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
app.use('/slashCommands', slashCommandsRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('Express server listening on port', port)
})

module.exports = app
