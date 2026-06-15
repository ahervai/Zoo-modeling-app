/**
 * AST modification helpers for `dim::` functions.
 *
 * `addDimDistance` generates three statements:
 *   1. `<leftVarName>XLengthLeftPlane  = offsetPlane(YZ, offset = <leftOffset>)`
 *   2. `<rightVarName>XLengthRightPlane = offsetPlane(YZ, offset = <rightOffset>)`
 *   3. `<name> = dim::distance(stationStart = ..., stationEnd = ..., direction = X, ...)`
 *
 * If `leftComponent` / `rightComponent` selections are supplied the variable
 * names of the selected bodies are used as the plane-name prefix; otherwise
 * `<name>Start` / `<name>End` are used as fallbacks.
 */

import type { Node } from '@rust/kcl-lib/bindings/Node'
import {
  createCallExpressionStdLibKw,
  createLabeledArg,
  createLiteral,
  createLocalName,
  createVariableDeclaration,
} from '@src/lang/create'
import { getVariableNameFromNodePath } from '@src/lang/queryAst'
import type { PathToNode, Program } from '@src/lang/wasm'
import type { ModuleType } from '@src/lib/wasm_lib_wrapper'
import type { Selections } from '@src/machines/modelingSharedTypes'

/** Safely extract the KCL variable name of the first selected artifact. */
function extractVarName(
  selections: Selections | undefined,
  ast: Node<Program>,
  wasmInstance: ModuleType
): string | undefined {
  const codeRef = selections?.graphSelections?.[0]?.codeRef
  if (!codeRef) return undefined
  return getVariableNameFromNodePath(codeRef.pathToNode, ast, wasmInstance)
}

/**
 * Inserts two YZ offset-plane declarations and a `dim::distance()` variable
 * into the AST.
 *
 * Direction, displayPlane and measurementPlane are fixed to X / XZ / XZ —
 * the dimension is always an X-direction length.
 *
 * When `leftComponent` / `rightComponent` selections are provided, the plane
 * variable names are derived from the selected body names so the generated
 * KCL is self-documenting:
 *
 * ```kcl
 * frame1XLengthLeftPlane  = offsetPlane(YZ, offset = 0mm)
 * frame2XLengthRightPlane = offsetPlane(YZ, offset = 120mm)
 * dimXLength = dim::distance(stationStart = frame1LeftStation, ...)
 * ```
 */
export function addDimDistance({
  ast,
  name,
  leftComponent,
  rightComponent,
  leftOffsetMm,
  rightOffsetMm,
  wasmInstance,
}: {
  ast: Node<Program>
  /** KCL variable name prefix for the generated planes */
  name: string
  /** Selected left body — used only for deriving a readable plane name */
  leftComponent?: Selections
  /** Selected right body — used only for deriving a readable plane name */
  rightComponent?: Selections
  /** X position in mm of the left station plane — auto-computed from bounding box when omitted */
  leftOffsetMm?: number
  /** X position in mm of the right station plane — auto-computed from bounding box when omitted */
  rightOffsetMm?: number
  wasmInstance: ModuleType
}): Error | { modifiedAst: Node<Program>; pathToNode: PathToNode } {
  if (!name.trim()) {
    return new Error('Variable name must not be empty')
  }

  const modifiedAst = structuredClone(ast)

  const startPlaneName = 'XLengthLeftPlane'
  const endPlaneName = 'XLengthRightPlane'

  // ── 1. Left station plane ─────────────────────────────────────────────────
  const leftOffsetExpr = createLiteral(leftOffsetMm ?? 0, wasmInstance, 'Mm')
  modifiedAst.body.push(
    createVariableDeclaration(
      startPlaneName,
      createCallExpressionStdLibKw('offsetPlane', createLocalName('YZ'), [
        createLabeledArg('offset', leftOffsetExpr),
      ])
    )
  )

  // ── 2. Right station plane ────────────────────────────────────────────────
  const rightOffsetExpr = createLiteral(
    rightOffsetMm ?? 100,
    wasmInstance,
    'Mm'
  )
  modifiedAst.body.push(
    createVariableDeclaration(
      endPlaneName,
      createCallExpressionStdLibKw('offsetPlane', createLocalName('YZ'), [
        createLabeledArg('offset', rightOffsetExpr),
      ])
    )
  )

  // Return path pointing at the last inserted statement (the right station plane)
  const pathToNode: PathToNode = [
    ['body', ''],
    [modifiedAst.body.length - 1, 'index'],
    ['declaration', 'VariableDeclaration'],
  ]

  return { modifiedAst, pathToNode }
}
