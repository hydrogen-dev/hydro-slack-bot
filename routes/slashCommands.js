var express = require('express')
var router = express.Router()

// rng commands
const roll = (text) => {
  let numbers = text.split(' ').slice(1)
  var bounds
  if (numbers.length === 0) {
    bounds = [1, 6]
  } else if (numbers.length === 1) {
    bounds = [1, numbers[0]]
  } else {
    return { 'response_type': 'ephemeral', 'text': 'Please pass 0 or 1 arguments to /roll.' }
  }

  return {
    'response_type': 'in_channel',
    'text': Math.floor(Math.random() * (bounds[1] - bounds[0] + 1) + bounds[0]).toString()
  }
}

const choose = (text) => {
  let list = text.split(' ').slice(1)

  if (list.length < 2) {
    return { 'response_type': 'ephemeral', 'text': 'Please pass at least two options to /choose.' }
  } else {
    return {
      'response_type': 'in_channel',
      'text': list[Math.floor(Math.random() * list.length)]
    }
  }
}

const rngCommands = {
  'roll': roll,
  'choose': choose
}

const rngCommandsAliased = {
  ...{
    'r': roll,
    'c': choose
  },
  ...rngCommands
}

const validCommands = {
  '/bot_health_check': (text, res) => {
    res.json({
      'response_type': 'ephemeral',
      'text': `It's alive!`
    })
  },
  '/rng': (text, res) => {
    let command = text.split(' ')[0]
    if (!Object.keys(rngCommandsAliased).includes(command)) {
      res.json({
        'response_type': 'ephemeral',
        'text': `Please choose one of: *${Object.keys(rngCommands).join('*, *')}*.`
      })
    } else {
      res.json(rngCommandsAliased[command](text))
    }
  }
}

router.post('/', function (req, res, next) {
  if (req.body.token !== req.app.get('SLACK_TOKEN')) throw Error('Unauthorized')
  if (!Object.keys(validCommands).includes(req.body.command)) throw Error(`Unsupported command: ${req.body.command}`)

  validCommands[req.body.command](req.body.text, res)
})

module.exports = router
