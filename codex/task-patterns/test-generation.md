# Pattern: test generation

Generating tests is the highest ROI work you can give Codex. Tests are mechanical, the verification is built in (the test runner), and a single Codex task can produce hundreds of tests overnight.

## When to use this

- A codebase has under 50% coverage and you want to lift it
- A specific module is going into production and needs tighter coverage
- You just shipped a feature and want regression coverage before moving on
- You inherited code without tests and need a safety net before refactoring

## When NOT to use this

- You want tests for complex async or stateful flows (write those by hand)
- You are testing UI rendering (use Playwright or Cypress, generated tests are fragile)
- You want integration tests across services (these need too much context)

## The pattern

Generated tests are good at:
- Pure functions
- Data transformations
- Validators and parsers
- Simple class methods

Generated tests are bad at:
- Anything that requires understanding business logic
- Anything that touches a database
- Anything that depends on external services

Stick to what they are good at.

## Step 1: pick the target

Run a script to identify functions that:
- Are exported
- Have low or no test coverage
- Have simple input and output types

```bash
# Example: find all exported pure-looking functions in TypeScript
rg "^export (async )?function" --type ts --json \
  | jq -r '.data.path.text + ":" + (.data.line_number | tostring)' \
  > test-candidates.txt
```

Filter that list down to the ones worth testing. Code with no tests today is a goldmine. Code with sparse tests is a smaller goldmine. Code with thorough tests is not the target.

## Step 2: write the prompt template

Copy this template and adjust the test framework name as needed:

```
Generate <TEST_FRAMEWORK> tests for the function below.

CODE:
<paste function source>

REQUIREMENTS:
1. Write tests in the same language as the function
2. Cover:
   - Happy path with typical input
   - All branches in the function
   - Boundary conditions (empty, null, max value, min value)
   - One representative invalid input per validation rule
3. Use describe and it blocks (or the equivalent in the chosen framework)
4. Tests must be independent: any test runnable in isolation
5. Test names should describe behavior, not structure: "returns the sum of two positive integers" not "test addNumbers"
6. No mocks unless the function depends on a side effect

FORMAT:
- One file with all tests for this function
- File name: <function-file>.test.<ext>
- Place: same directory as the function

VERIFICATION (run before declaring done):
- The test file compiles
- All generated tests pass against the current implementation
- Test count is between 5 and 15

If the function cannot be tested without significant mocking, output:
"SKIP: <reason>"
```

## Step 3: spawn a task per function

For each candidate, spawn a Codex task. The task is small (one file in, one file out), fast, and self-verifying.

Pair this with the [parallel-refactor pattern](./parallel-refactor.md): batch 10 to 30 functions per task.

## Step 4: review what landed

Generated tests fail in predictable ways. Watch for:

| Failure | Why it happens | What to do |
|---|---|---|
| Test asserts the wrong shape | Function output is more complex than the prompt explained | Add a typed example to the prompt |
| Test passes against any implementation | Generated test only checks the function returns truthy | Tighten the prompt to require value assertions, not existence assertions |
| Test depends on external state | The function is not as pure as it looked | Mark the function for hand-written tests |
| Tests pass but coverage does not move | The function had already-tested branches; new tests duplicate | Acceptable, the new tests still pin behavior |

A 10 percent rejection rate is normal. Tests that survive review are real tests.

## Step 5: merge and run coverage

Merge the generated test PRs in any order. Tests do not interact with each other.

Run coverage. The numbers will jump. The shape of the coverage will tell you what to target next:
- Files still at 0%: candidates for another round
- Functions with branches still uncovered: handwrite the harder cases

## Property-based tests

For functions where you can describe the property the output should satisfy, ask for property-based tests. They catch more bugs per line than example-based tests:

```
Generate property-based tests using <fast-check / hypothesis / quickcheck> for the function below.

For each property:
- State the property in plain English first
- Then write the test
- Use 100 iterations as the default

PROPERTIES TO COVER:
- Return type invariant (the function always returns the declared type, no matter the input)
- Domain invariant (specific to the function, e.g. for sort: output is sorted, output has same length as input)
- Idempotency (if applicable, e.g. for normalize: applying twice equals applying once)
- Roundtrip (if applicable, e.g. for parse and format: parse(format(x)) == x)
```

Property tests catch bugs example tests miss. Use them everywhere you can.

## Anti-pattern: the snapshot test farm

Do not let Codex generate snapshot tests in bulk. They look like coverage but catch nothing. They will be accepted by reviewers who do not read snapshot diffs and will rot the test suite.

## Outputs

After this pattern:
- A clear coverage delta on the target modules
- Hand-reviewed tests that pin actual behavior
- A reduced list of harder functions that need handwritten tests
- A baseline you can defend against regressions in CI

---

Built by Mr Closer
