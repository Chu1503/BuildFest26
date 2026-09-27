# Commit messages

Website:
```
feat(web): add floor-based room search, source selection and cleaner accessible POV navigation
```

Android:
```
feat(android): add sensor-assisted 3D navigation with manual position and floor fallbacks
```

One commit for this complete update:
```
feat: add room catalog and sensor-assisted accessible navigation across web and Android
```

From the project root, review before committing:
```sh
git status
git diff
node scripts/test-routes.mjs
git add building-demo scripts traveler-app docs .gitignore
git commit -m "feat: add room catalog and sensor-assisted accessible navigation across web and Android"
```

Push your actual current branch when ready. No commit or push was performed automatically in this update.
