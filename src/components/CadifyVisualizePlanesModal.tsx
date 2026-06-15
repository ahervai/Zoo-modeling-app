/**
 * CadifyVisualizePlanesModal
 *
 * Simple two-field wizard that generates two thin translucent station-plate
 * solids on YZ-offset planes so the user can visually inspect X-direction
 * dimension boundaries before a `dim::distance` annotation is added.
 *
 * Generated KCL (name = "station", left = "0mm", right = "100mm"):
 *
 *   stationPlateProfile = sketch(on = YZ) { ... }
 *   stationPlateRegion  = region(...)
 *   stationLeftPlate    = extrude(stationPlateRegion, length = 1mm, symmetric = true)
 *   stationRightPlate   = clone(stationLeftPlate)
 *   translate(stationLeftPlate,  x = 0mm,   global = true)
 *   translate(stationRightPlate, x = 100mm, global = true)
 *   appearance([stationLeftPlate, stationRightPlate], color = "#00aaff", opacity = 25)
 *   hide(stationPlateProfile)
 */

import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { type InstanceProps, create } from 'react-modal-promise'

import { ActionButton } from '@src/components/ActionButton'
import type { KclManager } from '@src/lang/KclManager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CadifyVisualizePlanesModalResolve = boolean
type CadifyVisualizePlanesModalReject = boolean

type CadifyVisualizePlanesModalProps = InstanceProps<
  CadifyVisualizePlanesModalResolve,
  CadifyVisualizePlanesModalReject
> & {
  kclManager: KclManager
}

// ---------------------------------------------------------------------------
// KCL generation
// ---------------------------------------------------------------------------

function buildKcl(
  name: string,
  leftOffset: string,
  rightOffset: string
): string {
  const profile = `${name}PlateProfile`
  const region = `${name}PlateRegion`
  const leftPlate = `${name}LeftPlate`
  const rightPlate = `${name}RightPlate`

  return `
// -- Cadify station plate visualization ----------------------------------------
${profile} = sketch(on = YZ) {
  bottom = line(start = [var -80mm, var -80mm], end = [var 80mm, var -80mm])
  right  = line(start = [var 80mm,  var -80mm], end = [var 80mm,  var 80mm])
  top    = line(start = [var 80mm,  var 80mm],  end = [var -80mm, var 80mm])
  left   = line(start = [var -80mm, var 80mm],  end = [var -80mm, var -80mm])

  coincident([bottom.end, right.start])
  coincident([right.end,  top.start])
  coincident([top.end,    left.start])
  coincident([left.end,   bottom.start])

  horizontal(bottom)
  horizontal(top)
  vertical(left)
  vertical(right)
}
${region}   = region(point = [0mm, 0mm], sketch = ${profile})
${leftPlate}  = extrude(${region}, length = 1mm, symmetric = true)
${rightPlate} = clone(${leftPlate})
translate(${leftPlate},  x = ${leftOffset},  global = true)
translate(${rightPlate}, x = ${rightOffset}, global = true)
appearance([${leftPlate}, ${rightPlate}], color = "#00aaff", opacity = 25)
hide(${profile})
`
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function CadifyVisualizePlanesModalInner({
  isOpen,
  onResolve,
  kclManager,
}: CadifyVisualizePlanesModalProps) {
  const [name, setName] = useState('station')
  const [leftOffset, setLeftOffset] = useState('0mm')
  const [rightOffset, setRightOffset] = useState('100mm')

  const canInsert =
    name.trim().length > 0 &&
    leftOffset.trim().length > 0 &&
    rightOffset.trim().length > 0

  const handleInsert = () => {
    const snippet = buildKcl(name.trim(), leftOffset.trim(), rightOffset.trim())
    kclManager.updateCodeEditor((kclManager.code ?? '') + snippet)
    onResolve(true)
  }

  const inputClass =
    'rounded border border-chalkboard-30 dark:border-chalkboard-70 bg-transparent px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass =
    'text-xs font-medium text-chalkboard-70 dark:text-chalkboard-40'

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-40"
        onClose={() => onResolve(false)}
      >
        {/* Backdrop */}
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
              <Dialog.Panel className="relative w-full max-w-md rounded bg-chalkboard-10 dark:bg-chalkboard-100 border border-chalkboard-30 dark:border-chalkboard-70 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-chalkboard-30 dark:border-chalkboard-70">
                  <Dialog.Title className="text-base font-semibold">
                    Visualize Station Planes
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={() => onResolve(false)}
                    className="text-chalkboard-50 hover:text-chalkboard-90 dark:hover:text-chalkboard-20 text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="px-4 py-4 flex flex-col gap-4">
                  <p className="text-xs text-chalkboard-60 dark:text-chalkboard-40">
                    Inserts two thin translucent plates on YZ-offset planes to
                    mark X-dimension boundaries in the 3D scene.
                  </p>

                  {/* Name prefix */}
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Name prefix</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="station"
                      autoFocus
                    />
                    <p className="text-xs text-chalkboard-50">
                      Variables will be named{' '}
                      <code className="font-mono">{name}LeftPlate</code> and{' '}
                      <code className="font-mono">{name}RightPlate</code>.
                    </p>
                  </div>

                  {/* Offsets */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className={labelClass}>Left offset (X)</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={leftOffset}
                        onChange={(e) => setLeftOffset(e.target.value)}
                        placeholder="0mm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelClass}>Right offset (X)</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={rightOffset}
                        onChange={(e) => setRightOffset(e.target.value)}
                        placeholder="100mm"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="rounded border border-chalkboard-20 dark:border-chalkboard-80 bg-chalkboard-20/40 dark:bg-chalkboard-80/40 p-3">
                    <p className="text-xs font-medium text-chalkboard-60 dark:text-chalkboard-40 mb-1.5">
                      Preview
                    </p>
                    <pre className="text-xs font-mono text-chalkboard-80 dark:text-chalkboard-30 whitespace-pre-wrap leading-relaxed">
                      {`${name}LeftPlate  @ X = ${leftOffset}\n${name}RightPlate @ X = ${rightOffset}\nappearance: #00aaff, opacity 25%`}
                    </pre>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => onResolve(false)}
                    className="px-3 py-1.5 text-sm rounded border border-chalkboard-30 dark:border-chalkboard-70 hover:bg-chalkboard-10 dark:hover:bg-chalkboard-90 transition-colors"
                  >
                    Cancel
                  </button>
                  <ActionButton
                    Element="button"
                    disabled={!canInsert}
                    onClick={handleInsert}
                  >
                    Insert
                  </ActionButton>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export const showCadifyVisualizePlanesModal = create<
  CadifyVisualizePlanesModalProps,
  CadifyVisualizePlanesModalResolve,
  CadifyVisualizePlanesModalReject
>(CadifyVisualizePlanesModalInner)
