var express = require('express')
var router = express.Router()

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: 'Express' })
})

router.get('/favicon.ico', (req, res) => {
  res.status(204)
})

module.exports = router
