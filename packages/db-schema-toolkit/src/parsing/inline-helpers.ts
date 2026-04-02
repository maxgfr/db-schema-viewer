import { extractBraceBlock } from "./extract-brace-block";

// ── Types ────────────────────────────────────────────────────────

interface FunctionHelper {
  paramName: string;
  /** Source text of the object body (between { and }) */
  returnBody: string;
}

interface Replacement {
  start: number;
  end: number;
  text: string;
}

// Dynamic AST nodes from the parser — flexible access is inherent to tree walking
type ASTNode = Record<string, any>;

// ══════════════════════════════════════════════════════════════════
//  Public API
// ══════════════════════════════════════════════════════════════════

/**
 * Inline helper functions that return object literals into their call sites.
 *
 * Uses the OXC parser (Rust/WASM) for AST-based analysis when available,
 * falling back to regex-based analysis otherwise.
 */
export function inlineHelperFunctions(content: string): string {
  try {
    return astInlineHelperFunctions(content);
  } catch {
    return regexInlineHelperFunctions(content);
  }
}

/**
 * Inline constant object literals into their spread sites.
 */
export function inlineObjectSpreads(content: string): string {
  try {
    return astInlineObjectSpreads(content);
  } catch {
    return regexInlineObjectSpreads(content);
  }
}

/**
 * Resolve class inheritance by prepending parent class body to child.
 * Returns a map of className → merged body text (parent + own).
 */
export function resolveClassInheritance(content: string): Map<string, string> {
  try {
    return astResolveClassInheritance(content);
  } catch {
    return regexResolveClassInheritance(content);
  }
}

// ══════════════════════════════════════════════════════════════════
//  AST-based implementation (OXC parser — Rust/WASM)
// ══════════════════════════════════════════════════════════════════

// Lazy-loaded OXC module
let oxc: { parseSync: (filename: string, source: string, options?: unknown) => { program: ASTNode; errors: unknown[] } } | null = null;
let oxcLoadFailed = false;

function getOxc() {
  if (oxc) return oxc;
  if (oxcLoadFailed) return null;
  try {
    // Use indirect require to avoid static analysis by bundlers (webpack/turbopack).
    // In Node.js: globalThis.process exists and we can dynamically create a require function.
    // In browser: this throws and we fall back to the regex-based implementation.
    if (typeof globalThis.process === "undefined") throw new Error("browser");
    const dynamicRequire = new Function("mod", "return require(mod)") as (mod: string) => typeof oxc;
    oxc = dynamicRequire("oxc-parser");
    return oxc;
  } catch {
    oxcLoadFailed = true;
    return null;
  }
}

function parseAST(content: string): ASTNode {
  const parser = getOxc();
  if (!parser) throw new Error("OXC parser not available");
  const result = parser.parseSync("schema.ts", content);
  if (result.errors && result.errors.length > 0) {
    throw new Error("Parse error");
  }
  return result.program;
}

// ── Generic AST walker ───────────────────────────────────────────

function walkAST(
  node: ASTNode,
  visitor: (node: ASTNode, parent: ASTNode | null) => void,
  parent: ASTNode | null = null,
): void {
  if (!node || typeof node !== "object" || !node.type) return;
  visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "type") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) {
          walkAST(item, visitor, node);
        }
      }
    } else if (child && typeof child === "object" && child.type) {
      walkAST(child, visitor, node);
    }
  }
}

// ── AST: Inline helper functions ─────────────────────────────────

