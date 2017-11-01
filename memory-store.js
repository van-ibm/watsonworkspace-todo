const userStorage = {
  // user todos will be added here
}

const spaceStorage = {
  // todos for a space added here
}

module.exports.create = todo => {
  const userId = todo.createdBy.id
  const spaceId = todo.spaceId

  if (userStorage[userId] === undefined) {
    userStorage[userId] = {}
  }

  if (spaceStorage[spaceId] === undefined) {
    spaceStorage[spaceId] = []
  }

  userStorage[userId][todo.id] = todo
  spaceStorage[spaceId].push(todo)
}

module.exports.find = (todoId, userId) => {
  if (userId) {
    return module.exports.list(userId).find(element => element.id === todoId)
  } else {
    for (var key in userStorage) {
      for (var key2 in userStorage[key]) {
        if (userStorage[key][key2].id === todoId) {
          return userStorage[key][key2]
        }
      }
    }
  }
}

module.exports.list = userId => {
  const todos = []

  if (userStorage[userId]) {
    for (var key in userStorage[userId]) {
      todos.push(userStorage[userId][key])
    }
  }

  return todos
}

module.exports.listSpace = spaceId => {
  if (spaceStorage[spaceId]) {
    return spaceStorage[spaceId]
  } else {
    return []
  }
}
