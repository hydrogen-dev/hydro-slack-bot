var express = require('express')
var router = express.Router()

const validCommands = {
  '/bot_health_check': res => {
    res.json({
      'response_type': 'ephemeral',
      'text': `It's alive!`
    })
  }
}

router.post('/', function (req, res, next) {
  if (req.body.token !== req.app.get('SLACK_TOKEN')) throw Error('Unauthorized')
  if (!Object.keys(validCommands).includes(req.body.command)) throw Error(`Unsupported command: ${req.body.command}`)

  validCommands[req.body.command](res)
})

module.exports = router
