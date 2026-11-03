import { randomUUID } from 'node:crypto';

export class TodoError extends Error {}

export function addTodo(todos, title) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new TodoError('Title must be a non-empty string');
  }
  const newTodo = {
    id: randomUUID(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
  };
  return [...todos, newTodo];
}

export function removeTodo(todos, id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) {
    throw new TodoError(`No todo found with id "${id}"`);
  }
  return [...todos.slice(0, index), ...todos.slice(index + 1)];
}

export function markDone(todos, id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) {
    throw new TodoError(`No todo found with id "${id}"`);
  }
  if (todos[index].done) {
    return todos;
  }
  const updated = { ...todos[index], done: true };
  return [...todos.slice(0, index), updated, ...todos.slice(index + 1)];
}

export function listTodos(todos) {
  return todos;
}
