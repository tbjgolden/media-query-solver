import { FeatureNode } from "media-query-parser";
import { getPackageJson, checkDirectory, isFile } from "./lib/utils.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

checkDirectory();

const packageJson = await getPackageJson();

{
  console.log("validating api (esm)...");
  let entrypoint: string | undefined;
  if (typeof packageJson.exports === "object") {
    const esmEntry = packageJson.exports.import;
    if (esmEntry) {
      if (esmEntry.startsWith("./")) {
        entrypoint = esmEntry.slice(2);
      } else {
        console.log("package.json exports must start with './'");
        process.exit(1);
      }
    } else {
      console.log("package.json exports field must have an import field");
      process.exit(1);
    }
  } else if (packageJson.main) {
    // node doesn't support the "modules" field
    entrypoint = packageJson.main;
  } else {
    console.log("package.json exports field or main field must be specified");
    process.exit(1);
  }
  if (!(await isFile(entrypoint))) {
    console.log(`entrypoint file "${entrypoint}" doesn't exist`);
    process.exit(1);
  }
  const { solveMediaQueryList } = await import(process.cwd() + "/" + entrypoint);
  const result = JSON.stringify(
    solveMediaQueryList("not all, ((width > 100px) or (monochrome))", {
      solveUnknownFeature: (featureNode: FeatureNode) => {
        if (featureNode.context === "boolean" && featureNode.feature === "monochrome") {
          return "true";
        }
        return "unknown";
      },
    }),
  );
  const expected = JSON.stringify("true");
  if (result !== expected) {
    console.log("expected:");
    console.log(expected);
    console.log("actual:");
    console.log(result);
    process.exit(1);
  }
}

{
  console.log("validating api (cjs)...");
  let entrypoint: string | undefined;
  if (typeof packageJson.exports === "object") {
    const cjsEntry = packageJson.exports.require;
    if (cjsEntry) {
      if (cjsEntry.startsWith("./")) {
        entrypoint = cjsEntry.slice(2);
      } else {
        console.log("package.json exports must start with './'");
        process.exit(1);
      }
    } else {
      console.log("package.json exports field must have an require field");
      process.exit(1);
    }
  } else if (packageJson.main) {
    // node doesn't support the "modules" field
    entrypoint = packageJson.main;
  } else {
    console.log("package.json exports field or main field must be specified");
    process.exit(1);
  }
  if (!(await isFile(entrypoint))) {
    console.log(`entrypoint file "${entrypoint}" doesn't exist`);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires, unicorn/prefer-module
  const { solveMediaFeature } = require(process.cwd() + "/" + entrypoint);
  const result = JSON.stringify(solveMediaFeature("(-1px > width)"));
  const expected = JSON.stringify("false");
  if (result !== expected) {
    console.log("expected:");
    console.log(expected);
    console.log("actual:");
    console.log(result);
    process.exit(1);
  }
}

{
  console.log("validating cli...");
  const entrypoint = packageJson.bin?.["media-query-solver"];
  if (entrypoint) {
    const { execSync } = require("child_process");
    const result = execSync(
      `NO_COLOR=1 node ${entrypoint} 'not all, ((width > 100px) or (monochrome))'`,
    ).toString();
    const expected = `solving this media query:\n\n@media not all, ((width > 100px) or (monochrome)) { /* ... */ }\n\n=> unknown\n\nsome (but not all browsers) will match this media query\n`;
    if (result !== expected) {
      console.log("expected:");
      console.log(expected);
      console.log("actual:");
      console.log(result);
      process.exit(1);
    }
  } else {
    console.log("package.json must have a bin field");
    process.exit(1);
  }
}
