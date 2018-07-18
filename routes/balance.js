const ethUtil = require('ethereumjs-util')
const requestPromise = require('request-promise')

var express = require('express')
var router = express.Router()

const addressNames = {
  '0x0fccb4868b7f13ede288aff9298fce67541e3d38': 'Deployment Wallet (Mainnet)'
}

const balanceToEther = (weiBalance) => {
  return parseInt(weiBalance) / 1e18
}

const getBalanceEtherscan = (address, apiKey) => {
  if (!ethUtil.isValidAddress(address)) {
    return Promise.reject(Error(`Invalid Address: '${address}'`))
  }

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
  let thresholdBalance = req.body.thresholdBalance

  let addressName = Object.keys(addressNames).includes(address.toLowerCase()) ? addressNames[address.toLowerCase()] : undefined
  let addressIdentifier = addressName === undefined ? address : addressName

  getBalanceEtherscan(address, req.app.get('ETHERSCAN_API_KEY'))
    .then(async balance => {
      var attachments
      if (balance <= thresholdBalance) {
        attachments = [{
          fallback: `Low Balance Warning: ${addressIdentifier} has only ${balance.toFixed(4)} ETH`,
          pretext: '<!channel> :warning: Low Balance Warning',
          color: 'warning',
          title: addressIdentifier,
          title_link: `https://etherscan.io/address/${address}`,
          text: [
            `This wallet's balance is *${balance.toFixed(4)}* ETH`,
            `It must always contain at least *${thresholdBalance.toFixed(4)}* ETH`
          ].join('\n')
        }]
      } else {
        attachments = [{
          fallback: `Balance Update: ${addressIdentifier} has ${balance.toFixed(4)} ETH`,
          pretext: ':party-parrot: Balance Update',
          color: 'good',
          title: addressIdentifier,
          title_link: `https://etherscan.io/address/${address}`,
          text: [
            `This wallet's balance is *${balance.toFixed(4)}* ETH`,
            `It exceeds the threshold balance of *${thresholdBalance.toFixed(4)}* ETH`
          ].join('\n')
        }]
      }

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
