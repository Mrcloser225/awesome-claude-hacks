# Technique: few-shot examples that actually work

Few-shot prompting is the technique of showing the model a handful of input-output examples before asking it to do a new instance. It is the single highest-ROI technique for tasks where the format or style matters.

The problem: most few-shot prompts in the wild are bad. They show too few examples, the wrong examples, or examples that confuse rather than clarify.

This guide is the rules.

## Rule 1: pick examples that are diverse, not redundant

If your task is "categorize a customer support email", do not show 5 examples that are all complaints about billing. Show 5 examples that span the categories you actually care about: billing, technical, feature request, refund, account access.

Diversity teaches the agent the boundaries between categories. Redundancy just teaches the model to expect more of the same.

```
Bad (5 redundant examples):
INPUT: "I was charged twice this month"
OUTPUT: billing

INPUT: "Why is my invoice wrong"
OUTPUT: billing

INPUT: "I need a refund for last month"
OUTPUT: billing

[etc]

Good (5 diverse examples):
INPUT: "I was charged twice this month"
OUTPUT: billing

INPUT: "The app crashes when I open settings"
OUTPUT: technical

INPUT: "Can you add dark mode"
OUTPUT: feature_request

INPUT: "I want my money back, this product is broken"
OUTPUT: refund

INPUT: "I cannot log in even after resetting password"
OUTPUT: account_access
```

## Rule 2: include the hard cases

Showing only easy cases makes the agent confident on easy cases and confused on hard cases. Include at least one example that is borderline. Show how you want the borderline resolved.

```
INPUT: "Can you give me a refund AND fix this bug"
OUTPUT: refund   # primary intent is the refund, the bug fix is secondary
```

The comment-style hint after the OUTPUT teaches the agent the rule for borderline cases.

## Rule 3: pick the right number

The right count depends on the task:

| Task | Examples |
|---|---|
| Classification with 3-5 classes | 5 to 10 (one per class plus some borderline) |
| Translation between two formats | 3 to 5 |
| Style imitation | 3 to 5 long examples |
| Complex extraction | 2 to 3 long examples with detailed structure |
| Code generation in a specific style | 2 to 4, complete and runnable |

Going past 10 examples rarely helps and often hurts. The agent starts pattern-matching on the example list rather than reasoning.

## Rule 4: separate the examples cleanly from the new input

The agent needs to know where the demonstrations end and the actual input begins. Use clear markers.

```
Below are example inputs and the desired outputs.

EXAMPLE 1:
<input>
...
</input>
<output>
...
</output>

EXAMPLE 2:
<input>
...
</input>
<output>
...
</output>

Now apply the same pattern to this new input:

<input>
[the actual user input goes here]
</input>
<output>
```

Leaving the final `<output>` tag open invites the model to fill in. Closing markers like `</input>` prevent the model from confusing the new input with another example.

## Rule 5: match the example format to the desired output format exactly

If you want JSON, your examples must contain valid JSON. If you want a specific schema, every example must follow it. Drift in your examples leads to drift in the output.

```
If your examples sometimes use single quotes and sometimes double quotes,
the model will alternate.
If your examples sometimes use snake_case keys and sometimes camelCase,
the model will alternate.
```

Treat your examples as the spec. Tighten them.

## Rule 6: order matters

Models pay more attention to the most recent examples. Two implications:

1. If you have one definitive example you really want the model to imitate, put it last.
2. If you have a borderline example, put it before easier examples. The easier examples can then "anchor" the agent's expected pattern.

This is fragile and varies between models. Test order changes if accuracy matters.

## Rule 7: use real examples, not synthetic ones

Synthetic examples have a tell. They are too clean, too perfectly aligned with the task, too consistent. A model trained on real-world text picks up on this.

Real examples include:
- Typos that you have to handle gracefully
- Unusual phrasings
- Inputs that are partially malformed
- Edge cases you would not have thought to invent

If you have real data, use it. If you have to fabricate, fabricate from real templates.

## Rule 8: combine few-shot with structure

Few-shot tells the agent the shape. CoT or structured output tells the agent the steps. Use both.

```
Below are examples. For each input, walk through the categorization in steps,
then output the final category.

EXAMPLE 1:
INPUT: "I was charged twice this month and the invoice is wrong"
THINKING:
- Two complaints in one message: billing twice, invoice incorrect
- Both are billing-related
- Primary frustration: financial impact
CATEGORY: billing

[etc]
```

This pattern is more verbose but dramatically more accurate on tricky cases.

## Anti-patterns

| Anti-pattern | What it does |
|---|---|
| Examples with errors in them | Teaches the agent to make those errors |
| Inconsistent formatting | Output will be inconsistent |
| All easy examples | Bad performance on hard cases |
| All hard examples | Bad performance on easy cases |
| No examples for one of your classes | The agent will rarely pick that class |
| Too many examples | Token cost up, quality flat or down |

## Self-test

Before deploying a few-shot prompt, run this check on your example set:

1. Cover every output class with at least one example
2. Include at least one borderline case
3. Use real (or realistic) inputs
4. Match the desired output format exactly
5. Mark clear boundaries between examples and new input
6. Test with 3 inputs you know the answer to. If the prompt fails any of them, revise.

A few-shot prompt that passes the self-test will outperform a zero-shot prompt by a large margin on the kind of task it is designed for.

---

Built by Mr Closer
