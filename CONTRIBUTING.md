# Contributing

Thanks for helping improve bd-phone-validator.

## Setup

```bash
npm install
npm run check      # lint + type check + tests
npm run build      # tsup: ESM, CJS and .d.ts into dist/
```

Node 18 or newer. The library has **zero runtime dependencies** and that is a hard
requirement; development dependencies are fine.

## Guidelines

- TypeScript is `strict`. Public functions need TSDoc comments with an `@example` where useful.
- Every behaviour change needs tests. Table style tests (`it.each`) are preferred for input/output pairs;
  invariants belong in `tests/properties.test.ts` (fast-check).
- Use only synthetic numbers in tests and docs. Do not commit real people's phone numbers.
- Update `CHANGELOG.md` for user-facing changes and keep `src/version.ts` equal to `package.json`
  (a test checks it).

## Numbering plan changes

Operator prefixes live in `src/operators.ts`, error messages in `src/messages.ts`.
Prefix ownership can change through number portability or regulator decisions; when adding
or changing a prefix please link the source in the pull request description.

## Release

`prepublishOnly` runs the checks and the build. `dist/` is not committed.
