import { ParserError, QueryNode, isParserError, parseMediaQuery } from "media-query-parser";
import {
  Kleene3,
  SolverConfig,
  SolverConfigInput,
  and,
  createSolverConfig,
  not,
} from "./solveMediaQueryList.js";
import { solveMediaCondition_ } from "./solveMediaCondition.js";

export const solveMediaQuery = (
  mediaQuery: string | QueryNode | ParserError,
  configInput?: SolverConfigInput,
): Kleene3 => {
  const mq = typeof mediaQuery === "string" ? parseMediaQuery(mediaQuery) : mediaQuery;

  return isParserError(mq) ? "false" : solveMediaQuery_(mq, createSolverConfig(configInput));
};

export const solveMediaQuery_ = (mediaQuery: QueryNode, config: SolverConfig): Kleene3 => {
  if (config.isLegacyBrowser === "true" && mediaQuery.prefix === "only") {
    return "false";
  }

  let typeMatch: Kleene3;
  if (mediaQuery.type === undefined || mediaQuery.type === "all") typeMatch = "true";
  else if (mediaQuery.type === "screen") typeMatch = config.isMediaTypeScreen;
  else if (mediaQuery.type === "print") typeMatch = not(config.isMediaTypeScreen);
  else typeMatch = "false";

  const conditionMatch =
    mediaQuery.condition === undefined
      ? "true"
      : solveMediaCondition_(mediaQuery.condition, config);

  const typeAndConditionMatch = and(typeMatch, conditionMatch);

  return mediaQuery.prefix === "not" ? not(typeAndConditionMatch) : typeAndConditionMatch;
};
