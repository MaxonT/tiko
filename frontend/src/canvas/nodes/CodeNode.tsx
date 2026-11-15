import {
  NodeResizeControl,
  ResizeControlVariant,
  useReactFlow,
  useStore,
  type NodeProps,
} from '@xyflow/react'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { memo, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { takeFresh } from '@/canvas/editing'
import { indent } from '@/canvas/code/indent'
import {
  CODE_MAX_CHARS,
  LANGUAGE_NAMES,
  LANGUAGES,
  type CodeLanguage,
} from '@/canvas/code/languages'
import type { Token } from '@/canvas/code/highlight'
import { Handles } from '@/canvas/nodes/Handles'
import { useReadOnly } from '@/canvas/readonly'
import type { CodeNode as CodeNodeType } from '@/canvas/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// One look for the shown code and the field over it, so the caret sits on its letters.
const CODE_TEXT =
  'm-0 p-3 font-mono text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [tab-size:2]'

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
  return useMemo(
    () => (ready?.language === language ? ready.module.tokenize(text, language) : null),
    [text, language, ready],
  )
}

function Lines({ text, tokens }: { text: string; tokens: Token[][] | null }) {
  if (!tokens) return text
  return tokens.map((line, i) => (
    <span key={i}>
      {i > 0 && '\n'}
      {line.map((token, j) => (
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
      ))}
    </span>
  ))
}

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

function CodeNodeView({ id, data, selected }: NodeProps<CodeNodeType>) {
  const { updateNodeData } = useReactFlow()
  const readOnly = useReadOnly()
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
    if (draft !== data.text) updateNodeData(id, { text: draft })
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
          {selected && !readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="nodrag h-6 gap-1 px-1.5 text-xs">
                  {LANGUAGE_NAMES[data.language]}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={data.language}
                  onValueChange={(language) => updateNodeData(id, { language })}
                >
                  {LANGUAGES.map((language) => (
                    <DropdownMenuRadioItem key={language} value={language}>
                      {LANGUAGE_NAMES[language]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="px-1.5">{LANGUAGE_NAMES[data.language]}</span>
          )}
          {collapsed && (
            <span className="min-w-0 flex-1 truncate font-mono">
              {firstLine}
              <span className="font-sans"> · {lineCount(data.text)}</span>
            </span>
          )}
          <span className={cn(!collapsed && 'flex-1')} />
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
            {/* The trailing break keeps an empty last line as tall as in the field. */}
            <pre aria-hidden={editing} className={cn(CODE_TEXT, !shown && 'opacity-50')}>
              {shown ? <Lines text={shown} tokens={tokens} /> : editing ? '' : 'Code'}
              {'\n'}
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
