import { toAST, AST, MediaCondition, MediaFeature } from "media-query-parser";
import {
  Perm,
  MediaFeatures,
  permToConditionPairs,
  hasRangeNumberKey,
  hasRangeRatioKey,
  attachPair,
  andRanges,
  DISCRETE_FEATURES,
  isDiscreteKey,
  isRangeRatioKey,
  hasRangeKey,
  ConditionRange,
  hasDiscreteKey,
  notRatioRange,
  notNumberRange,
  ConditionPair,
  boundRange,
} from "./helpers";
import {
  CompiledUnitConversions,
  compileStaticUnitConversions,
  getRatio,
  getValue,
  simplifyMediaFeature,
  UnitConversions,
} from "./units";

export type SimplePerm = Partial<
  MediaFeatures & {
    "media-type": "screen" | "print" | "not-screen" | "not-print";
  }
>;

export type EvaluateResult = {
  simplePerms: SimplePerm[];
  invalidFeatures: string[];
  falseFeatures: string[];
};

export const andPerms = (as: Perm[], bs: Perm[]): Perm[] => {
  const newPerms: Perm[] = [];
  for (const a of as) {
    for (const b of bs) {
      const newPerm = mergePerms(a, b);
      if (Object.keys(newPerm).length > 0) {
        newPerms.push(newPerm);
      }
    }
  }
  return newPerms;
};

export const mergePerms = (a: Perm, b: Perm): Perm => {
  const merged: Perm = {};

  for (const p of permToConditionPairs(a)) {
    if (p[1] !== undefined) {
      attachPair(merged, p);
    }
  }

  for (const p of permToConditionPairs(b)) {
    if (p[0] in merged) {
      if (merged[p[0]] !== undefined) {
        // q is type safe from the above checks
        const q = merged as Required<Perm>;

        // in both, merge
        if (p[0] === "media-type") {
          // this function doesn't merge media-types
        } else if (p[0] === "invalid-features") {
          q[p[0]].push(...p[1]);
        } else if (q[p[0]] === "{false}" || p[1] === "{false}") {
          q[p[0]] = "{false}";
        } else if (q[p[0]] === "{true}") {
          attachPair(q, p);
        } else if (p[1] === "{true}") {
          // nothing, q[p[0]] doesn't change
        } else {
          // qq is type safe from the above checks
          const qq = merged as MediaFeatures;
          if (hasRangeNumberKey(p)) {
            attachPair(qq, [p[0], andRanges(qq[p[0]], p[1])]);
          } else if (hasRangeRatioKey(p)) {
            attachPair(qq, [p[0], andRanges(qq[p[0]], p[1])]);
          } else if (p[0] === "color-gamut") {
            qq[p[0]] = [
              qq[p[0]][0] && p[1][0],
              qq[p[0]][1] && p[1][1],
              qq[p[0]][2] && p[1][2],
              qq[p[0]][3] && p[1][3],
            ];
          } else if (p[0] === "any-hover" || p[0] === "hover") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else if (p[0] === "any-pointer" || p[0] === "pointer") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else if (p[0] === "grid") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else if (p[0] === "overflow-block") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else if (p[0] === "overflow-inline") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else if (p[0] === "scan") {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          } else {
            attachPair(qq, [p[0], qq[p[0]] === p[1] ? qq[p[0]] : "{false}"]);
          }
        }
      }
    } else {
      attachPair(merged, p);
    }
  }

  return merged;
};

export const notPerms = (conditionSets: Perm[]): Perm[] => {
  // !(a || b) = !a && !b
  return conditionSets
    .map((conditionSet) => invertPerm(conditionSet))
    .reduce((a: Perm[], b: Perm[]) => andPerms(a, b));
};

