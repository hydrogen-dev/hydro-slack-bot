# Slack Bot

This is a lightweight Express API hosted on Heroku that exposes endpoints which send notifications to the Hydrogen Slack based on the current state of Ethereum/the world.

It's a basic Express API: the setup logic is in [app.js](./app.js) and endpoints are defined in [routes/](./routes). The scheduling of calls is handled by [scheduler.js](./scheduler.js).

## Balances
`/balance` sends updates about the ether balance of a given Ethereum account.

## Gas
`/balance` sends updates about current gas prices.

## Health Check
Typing `/bot_health_check` in Slack returns `It's alive!` if the API can be reached on Heroku.
