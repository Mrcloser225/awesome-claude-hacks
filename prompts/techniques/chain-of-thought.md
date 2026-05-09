# Technique: chain-of-thought patterns for Claude

Chain-of-thought (CoT) is the simplest and most effective prompting technique for tasks that require reasoning. Done well, it transforms a 60% answer into a 95% answer. Done badly, it adds noise without adding accuracy.

## The basic pattern

```
Before answering, work through this in steps:
1. Restate the problem
2. List what is known
3. List what needs to be derived
4. Walk through the derivation
5. State the final answer
```

That works for a wide class of problems. The interesting variations are below.

## When CoT helps

- Math and logic problems
- Multi-step planning
- Code analysis where the answer depends on tracing execution
- Comparison tasks where the answer requires holding multiple things in mind

## When CoT does not help

- Pattern matching tasks (lookup, classification, simple translation)
- Tasks where the agent already gets the right answer in one shot
- Format-strict outputs where the steps would interfere with parseable output

If you are unsure, run a small benchmark with and without CoT and pick the winner.

## Variation 1: structured CoT

Better than unstructured "think step by step" for harder problems. Ask the agent to fill in named slots.

```
Solve the problem below. Use this template:

PROBLEM RESTATED: <one sentence>
KNOWN FACTS: <bulleted list>
GOAL: <one sentence>
APPROACH: <one paragraph>
DERIVATION:
  Step 1: <what>
  Step 2: <what>
  Step n: <what>
ANSWER: <final>
CONFIDENCE: <high / medium / low>
```

Models reason better when the structure is explicit. The named slots also make it easy to extract the final answer programmatically.

## Variation 2: hypothesize-test-revise

For problems with uncertainty.

```
Approach this in three rounds:

ROUND 1: hypothesize
- Without committing, list 3 possible answers
- For each, state what would have to be true for it to be correct

ROUND 2: test
- For each hypothesis, identify the test that would distinguish it from the
  others
- Run the test (in your head or against the data)
- Update beliefs

ROUND 3: revise
- State the surviving hypothesis as the answer
- State what new information would change the answer
```

This is the pattern the [bug-detective](../system-prompts/bug-detective.md) prompt uses internally.

## Variation 3: adversarial CoT

For tasks where the agent tends to be over-confident.

```
Solve the problem in two passes:

PASS 1: solve it
PASS 2: try to break your own answer

In pass 2, take the role of a critic. Find:
- The strongest argument against the answer
- An edge case that might invalidate it
- A different framing that suggests a different answer

If pass 2 produces a serious challenge, revise the answer. State both
versions and what changed.
```

This catches confident-but-wrong answers, which are the most damaging mode of failure.

## Variation 4: estimation CoT

For tasks where the user wants a number and the agent does not have direct data.

```
Estimate <quantity>. Use Fermi estimation:

1. Decompose: break the quantity into 3-5 multiplied factors
2. Bound each factor: state a low and high bound
3. Multiply lows for the lower bound, highs for the upper bound
4. Pick a midpoint
5. State the answer with the range

Be explicit about which factors are guesses vs. known.
```

The output is more useful than a single guess, because the user can challenge any individual factor.

## Variation 5: self-consistency

Run the same prompt multiple times with slight variation. The most common answer wins.

This is more expensive but more reliable. Use when the cost of a wrong answer is high.

```
Solve the problem 3 times with these different framings:
- A: from the perspective of <expert A>
- B: from the perspective of <expert B>
- C: starting from the conclusion and working backwards

Compare the three. If they agree, state the answer with high confidence. If
they disagree, identify what each got right and synthesize.
```

## Anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| "Think carefully" with no structure | Adds words, not accuracy |
| Asking for steps after the answer | Steps become rationalization, not reasoning |
| Long open-ended scratchpads | Token bloat, no anchoring |
| CoT on classification tasks | Can flip a correct answer to wrong |

## Combining with tool use

CoT pairs well with tool use when the agent has access to tools. The pattern:

```
You have these tools available: <list>

For each step in your reasoning:
1. State what you need to know
2. If a tool can answer it, call the tool
3. Otherwise reason from what you have
4. Continue to the next step

Do not call a tool when you can derive the answer. Do not derive when a
tool would be more accurate.
```

The "do not derive when a tool would be more accurate" line catches the common failure where the agent invents data instead of looking it up.

---

Built by Mr Closer
