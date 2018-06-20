var express = require('express');
var router = express.Router();

balanceToEther = (weiBalance) => {
  return parseInt(weiBalance) / 1e18
}

router.get('/:address', function(req, res, next) {
  let address = req.params.address;

  req.app.get('getBalanceEtherscan')(address, req.app.get('ETHERSCAN_API_KEY'))
    .then(async balance => {
      let etherBalance = balanceToEther(balance)
      if (etherBalance < .1) {
        await sendWebhook(
          req.app.get('webhooks').noah,
          `⚠️WARNING⚠️ The balance of [${address}](https://etherscan.io/address/${address}) is running low.` +
            `\n> ${etherBalance.toFixed(4)} ETH`
        )
      }
      res.sendStatus(200)
    })
    .catch(error => { next(error) })
});

module.exports = router;
