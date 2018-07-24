require('dotenv').config()
const { IncomingWebhook } = require('@slack/client')

var passport = require('passport')
var Strategy = require('passport-http-bearer').Strategy

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

// database connection
// const { Pool } = require('pg')
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: true
// })
// app.set('pool', pool)
// https://devcenter.heroku.com/articles/getting-started-with-nodejs#provision-a-database
// let client = app.get('pool').connect()
// let result = await client.query('SELECT * FROM test_table')

// set config variables so we don't have to access them in individual routes
app.set('SLACK_TOKEN', process.env.SLACK_TOKEN)
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


// configure passport auth and authenticate all calls except slashCommands
passport.use(new Strategy(
  (token, done) => {
    return token === process.env.ACCESS_TOKEN ? done(null, true) : done(null, false)
  }
))

app.use('/slashCommands', slashCommandsRouter)

app.all('*', passport.authenticate('bearer', { session: false }), (req, res, next) => {
  next()
})

// send 204 for favicon requests
app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204)
})

// set up routers
app.use('/', indexRouter)
app.use('/gas', gasRouter)
app.use('/balance', balanceRouter)

// catch 404 and forward to error handlers
app.use((req, res, next) => {
  next(createError(404))
})

// custom error handler to log errors to slack
app.use((err, req, res, next) => {
  let hook = req.app.get('env') === 'production' ? 'logs' : 'noah'

  req.app.get('sendWebhook')(
    req.app.get('webhooks')[hook],
    [{
      'fallback': `Error while calling ${req.originalUrl}`,
      'pretext': '<!channel> :skull_and_crossbones:',
      'color': 'danger',
      'title': `Bot Error: ${req.originalUrl}`,
      'text': err.toString(),
      'ts': Math.floor(new Date() / 1000)
    }]
  )

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
