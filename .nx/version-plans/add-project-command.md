---
__default__: minor
---

Add `hivefloor add-project NAME`, which makes a project public in one step: it updates the machine config for the folder and the `publicProjects` allowlist in `office.config.json` (or says exactly what to add on the relay), and can deploy with `--deploy`. It writes nothing when run again with the same arguments.
