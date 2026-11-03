#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

import { addTodo, removeTodo, markDone, listTodos, TodoError } from './todo.js';

function getTodoFilePath() {
  return process.env.TODO_FILE || './todos.json';
}

function loadTodos(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw new TodoError(`Could not read todo file "${filePath}": ${err.message}`);
  }
  if (raw.trim().length === 0) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new TodoError(`Todo file "${filePath}" is not valid JSON`);
  }
}

function saveTodos(filePath, todos) {
  writeFileSync(filePath, JSON.stringify(todos, null, 2));
}

function formatTodo(todo) {
  const mark = todo.done ? '[x]' : '[ ]';
  return `${mark} ${todo.id} ${todo.title}`;
}

function runAdd(todos, args) {
  const title = args.join(' ').trim();
  if (!title) {
    throw new TodoError('Usage: add <title>');
  }
  const updated = addTodo(todos, title);
  const created = updated[updated.length - 1];
  console.log(created.id);
  return updated;
}

function runList(todos) {
  const items = listTodos(todos);
  if (items.length === 0) {
    console.log('No todos yet.');
  } else {
    for (const todo of items) {
      console.log(formatTodo(todo));
    }
  }
  return null;
}

function runDone(todos, args) {
  const [id] = args;
  if (!id) {
    throw new TodoError('Usage: done <id>');
  }
  const updated = markDone(todos, id);
  console.log(`Done: ${id}`);
  return updated;
}

function runRemove(todos, args) {
  const [id] = args;
  if (!id) {
    throw new TodoError('Usage: remove <id>');
  }
  const updated = removeTodo(todos, id);
  console.log(`Removed: ${id}`);
  return updated;
}

const COMMANDS = {
  add: runAdd,
  list: runList,
  done: runDone,
  remove: runRemove,
};

function main(argv) {
  const [command, ...args] = argv;
  const handler = COMMANDS[command];
  if (!handler) {
    throw new TodoError(
      `Unknown command "${command ?? ''}". Available commands: add, list, done, remove`,
    );
  }

  const todoFilePath = getTodoFilePath();
  const todos = loadTodos(todoFilePath);
  const updated = handler(todos, args);
  if (updated !== null) {
    saveTodos(todoFilePath, updated);
  }
}

try {
  main(process.argv.slice(2));
  process.exitCode = 0;
} catch (err) {
  const message = err instanceof TodoError ? err.message : `Unexpected error: ${err.message}`;
  console.error(message);
  process.exitCode = 1;
}
