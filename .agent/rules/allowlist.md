---
trigger: always_on
---

---
description: Run build and validation tests
---
This workflow runs the build and test suite automatically.

// turbo-all
1. Run build
```bash
npm run build
```

2. Run tests
```bash
npm test
```