function astInlineHelperFunctions(content: string): string {
  const ast = parseAST(content);
  const helpers = new Map<string, FunctionHelper>();

  // Collect function helpers from top-level statements
  for (const stmt of ast.body as ASTNode[]) {
    collectHelper(stmt, content, helpers);
  }

  if (helpers.size === 0) return content;

  // Find replacement sites
  const replacements: Replacement[] = [];

  walkAST(ast, (node, parent) => {
    // Pattern 1: ArrowFunction whose body is a CallExpression to a known helper
    // e.g., (d) => helperFunc(d)
    if (
      node.type === "ArrowFunctionExpression" &&
      node.body?.type === "CallExpression" &&
      node.body.callee?.type === "Identifier"
    ) {
      const funcName = node.body.callee.name as string;
      const helper = helpers.get(funcName);
      if (!helper) return;

      const callParam = node.params?.[0]?.name as string | undefined;
      if (!callParam) return;

      const body = renameParam(helper.returnBody, helper.paramName, callParam);
      // Replace the entire arrow function
      replacements.push({
        start: node.start as number,
        end: node.end as number,
        text: `(${callParam}) => ({ ${body} })`,
      });
    }

    // Pattern 2: SpreadElement whose argument is a CallExpression to a known helper
    // e.g., ...helperFunc(d) inside an object
    if (
      node.type === "SpreadElement" &&
      node.argument?.type === "CallExpression" &&
      node.argument.callee?.type === "Identifier" &&
      parent?.type === "ObjectExpression"
    ) {
      const funcName = node.argument.callee.name as string;
      const helper = helpers.get(funcName);
      if (!helper) return;

      const callArg = node.argument.arguments?.[0]?.name as string | undefined;
      if (!callArg) return;

      const body = renameParam(helper.returnBody, helper.paramName, callArg);
      replacements.push({
        start: node.start as number,
        end: node.end as number,
        text: body,
      });
    }
  });

  return applyReplacements(content, replacements);
}

function collectHelper(
  stmt: ASTNode,
  content: string,
  helpers: Map<string, FunctionHelper>,
): void {
  // Unwrap export: export function / export const
  let inner = stmt;
  if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
    inner = stmt.declaration;
  }

  // function helperName(param) { return { ... }; }
  if (inner.type === "FunctionDeclaration" && inner.id?.name) {
    const funcName = inner.id.name as string;
    const paramName = inner.params?.[0]?.name as string | undefined;
    if (!paramName) return;

    const returnObj = findReturnObject(inner.body);
    if (returnObj) {
      helpers.set(funcName, {
        paramName,
        returnBody: content.substring(
          (returnObj.start as number) + 1,
          (returnObj.end as number) - 1,
        ),
      });
    }
  }

  // const helperName = (param) => ({ ... })
  // const helperName = (param) => { return { ... }; }
  if (inner.type === "VariableDeclaration") {
    for (const decl of inner.declarations as ASTNode[]) {
      if (
        decl.type !== "VariableDeclarator" ||
        !decl.id?.name ||
        !decl.init
      )
        continue;

      const funcName = decl.id.name as string;
      const init = decl.init;

      if (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression")
        continue;

      const paramName = init.params?.[0]?.name as string | undefined;
      if (!paramName) return;

      // Arrow with direct object return: (d) => ({ ... })
      if (init.body?.type === "ObjectExpression") {
        helpers.set(funcName, {
          paramName,
          returnBody: content.substring(
            (init.body.start as number) + 1,
            (init.body.end as number) - 1,
          ),
        });
        continue;
      }

      // Arrow/function with block body: { return { ... }; }
      if (init.body?.type === "BlockStatement") {
        const returnObj = findReturnObject(init.body);
        if (returnObj) {
          helpers.set(funcName, {
            paramName,
            returnBody: content.substring(
              (returnObj.start as number) + 1,
              (returnObj.end as number) - 1,
            ),
          });
        }
      }
    }
  }
}

function findReturnObject(blockStmt: ASTNode): ASTNode | null {
  if (!blockStmt?.body) return null;
  for (const stmt of blockStmt.body as ASTNode[]) {
    if (
      stmt.type === "ReturnStatement" &&
      stmt.argument?.type === "ObjectExpression"
    ) {
      return stmt.argument;
    }
  }
  return null;
}

// ── AST: Inline object spreads ───────────────────────────────────