export const invertPerm = (set: Perm): Perm[] => {
  // !(a && b && c) = !a || !b || !c
  const pairs = permToConditionPairs(set);
  const combinations: [ConditionPair, ConditionPair[]][] = [];
  for (const p of pairs) {
    if (p[1] !== undefined) {
      let condition: ConditionPair;
      let notConditions: ConditionPair[];
      if (p[0] === "invalid-features") {
        return [{ [p[0]]: p[1] }];
      } else if (p[0] === "media-type") {
        continue;
      } else {
        condition = p;
        if (p[1] === "{false}") {
          notConditions = [[p[0], "{true}"]];
        } else if (p[1] === "{true}") {
          notConditions = [[p[0], "{false}"]];
        } else if (hasDiscreteKey(p)) {
          if (p[0] === "color-gamut") {
            const c = p[1];
            notConditions = [["color-gamut", [!c[0], !c[1], !c[2], !c[3]]]];
          } else if (p[0] === "grid") {
            notConditions = [["grid", p[1] === 0 ? 1 : 0]];
          } else {
            notConditions = Object.keys(DISCRETE_FEATURES[p[0]]).map(
              (value) => [p[0], value] as ConditionPair
            );
          }
        } else if (hasRangeRatioKey(p)) {
          const r = notRatioRange(p);
          const ranges = r === "{false}" ? (["{false}"] as const) : r;
          notConditions = ranges.map((range) => [p[0], range]);
        } else {
          const r = notNumberRange(p);
          const ranges = r === "{false}" ? (["{false}"] as const) : r;
          notConditions = ranges.map((range) => [p[0], range]);
        }
      }
      combinations.push([condition, notConditions]);
    }
  }

  const invertedPerms: Perm[] = [];
  for (let i = 0; i < combinations.length; i++) {
    for (const notCondition of combinations[i][1]) {
      const perm: Perm = {};
      attachPair(perm, notCondition);
      for (let j = 0; j < combinations.length; j++) {
        if (i !== j) {
          attachPair(perm, combinations[j][0]);
        }
      }
      invertedPerms.push(perm);
    }
  }
  return invertedPerms;
};

export const mediaFeatureToPerms = (
  mediaFeature: MediaFeature,
  unitConversions: CompiledUnitConversions
): Perm[] => {
  const feature = simplifyMediaFeature(mediaFeature, unitConversions);
  const INVALID = [{ "invalid-features": [mediaFeature.feature] }];

  if (feature.type === "invalid") {
    return INVALID;
  } else if (feature.type === "boolean") {
    if (feature.name === "color-gamut") {
      return [{ "color-gamut": [false, true, true, true] }];
    } else if (feature.name === "grid") {
      return [{ grid: 1 }];
    } else if (isDiscreteKey(feature.name)) {
      return invertPerm({ [feature.name]: "none" });
    } else if (isRangeRatioKey(feature.name)) {
      return [{ [feature.name]: [false, [0, 1], [Infinity, 1], true] }];
    } else {
      return [{ [feature.name]: [false, 0, Infinity, true] }];
    }
  } else if (isDiscreteKey(feature.name)) {
    if (feature.type === "equals") {
      const unit = feature.value;
      if (feature.name === "grid") {
        if (unit.type === "number" && (unit.value === 0 || unit.value === 1)) {
          return [{ grid: unit.value }];
        }
      } else if (
        unit.type === "ident" &&
        unit.value in DISCRETE_FEATURES[feature.name]
      ) {
        if (feature.name === "color-gamut") {
          const index = ["srgb", "p3", "rec2020"].indexOf(unit.value);
          if (index !== -1) {
            return [
              { "color-gamut": [false, index <= 0, index <= 1, index <= 2] },
            ];
          }
        } else {
          return [{ [feature.name]: unit.value }];
        }
      }
    }
    return INVALID;
  } else if (isRangeRatioKey(feature.name)) {
    let range: ConditionRange<readonly [number, number]> | null = null;

    if (feature.type === "equals") {
      const ratio = getRatio(feature.value);
      if (ratio !== null) {
        range = [true, ratio, ratio, true];
      }
    } else if (feature.type === "single") {
      const ratio = getRatio(feature.value);
      if (ratio !== null) {
        if (feature.op === "<") range = [true, [-Infinity, 1], ratio, false];
        else if (feature.op === "<=")
          range = [true, [-Infinity, 1], ratio, true];
        else if (feature.op === ">")
          range = [false, ratio, [Infinity, 1], true];
        else range = [true, ratio, [Infinity, 1], true];
      }
    } else if (feature.type === "double") {
      const minRatio = getRatio(feature.min);
      const maxRatio = getRatio(feature.max);
      if (minRatio !== null && maxRatio !== null) {
        range = [
          feature.minOp === "<=",
          minRatio,
          maxRatio,
          feature.maxOp === "<=",
        ];
      }
    }

    return range === null
      ? INVALID
      : [{ [feature.name]: boundRange([feature.name, range]) }];
  } else {
    let range: ConditionRange | null = null;

    if (feature.type === "equals") {
      const value = getValue(feature.value, feature.name);
      if (value !== null) range = [true, value, value, true];
    } else if (feature.type === "single") {
      const value = getValue(feature.value, feature.name);
      if (value !== null) {
        if (feature.op === "<") range = [true, -Infinity, value, false];
        else if (feature.op === "<=") range = [true, -Infinity, value, true];
        else if (feature.op === ">") range = [false, value, Infinity, true];
        else range = [true, value, Infinity, true];
      }
    } else if (feature.type === "double") {
      const minValue = getValue(feature.min, feature.name);
      const maxValue = getValue(feature.max, feature.name);
      if (minValue !== null && maxValue !== null) {
        range = [
          feature.minOp === "<=",
          minValue,
          maxValue,
          feature.maxOp === "<=",
        ];
      }
    }

    return range === null
      ? INVALID
      : [{ [feature.name]: boundRange([feature.name, range]) }];
  }
};

