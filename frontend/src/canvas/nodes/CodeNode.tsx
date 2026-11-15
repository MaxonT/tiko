import {
  NodeResizeControl,
  ResizeControlVariant,
  useReactFlow,
  useStore,
  type NodeProps,
} from '@xyflow/react'
import { Check, ChevronDown, ChevronRight, Copy, ListOrdered } from 'lucide-react'
import { memo, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { takeFresh } from '@/canvas/editing'
import { indent } from '@/canvas/code/indent'
import { followMarks } from '@/canvas/code/marks'
import { CODE_MAX_CHARS, LANGUAGE_NAMES, type CodeLanguage } from '@/canvas/code/languages'
import type { Token } from '@/canvas/code/highlight'
import { LanguagePicker } from '@/canvas/code/LanguagePicker'
import { EditableText } from '@/canvas/nodes/EditableText'
import { Handles } from '@/canvas/nodes/Handles'
import { useReadOnly } from '@/canvas/readonly'
import type { CodeNode as CodeNodeType } from '@/canvas/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// One look for the shown code and the field over it, so the caret sits on its letters.
const CODE_TEXT =
  'm-0 py-3 pr-3 font-mono text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [tab-size:2]'

type Highlighter = typeof import('@/canvas/code/highlight')

/** Colored lines of the text, or null until the highlighter and the language have loaded. */
function useTokens(text: string, language: CodeLanguage) {
  const [ready, setReady] = useState<{ language: CodeLanguage; module: Highlighter } | null>(null)
  useEffect(() => {
    if (language === 'plain') return
    let live = true
    // The highlighter is a chunk of its own: a board without code never downloads it.
    import('@/canvas/code/highlight')
      .then(async (module) => {
        await module.prepare(language)
        if (live) setReady({ language, module })
      })
      // A language that fails to load leaves the code plain; the next mount tries again.
      .catch(() => {})
    return () => {
      live = false
    }
  }, [language])
  // Until a newly picked language loads, the colors of the last one stay: no flash of plain.
  return useMemo(
    () => (language === 'plain' || !ready ? null : ready.module.tokenize(text, ready.language)),
    [text, language, ready],
  )
}

function Line({ tokens }: { tokens: Token[] }) {
  return tokens.map((token, j) => (
    <span
      key={j}
      className="code-token"
      style={{
        ['--code-light' as string]: token.light,
        ['--code-dark' as string]: token.dark,
        fontStyle: token.italic ? 'italic' : undefined,
        fontWeight: token.bold ? 600 : undefined,
      }}
    >
      {token.content}
    </span>
  ))
}

/** One block per line, so a wrapped line keeps its number on its first row and its mark whole. */
function Lines({
  text,
  tokens,
  numbered,
  marked,
  inset,
  onMark,
}: {
  text: string
  tokens: Token[][] | null
  numbered: boolean
  marked: Set<number>
  inset: string
  onMark?: (line: number) => void
}) {
  return text.split('\n').map((line, i) => {
    const n = i + 1
    return (
      <div
        key={i}
        className={cn('relative min-h-5', marked.has(n) && 'bg-primary/15')}
        // The mark spans the gutter and the padding too.
        style={{
          marginLeft: `calc(-1 * ${inset})`,
          paddingLeft: inset,
          marginRight: `-${PAD}`,
          paddingRight: PAD,
        }}
      >
        {numbered && (
          <span
            className={cn(
              'text-muted-foreground absolute text-right select-none',
              onMark && 'nodrag hover:text-foreground cursor-pointer',
              marked.has(n) && 'text-foreground',
            )}
            style={{ left: PAD, width: `${digits(text)}ch` }}
            title={onMark && (marked.has(n) ? 'Unmark line' : 'Mark line')}
            onClick={onMark && (() => onMark(n))}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {n}
          </span>
        )}
        {tokens?.[i] ? <Line tokens={tokens[i]} /> : line}
      </div>
    )
  })
}

const PAD = '0.75rem'
const digits = (text: string) => String(text.split('\n').length).length
/** Where the code starts: past the padding, and past the numbers when they are shown. */
const insetOf = (text: string, numbered: boolean) =>
  numbered ? `calc(${PAD} + ${digits(text) + 1.5}ch)` : PAD

// The height follows the code, so only the sides take a drag, and only sideways.
function WidthGrips() {
  const zoom = useStore((state) => state.transform[2])
  const style = { '--zoom': zoom } as CSSProperties
  return (['left', 'right'] as const).map((position) => (
    <NodeResizeControl
      key={position}
      variant={ResizeControlVariant.Line}
      position={position}
      resizeDirection="horizontal"
      minWidth={200}
      style={style}
    />
  ))
}

function lineCount(text: string) {
  const count = text.split('\n').length
  return `${count} ${count === 1 ? 'line' : 'lines'}`
}

function CodeNodeView({ id, data, selected, height }: NodeProps<CodeNodeType>) {
  const { updateNode, updateNodeData } = useReactFlow()
  const readOnly = useReadOnly()
  // The height follows the code. A stored one, left by an older build, pins the box: folding
  // then shrinks the block inside it and arrows stay at the old middle.
  useEffect(() => {
    if (height != null && !readOnly) updateNode(id, { height: undefined })
  }, [height, id, readOnly, updateNode])
  const [editing, setEditing] = useState(() => takeFresh(id))
  const [draft, setDraft] = useState(data.text)
  const [copied, setCopied] = useState(false)
  // A viewer may unfold a block for themselves; it is not saved.
  const [ownFold, setOwnFold] = useState<boolean | null>(null)
  const collapsed = !editing && (ownFold ?? data.collapsed ?? false)
  const shown = editing ? draft : data.text
  const tokens = useTokens(shown, data.language)

  const start = () => {
    if (readOnly) return
    setDraft(data.text)
    setEditing(true)
  }
  const finish = () => {
    setEditing(false)
    if (draft === data.text) return
    // Marks go with their lines, so a line added above does not move them onto another.
    const marked = data.marked?.length ? followMarks(data.text, draft, data.marked) : undefined
    updateNodeData(id, marked ? { text: draft, marked } : { text: draft })
  }
  const fold = () => {
    if (readOnly) setOwnFold(!collapsed)
    else updateNodeData(id, { collapsed: !collapsed })
  }
  const copy = () => {
    navigator.clipboard.writeText(data.text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        toast.success('Code copied')
      },
      () => toast.error('Not copied', { description: 'The browser did not allow the clipboard.' }),
    )
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') return event.currentTarget.blur()
    if (event.key !== 'Tab') return
    event.preventDefault()
    const field = event.currentTarget
    const edit = indent(field.value, field.selectionStart, field.selectionEnd, event.shiftKey)
    if (!edit) return
    field.setSelectionRange(edit.from, edit.to)
    // insertText keeps the browser's own undo; setRangeText is there for where it is missing.
    if (!document.execCommand?.('insertText', false, edit.insert)) {
      field.setRangeText(edit.insert, edit.from, edit.to)
    }
    field.setSelectionRange(edit.start, edit.end)
    setDraft(field.value)
  }

  const firstLine = data.text.split('\n', 1)[0]
  const editable = selected && !readOnly
  const numbered = data.numbered ?? false
  const marked = new Set(data.marked ?? [])
  const inset = insetOf(shown, numbered)
  const mark = (line: number) => {
    const next = new Set(marked)
    if (!next.delete(line)) next.add(line)
    updateNodeData(id, { marked: [...next].sort((a, b) => a - b) })
  }
  return (
    <div className="relative w-full">
      {selected && !readOnly && <WidthGrips />}
      <div
        className={cn(
          'bg-card text-card-foreground overflow-hidden rounded-md border shadow-sm',
          selected && 'ring-primary ring-2',
        )}
      >
        <div className="text-muted-foreground flex h-8 items-center gap-1 border-b px-1.5 text-xs">
          {editable ? (
            <LanguagePicker
              value={data.language}
              onPick={(language) => updateNodeData(id, { language })}
            />
          ) : (
            <span className="shrink-0 px-1.5">{LANGUAGE_NAMES[data.language]}</span>
          )}
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {editable ? (
              <EditableText
                nodeId={id}
                value={data.title ?? ''}
                field="title"
                maxLength={200}
                placeholder="Add a title"
                singleLine
                startFresh={false}
                className="text-foreground min-w-0 truncate font-medium whitespace-nowrap"
              />
            ) : data.title ? (
              <span className="text-foreground min-w-0 truncate font-medium">{data.title}</span>
            ) : (
              collapsed && <span className="min-w-0 truncate font-mono">{firstLine}</span>
            )}
            {collapsed && <span className="shrink-0">· {lineCount(data.text)}</span>}
          </span>
          {editable && (
            <Button
              variant={numbered ? 'secondary' : 'ghost'}
              size="icon"
              className="nodrag size-6"
              aria-label="Line numbers"
              aria-pressed={numbered}
              title={
                numbered ? 'Hide line numbers' : 'Show line numbers; click one to mark its line'
              }
              onClick={() => updateNodeData(id, { numbered: !numbered })}
            >
              <ListOrdered className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="nodrag size-6"
            aria-label="Copy code"
            title="Copy code"
            onClick={copy}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="nodrag size-6"
            aria-label={collapsed ? 'Unfold code' : 'Fold code'}
            title={collapsed ? 'Unfold' : 'Fold'}
            onClick={fold}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        </div>
        {!collapsed && (
          <div className="relative" onDoubleClick={start}>
            <pre
              aria-hidden={editing}
              className={cn(CODE_TEXT, !shown && !editing && 'opacity-50')}
              style={{ paddingLeft: inset }}
            >
              <Lines
                text={shown || (editing ? '' : 'Code')}
                tokens={shown ? tokens : null}
                numbered={numbered && !!shown}
                marked={marked}
                inset={inset}
                onMark={editable && !editing ? mark : undefined}
              />
            </pre>
            {editing && (
              <textarea
                value={draft}
                maxLength={CODE_MAX_CHARS}
                autoFocus
                spellCheck={false}
                aria-label="Code"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                onBlur={finish}
                // nodrag and nowheel let the field take mouse input instead of the canvas.
                className={cn(
                  CODE_TEXT,
                  'nodrag nowheel caret-foreground absolute inset-0 resize-none overflow-hidden bg-transparent text-transparent outline-none',
                )}
                style={{ paddingLeft: inset }}
              />
            )}
          </div>
        )}
      </div>
      <Handles />
    </div>
  )
}

export const CodeNode = memo(CodeNodeView)
