const ethUtil = require('ethereumjs-util')
const requestPromise = require('request-promise')

var express = require('express')
var router = express.Router()

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

router.post('/', async (req, res, next) => {
  // validate passed arguments
  let passedHooks = req.body.notify
  let validHooks = req.app.get('webhooks')

  if (!passedHooks.every(hook => { return Object.keys(validHooks).includes(hook) })) {
    next(Error(`One or more unsupported hooks passed: ${passedHooks}`))
    return
  }

  let address = req.body.address
  if (!ethUtil.isValidAddress(address)) throw Error(`Invalid Address: '${address}'`)
  address = ethUtil.toChecksumAddress(address)
  let addressName = Object.keys(addressNames).includes(address) ? addressNames[address] : null
  let addressIdentifier = addressName === null ? address : addressName

  let thresholdBalance = req.body.thresholdBalance

  // fetch external data
  let balance
  try {
    balance = await getBalanceEtherscan(address, req.app.get('ETHERSCAN_API_KEY'))
  } catch (error) {
    next(error)
    return
  }

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

  // send message
  Promise.all(passedHooks.map(hook => {
    return req.app.get('sendWebhook')(validHooks[hook], attachments)
  }))
    .then(() => {
      res.status(200).send(warning)
    })
    .catch(error => {
      next(error)
    })
})

module.exports = router
