var express = require('express')
var router = express.Router()

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: 'Hydro Slack Bot', githubLink: 'https://github.com/NoahHydro/hydro-slack-bot' })
})

module.exports = router