function astInlineObjectSpreads(content: string): string {
  const ast = parseAST(content);
  const constObjects = new Map<string, { start: number; end: number }>();

  // Collect const obj = { ... } declarations
  for (const stmt of ast.body as ASTNode[]) {
    let inner = stmt;
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      inner = stmt.declaration;
    }
    if (inner.type !== "VariableDeclaration" || inner.kind !== "const") continue;

    for (const decl of inner.declarations as ASTNode[]) {
      if (decl.init?.type === "ObjectExpression" && decl.id?.name) {
        // Skip objects containing functions (not simple data objects)
        const props = decl.init.properties as ASTNode[] | undefined;
        const hasFunction = props?.some(
          (p) =>
            p.value?.type === "FunctionExpression" ||
            p.value?.type === "ArrowFunctionExpression",
        );
        if (hasFunction) continue;

        constObjects.set(decl.id.name as string, {
          start: (decl.init.start as number) + 1,
          end: (decl.init.end as number) - 1,
        });
      }
    }
  }

  if (constObjects.size === 0) return content;

  const replacements: Replacement[] = [];

  walkAST(ast, (node) => {
    if (
      node.type === "SpreadElement" &&
      node.argument?.type === "Identifier"
    ) {
      const varName = node.argument.name as string;
      const objSpan = constObjects.get(varName);
      if (!objSpan) return;

      replacements.push({
        start: node.start as number,
        end: node.end as number,
        text: content.substring(objSpan.start, objSpan.end),
      });
    }
  });

  return applyReplacements(content, replacements);
}

// ── AST: Resolve class inheritance ───────────────────────────────

function astResolveClassInheritance(content: string): Map<string, string> {
  const ast = parseAST(content);
  const bodies = new Map<string, string>();

  for (const stmt of ast.body as ASTNode[]) {
    let inner = stmt;
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      inner = stmt.declaration;
    }
    if (inner.type !== "ClassDeclaration" || !inner.id?.name) continue;

    const className = inner.id.name as string;
    const parentName = inner.superClass?.name as string | undefined;

    // Body is the ClassBody node; extract text between its braces
    let bodyText = content.substring(
      (inner.body.start as number) + 1,
      (inner.body.end as number) - 1,
    );

    if (parentName) {
      const parentBody = bodies.get(parentName);
      if (parentBody) {
        bodyText = parentBody + "\n" + bodyText;
      }
    }

    bodies.set(className, bodyText);
  }

  return bodies;
}

// ── Shared utility ───────────────────────────────────────────────

function applyReplacements(content: string, replacements: Replacement[]): string {
  if (replacements.length === 0) return content;
  // Apply from end to start to preserve earlier offsets
  replacements.sort((a, b) => b.start - a.start);
  let result = content;
  for (const { start, end, text } of replacements) {
    result = result.substring(0, start) + text + result.substring(end);
  }
  return result;
}

function renameParam(body: string, oldParam: string, newParam: string): string {
  if (oldParam === newParam) return body;
  return body.replace(
    new RegExp(`\\b${escapeRegExp(oldParam)}(?=\\s*\\.)`, "g"),
    newParam,
  );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ══════════════════════════════════════════════════════════════════
//  Regex-based fallback (no external dependencies)
// ══════════════════════════════════════════════════════════════════

function regexInlineHelperFunctions(content: string): string {
  const helpers = regexExtractFunctionHelpers(content);
  if (helpers.size === 0) return content;

  for (const [funcName, helper] of helpers) {
    const directCallRegex = new RegExp(
      `\\(\\s*(\\w+)[^)]*\\)\\s*=>\\s*${escapeRegExp(funcName)}\\s*\\(\\s*\\w+\\s*\\)`,
      "g",
    );
    content = content.replace(directCallRegex, (_match, callParam: string) => {
      const body = renameParam(helper.returnBody, helper.paramName, callParam);
      return `(${callParam}) => ({ ${body} })`;
    });

    const spreadRegex = new RegExp(
      `\\.\\.\\.\\s*${escapeRegExp(funcName)}\\s*\\(\\s*(\\w+)\\s*\\)`,
      "g",
    );
    content = content.replace(spreadRegex, (_match, callArg: string) => {
      return renameParam(helper.returnBody, helper.paramName, callArg);
    });
  }

  return content;
}

function regexInlineObjectSpreads(content: string): string {
  const objects = regexExtractObjectConstants(content);
  if (objects.size === 0) return content;

  for (const [varName, body] of objects) {
    const spreadRegex = new RegExp(
      `\\.\\.\\.\\s*${escapeRegExp(varName)}(?!\\w)`,
      "g",
    );
    content = content.replace(spreadRegex, body);
  }

  return content;
}

function regexResolveClassInheritance(content: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const classRegex = /\bclass\s+(\w+)(?:\s+extends\s+(\w+))?/g;

  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1]!;
    const parentName = match[2];

    let braceStart = -1;
    for (let i = match.index + match[0].length; i < content.length; i++) {
      if (content[i] === "{") {
        braceStart = i;
        break;
      }
    }
    if (braceStart === -1) continue;

    let body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    if (parentName) {
      const parentBody = bodies.get(parentName);
      if (parentBody) {
        body = parentBody + "\n" + body;
      }
    }

    bodies.set(className, body);
  }

  return bodies;
}

