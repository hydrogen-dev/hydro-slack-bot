const requestPromise = require('request-promise')
const CoinMarketCap = require('coinmarketcap-api')

var express = require('express')
var router = express.Router()

// static(ish) API variable
const thresholdGas = 40
const clientRaindropGasDiscount = 0.9
const challengeGasDiscount = 1

const getGasPrice = (url) => {
  var options = {
    method: 'POST',
    timeout: 10000, // 10 seconds
    url: url,
    body: {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 73
    },
    json: true
  }

  return requestPromise(options)
    .then(result => {
      return parseInt(result.result) / 1e9
    })
}

const getEthPrice = async () => {
  let client = new CoinMarketCap()
  return client.getTicker({currency: 'ETH'})
    .then(result => {
      return result.data.quotes.USD.price
    })
}

router.post('/', async (req, res, next) => {
  // validate passed notify arguments
  let passedHooks = req.body.notify
  let validHooks = req.app.get('webhooks')

  if (!passedHooks.every(hook => { return Object.keys(validHooks).includes(hook) })) {
    next(Error(`One or more unsupported hooks passed: ${passedHooks}`))
    return
  }

  // fetch external data
  let gasPrice, ethPrice
  try {
    gasPrice = await getGasPrice(req.app.get('QUIKNODE_URL'))
    ethPrice = await getEthPrice()
  } catch (error) {
    next(error)
    return
  }

  // formulate message
  let serverRaindropChallengeCost =
    (65000 * Math.min(challengeGasDiscount * gasPrice, thresholdGas) / 1e9 * ethPrice).toFixed(2)
  let serverRaindropAuthenticateCost = (80000 * gasPrice / 1e9 * ethPrice).toFixed(2)
  let clientRaindropCost =
    (110000 * Math.min(clientRaindropGasDiscount * gasPrice, thresholdGas) / 1e9 * ethPrice).toFixed(2)

  var warning = gasPrice > (thresholdGas / 2)

  let attachments = [{
    fallback: `Gas Price Update: ${gasPrice} Gwei`,
    pretext: warning ? '<!channel> ' : '' + ':fuelpump:',
    color: warning ? 'warning' : 'good',
    title: `Gas Price Update\n${gasPrice} Gwei`,
    title_link: `https://ethgasstation.info/`,
    fields: [{
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
    }]
  }]

  // send message
  Promise.all(passedHooks.map(hook => {
    return req.app.get('sendWebhook')(validHooks[hook], attachments)
  }))
    .then(() => {
      res.sendStatus(200)
    })
    .catch(error => {
      next(error)
    })
})

module.exports = router
