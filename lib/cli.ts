#!/usr/bin/env node
/* eslint-disable unicorn/no-process-exit, no-console */
import { solveMediaQueryList } from "./solveMediaQueryList.js";

const hasCol = !process.env.NO_COLOR;

const cliFormat = (str: string, modifier: string): string => {
  return `${hasCol ? `\u001B[${modifier}m` : ""}${str}${hasCol ? "\u001B[0m" : ""}`;
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("usage:\n\nmedia-query-solver <media-query>");
  process.exit(1);
} else {
  console.log(cliFormat("solving this media query:", "36"));
  console.log("");
  console.log(cliFormat("@media ", "37") + args[0] + cliFormat(" { /* ... */ }", "37"));
  console.log("");
  const result = solveMediaQueryList(args[0]);
  console.log(`${cliFormat("=>", "37")} ${cliFormat(cliFormat(result, "1"), "33")}`);
  console.log("");
  if (result === "unknown") {
    console.log(cliFormat("some (but not all browsers) will match this media query", "33  "));
  } else if (result === "true") {
    console.log(
      cliFormat(
        "all browsers will match this media query\n\nit is equivalent to @media all {}",
        "33 ",
      ),
    );
  } else {
    console.log(
      cliFormat(
        "no browsers will match this media query\n\nit can safely be removed along with its contents",
        "33 ",
      ),
    );
  }
}
