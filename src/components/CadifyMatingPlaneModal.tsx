/**
 * CadifyMatingPlaneModal
 *
 * 2-step wizard for labelling a mating surface with a gdt::annotation.
 *
 *  Step 1 – select face  (picks a tagged face from the KCL file)
 *  Step 2 – name it      (descriptive annotation label)
 *
 * Generated KCL example (face = "endEyeFace", label = "Piston Rod Mate"):
 *
 *   gdt::annotation(
 *     annotation = "Piston Rod Mate",
 *     faces = [endEyeFace],
 *   )
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

type CadifyMatingPlaneModalResolve = boolean
type CadifyMatingPlaneModalReject = boolean

type CadifyMatingPlaneModalProps = InstanceProps<
  CadifyMatingPlaneModalResolve,
  CadifyMatingPlaneModalReject
> & {
  kclManager: KclManager
}

// ---------------------------------------------------------------------------
// AST helpers – collect all face tag names
// ---------------------------------------------------------------------------

/** Walk the AST recursively and collect every TagDeclarator value. */
function collectFaceTags(node: any): string[] {
  const tags: string[] = []
  function walk(n: any) {
    if (!n || typeof n !== 'object') return
    if (n.type === 'TagDeclarator' && typeof n.value === 'string') {
      tags.push(n.value)
      return
    }
    for (const key of Object.keys(n)) {
      // skip numeric source-span properties to avoid infinite loops
      if (key === 'start' || key === 'end') continue
      const val = n[key]
      if (Array.isArray(val)) val.forEach(walk)
      else if (val && typeof val === 'object') walk(val)
    }
  }
  walk(node)
  return [...new Set(tags)]
}

// ---------------------------------------------------------------------------
// KCL generation
// ---------------------------------------------------------------------------

function buildKcl(faceTag: string, label: string): string {
  return `
// -- Cadify mating plane -------------------------------------------------------
gdt::annotation(
  annotation = ${JSON.stringify(label)},
  faces = [${faceTag}],
)
`
}

// ---------------------------------------------------------------------------
// Step header (same style as CadifyDimensionModal)
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
// Main modal
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 2

function CadifyMatingPlaneModalInner({
  isOpen,
  onResolve,
  onReject,
  kclManager,
}: CadifyMatingPlaneModalProps) {
  const [step, setStep] = useState(1)

  const faceTags = useMemo(
    () => collectFaceTags(kclManager.ast as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [faceTag, setFaceTag] = useState<string>(faceTags[0] ?? '')
  const [label, setLabel] = useState('')

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return faceTag.trim().length > 0
      case 2:
        return label.trim().length > 0
      default:
        return false
    }
  }, [step, faceTag, label])

  const handleInsert = () => {
    const snippet = buildKcl(faceTag.trim(), label.trim())
    kclManager.updateCodeEditor((kclManager.code ?? '') + snippet)
    onResolve(true)
  }

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <StepHeader
              step={1}
              total={TOTAL_STEPS}
              title="Select face"
              subtitle="Choose the tagged face that represents the mating surface. Make sure the model is built so face tags are available."
            />
            {faceTags.length === 0 ? (
              <div className="rounded border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                No tagged faces found in the current file.
                <br />
                Add a <code className="font-mono">tagEnd</code> or{' '}
                <code className="font-mono">tag</code> to an extrude or sketch
                to create face tags.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="cadify-mating-face"
                  className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
                >
                  Face tag
                </label>
                <select
                  id="cadify-mating-face"
                  className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-chalkboard-10 dark:bg-chalkboard-90 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={faceTag}
                  onChange={(e) => setFaceTag(e.target.value)}
                  autoFocus
                >
                  <option value="">— select a face —</option>
                  {faceTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )
      case 2:
        return (
          <>
            <StepHeader
              step={2}
              total={TOTAL_STEPS}
              title="Name the mating surface"
              subtitle="Give a descriptive name for this mating surface. It will appear as the annotation label in the 3D scene."
            />
            <div className="flex flex-col gap-2">
              <label
                htmlFor="cadify-mating-label"
                className="text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40"
              >
                Annotation label
              </label>
              <input
                id="cadify-mating-label"
                type="text"
                className="rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder='e.g. "Piston Rod Mate"'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canProceed) handleInsert()
                }}
              />
              {/* Live preview */}
              {faceTag && label && (
                <div className="mt-2 rounded border border-chalkboard-20 dark:border-chalkboard-80 bg-chalkboard-20/40 dark:bg-chalkboard-80/40 p-3">
                  <p className="text-xs font-medium text-chalkboard-60 dark:text-chalkboard-40 mb-1.5">
                    Preview
                  </p>
                  <pre className="text-xs font-mono text-chalkboard-80 dark:text-chalkboard-30 whitespace-pre-wrap leading-relaxed">
                    {`gdt::annotation(\n  annotation = ${JSON.stringify(label)},\n  faces = [${faceTag}],\n)`}
                  </pre>
                </div>
              )}
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
                    <CustomIcon name="plane" className="w-5 h-5" />
                    <Dialog.Title className="text-base font-semibold">
                      Select Mating Plane
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
                      Insert annotation
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

export const showCadifyMatingPlaneModal = create<
  CadifyMatingPlaneModalProps,
  CadifyMatingPlaneModalResolve,
  CadifyMatingPlaneModalReject
>(CadifyMatingPlaneModalInner)
