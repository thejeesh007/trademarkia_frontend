type TokenType =
  | "number"
  | "operator"
  | "paren_open"
  | "paren_close"
  | "comma"
  | "colon"
  | "identifier"
  | "ref";

type Token = {
  type: TokenType;
  value: string;
};

type EvalState = "visiting" | "done";

const CELL_REF_REGEX = /^[A-Z]+[1-9]\d*$/;

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === " " || char === "\t" || char === "\n") {
      index += 1;
      continue;
    }

    if (char >= "0" && char <= "9") {
      let number = char;
      index += 1;
      while (index < expression.length) {
        const next = expression[index];
        if ((next >= "0" && next <= "9") || next === ".") {
          number += next;
          index += 1;
          continue;
        }
        break;
      }
      tokens.push({ type: "number", value: number });
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "paren_open", value: char });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "paren_close", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }

    if (char === ":") {
      tokens.push({ type: "colon", value: char });
      index += 1;
      continue;
    }

    if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
      let word = char.toUpperCase();
      index += 1;
      while (index < expression.length) {
        const next = expression[index];
        const isAlphaNum =
          (next >= "A" && next <= "Z") ||
          (next >= "a" && next <= "z") ||
          (next >= "0" && next <= "9");
        if (!isAlphaNum) {
          break;
        }
        word += next.toUpperCase();
        index += 1;
      }
      tokens.push({ type: CELL_REF_REGEX.test(word) ? "ref" : "identifier", value: word });
      continue;
    }

    throw new Error("Unsupported character in formula.");
  }

  return tokens;
}

function columnToIndex(label: string): number {
  let result = 0;
  for (let i = 0; i < label.length; i += 1) {
    result = result * 26 + (label.charCodeAt(i) - 64);
  }
  return result - 1;
}

function indexToColumn(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function parseCellRef(ref: string): { row: number; column: number } {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(ref);
  if (!match) {
    throw new Error("Invalid cell reference.");
  }
  return {
    column: columnToIndex(match[1]),
    row: Number(match[2]) - 1
  };
}

function expandRange(startRef: string, endRef: string): string[] {
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minColumn = Math.min(start.column, end.column);
  const maxColumn = Math.max(start.column, end.column);

  const refs: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      refs.push(`${indexToColumn(column)}${row + 1}`);
    }
  }
  return refs;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "#ERR";
  }
  const fixed = Number(value.toFixed(8));
  return Number.isInteger(fixed) ? String(fixed) : String(fixed);
}

function toNumber(value: string): number {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type FormulaParserContext = {
  tokens: Token[];
  position: number;
  resolveRef: (ref: string) => number;
};

function currentToken(context: FormulaParserContext): Token | undefined {
  return context.tokens[context.position];
}

function consume(context: FormulaParserContext): Token {
  const token = context.tokens[context.position];
  if (!token) {
    throw new Error("Unexpected end of expression.");
  }
  context.position += 1;
  return token;
}

function parseExpression(context: FormulaParserContext): number {
  let value = parseTerm(context);
  while (true) {
    const token = currentToken(context);
    if (!token || token.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
      break;
    }
    consume(context);
    const right = parseTerm(context);
    value = token.value === "+" ? value + right : value - right;
  }
  return value;
}

function parseTerm(context: FormulaParserContext): number {
  let value = parseUnary(context);
  while (true) {
    const token = currentToken(context);
    if (!token || token.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
      break;
    }
    consume(context);
    const right = parseUnary(context);
    value = token.value === "*" ? value * right : value / right;
  }
  return value;
}

function parseUnary(context: FormulaParserContext): number {
  const token = currentToken(context);
  if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
    consume(context);
    const next = parseUnary(context);
    return token.value === "-" ? -next : next;
  }
  return parsePrimary(context);
}

function parseFunction(context: FormulaParserContext, name: string): number {
  if (name !== "SUM") {
    throw new Error("Unsupported function.");
  }

  const openParen = consume(context);
  if (openParen.type !== "paren_open") {
    throw new Error("Expected opening parenthesis.");
  }

  let total = 0;
  let expectArgument = true;

  while (context.position < context.tokens.length) {
    const token = currentToken(context);
    if (!token) {
      throw new Error("Invalid function expression.");
    }

    if (token.type === "paren_close") {
      consume(context);
      return total;
    }

    if (!expectArgument && token.type === "comma") {
      consume(context);
      expectArgument = true;
      continue;
    }

    if (!expectArgument) {
      throw new Error("Expected comma between arguments.");
    }

    if (
      token.type === "ref" &&
      context.tokens[context.position + 1]?.type === "colon" &&
      context.tokens[context.position + 2]?.type === "ref"
    ) {
      const startRef = consume(context).value;
      consume(context);
      const endRef = consume(context).value;
      const refs = expandRange(startRef, endRef);
      total += refs.reduce((sum, ref) => sum + context.resolveRef(ref), 0);
      expectArgument = false;
      continue;
    }

    total += parseExpression(context);
    expectArgument = false;
  }

  throw new Error("Unclosed function call.");
}

function parsePrimary(context: FormulaParserContext): number {
  const token = currentToken(context);
  if (!token) {
    throw new Error("Unexpected end of expression.");
  }

  if (token.type === "number") {
    consume(context);
    return Number(token.value);
  }

  if (token.type === "ref") {
    consume(context);
    return context.resolveRef(token.value);
  }

  if (token.type === "identifier") {
    const fnName = consume(context).value;
    return parseFunction(context, fnName);
  }

  if (token.type === "paren_open") {
    consume(context);
    const value = parseExpression(context);
    const closing = consume(context);
    if (closing.type !== "paren_close") {
      throw new Error("Expected closing parenthesis.");
    }
    return value;
  }

  throw new Error("Invalid expression.");
}

function evaluateFormulaExpression(
  expression: string,
  resolveRef: (ref: string) => number
): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    return 0;
  }

  const context: FormulaParserContext = {
    tokens,
    position: 0,
    resolveRef
  };

  const result = parseExpression(context);
  if (context.position !== tokens.length) {
    throw new Error("Unexpected trailing tokens.");
  }

  return result;
}

export function computeDisplayValues(rawCells: Record<string, string>): Record<string, string> {
  const cache: Record<string, string> = {};
  const states: Record<string, EvalState> = {};

  function computeCell(ref: string): string {
    const normalizedRef = ref.toUpperCase();

    if (cache[normalizedRef] !== undefined) {
      return cache[normalizedRef];
    }

    const currentState = states[normalizedRef];
    if (currentState === "visiting") {
      cache[normalizedRef] = "#CYCLE";
      return cache[normalizedRef];
    }

    states[normalizedRef] = "visiting";
    const raw = rawCells[normalizedRef] ?? "";

    if (!raw.startsWith("=")) {
      cache[normalizedRef] = raw;
      states[normalizedRef] = "done";
      return cache[normalizedRef];
    }

    try {
      const result = evaluateFormulaExpression(raw.slice(1), (depRef) => toNumber(computeCell(depRef)));
      cache[normalizedRef] = formatNumber(result);
    } catch {
      cache[normalizedRef] = "#ERR";
    }

    states[normalizedRef] = "done";
    return cache[normalizedRef];
  }

  const display: Record<string, string> = {};
  Object.keys(rawCells).forEach((ref) => {
    display[ref] = computeCell(ref);
  });

  return display;
}
