const ethUtil = require('ethereumjs-util')
const requestPromise = require('request-promise')

var express = require('express')
var router = express.Router()

var hydroBeenWarned = false

const addressNames = {
  '0x0fCCB4868B7F13EDe288AFF9298fcE67541e3d38': 'Deployment Wallet'
}

const balanceToEther = (weiBalance) => {
  return parseInt(weiBalance) / 1e18
}

const getBalanceEtherscan = (address, apiKey) => {
  let balanceUrl =
    `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`

  let options = {
    url: balanceUrl,
    json: true
  }

  return requestPromise(options)
    .then(result => {
      return balanceToEther(result.result)
    })
}

router.post('/', function (req, res, next) {
  let notifyHydro = req.body.notifyHydro

  let address = req.body.address
  if (!ethUtil.isValidAddress(address)) throw Error(`Invalid Address: '${address}'`)
  address = ethUtil.toChecksumAddress(address)

  let thresholdBalance = req.body.thresholdBalance

  let addressName = Object.keys(addressNames).includes(address) ? addressNames[address] : null
  let addressIdentifier = addressName === null ? address : addressName

  getBalanceEtherscan(address, req.app.get('ETHERSCAN_API_KEY'))
    .then(async balance => {
      var warning = balance <= thresholdBalance
      var attachments
      if (warning) {
        attachments = [{
          fallback: `Low Balance Warning: ${addressIdentifier} has ${balance.toFixed(4)} ETH`,
          pretext: '<!channel> :money_with_wings:',
          color: 'warning',
          title: `Low Balance Warning\n${addressIdentifier}`,
          title_link: `https://etherscan.io/address/${address}`,
          text:
            `The balance of this wallet is *${balance.toFixed(4)}* ETH. ` +
            `It should be at least *${thresholdBalance.toFixed(4)}* ETH.`
        }]
      } else {
        attachments = [{
          fallback: `Balance Update: ${addressIdentifier} has ${balance.toFixed(4)} ETH`,
          pretext: ':party-parrot:',
          color: 'good',
          title: `Balance Update\n${addressIdentifier}`,
          title_link: `https://etherscan.io/address/${address}`,
          text:
            `The balance of this wallet is *${balance.toFixed(4)}* ETH. ` +
            `It exceeds the recommended threshold of *${thresholdBalance.toFixed(4)}* ETH.`
        }]
      }

      // reset the warning once a successful notification goes through
      if (!warning) hydroBeenWarned = false

      // notify #hydro if the passed flag has been set or they haven't been warned yet
      if (notifyHydro || (warning && !hydroBeenWarned)) {
        await req.app.get('sendWebhook')(req.app.get('webhooks').noah, attachments)
        if (warning) hydroBeenWarned = true
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
