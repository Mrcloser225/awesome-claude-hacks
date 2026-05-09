# Test Fortress: build comprehensive test coverage

This workflow takes a codebase with bad coverage and turns it into one with confident coverage. It avoids the two failure modes that kill most coverage initiatives: writing tests that pass without testing anything, and writing so many tests that the suite becomes a tax.

## When to use this

- You inherited a codebase with under 40 percent coverage
- A recent outage exposed an untested path
- You are about to refactor and the existing tests do not give you confidence
- Tests are slow, flaky, or duplicate each other

## The fortress philosophy

A fortress has layers. Each layer catches what the inner layer let through. Tests should work the same way.

```
   Outer layer:  end-to-end smoke tests   (5 to 10 tests, slow, real)
   Middle layer: integration tests        (50 to 200 tests, medium, real-ish)
   Inner layer:  unit tests               (hundreds, fast, isolated)
```

Coverage is a byproduct of having the right tests at the right layer, not a goal you chase directly. A 95 percent unit-tested codebase with no integration tests is still fragile.

## Phase 1: Audit what you have

Tell Claude:

```
I want a test fortress audit of this codebase.

Output a markdown report with these sections:

1. Test inventory: a table of every test file, its layer (unit, integration, e2e), what it covers, and approximate runtime

2. Coverage map: for each top-level module, what percentage of lines, branches, and exported functions have tests

3. Layer balance: count of tests at each layer, with the ratio between them

4. Duplication: tests that test the same behavior at multiple layers

5. Holes: critical paths that have zero tests at any layer

6. Fragility: tests that look like they would break on any reasonable refactor

7. Recommendations: ranked by impact, not by ease

Do not propose changes yet.
```

Read the report. The "holes" section is your work list.

## Phase 2: Plug the holes from the outside in

The mistake most people make is starting with unit tests because they feel safe. Start with the outer layer first. End-to-end tests prove the system actually works. They are also the easiest place to spot a hole that nobody noticed.

### Outer layer: 5 to 10 e2e smoke tests

For each critical user journey, write one test that:
- Spins up the real app (or hits a deployed staging URL)
- Walks through the journey using something close to a real user (Playwright, real HTTP, etc.)
- Asserts on the user-visible outcome, not internal state

Tell Claude:

```
List the 10 most critical user journeys this app supports.
For each, write a single end-to-end test.

Constraints:
- Real backend, real frontend, real network
- The test should fail loud if the journey is broken
- Each test runs in under 30 seconds
- The whole suite runs in under 5 minutes

Save them in tests/e2e/ and add a script "test:e2e" that runs only these.
```

These tests are your fire alarm. If they go red, something user-facing is broken right now.

### Middle layer: integration tests for boundaries

The middle layer tests the seams between modules. Pick boundaries first: API to database, service to service, frontend to API.

```
Identify every integration boundary in the codebase:
- HTTP routes that talk to a database
- Services that call other services
- Background jobs that interact with state
- Frontend components that call APIs

For each boundary, write integration tests that:
- Use real implementations on both sides (test database, real HTTP)
- Cover the happy path, one error path, and one edge case per boundary
- Run in under 1 second each

Save them in tests/integration/.
```

### Inner layer: unit tests for the smart code

Unit tests should target the code with logic, not the code that wires things up. The rule of thumb: if a function is over 5 lines and has any conditional, it deserves a unit test. Pure data transformations and formatters are top priority.

```
List every function with cyclomatic complexity above 3 in the codebase.
For each, write unit tests that:
- Cover every branch
- Use no mocks unless absolutely necessary
- Run in under 50ms each

Save them in tests/unit/ alongside the implementation files.
```

## Phase 3: Anti-fragile patterns

Most tests break for the wrong reasons. Apply these patterns to make tests robust to refactors but strict about behavior.

### Test behavior, not structure

Bad: `expect(component).toHaveClass('btn-primary')`
Good: `expect(getByRole('button', { name: 'Submit' })).toBeVisible()`

The bad version breaks when you rename the class. The good version only breaks when the user-visible behavior changes.

### Pin the public surface, leave the private surface free

If a function is exported, write tests for it. If it is private, do not test it directly. Test it through the public function that calls it.

### Generate inputs, do not invent them

For pure functions, use property-based testing where you can. Even one property test often catches more bugs than ten hand-written examples.

```javascript
test.prop([fc.array(fc.integer())])('sort produces ascending output', (input) => {
  const result = sort(input);
  for (let i = 1; i < result.length; i++) {
    expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
  }
});
```

### Snapshots are a tax, not an asset

Snapshot tests catch nothing on purpose. They catch any change. Most teams accept any snapshot diff without reading it. Use them for output you visually inspect (rendered HTML, schema files), never for data structures.

## Phase 4: Speed

A slow test suite is a tax on every commit. The team will skip it, the CI will batch it, and bugs will land between batches. Speed is not a luxury.

Tell Claude:

```
Profile the test suite:
1. Run all tests with timing
2. List the 20 slowest tests
3. For each, identify why it is slow (real network, unnecessary setup, large fixture, etc.)
4. Propose a speed-up for each
5. Apply the easy ones, mark the hard ones as TODO

Target: 95th percentile test under 100ms, full unit suite under 30 seconds.
```

Common speed wins:
- Replace real network calls with deterministic test doubles at the boundary
- Share expensive setup across tests in a module
- Run independent tests in parallel
- Remove tests that duplicate other tests

## Phase 5: Wire it into the loop

The last phase makes the fortress self-maintaining.

```yaml
# CI pipeline shape
- on every PR:
    - lint
    - typecheck
    - unit tests (under 30 seconds)
    - integration tests (under 2 minutes)
- on merge to main:
    - everything above
    - e2e tests (under 5 minutes)
- on a schedule:
    - all of the above plus property-based tests with high iteration counts
```

Add a coverage gate, but pick a number based on the audit, not 100 percent. A reasonable starting bar is "do not regress current coverage". Better to slowly improve than to write fake tests to hit a target.

## Maintaining the fortress

A fortress that stops being maintained is a ruin. Add a monthly task:

```
Re-run the audit from phase 1.
Compare to the previous month.
Flag:
- Any test added that does not fit a layer
- Any test that became slow
- Any test that has become flaky (look at CI history)
- Any new module that landed without tests

Output a punch list of cleanup tasks for this month.
```

A test suite is a living document of what the team believes the system should do. Treat it that way.

---

Built by Mr Closer
