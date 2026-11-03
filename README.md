# todo-app

A simple, dependency-free Node.js CLI todo app. Data is stored in a JSON file;
business logic is plain functions, I/O only happens in the CLI layer.

## Requirements

- Node.js >= 18 (no npm dependencies, no devDependencies)

## Install

```sh
git clone https://github.com/ebatzorig/todo-app.git
cd todo-app
```

No `npm install` step is needed — there are no dependencies.

## Usage

```sh
node src/cli.js add "Buy milk"      # add a new todo, prints its id, exit 0
node src/cli.js list                # list all todos ([ ]/[x] id title)
node src/cli.js done <id>           # mark a todo as done (idempotent)
node src/cli.js remove <id>         # remove a todo
```

### Examples

```sh
$ node src/cli.js add "Buy milk"
3f1c9b2a-...
$ node src/cli.js list
[ ] 3f1c9b2a-... Buy milk
$ node src/cli.js done 3f1c9b2a-...
Done: 3f1c9b2a-...
$ node src/cli.js list
[x] 3f1c9b2a-... Buy milk
$ node src/cli.js remove 3f1c9b2a-...
Removed: 3f1c9b2a-...
$ node src/cli.js list
No todos yet.
```

Unknown commands, missing arguments, or an unknown `<id>` print an error to
stderr and exit with a non-zero code; the data file is left untouched.

## Data file

Todos are stored as JSON. The path defaults to `./todos.json` and can be
overridden with the `TODO_FILE` environment variable:

```sh
TODO_FILE=/tmp/my-todos.json node src/cli.js list
```

If the file does not exist or is empty, it is treated as an empty list (no
crash). `todos.json` is git-ignored and must not be committed.

## Tests

```sh
npm test
```

Runs the acceptance tests with Node's built-in test runner (`node --test`).
