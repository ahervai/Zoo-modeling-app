/**
 * CadifyDimensionModal
 *
 * 3-step wizard for creating a dynamic X-direction length dimension.
 *
 *  Step 1 � select left plane  (picks an existing XLengthLeftPlane variable)
 *  Step 2 � select right plane (picks an existing XLengthRightPlane variable)
 *  Step 3 � dimension options  (name, tolerance, fontSize, �)
 *
 * Run "X-length Edge Planes" first to create the planes, then use this wizard
 * to annotate the distance between them with gdt::distance.
 */

import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useMemo, useState } from 'react'
import { type InstanceProps, create } from 'react-modal-promise'

import { ActionButton } from '@src/components/ActionButton'
import { CustomIcon } from '@src/components/CustomIcon'
import type { KclManager } from '@src/lang/KclManager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DimensionOptions = {
  name: string
  tolerance: string
  fontSize: string
  precision: number
}

type CadifyDimensionModalResolve = boolean
type CadifyDimensionModalReject = boolean

type CadifyDimensionModalProps = InstanceProps<
  CadifyDimensionModalResolve,
  CadifyDimensionModalReject
> & {
  kclManager: KclManager
}

// ---------------------------------------------------------------------------
// KCL generation
// ---------------------------------------------------------------------------

function buildKcl(
  leftPlaneName: string,
  rightPlaneName: string,
  leftOffset: string,
  rightOffset: string,
  opts: DimensionOptions
): string {
  const barName = `${opts.name}Bar`
  const bottomTag = `${opts.name}Bottom`
  const endTag = `${opts.name}End`
  const edgeName = `${opts.name}DimEdge`

  const leftNum = parseFloat(leftOffset)
  const rightNum = parseFloat(rightOffset)
  const deltaNum =
    !isNaN(leftNum) && !isNaN(rightNum) ? rightNum - leftNum : undefined

  const span =
    deltaNum !== undefined
      ? `${deltaNum}mm`
      : `(${rightOffset}) - (${leftOffset})`

  return `
// -- Cadify X-length dimension ------------------------------------------------
${barName} = startSketchOn(XZ)
  |> startProfile(at = [${leftOffset}, 0mm])
  |> line(end = [${span}, 0mm], tag = $${bottomTag})
  |> line(end = [0mm, 1mm])
  |> close()
  |> extrude(length = 0.1mm, tagEnd = $${endTag})
${edgeName} = getCommonEdge(faces = [${bottomTag}, ${endTag}])
${opts.name} = gdt::distance(
  edges = [${edgeName}],
  tolerance = ${opts.tolerance},
  precision = ${opts.precision},
  fontSize = ${opts.fontSize},
  framePlane = XZ,
)
hide(${barName})
`
}

// ---------------------------------------------------------------------------
// Step header
// ---------------------------------------------------------------------------

function StepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number
  total: number
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex-none text-xs font-mono text-chalkboard-50">
          {step}/{total}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {subtitle && (
        <p className="text-xs text-chalkboard-60 dark:text-chalkboard-50 ml-7">
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AST helpers � scan for existing XLength planes
// ---------------------------------------------------------------------------

type XLengthPlane = { varName: string; offsetMm: number; raw: string }

/** Walk the AST body and collect XLengthLeftPlane / XLengthRightPlane variables. */
function findXLengthPlanes(ast: { body: unknown[] }): {
  left: XLengthPlane[]
  right: XLengthPlane[]
} {
  const left: XLengthPlane[] = []
  const right: XLengthPlane[] = []

  for (const node of ast.body) {
    const decl = node as any
    if (decl?.type !== 'VariableDeclaration') continue
    const varName: string = decl.declaration?.id?.name ?? ''
    if (!varName) continue

    const init = decl.declaration?.init as any
    if (init?.type !== 'CallExpressionKw') continue
    if (init?.callee?.name?.name !== 'offsetPlane') continue

    const offsetArg = (init.arguments ?? []).find(
      (a: any) => a?.label?.name === 'offset'
    )
    if (!offsetArg) continue

    // Resolve numeric value + raw text from a literal or a unary negation
    // e.g. 765mm → Literal, -265mm → UnaryExpression('-', Literal(265))
    function resolveOffset(
      node: any
    ): { offsetMm: number; raw: string } | null {
      if (node?.type === 'Literal') {
        const mm: number =
          typeof node.value === 'number'
            ? node.value
            : typeof node.value?.value === 'number'
              ? node.value.value
              : NaN
        if (isNaN(mm)) return null
        const r: string =
          typeof node.raw === 'string' && node.raw ? node.raw : `${mm}mm`
        return { offsetMm: mm, raw: r }
      }
      if (node?.type === 'UnaryExpression' && node.operator === '-') {
        const inner = resolveOffset(node.argument)
        if (!inner) return null
        return { offsetMm: -inner.offsetMm, raw: `-${inner.raw}` }
      }
      return null
    }
    const resolved = resolveOffset(offsetArg.arg)
    if (!resolved) continue
    const { offsetMm, raw } = resolved

    if (varName.endsWith('XLengthLeftPlane'))
      left.push({ varName, offsetMm, raw })
    else if (varName.endsWith('XLengthRightPlane'))
      right.push({ varName, offsetMm, raw })
  }

  return { left, right }
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 3

function CadifyDimensionModalInner({
  isOpen,
  onResolve,
  onReject,
  kclManager,
}: CadifyDimensionModalProps) {
  const [step, setStep] = useState(1)

  const planes = useMemo(
    () => findXLengthPlanes(kclManager.ast as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [leftPlaneName, setLeftPlaneName] = useState<string>(
    planes.left[0]?.varName ?? ''
  )
  const [rightPlaneName, setRightPlaneName] = useState<string>(
    planes.right[0]?.varName ?? ''
  )
  const [opts, setOpts] = useState<DimensionOptions>({
    name: 'dimXLength',
    tolerance: '1mm',
    fontSize: '10mm',
    precision: 0,
  })

  const leftPlane = planes.left.find((p) => p.varName === leftPlaneName)
  const rightPlane = planes.right.find((p) => p.varName === rightPlaneName)

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return leftPlaneName.length > 0
      case 2:
        return rightPlaneName.length > 0
      case 3:
        return opts.name.trim().length > 0
      default:
        return false
    }
  }, [step, leftPlaneName, rightPlaneName, opts])

  const handleInsert = () => {
    const leftOffset = leftPlane?.raw ?? '0mm'
    const rightOffset = rightPlane?.raw ?? '0mm'
    const snippet = buildKcl(
      leftPlaneName,
      rightPlaneName,
      leftOffset,
      rightOffset,
      opts
    )
    kclManager.updateCodeEditor((kclManager.code ?? '') + snippet)
    onResolve(true)
  }

  const PlaneSelectStep = ({
    side,
    planeName,
    planeList,
    onChange,
  }: {
    side: 'left' | 'right'
    planeName: string
    planeList: XLengthPlane[]
    onChange: (name: string) => void
  }) => {
    const stepNum = side === 'left' ? 1 : 2
    const label = side === 'left' ? 'Left plane' : 'Right plane'
    const hint =
      side === 'left'
        ? 'Select the XLengthLeftPlane that marks the left boundary of your dimension. Run "X-length Edge Planes" first if none appear.'
        : 'Select the XLengthRightPlane that marks the right boundary of your dimension.'
    const selected = planeList.find((p) => p.varName === planeName)

    return (
      <>
        <StepHeader
          step={stepNum}
          total={TOTAL_STEPS}
          title={label}
          subtitle={hint}
        />
        {planeList.length === 0 ? (
          <div className="rounded border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            No {label.toLowerCase()} found in the current file.
            <br />
            Use <strong>X-length Edge Planes</strong> to create them first.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`cadify-${side}-plane`}
              className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
            >
              {label}
            </label>
            <select
              id={`cadify-${side}-plane`}
              className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-chalkboard-10 dark:bg-chalkboard-90 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={planeName}
              onChange={(e) => onChange(e.target.value)}
              autoFocus
            >
              <option value="">� select a plane �</option>
              {planeList.map((p) => (
                <option key={p.varName} value={p.varName}>
                  {p.varName} ({p.raw})
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs font-mono text-chalkboard-50 mt-1">
                offsetPlane(YZ, offset = {selected.raw})
              </p>
            )}
          </div>
        )}
      </>
    )
  }

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <PlaneSelectStep
            side="left"
            planeName={leftPlaneName}
            planeList={planes.left}
            onChange={setLeftPlaneName}
          />
        )
      case 2:
        return (
          <PlaneSelectStep
            side="right"
            planeName={rightPlaneName}
            planeList={planes.right}
            onChange={setRightPlaneName}
          />
        )
      case 3:
        return (
          <>
            <StepHeader
              step={3}
              total={TOTAL_STEPS}
              title="Dimension options"
            />
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="cadify-dim-name"
                    className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
                  >
                    Variable name
                  </label>
                  <input
                    id="cadify-dim-name"
                    type="text"
                    className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    value={opts.name}
                    onChange={(e) =>
                      setOpts((o) => ({ ...o, name: e.target.value }))
                    }
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="cadify-dim-tolerance"
                    className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
                  >
                    Tolerance
                  </label>
                  <input
                    id="cadify-dim-tolerance"
                    type="text"
                    className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    value={opts.tolerance}
                    onChange={(e) =>
                      setOpts((o) => ({ ...o, tolerance: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="cadify-dim-fontsize"
                    className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
                  >
                    Font size
                  </label>
                  <input
                    id="cadify-dim-fontsize"
                    type="text"
                    className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    value={opts.fontSize}
                    onChange={(e) =>
                      setOpts((o) => ({ ...o, fontSize: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="cadify-dim-precision"
                    className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
                  >
                    Precision
                  </label>
                  <input
                    id="cadify-dim-precision"
                    type="number"
                    min={0}
                    max={6}
                    className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    value={opts.precision}
                    onChange={(e) =>
                      setOpts((o) => ({
                        ...o,
                        precision: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              {/* Live preview */}
              <div className="mt-1 rounded border border-chalkboard-20 dark:border-chalkboard-80 bg-chalkboard-20/40 dark:bg-chalkboard-80/40 p-3">
                <p className="text-xs font-medium text-chalkboard-60 dark:text-chalkboard-40 mb-1.5">
                  Preview
                </p>
                <pre className="text-xs font-mono text-chalkboard-80 dark:text-chalkboard-30 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {`${opts.name}Bar = startSketchOn(XZ)\n`}
                  {`  |> startProfile(at = [${leftPlane?.raw ?? '?'}, 0mm])\n`}
                  {`  |> line(end = [...], tag = $${opts.name}Bottom)\n`}
                  {`  |> ...\n`}
                  {`  |> extrude(length = 0.1mm, tagEnd = $${opts.name}End)\n`}
                  {`${opts.name}DimEdge = getCommonEdge(...)\n`}
                  {`${opts.name} = gdt::distance(\n`}
                  {`  edges = [${opts.name}DimEdge],\n`}
                  {`  tolerance = ${opts.tolerance},\n`}
                  {`  framePlane = XZ,\n`}
                  {`)\n`}
                  {`hide(${opts.name}Bar)`}
                </pre>
              </div>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-40"
        onClose={() => onReject(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-chalkboard-110/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto p-4 pt-[8vh]">
          <div className="flex min-h-full items-start justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-2"
            >
              <Dialog.Panel className="relative w-full max-w-lg rounded bg-chalkboard-10 dark:bg-chalkboard-100 border border-chalkboard-30 dark:border-chalkboard-70 shadow-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-chalkboard-30 dark:border-chalkboard-70">
                  <div className="flex items-center gap-2">
                    <CustomIcon name="dimension" className="w-5 h-5" />
                    <Dialog.Title className="text-base font-semibold">
                      Create X-Length Dimension
                    </Dialog.Title>
                  </div>
                  <ActionButton
                    Element="button"
                    onClick={() => onReject(false)}
                    iconStart={{ icon: 'close' }}
                    className="!p-1"
                  />
                </div>

                {/* Progress bar */}
                <div className="flex h-1">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 transition-colors ${i < step ? 'bg-primary' : 'bg-chalkboard-20 dark:bg-chalkboard-80'}`}
                    />
                  ))}
                </div>

                {/* Body */}
                <div className="px-4 py-5 overflow-y-auto max-h-[60vh]">
                  {stepContent()}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-4 py-3 border-t border-chalkboard-30 dark:border-chalkboard-70">
                  <ActionButton
                    Element="button"
                    onClick={() => {
                      if (step === 1) onReject(false)
                      else setStep((s) => s - 1)
                    }}
                  >
                    {step === 1 ? 'Cancel' : 'Back'}
                  </ActionButton>
                  {step < TOTAL_STEPS ? (
                    <ActionButton
                      Element="button"
                      disabled={!canProceed}
                      onClick={() => setStep((s) => s + 1)}
                      iconStart={{ icon: 'arrowRight' }}
                    >
                      Next
                    </ActionButton>
                  ) : (
                    <ActionButton
                      Element="button"
                      disabled={!canProceed}
                      onClick={handleInsert}
                      iconStart={{ icon: 'checkmark' }}
                    >
                      Insert dimension
                    </ActionButton>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export const showCadifyDimensionModal = create<
  CadifyDimensionModalProps,
  CadifyDimensionModalResolve,
  CadifyDimensionModalReject
>(CadifyDimensionModalInner)