// ── Regex: Extract function helpers ──────────────────────────────

function regexExtractFunctionHelpers(content: string): Map<string, FunctionHelper> {
  const helpers = new Map<string, FunctionHelper>();

  const funcDeclRegex = /\bfunction\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcDeclRegex.exec(content)) !== null) {
    regexProcessFuncCandidate(content, match[1]!, match.index + match[0].length, helpers);
  }

  const constExprRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:function\s*)?\(/g;
  while ((match = constExprRegex.exec(content)) !== null) {
    regexProcessFuncCandidate(content, match[1]!, match.index + match[0].length, helpers);
  }

  return helpers;
}

function regexProcessFuncCandidate(
  content: string,
  funcName: string,
  afterOpenParen: number,
  helpers: Map<string, FunctionHelper>,
): void {
  if (helpers.has(funcName)) return;

  const paramSlice = content.substring(afterOpenParen);
  const paramMatch = /^\s*(\w+)/.exec(paramSlice);
  if (!paramMatch) return;
  const paramName = paramMatch[1]!;

  let depth = 1;
  let pos = afterOpenParen;
  while (pos < content.length && depth > 0) {
    if (content[pos] === "(") depth++;
    else if (content[pos] === ")") depth--;
    pos++;
  }
  if (depth !== 0) return;

  const remaining = content.substring(pos);
  const arrowIdx = remaining.search(/=>/);
  const braceIdx = remaining.search(/\{/);

  if (arrowIdx !== -1 && (braceIdx === -1 || arrowIdx < braceIdx)) {
    const absoluteArrowPos = pos + arrowIdx + 2;
    const afterArrow = content.substring(absoluteArrowPos).trimStart();

    if (afterArrow.startsWith("(")) {
      const parenPos = content.indexOf("(", absoluteArrowPos);
      const innerBraceIdx = content.indexOf("{", parenPos);
      if (innerBraceIdx === -1) return;
      const returnBody = extractBraceBlock(content, innerBraceIdx);
      if (returnBody) helpers.set(funcName, { paramName, returnBody });
    } else if (afterArrow.startsWith("{")) {
      const funcBodyStart = content.indexOf("{", absoluteArrowPos);
      if (funcBodyStart === -1) return;
      regexExtractReturnObject(content, funcBodyStart, paramName, funcName, helpers);
    }
  } else if (braceIdx !== -1) {
    const funcBodyStart = pos + braceIdx;
    regexExtractReturnObject(content, funcBodyStart, paramName, funcName, helpers);
  }
}

function regexExtractReturnObject(
  content: string,
  funcBodyStart: number,
  paramName: string,
  funcName: string,
  helpers: Map<string, FunctionHelper>,
): void {
  const funcBody = extractBraceBlock(content, funcBodyStart);
  if (!funcBody) return;

  const returnMatch = /\breturn\s*\{/.exec(funcBody);
  if (!returnMatch) return;

  const braceRelativeIdx = returnMatch.index + returnMatch[0].length - 1;
  const absoluteReturnIdx = funcBodyStart + 1 + braceRelativeIdx;
  const returnBody = extractBraceBlock(content, absoluteReturnIdx);
  if (!returnBody) return;

  helpers.set(funcName, { paramName, returnBody });
}

function regexExtractObjectConstants(content: string): Map<string, string> {
  const objects = new Map<string, string>();
  const objRegex = /(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?\s*=\s*\{/g;

  let match;
  while ((match = objRegex.exec(content)) !== null) {
    const varName = match[1]!;
    const braceIdx = content.indexOf("{", match.index + match[0].length - 1);
    const body = extractBraceBlock(content, braceIdx);
    if (!body) continue;
    if (/\breturn\s/.test(body)) continue;
    objects.set(varName, body);
  }

  return objects;
}
