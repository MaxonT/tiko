import { Check, ChevronDown } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { LANGUAGE_NAMES, matchLanguages, type CodeLanguage } from '@/canvas/code/languages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** The block's language; typing narrows the list, arrows move, Enter picks. */
export function LanguagePicker({
  value,
  onPick,
}: {
  value: CodeLanguage
  onPick: (language: CodeLanguage) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const found = matchLanguages(query)

  const toggle = (next: boolean) => {
    setOpen(next)
    setQuery('')
    setActive(0)
  }
  const pick = (language: CodeLanguage) => {
    onPick(language)
    toggle(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (found.length ? (i + step + found.length) % found.length : 0))
    } else if (event.key === 'Enter' && found[active]) {
      event.preventDefault()
      pick(found[active])
    }
  }

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="nodrag h-6 gap-1 px-1.5 text-xs">
          {LANGUAGE_NAMES[value]}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        <Input
          autoFocus
          value={query}
          placeholder="Find a language"
          aria-label="Find a language"
          role="combobox"
          aria-expanded
          aria-controls="code-languages"
          aria-activedescendant={found[active] && `code-language-${found[active]}`}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          className="mb-1 h-8"
        />
        <div id="code-languages" role="listbox" className="max-h-64 overflow-y-auto">
          {found.map((language, i) => (
            <div
              key={language}
              id={`code-language-${language}`}
              role="option"
              aria-selected={i === active}
              onPointerMove={() => setActive(i)}
              onClick={() => pick(language)}
              className={cn(
                'flex cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm',
                i === active && 'bg-accent text-accent-foreground',
              )}
            >
              {LANGUAGE_NAMES[language]}
              {language === value && <Check className="size-3.5" />}
            </div>
          ))}
          {found.length === 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">No such language</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
