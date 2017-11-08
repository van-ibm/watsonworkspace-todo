'use strict'

const cryptoRandomString = require('crypto-random-string')

const logger = require('winston')

const UI = require('watsonworkspace-sdk').UI

const todoStorage = require('./memory-store')

const lens = 'Todo'

const viewActionId = 'View'
const listActionId = 'List'

const acceptActionId = 'submit-action'
const completeActionId = 'Complete'
const removeActionId = 'Remove'

const slashCommand = '/todos'

module.exports.bind = (bot) => {
  logger.info(`Adding todo event listeners`)

  // if a message contains something that is "todoable", add a lens to show action fulfillment
  bot.on('message-focus:ActionRequest', (message, annotation) => addTodoLens(message, annotation))
  bot.on('message-focus:Commitment', (message, annotation) => addTodoLens(message, annotation))

  // user is selcting action fulfillment
  bot.on(`actionSelected:${viewActionId}`, (message, annotation) => createViewDialog(message, annotation))
  bot.on(`actionSelected:${listActionId}`, (message, annotation) => showTodoList(message, annotation))
  bot.on(`actionSelected:${acceptActionId}`, (message, annotation) => acceptTodo(message, annotation))

  // slash command
  bot.on(`actionSelected:${slashCommand}`, (message, annotation, params) => doSlash(message, annotation, params))

  // the actionId for card butons is the JSON payload, listen to the generic actionSelected
  bot.on(`actionSelected`, (message, annotation) => {
    logAction(message, annotation)

    if (annotation.actionId.charAt(0) === '{') {
      const payload = JSON.parse(annotation.actionId)

      logger.verbose(`User selected '${payload.action}' action`)

      switch (payload.action) {
        case completeActionId:
          completeTodo(payload.todoId, message, annotation)
      }
    }
  })

  function doSlash (message, annotation, params) {
    let option = 'space'

    // user has specified information to the slash command
    if (params.length > 0) {
      option = params[0].toLowerCase()
    }

    switch (option) {
      case 'space':
        showTodoList(message.userId, annotation, message.conversationId)
        break
      case 'me':
        showTodoList(message.userId, annotation)
        break
    }
  }

  function addTodoLens (message, annotation) {
    logger.verbose(`Adding lens '${lens}' to message ${message.messageId}`)

    getMessage(message.messageId)
    .then(messageWithContent => {
      // store metadata with the annotation for later use by the AF handler
      const payload = {
        phrase: annotation.phrase // the todoable phrase
      }

      // create the focus to add the UI decoration in Workspace
      return bot.addMessageFocus(messageWithContent, annotation.phrase, lens, '',
        viewActionId, payload)
    })
    .catch(error => logger.error(error))
  }

  function createViewDialog (message, annotation) {
    logAction(message, annotation)

    getMessage(annotation.referralMessageId)
    .then(messageWithTodoData => {
      const todoLensPayload = getTodoLensPayload(messageWithTodoData)

      return bot.sendTargetedMessage(message.userId, annotation, UI.generic(
        'Would you like to do?',
        todoLensPayload.phrase,
        [
          UI.button(acceptActionId, 'Add to List')
        ]
      ))
    })
    .catch(error => logger.error(error))
  }

  function acceptTodo (message, annotation) {
    const userId = message.userId

    logger.verbose(`User '${userId}' accepting a todo`)

    getMessage(annotation.referralMessageId)
    .then(messageWithTodoData => {
      addTodo(buildTodo(messageWithTodoData, annotation.conversationId))
      return showTodoList(userId, annotation)
    })
    .catch(error => logger.error(error))
  }

  function addTodo (todo) {
    logger.verbose(`Adding todo '${todo.id}'`)

    todoStorage.create(todo)
  }

  function buildTodo (message, spaceId) {
    logger.verbose(`Building a todo from message '${message.id}' in space '${spaceId}'`)

    return {
      id: cryptoRandomString(32),
      created: message.created,
      createdBy: message.createdBy,
      messageId: message.id,
      content: message.content,
      payload: getTodoLensPayload(message),
      completed: false,
      spaceId: spaceId
    }
  }

  function showTodoList (userId, annotation, spaceId) {
    const cards = []
    let todos = []

    if (spaceId) {
      logger.verbose(`Showing todo list for space ${spaceId}`)
      todos = todoStorage.listSpace(spaceId)
    } else {
      logger.verbose(`Showing todo list for user ${userId}`)
      todos = todoStorage.list(userId)
    }

    // get this user's todos
    todos.forEach(todo => {
      logger.verbose(todo)
      const buttonText = todo.completed ? removeActionId : completeActionId
      const isSecondary = todo.completed

      // add a complete button if this is the user's todo
      let completeButton = {}

      if (userId === todo.createdBy.id) {
        completeButton = {
          action: completeActionId,
          todoId: todo.id
        }
      }

      cards.push(UI.card(todo.payload.phrase, todo.createdBy.displayName, todo.content, [
        UI.cardButton(buttonText, completeButton, isSecondary)
      ], todo.created))
    })

    return bot.sendTargetedMessage(userId, annotation, cards)
  }

  function completeTodo (todoId, message, annotation) {
    const userId = message.userId
    const todo = todoStorage.find(todoId, userId)

    logger.verbose(`User '${userId}' completed todo '${todoId}'`)

    if (todo) {
      todo.completed = !todo.completed
      return showTodoList(userId, annotation)
    } else {
      console.error(`Failed to find todo ${todoId}`)
    }
  }

  function getMessage (messageId) {
    logger.verbose(`Retrieving more complete message data from message '${messageId}'`)

    return bot.getMessage(messageId, [
      'id',
      'created',
      'annotations',
      'content',
      {
        name: 'createdBy',
        fields: ['id', 'displayName']
      }
    ])
  }

  function getTodoLensPayload (message) {
    logger.verbose(`Finding '${lens}' lens in message '${message.id}' annotations`)

    // get the message-focus annotation added earlier to get the payload
    const lensAnnotation = message.annotations.find(element => element.lens === lens)

    if (lensAnnotation) {
      logger.verbose(`Found '${lens}' lens with payload ${lensAnnotation.payload}`)
      return JSON.parse(lensAnnotation.payload)
    } else {
      console.error(`Failed to find the '${lens}' lens in message ${message.id}`)
      return {}
    }
  }

  function logAction (message, annotation) {
    const referralMessageId = annotation.referralMessageId
    const userId = message.userId
    const actionId = annotation.actionId

    logger.verbose(`${actionId} selected from message ${referralMessageId} by user ${userId}`)
    logger.debug(message)
    logger.debug(annotation)
  }
}
