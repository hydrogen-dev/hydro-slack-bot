const requestPromise = require('request-promise')
const CoinMarketCap = require('coinmarketcap-api')

var express = require('express')
var router = express.Router()

router.post('/', async (req, res, next) => {
  let notifyHydro = req.body.notifyHydro

  // API variables
  let thresholdGas = 40
  let clientRaindropGasDiscount = 0.9
  let challengeGasDiscount = 1

  var options = {
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: req.app.get('QUIKNODE_URL'),
    body: {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 73
    },
    json: true
  }

  requestPromise(options)
    .then(async result => {
      let gasPrice = parseInt(result.result) / 1e9

      let client = new CoinMarketCap()
      let ethPrice = await client.getTicker({currency: 'ETH'}).then(result => {
        return result.data.quotes.USD.price
      })
      let serverRaindropChallengeCost =
        (65000 * Math.min(challengeGasDiscount * gasPrice, thresholdGas) / 1e9 * ethPrice).toFixed(2)
      let serverRaindropAuthenticateCost = (80000 * gasPrice / 1e9 * ethPrice).toFixed(2)
      let clientRaindropCost =
        (110000 * Math.min(clientRaindropGasDiscount * gasPrice, thresholdGas) / 1e9 * ethPrice).toFixed(2)

      let attachments = [{
        'fallback': `Current Gas Price: ${gasPrice} Gwei`,
        'pretext': ':fuelpump:',
        'color': '#000000',
        'title': `Current Gas Price: ${gasPrice} Gwei`,
        'title_link': `https://ethgasstation.info/`,
        'fields': [{
          title: 'Server Raindrop Challenge',
          value: `$${serverRaindropChallengeCost}`,
          short: true
        },
        {
          title: 'Server Raindrop Authenticate',
          value: `$${serverRaindropAuthenticateCost}`,
          short: true
        },
        {
          title: 'Client Raindrop Sign Up',
          value: `$${clientRaindropCost}`
        }
        ]
      }]

      // notify #hydro if the passed flag has been set
      if (notifyHydro) {
        await req.app.get('sendWebhook')(req.app.get('webhooks').hydro, attachments)
      }

      // log the balance
      await req.app.get('sendWebhook')(req.app.get('webhooks').logs, attachments)

      // return
      res.sendStatus(200)
    })
    .catch(async error => {
      // forward along to error handlers
      res.locals.sendSlackError = error
      next(error)
    })
})

module.exports = router
