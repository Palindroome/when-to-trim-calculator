---
name: issue-flow
description: Run the project's implement → validate loop for one issue or task, using the implementer and validator agents. Use when the user says "/issue-flow 3", "take issue #3 through the workflow", "fix and validate #N", or asks to implement a task end to end.
argument-hint: <issue number | issue URL | task description>
---

Orchestrate `docs/agent-workflow.md` for: $ARGUMENTS

1. **Resolve the input.**
   - An issue number or URL: confirm the issue exists and is open (`gh issue view N -R Palindroome/when-to-trim-calculator`).
   - A free-text task: check whether it matches an open issue (`gh issue list --search`).
     - If it matches an open issue, ask the user whether to use that issue.
     - If it does not, and the task is non-trivial, ask the user whether the `issue-writer` agent should file an issue first, or whether to proceed without one.
2. **Implement and validate.** Spawn the `implementer` agent with the issue number (or the task text). The implementer owns the validation loop: up to 3 rounds, a fresh `validator` each round, and fixes in between.
3. **Relay validation if needed.** Subagents usually cannot spawn agents themselves. If the implementer returns `READY FOR VALIDATION`:
   - spawn a fresh `validator` with exactly what the implementer passed: the branch, the issue or task, "round k of 3", and the previous report if there is one;
   - resume the same implementer (SendMessage to its id) with the validator's report, unchanged;
   - repeat until the implementer returns a final verdict.

   Never count rounds yourself in a way that resets the limit. The cap is 3 validator runs per invocation.
4. **Report to the user:**
   - the branch;
   - the commits;
   - the verdict and the number of rounds used;
   - the key evidence.

   If the work was approved, what is left for the user is to review the branch, then merge and push it. Pushing to `main` deploys GitHub Pages.

   If it was still rejected after 3 rounds:
   - list the open findings and what the implementer tried;
   - ask the user how to proceed: another round, change the approach, or narrow the issue.

   Do not merge or push yourself unless the user asks.
