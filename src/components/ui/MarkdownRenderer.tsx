import React from 'react'
import { Icon } from '@/components/ui/icon'

interface MarkdownRendererProps {
  content?: string | string[]
  className?: string
  isNested?: boolean
}

export interface AlertStyle {
  title: string
  icon: string
  borderColor: string
  bgColor: string
  titleColor: string
  iconColor: string
}

const ALERT_CONFIGS: Record<string, AlertStyle> = {
  NOTE: {
    title: 'Note',
    icon: 'info',
    borderColor: 'border-l-sky-500 border-sky-500/30',
    bgColor: 'bg-sky-950/25',
    titleColor: 'text-sky-400',
    iconColor: 'text-sky-400',
  },
  INFO: {
    title: 'Info',
    icon: 'info',
    borderColor: 'border-l-sky-500 border-sky-500/30',
    bgColor: 'bg-sky-950/25',
    titleColor: 'text-sky-400',
    iconColor: 'text-sky-400',
  },
  TIP: {
    title: 'Tip',
    icon: 'lightbulb',
    borderColor: 'border-l-emerald-500 border-emerald-500/30',
    bgColor: 'bg-emerald-950/25',
    titleColor: 'text-emerald-400',
    iconColor: 'text-emerald-400',
  },
  HINT: {
    title: 'Hint',
    icon: 'lightbulb',
    borderColor: 'border-l-emerald-500 border-emerald-500/30',
    bgColor: 'bg-emerald-950/25',
    titleColor: 'text-emerald-400',
    iconColor: 'text-emerald-400',
  },
  IMPORTANT: {
    title: 'Important',
    icon: 'priority_high',
    borderColor: 'border-l-purple-500 border-purple-500/30',
    bgColor: 'bg-purple-950/25',
    titleColor: 'text-purple-400',
    iconColor: 'text-purple-400',
  },
  WARNING: {
    title: 'Warning',
    icon: 'warning',
    borderColor: 'border-l-amber-500 border-amber-500/30',
    bgColor: 'bg-amber-950/25',
    titleColor: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  CAUTION: {
    title: 'Caution',
    icon: 'dangerous',
    borderColor: 'border-l-rose-500 border-rose-500/30',
    bgColor: 'bg-rose-950/25',
    titleColor: 'text-rose-400',
    iconColor: 'text-rose-400',
  },
  DANGER: {
    title: 'Danger',
    icon: 'dangerous',
    borderColor: 'border-l-rose-500 border-rose-500/30',
    bgColor: 'bg-rose-950/25',
    titleColor: 'text-rose-400',
    iconColor: 'text-rose-400',
  },
  ERROR: {
    title: 'Error',
    icon: 'error',
    borderColor: 'border-l-rose-500 border-rose-500/30',
    bgColor: 'bg-rose-950/25',
    titleColor: 'text-rose-400',
    iconColor: 'text-rose-400',
  },
  SUCCESS: {
    title: 'Success',
    icon: 'check_circle',
    borderColor: 'border-l-emerald-500 border-emerald-500/30',
    bgColor: 'bg-emerald-950/25',
    titleColor: 'text-emerald-400',
    iconColor: 'text-emerald-400',
  },
  QUESTION: {
    title: 'Question',
    icon: 'help_outline',
    borderColor: 'border-l-indigo-500 border-indigo-500/30',
    bgColor: 'bg-indigo-950/25',
    titleColor: 'text-indigo-400',
    iconColor: 'text-indigo-400',
  },
  FAQ: {
    title: 'FAQ',
    icon: 'help_outline',
    borderColor: 'border-l-indigo-500 border-indigo-500/30',
    bgColor: 'bg-indigo-950/25',
    titleColor: 'text-indigo-400',
    iconColor: 'text-indigo-400',
  },
  EXAMPLE: {
    title: 'Example',
    icon: 'description',
    borderColor: 'border-l-cyan-500 border-cyan-500/30',
    bgColor: 'bg-cyan-950/25',
    titleColor: 'text-cyan-400',
    iconColor: 'text-cyan-400',
  },
  QUOTE: {
    title: 'Quote',
    icon: 'format_quote',
    borderColor: 'border-l-primary border-primary/30',
    bgColor: 'bg-primary/10',
    titleColor: 'text-primary',
    iconColor: 'text-primary',
  },
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []

  // Tokens:
  // 1: Clickable image: [![alt](imgUrl)](linkUrl)
  // 2: Image: ![alt](imgUrl "title")
  // 3: Link: [text](linkUrl)
  // 4: Bold **bold**
  // 5: Bold __bold__
  // 6: Inline code `code`
  // 7: Italic *italic*
  // 8: Italic _italic_
  // 9: Strikethrough ~~strike~~
  const tokenRegex =
    /(\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const fullMatch = match[1]

    if (fullMatch.startsWith('[![')) {
      // Clickable image [![alt](imgUrl)](linkUrl)
      const alt = match[2] || ''
      const imgUrl = match[3]
      const imgTitle = match[4] || alt
      const linkUrl = match[5]
      parts.push(
        <a
          key={`clickimg-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block hover:opacity-85 transition-opacity align-middle my-0.5"
        >
          <img
            src={imgUrl}
            alt={alt}
            title={imgTitle}
            className="inline-block max-h-8 align-middle border border-border bg-background/50 object-contain rounded-none"
            loading="lazy"
          />
        </a>
      )
    } else if (fullMatch.startsWith('![')) {
      // Standalone inline image ![alt](imgUrl "title")
      const alt = match[6] || ''
      const imgUrl = match[7]
      const imgTitle = match[8] || alt
      parts.push(
        <img
          key={`img-${match.index}`}
          src={imgUrl}
          alt={alt}
          title={imgTitle}
          className="inline-block max-h-8 align-middle mx-1 border border-border bg-background/50 object-contain rounded-none"
          loading="lazy"
        />
      )
    } else if (match[9] && match[10]) {
      // Link [text](url)
      parts.push(
        <a
          key={`link-${match.index}`}
          href={match[10]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          {match[9]}
        </a>
      )
    } else if (match[11] || match[12]) {
      // Bold **bold** or __bold__
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
          {match[11] || match[12]}
        </strong>
      )
    } else if (match[13]) {
      // Inline code `code`
      parts.push(
        <code
          key={`code-${match.index}`}
          className="px-1 py-0.5 bg-muted text-foreground border border-border text-[var(--body-font-size)] font-mono"
        >
          {match[13]}
        </code>
      )
    } else if (match[14] || match[15]) {
      // Italic *italic* or _italic_
      parts.push(
        <em key={`em-${match.index}`} className="italic">
          {match[14] || match[15]}
        </em>
      )
    } else if (match[16]) {
      // Strikethrough ~~text~~
      parts.push(
        <del key={`del-${match.index}`} className="line-through text-muted-foreground">
          {match[16]}
        </del>
      )
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isNested = false,
}) => {
  if (!content) return null

  const rawText = Array.isArray(content) ? content.join('\n') : content
  const lines = rawText.split('\n')

  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let inCodeBlock = false
  let codeBlockLines: string[] = []
  let blockKey = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`ul-${blockKey++}`}
          className="space-y-1 my-2 list-disc list-inside text-muted-foreground text-[var(--body-font-size)] font-light leading-relaxed"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-snug">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <pre
          key={`pre-${blockKey++}`}
          className="bg-background/80 border border-border p-2.5 my-2 overflow-x-auto text-[var(--body-font-size)] font-mono text-foreground leading-relaxed rounded-none"
        >
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      )
      codeBlockLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 1. Code blocks ```
    if (trimmed.startsWith('```')) {
      flushList()
      if (inCodeBlock) {
        inCodeBlock = false
        flushCodeBlock()
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // 2. Blank line
    if (trimmed === '') {
      flushList()
      continue
    }

    // 3. GitHub-style Alert Callout blockquote: > [!NOTE], > [!WARNING], etc.
    const alertMatch = trimmed.match(
      /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|HINT|DANGER|ERROR|SUCCESS|QUESTION|FAQ|EXAMPLE|QUOTE)\](?:\s+(.*))?$/i
    )
    if (alertMatch) {
      flushList()
      const alertTypeKey = alertMatch[1].toUpperCase()
      const customTitle = alertMatch[2]?.trim() || undefined
      const cfg = ALERT_CONFIGS[alertTypeKey] || ALERT_CONFIGS.NOTE

      const alertBodyLines: string[] = []

      // Consume subsequent lines belonging to this alert callout
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nextTrimmed = nextLine.trim()

        if (nextTrimmed === '') {
          // Check if after blank line there's another '>' line or end of alert
          if (i + 2 < lines.length && lines[i + 2].trim().startsWith('>')) {
            alertBodyLines.push('')
            i++
            continue
          } else {
            break
          }
        }

        // Check if next line is another alert header or major block boundary
        if (nextTrimmed.match(/^>\s*\[!/i)) {
          break
        }

        if (nextTrimmed.startsWith('>')) {
          // Prefixed with >
          alertBodyLines.push(nextTrimmed.replace(/^>\s?/, ''))
          i++
        } else {
          // Loose line (e.g. array of strings in JSON without leading > on line 2)
          // Stop if it starts with another markdown block (list, header, hr, table)
          if (
            nextTrimmed.startsWith('- ') ||
            nextTrimmed.startsWith('* ') ||
            nextTrimmed.startsWith('# ') ||
            nextTrimmed.startsWith('## ') ||
            nextTrimmed.startsWith('### ') ||
            nextTrimmed.startsWith('---') ||
            nextTrimmed.startsWith('***') ||
            nextTrimmed.startsWith('|')
          ) {
            break
          }
          alertBodyLines.push(nextTrimmed)
          i++
        }
      }

      elements.push(
        <div
          key={`alert-${blockKey++}`}
          className={`my-2.5 p-2.5 border-l-4 border ${cfg.borderColor} ${cfg.bgColor} rounded-none select-text`}
        >
          <div
            className={`flex items-center gap-1.5 font-bold text-[var(--body-font-size)] mb-1 ${cfg.titleColor}`}
          >
            <Icon name={cfg.icon} size={15} className={cfg.iconColor} />
            <span className="uppercase tracking-wider text-xs">
              {customTitle || cfg.title}
            </span>
          </div>
          {alertBodyLines.length > 0 && (
            <div className="text-foreground/90 font-light leading-relaxed pl-0.5">
              <MarkdownRenderer content={alertBodyLines.join('\n')} isNested />
            </div>
          )}
        </div>
      )
      continue
    }

    // 4. Standard Blockquote (consecutive > lines)
    if (trimmed.startsWith('>')) {
      flushList()
      const quoteBodyLines: string[] = [trimmed.replace(/^>\s?/, '')]

      while (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim()
        if (nextTrimmed.startsWith('>') && !nextTrimmed.match(/^>\s*\[!/i)) {
          quoteBodyLines.push(nextTrimmed.replace(/^>\s?/, ''))
          i++
        } else {
          break
        }
      }

      elements.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="border-l-2 border-primary/70 bg-muted/20 pl-3 py-1.5 my-2 text-muted-foreground italic text-[var(--body-font-size)] font-light leading-relaxed select-text"
        >
          <MarkdownRenderer content={quoteBodyLines.join('\n')} isNested />
        </blockquote>
      )
      continue
    }

    // 5. Block Images: ![Alt text](url "title")
    const blockImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/)
    if (blockImgMatch) {
      flushList()
      const alt = blockImgMatch[1] || ''
      const url = blockImgMatch[2]
      const title = blockImgMatch[3] || alt

      elements.push(
        <figure
          key={`blockimg-${blockKey++}`}
          className="my-3 flex flex-col items-center select-none"
        >
          <img
            src={url}
            alt={alt}
            title={title}
            className="max-w-full h-auto max-h-72 border border-border bg-background/50 object-contain shadow-sm rounded-none"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent && !parent.querySelector('.img-error-badge')) {
                const badge = document.createElement('div')
                badge.className =
                  'img-error-badge p-2 text-xs text-muted-foreground border border-dashed border-border flex items-center gap-1.5 bg-muted/20'
                badge.innerHTML = `<span class="material-icons text-sm text-destructive">broken_image</span> Image unavailable: ${alt || url}`
                parent.appendChild(badge)
              }
            }}
          />
          {alt && (
            <figcaption className="text-[11px] text-muted-foreground/80 italic mt-1 text-center">
              {alt}
            </figcaption>
          )}
        </figure>
      )
      continue
    }

    // 6. GFM Tables: lines starting with | and ending with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim()
      const isTableSeparator = /^\|(?:\s*:?-+:?\s*\|)+$/.test(nextTrimmed)

      if (isTableSeparator) {
        flushList()
        const parseRow = (rowStr: string) =>
          rowStr
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim())

        const headers = parseRow(trimmed)
        i++ // Skip header
        i++ // Skip delimiter

        const tableRows: string[][] = []
        while (i < lines.length) {
          const rTrimmed = lines[i].trim()
          if (rTrimmed.startsWith('|') && rTrimmed.endsWith('|')) {
            tableRows.push(parseRow(rTrimmed))
            i++
          } else {
            i-- // Let outer loop handle non-table line
            break
          }
        }

        elements.push(
          <div key={`table-${blockKey++}`} className="my-2.5 overflow-x-auto">
            <table className="w-full border-collapse border border-border text-[var(--body-font-size)] font-sans">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className="p-1.5 px-2 text-left font-bold text-foreground border-r border-border last:border-0"
                    >
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="p-1.5 px-2 text-muted-foreground border-r border-border/50 last:border-0"
                      >
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 7. Bullet list item (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2).trim())
      continue
    } else {
      flushList()
    }

    // 8. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${blockKey++}`}
          className="font-bold text-foreground text-[var(--header-font-size)] mt-3 mb-1.5 first:mt-0"
        >
          {parseInline(trimmed.slice(2))}
        </h1>
      )
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${blockKey++}`}
          className="font-bold text-foreground text-[var(--body-font-size)] uppercase tracking-wider mt-3 mb-1 first:mt-0"
        >
          {parseInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${blockKey++}`}
          className="font-bold text-foreground text-[var(--body-font-size)] mt-2.5 mb-1 first:mt-0"
        >
          {parseInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4
          key={`h4-${blockKey++}`}
          className="font-semibold text-foreground text-[var(--body-font-size)] mt-2 mb-1 first:mt-0"
        >
          {parseInline(trimmed.slice(5))}
        </h4>
      )
    } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      // Horizontal rule
      elements.push(<hr key={`hr-${blockKey++}`} className="border-border my-2.5" />)
    } else {
      // Regular paragraph
      elements.push(
        <p
          key={`p-${blockKey++}`}
          className="text-muted-foreground font-light leading-relaxed my-1.5 text-[var(--body-font-size)]"
        >
          {parseInline(trimmed)}
        </p>
      )
    }
  }

  flushList()
  flushCodeBlock()

  return (
    <div
      className={`space-y-0.5 text-[var(--body-font-size)] ${
        isNested ? '' : className
      }`}
    >
      {elements}
    </div>
  )
}

export default MarkdownRenderer
