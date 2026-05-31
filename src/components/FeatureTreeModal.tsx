import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { type InstanceProps, create } from 'react-modal-promise'

import { ActionButton } from '@src/components/ActionButton'
import { CustomIcon } from '@src/components/CustomIcon'
import { type FeatureTreeNode, buildFeatureTreeCsv } from '@src/lib/operations'

type FeatureTreeModalResolve = boolean
type FeatureTreeModalReject = boolean

type FeatureTreeModalProps = InstanceProps<
  FeatureTreeModalResolve,
  FeatureTreeModalReject
> & {
  tree: FeatureTreeNode[]
}

function FeatureTreeModalInner({
  isOpen,
  onResolve,
  tree,
}: FeatureTreeModalProps) {
  // Re-mount tree nodes by incrementing key to reset all expanded states
  const [expandKey, setExpandKey] = useState(0)
  const [defaultExpanded, setDefaultExpanded] = useState(true)
  const [checkedNodes, setCheckedNodes] = useState<Set<FeatureTreeNode>>(
    new Set()
  )

  const handleExpandAll = () => {
    setDefaultExpanded(true)
    setExpandKey((k) => k + 1)
  }

  const handleCollapseAll = () => {
    setDefaultExpanded(false)
    setExpandKey((k) => k + 1)
  }

  const handleCheckedChange = (node: FeatureTreeNode, isChecked: boolean) => {
    setCheckedNodes((prev) => {
      const next = new Set(prev)
      if (isChecked) next.add(node)
      else next.delete(node)
      return next
    })
  }

  const handleExportSelected = () => {
    const selected = [...checkedNodes]
    if (selected.length === 0) return
    const nodes = selected.map((n) => ({ ...n, children: [] }))
    const csv = buildFeatureTreeCsv(nodes)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'feature-tree-selected.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-40"
        onClose={() => onResolve(true)}
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
              <Dialog.Panel className="relative w-full max-w-3xl rounded bg-chalkboard-10 dark:bg-chalkboard-100 border border-chalkboard-30 dark:border-chalkboard-70 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-chalkboard-30 dark:border-chalkboard-70 flex-shrink-0">
                  <Dialog.Title className="text-base font-semibold">
                    Feature Tree
                  </Dialog.Title>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-chalkboard-50 dark:text-chalkboard-50">
                      {tree.length} top-level item
                      {tree.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-chalkboard-60 dark:text-chalkboard-40 hover:text-chalkboard-100 dark:hover:text-chalkboard-10 underline"
                      onClick={handleExpandAll}
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      className="text-xs text-chalkboard-60 dark:text-chalkboard-40 hover:text-chalkboard-100 dark:hover:text-chalkboard-10 underline"
                      onClick={handleCollapseAll}
                    >
                      Collapse all
                    </button>
                    <ActionButton
                      Element="button"
                      onClick={() => onResolve(true)}
                      iconStart={{ icon: 'close' }}
                      className="!p-1 ml-1"
                    />
                  </div>
                </div>

                {/* Tree */}
                <div className="overflow-y-auto flex-1 py-2">
                  {tree.length === 0 ? (
                    <p className="text-center text-chalkboard-60 dark:text-chalkboard-40 py-10 text-sm">
                      No features found in the current model.
                    </p>
                  ) : (
                    <div key={expandKey}>
                      {tree.map((node, i) => (
                        <ExpandableNodeRow
                          key={i}
                          node={node}
                          depth={0}
                          defaultExpanded={defaultExpanded}
                          checkedNodes={checkedNodes}
                          onCheckedChange={handleCheckedChange}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-4 py-3 border-t border-chalkboard-30 dark:border-chalkboard-70 flex-shrink-0">
                  <ActionButton
                    Element="button"
                    onClick={handleExportSelected}
                    disabled={checkedNodes.size === 0}
                    iconStart={{ icon: 'exportFile' }}
                  >
                    Export selected ({checkedNodes.size})
                  </ActionButton>
                  <ActionButton
                    Element="button"
                    onClick={() => onResolve(true)}
                  >
                    Close
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

function ExpandableNodeRow({
  node,
  depth,
  defaultExpanded,
  checkedNodes,
  onCheckedChange,
}: {
  node: FeatureTreeNode
  depth: number
  defaultExpanded: boolean
  checkedNodes: Set<FeatureTreeNode>
  onCheckedChange: (node: FeatureTreeNode, checked: boolean) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const checked = checkedNodes.has(node)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 pr-3 hover:bg-chalkboard-20 dark:hover:bg-chalkboard-90 rounded cursor-default select-none"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(node, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-3.5 h-3.5 accent-primary cursor-pointer"
        />
        {/* Expand/collapse indicator */}
        <span className="w-4 flex-shrink-0 flex items-center justify-center">
          {hasChildren ? (
            <CustomIcon
              name="caretDown"
              className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
            />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-chalkboard-40 dark:bg-chalkboard-60 mx-auto" />
          )}
        </span>

        {/* Label */}
        <span className="flex-1 font-mono text-sm truncate">{node.label}</span>

        {/* Metadata badges */}
        <span className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
          {node.type && (
            <span className="text-xs bg-chalkboard-20 dark:bg-chalkboard-80 text-chalkboard-70 dark:text-chalkboard-30 px-1.5 py-0.5 rounded font-mono">
              {node.type}
            </span>
          )}
          {node.operationName && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
              {node.operationName}
            </span>
          )}
          {node.variableName && (
            <span className="text-xs text-chalkboard-60 dark:text-chalkboard-40 font-mono">
              → {node.variableName}
            </span>
          )}
          {node.kclType && (
            <span className="text-xs text-chalkboard-50 dark:text-chalkboard-50 font-mono">
              : {node.kclType}
            </span>
          )}
          {node.value && (
            <span className="text-xs text-succeed-70 dark:text-succeed-40 font-mono bg-succeed-10/30 dark:bg-succeed-80/10 px-1.5 py-0.5 rounded">
              = {node.value}
            </span>
          )}
        </span>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <ExpandableNodeRow
              key={i}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
              checkedNodes={checkedNodes}
              onCheckedChange={onCheckedChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const showFeatureTreeModal = create<
  FeatureTreeModalProps,
  FeatureTreeModalResolve,
  FeatureTreeModalReject
>(FeatureTreeModalInner)