export const mediaConditionToPerms = (
  mediaCondition: MediaCondition,
  unitConversions: CompiledUnitConversions
): Perm[] => {
  const conditionSetsSets: Perm[][] = [];
  for (const child of mediaCondition.children) {
    if ("context" in child) {
      conditionSetsSets.push(mediaFeatureToPerms(child, unitConversions));
    } else {
      conditionSetsSets.push(mediaConditionToPerms(child, unitConversions));
    }
  }
  if (mediaCondition.operator === "or" || mediaCondition.operator === null) {
    return conditionSetsSets.flat();
  } else if (mediaCondition.operator === "and") {
    return conditionSetsSets.reduce((a, b) => andPerms(a, b));
  } else {
    // "not"
    return notPerms(conditionSetsSets[0]);
  }
};

export const simplifyPerms = (perms: Perm[]): EvaluateResult => {
  const simplePerms: SimplePerm[] = [];
  const invalidFeatures = new Set<string>();
  const falseFeatures = new Set<string>();

  for (const perm of perms) {
    let isUnmatchable = false;
    if (Array.isArray(perm["invalid-features"])) {
      if (perm["invalid-features"].length > 0) {
        for (const invalidFeature of perm["invalid-features"]) {
          invalidFeatures.add(invalidFeature);
        }
        isUnmatchable = true;
      }
    }

    const simplePerm: SimplePerm = {};
    for (const p of permToConditionPairs(perm)) {
      if (p[0] === "invalid-features") {
        continue;
      } else {
        if (p[0] === "color-gamut") {
          // because color-gamut value can be always true or always false
          // we should convert this to "{true}" or "{false}"
          // so it can be processed with the rest of the keys below
          const prev = p[1].toString();
          if (prev === "false,false,false,false") {
            p[1] = "{false}";
          } else if (prev === "true,true,true,true") {
            p[1] = "{true}";
          }
        } else if (hasRangeKey(p)) {
          p[1] = boundRange(p);
        }

        if (p[1] === "{false}") {
          falseFeatures.add(p[0]);
          isUnmatchable = true;
        } else if (p[1] === "{true}") {
          // skip. {true} is removed from output
        } else if (p[0] === "media-type" && p[1] === "all") {
          // skip. media-type: all is removed from output
        } else {
          attachPair(simplePerm, p);
        }
      }
    }

    if (!isUnmatchable) {
      simplePerms.push(simplePerm);
    }
  }

  return {
    simplePerms,
    invalidFeatures: [...invalidFeatures].sort(),
    falseFeatures: [...falseFeatures].sort(),
  };
};

export const compileAST = (
  ast: AST,
  units: Partial<UnitConversions> = {}
): EvaluateResult => {
  const unitConversions = compileStaticUnitConversions(units);
  const allConditions: Perm[] = [];

  for (const mediaQuery of ast) {
    const extraConditions: Perm[] = [];
    if (mediaQuery.mediaPrefix === "not") {
      if (mediaQuery.mediaType === "print") {
        extraConditions.push({
          "media-type": "not-print",
        });
      } else if (mediaQuery.mediaType === "screen") {
        extraConditions.push({
          "media-type": "not-screen",
        });
      }

      if (mediaQuery.mediaCondition !== null) {
        extraConditions.push(
          ...notPerms(
            mediaConditionToPerms(mediaQuery.mediaCondition, unitConversions)
          ).map((conditionSet) => {
            if (mediaQuery.mediaType === "all") {
              return conditionSet;
            } else {
              return {
                ...conditionSet,
                "media-type": mediaQuery.mediaType,
              };
            }
          })
        );
      }
    } else {
      if (mediaQuery.mediaCondition === null) {
        extraConditions.push({
          "media-type": mediaQuery.mediaType,
        });
      } else {
        extraConditions.push(
          ...mediaConditionToPerms(
            mediaQuery.mediaCondition,
            unitConversions
          ).map((conditionSet) => ({
            ...conditionSet,
            "media-type": mediaQuery.mediaType,
          }))
        );
      }
    }

    if (
      extraConditions.every(
        (condition) => (condition["invalid-features"] ?? []).length === 0
      )
    ) {
      allConditions.push(...extraConditions);
    }
  }

  return simplifyPerms(allConditions);
};

export const compileQuery = (
  query: string,
  units: Partial<UnitConversions> = {}
): EvaluateResult => {
  const ast = toAST(query);
  if (ast === null) {
    throw new Error("Query string was not lexed due to a syntax error");
  }
  return compileAST(ast, units);
};
