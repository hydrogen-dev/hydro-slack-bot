require('dotenv').config()
const { IncomingWebhook } = require('@slack/client')

var createError = require('http-errors')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var indexRouter = require('./routes/index')

var gasRouter = require('./routes/gas')
var balanceRouter = require('./routes/balance')

var slashCommandsRouter = require('./routes/slashCommands')

var app = express()

// quiknode
app.set('QUIKNODE_URL', process.env.QUIKNODE_URL)

// webhooks
const webhooks = {
  noah: new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_NOAH),
  logs: new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_LOGS),
  hydro: new IncomingWebhook(process.env.SLACK_WEBHOOK_URL_HYDRO)
}
app.set('webhooks', webhooks)
let sendWebhook = (webhook, attachments) => {
  if (attachments.length > 1) throw Error('Too many attachments.')

  // insert common footer args
  attachments[0].footer_icon = 'https://i.imgur.com/Hzb3Uvy.png'
  attachments[0].footer = '<https://github.com/NoahHydro/hydro-slack-bot|Source Code>'
  attachments[0].ts = Math.floor(new Date() / 1000)
  console.log(attachments)
  return webhook.send({ attachments: attachments })
}
app.set('sendWebhook', sendWebhook)

// etherscan balance query
app.set('ETHERSCAN_API_KEY', process.env.ETHERSCAN_API_KEY)

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/', indexRouter)
app.use('/gas', gasRouter)
app.use('/balance', balanceRouter)
app.use('/slashCommands', slashCommandsRouter)

// catch 404 and forward to error handlers
app.use((req, res, next) => {
  next(createError(404))
})

app.use((err, req, res, next) => {
  // log applicable errors to slack
  if (res.locals.sendSlackError) {
    req.app.get('sendWebhook')(
      req.app.get('webhooks').logs,
      [{
        'fallback': `Error while calling ${req.originalUrl}`,
        'pretext': '<!channel>\n:skull_and_crossbones: Hydro Bot Error',
        'color': 'danger',
        'title': `Error: ${req.originalUrl}`,
        'text': res.locals.sendSlackError.toString(),
        'ts': Math.floor(new Date() / 1000)
      }]
    )
  }
  next(err)
})

// generic error handler
app.use((err, req, res, next) => {
  console.error(err)
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
  // begin the scheduler
  require('./scheduler')
})

module.exports = app
