# `media-query-solver`

![npm](https://img.shields.io/npm/v/media-query-solver)
![npm type definitions](https://img.shields.io/npm/types/media-query-solver)
![license](https://img.shields.io/npm/l/media-query-solver)
![npm downloads](https://img.shields.io/npm/dw/media-query-solver)
[![install size](https://packagephobia.com/badge?p=media-query-solver)](https://packagephobia.com/result?p=media-query-solver)

![](screen.gif)

Cool functions for media queries. [**Spec-compliant**](https://www.w3.org/TR/mediaqueries-5).

---

## Install

This package is available from the `npm` registry.

```sh
npm install media-query-solver
```

## Usage

Supports JavaScript + TypeScript:

```ts
import { compileQuery, matches, toEnglishString } from "media-query-solver";

// returns data that can be used to interpret the query
const maxWidthQuery = compileQuery(`(max-width: 1200px)`);
// (throws if invalid query syntax)

const testEnv = (widthPx = 1280, heightPx = 800) => ({
  widthPx,
  heightPx,
  deviceWidthPx: widthPx,
  deviceHeightPx: heightPx,
  dppx: 2,
});
console.log(matches(maxWidthQuery, testEnv(1280))); // false
console.log(matches(maxWidthQuery, testEnv(1000))); // true

const complexQuery = compileQuery(`screen and (monochrome) and (orientation)`);
console.log(matches(complexQuery, testEnv()));
// true

console.log(toEnglishString(maxWidthQuery));
// 'if width ≤ 1200px'
console.log(toEnglishString(complexQuery));
// 'if (is screen AND monochrome)'
// note: (orientation) without "landscape" or "portrait" is always true, so it's removed for brevity
```

Can also be imported via `require("media-query-solver")`.

## Contributing

- PRs welcome and accepted, simply fork and create
- Issues also very welcome
- Treat others with common courtesy and respect 🤝

Dev environment (for contributing) requires:

- node >= 16.14.0
- npm >= 6.8.0
- git >= 2.11

## Licence

MIT
