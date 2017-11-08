require('dotenv').config()

// creates a bot server with a single bot
const botFramework = require('watsonworkspace-bot')
botFramework.level('info')
botFramework.startServer()

const bot = botFramework.create(
  process.env.TODO_APP_ID,
  process.env.TODO_APP_SECRET,
  process.env.TODO_WEBHOOK_SECRET
)

// bind the todo bot's behavior
const todo = require('./index.js')
todo.bind(bot)

bot.authenticate()
