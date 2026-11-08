---
__default__: patch
---

Fix `hivefloor init` after `npm install -g`: it registered `node hook` with no script, so the hook never ran and no robots appeared. Running `init` again replaces the broken entries, and `uninstall` now removes them.
