import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { addTodo, removeTodo, markDone, listTodos, TodoError } from '../src/todo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');

function makeTmpDir() {
  return mkdtempSync(path.join(tmpdir(), 'todo-app-test-'));
}

function runCli(args, todoFile) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, TODO_FILE: todoFile },
  });
}

// ---------------------------------------------------------------------------
// Pure core logic (src/todo.js)
// ---------------------------------------------------------------------------

test('AC-2 addTodo returns a new todo with unique id, title, done=false, ISO createdAt', () => {
  const afterFirst = addTodo([], 'Сүү авах');
  assert.equal(afterFirst.length, 1);
  const todo = afterFirst[0];
  assert.equal(todo.title, 'Сүү авах');
  assert.equal(todo.done, false);
  assert.ok(typeof todo.id === 'string' && todo.id.length > 0);
  assert.equal(new Date(todo.createdAt).toISOString(), todo.createdAt);

  const afterSecond = addTodo(afterFirst, 'Талх авах');
  assert.equal(afterSecond.length, 2);
  assert.notEqual(afterSecond[0].id, afterSecond[1].id);
});

test('AC-4 markDone sets done=true and is idempotent without touching other fields/todos', () => {
  const todos = addTodo(addTodo([], 'A'), 'B');
  const target = todos[0];
  const other = todos[1];

  const once = markDone(todos, target.id);
  const found = once.find((t) => t.id === target.id);
  assert.equal(found.done, true);
  assert.equal(found.title, target.title);
  assert.equal(found.createdAt, target.createdAt);
  assert.deepEqual(once.find((t) => t.id === other.id), other);

  const twice = markDone(once, target.id);
  assert.deepEqual(twice, once);
});

test('AC-4 markDone throws for an unknown id', () => {
  assert.throws(() => markDone([], 'missing-id'), TodoError);
});

test('AC-5 removeTodo deletes only the targeted todo and keeps remaining ids', () => {
  const todos = addTodo(addTodo(addTodo([], 'A'), 'B'), 'C');
  const [a, b, c] = todos;
  const after = removeTodo(todos, b.id);
  assert.equal(after.length, 2);
  assert.deepEqual(after.map((t) => t.id).sort(), [a.id, c.id].sort());
});

test('AC-5 removeTodo throws for an unknown id', () => {
  assert.throws(() => removeTodo([], 'missing-id'), TodoError);
});

test('listTodos returns the todos unchanged', () => {
  const todos = addTodo([], 'A');
  assert.deepEqual(listTodos(todos), todos);
});

// ---------------------------------------------------------------------------
// CLI (src/cli.js) — acceptance tests
// ---------------------------------------------------------------------------

test('AC-2 CLI add creates a todo, prints its id, exits 0', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const result = runCli(['add', 'Сүү авах'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    const id = result.stdout.trim();
    assert.ok(id.length > 0);

    const saved = JSON.parse(readFileSync(todoFile, 'utf8'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, id);
    assert.equal(saved[0].title, 'Сүү авах');
    assert.equal(saved[0].done, false);
    assert.equal(new Date(saved[0].createdAt).toISOString(), saved[0].createdAt);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-3 CLI list shows a clear "no todos" message and exits 0 when empty', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const result = runCli(['list'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout.toLowerCase(), /no todos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-3 CLI list prints id, status mark, and title for each todo', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const add1 = runCli(['add', 'Сүү авах'], todoFile);
    const id1 = add1.stdout.trim();
    const add2 = runCli(['add', 'Талх авах'], todoFile);
    const id2 = add2.stdout.trim();
    runCli(['done', id1], todoFile);

    const result = runCli(['list'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[x\]/);
    assert.match(result.stdout, /\[ \]/);
    assert.ok(result.stdout.includes(id1));
    assert.ok(result.stdout.includes(id2));
    assert.ok(result.stdout.includes('Сүү авах'));
    assert.ok(result.stdout.includes('Талх авах'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-4 CLI done marks a todo as done, exits 0', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const id = runCli(['add', 'Сүү авах'], todoFile).stdout.trim();
    const result = runCli(['done', id], todoFile);
    assert.equal(result.status, 0, result.stderr);

    const saved = JSON.parse(readFileSync(todoFile, 'utf8'));
    assert.equal(saved[0].done, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-4 CLI done is idempotent when called twice on the same id', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const id = runCli(['add', 'Сүү авах'], todoFile).stdout.trim();
    runCli(['done', id], todoFile);
    const beforeSecond = readFileSync(todoFile, 'utf8');

    const result = runCli(['done', id], todoFile);
    assert.equal(result.status, 0, result.stderr);
    const afterSecond = readFileSync(todoFile, 'utf8');
    assert.equal(afterSecond, beforeSecond);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-5 CLI remove deletes only the targeted todo, keeping other ids', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const id1 = runCli(['add', 'A'], todoFile).stdout.trim();
    const id2 = runCli(['add', 'B'], todoFile).stdout.trim();

    const result = runCli(['remove', id1], todoFile);
    assert.equal(result.status, 0, result.stderr);

    const saved = JSON.parse(readFileSync(todoFile, 'utf8'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, id2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-6 unknown command fails with stderr message, non-zero exit, no file write', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const result = runCli(['frobnicate'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.equal(existsSync(todoFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-6 add without a title fails with stderr message, non-zero exit, no file write', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const result = runCli(['add'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.equal(existsSync(todoFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-6 done without an id fails with stderr message, non-zero exit, no file write', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const result = runCli(['done'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.equal(existsSync(todoFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-6 done with an unknown id fails with stderr message, non-zero exit, file unchanged', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    runCli(['add', 'A'], todoFile);
    const before = readFileSync(todoFile, 'utf8');

    const result = runCli(['done', 'does-not-exist'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.equal(readFileSync(todoFile, 'utf8'), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-6 remove with an unknown id fails with stderr message, non-zero exit, file unchanged', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    runCli(['add', 'A'], todoFile);
    const before = readFileSync(todoFile, 'utf8');

    const result = runCli(['remove', 'does-not-exist'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.equal(readFileSync(todoFile, 'utf8'), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-7 data persists across separate CLI invocations via TODO_FILE', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    const id = runCli(['add', 'Сүү авах'], todoFile).stdout.trim();
    const result = runCli(['list'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(id));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-7 missing todo file is treated as an empty list, not a crash', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    assert.equal(existsSync(todoFile), false);
    const result = runCli(['list'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout.toLowerCase(), /no todos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-7 empty todo file is treated as an empty list, not a crash', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    writeFileSync(todoFile, '');
    const result = runCli(['list'], todoFile);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout.toLowerCase(), /no todos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC-7 corrupted (non-JSON) todo file produces a clean error without a stack trace', () => {
  const dir = makeTmpDir();
  const todoFile = path.join(dir, 'todos.json');
  try {
    writeFileSync(todoFile, '{not valid json');
    const result = runCli(['list'], todoFile);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0);
    assert.doesNotMatch(result.stderr, /\n\s*at\s/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
