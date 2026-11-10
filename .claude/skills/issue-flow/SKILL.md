---
name: issue-flow
description: Run the project's implement → validate loop for one issue or task, using the implementer and validator agents. Use when the user says "/issue-flow 3", "take issue #3 through the workflow", "fix and validate #N", or asks to implement a task end to end.
argument-hint: <issue number | issue URL | task description>
---

Orchestrate `docs/agent-workflow.md` for: $ARGUMENTS

**Spawning rules** (each one cost a past run turns or a restart):
- **Keep agent prompts short.** Give the issue number or task, the round information, and anything the user said. The agent definitions already contain the workflow, paths and commands, so don't restate them or override them (for example with another worktree path).
- **Never pass `isolation: "worktree"`.** It fails on this WSL repo. Implementers create their own worktree under `~/wtc-worktrees/<branch>`, so parallel implementers on different issues are safe without it.
- **New scope gets a new agent.** If the user asks for more than the issue covers after hand-off, file or extend an issue and start a fresh implementer. Don't resume the finished one: its whole history is re-read on every turn.
- Read issues with `bash ~/when-to-trim-calculator/scripts/agent/issue.sh N`. Plain `gh issue view` prints nothing here.

1. **Resolve the input.**
   - An issue number or URL: confirm the issue exists and is open (`issue.sh N`; the state is on the second line).
   - A free-text task: check whether it matches an open issue (`bash ~/when-to-trim-calculator/scripts/agent/search.sh <keywords>`).
     - If it matches an open issue, ask the user whether to use that issue.
     - If it does not, and the task is non-trivial, ask the user whether the `issue-writer` agent should file an issue first, or whether to proceed without one.
2. **Implement and validate.** Spawn the `implementer` agent with the issue number (or the task text). The implementer owns the validation loop: up to 3 rounds, a fresh `validator` each round, and fixes in between.
   - Validation reports stay between the implementer, the validator and you. Nobody posts them on the issue, and neither do you.
   - When restarting work after `status:changes-requested`, pass the implementer the open findings from the last validation report of the previous run (from this conversation, or ask the user for them).
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

   If the work was approved, offer to push the branch and open a PR against `main`. The user reviews and merges the PR on GitHub, and that merge deploys GitHub Pages.

   If it was still rejected after 3 rounds:
   - list the open findings and what the implementer tried;
   - ask the user how to proceed: another round, change the approach, or narrow the issue.

   Never merge into or push `main`, even if asked. Open a PR instead (see `CLAUDE.md`).
