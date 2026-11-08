# 0005. One robot per Claude instance, with hot desks

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

What does a robot represent, and how does it get a place in the office? Options range from one robot per project to one per tool call.

## Decision drivers

- Visitors should be able to count how many agents are working.
- Subagents are a visible, interesting part of how Claude works.
- Every visitor must see the same robot in the same place.
- No stable identifiers may leave the machine.

## Considered options

1. One robot per Claude instance: each main session and each subagent, with desks assigned on arrival (hot desks).
2. One robot per project, with activity shown as animation only.
3. Fixed desks per session identity, kept across days.

## Decision outcome

Chosen option: **one robot per Claude instance with hot desks.** A main session is a full-size robot at a desk in its project's room; a subagent is a smaller robot at the room's team table. Robots are keyed by salted 6-character hashes (`sid`, and `sid:aid` for subagents). The Durable Object assigns desk and seat numbers through the shared `layout` function, so every visitor sees the same placement.

### Consequences

- Good: the office shows real parallelism; subagents walk in and out as they start and finish.
- Good: no long-lived identity, so robots can't be tracked across days (the salt is fixed per session, H7).
- Bad: a session that outlives midnight or wakes from sleep needs care (H7, H9).
- Bad: very busy offices need render caps (40 robots, "+N" signs) while the list view still shows everyone.

## More information

- PRD: CLI requirement C6, relay R3 and R5, elastic office rules E5–E8.
