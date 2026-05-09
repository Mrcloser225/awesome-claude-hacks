# Technique: context engineering

Context engineering is the discipline of putting the right information in front of the model at the right time. As models get smarter, the bottleneck shifts from "how do I get the model to think harder" to "how do I make sure the model has what it needs to think well".

The rules below are the result of running thousands of sessions and watching what made the difference between a useful response and a wasted token budget.

## Rule 1: order matters

Recent context is heavier than old context. Models pay more attention to the most recent tokens. Two implications:

- The most important instruction goes last in the system prompt
- The most relevant code excerpts go last in the user prompt
- If you have a critical constraint, restate it just before the question

The exception is when you have role-defining text. The opening of a system prompt sets the agent's identity. Keep that at the top.

## Rule 2: trim aggressively

Every token of context is doing one of two things:
- Helping the agent answer the question
- Confusing the agent

There is no middle ground. Tokens that are not actively helpful are actively harmful.

Common things to trim:
- Boilerplate that does not change the answer (license headers, generated comments)
- Test files when the question is not about tests
- Configuration files when the question is about logic
- Old conversation history when the relevant facts have been incorporated into the current question

If you cannot decide whether a piece of context is helping, run with and without and compare.

## Rule 3: chunk by meaning, not by size

Splitting code at arbitrary line boundaries breaks reasoning. The model loses track of what is local and what is from elsewhere.

When sharing code:
- Share whole functions when discussing a function
- Share whole modules when discussing a module
- Include the import block so the model knows what is in scope
- Add file path comments so the model knows where each block lives

```
// File: src/auth/middleware.ts
import { ... } from "...";

export function authMiddleware(...) {
  ...
}

// File: src/auth/index.ts
import { authMiddleware } from "./middleware";

export const auth = ...
```

## Rule 4: state the goal, then the context, then the question

The order of information in a prompt should be:

1. **What we are doing** (one sentence)
2. **Why it matters** (one sentence)
3. **The relevant context** (code, data, history)
4. **The specific question** (the actionable ask)

If the question comes first, the agent reads the context already biased by the question. That is sometimes useful (more focused) and sometimes harmful (premature narrowing). For most engineering tasks, the order above performs better because the agent can read context with an open mind.

## Rule 5: explicit framing beats implicit framing

The difference between "rewrite this" and "rewrite this for clarity, keeping the same behavior, in the same file structure" is enormous. The second tells the agent what to optimize for, what to leave alone, and what shape the output should take.

A good framing answers:
- What changes? What stays?
- What format should the answer be in?
- How long should the answer be?
- What should the agent NOT do?

```
Rewrite the function below for clarity.

CHANGES ALLOWED:
- Variable names
- Statement order, when behavior is preserved
- Adding internal helpers
- Type annotations

NOT ALLOWED:
- Changing the function signature
- Adding new dependencies
- Changing the public surface

OUTPUT:
- The full new function, ready to paste over the old one
- A 2-line summary of what changed and why
```

## Rule 6: anchor with concrete examples

When asking for output in a specific shape or style, an example is worth a paragraph of description. See [few-shot-mastery.md](./few-shot-mastery.md) for the rules on examples.

## Rule 7: progressive disclosure for long sessions

In a long session, the agent's working set is everything it has seen since the start. That is not always what you want. To avoid being haunted by an early misunderstanding:

- Start a fresh session for unrelated tasks
- Mark transitions explicitly: "We are now switching to a different task. Forget the previous context except for X."
- For tasks with multiple phases, end each phase with an explicit summary the agent confirms before moving on

## Rule 8: use external memory deliberately

If your client supports it (Claude Code with CLAUDE.md, Cowork with skills, an MCP memory server), use external memory for:
- Facts about the project that hold across sessions
- House style and conventions
- Past decisions and their reasons

Do NOT use external memory for:
- Ephemeral task state
- Specific things to do in this session
- Conversation context

The distinction matters. External memory should be a slowly-changing source of truth, not a scratchpad.

## Rule 9: tools are context too

When you give the agent access to tools, the tool descriptions become part of its context. Bad tool descriptions confuse the agent the same way bad prose does.

- One sentence per tool, stating what it does
- Specific input requirements
- A note on when NOT to call the tool, if the agent tends to over-use it

## Rule 10: measure, do not guess

The single biggest leverage in context engineering is having a benchmark. A small set of inputs with known correct outputs lets you change the prompt and measure what helps.

Without a benchmark, you are vibing. With one, you are engineering.

Build the benchmark before you optimize the prompt.

## A worked example

Bad prompt:

> "Fix the bug in this code: <pastes 500 lines>"

Good prompt:

> "We have a bug where the checkout fails for users with international addresses. The bug surfaced after the v2.3 release.
>
> Below are the three files most likely involved:
> - <file 1>
> - <file 2>
> - <file 3>
>
> The error in production: 'PostalCode is invalid' for any non-US address.
>
> The expected behavior: international addresses should pass without a postal code requirement.
>
> Please:
> 1. Identify the line responsible
> 2. Explain why it fails for international addresses
> 3. Propose the smallest fix
> 4. Add a test that pins the behavior for international addresses
>
> Do NOT refactor the surrounding code. Do NOT change the validation library."

The difference is not length. It is structure: goal, context, specific request, explicit out-of-scope.

---

Built by Mr Closer
