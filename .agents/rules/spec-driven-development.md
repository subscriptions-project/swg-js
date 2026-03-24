---
trigger: always_on
---

# CORE DIRECTIVE: SPEC-DRIVEN DEVELOPMENT

 * READ SPECS DURING PLANNING: Look in `/specs` for documents related to the change you are planning and take those into  consideration.
 * PRODUCE DELTA: Understand how your change will affect the current specs. If unspecified, add it to the spec.
 * NO SILENT DEVIATIONS: If the user request contradicts the existing spec, flag the contradiction in your plan and insist on clarification before proceeding.
 * FINAL CHECK: Verify that tests cover ths spec and are passing.
 * NOTE DIFFICULTIES: During planning and execution of the task, note where you struggled and if there are any updates to the specs in `/specs` or skills in `.agents/skills` which could have prevented these struggles.
 * KEEP IT TECHNICAL: Document state changes, input/output contracts, and architectural decisions.