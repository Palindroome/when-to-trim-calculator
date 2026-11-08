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
2. **Implement.** Spawn the `implementer` agent with the issue number (or the task text). Wait for its report and note the branch name.
3. **Validate.** Spawn the `validator` agent with the branch name and issue number. Give it only the branch name, the issue number and the task text. Do not pass the implementer's claims as facts.
4. **Changes requested.** Spawn the `implementer` again on the same branch, pointing it to the validator's findings. Then validate again.
   - Stop after **two** rejection rounds. Report the remaining findings to the user and ask how to proceed.
5. **Report to the user:**
   - the branch;
   - the commits;
   - the verdict;
   - the key evidence;
   - what is left for them: review the branch, then merge and push. Pushing to `main` deploys GitHub Pages.

   Do not merge or push yourself unless the user asks.
