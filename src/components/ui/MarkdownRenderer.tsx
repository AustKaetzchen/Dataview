import React from 'react'

interface MarkdownRendererProps {
  content?: string | string[]
  className?: string
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2] && match[3]) {
      // Link [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          {match[2]}
        </a>
      )
    } else if (match[4]) {
      // Bold **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[4]}
        </strong>
      )
    } else if (match[5]) {
      // Inline code `code`
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 bg-muted text-foreground border border-border text-[var(--body-font-size)] font-mono"
        >
          {match[5]}
        </code>
      )
    } else if (match[6]) {
      // Italic *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[6]}
        </em>
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
          className="bg-background/80 border border-border p-2.5 my-2 overflow-x-auto text-[var(--body-font-size)] font-mono text-foreground leading-relaxed"
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

    // Code blocks ```
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

    // Blank line
    if (trimmed === '') {
      flushList()
      continue
    }

    // Bullet list item (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2).trim())
      continue
    } else {
      flushList()
    }

    // Headings
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
    } else if (trimmed === '---' || trimmed === '***') {
      // Horizontal rule
      elements.push(<hr key={`hr-${blockKey++}`} className="border-border my-2.5" />)
    } else if (trimmed.startsWith('> ')) {
      // Blockquote
      elements.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="border-l-2 border-primary pl-2.5 py-0.5 my-1.5 text-muted-foreground text-[var(--body-font-size)] font-light italic"
        >
          {parseInline(trimmed.slice(2))}
        </blockquote>
      )
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
    <div className={`space-y-0.5 text-[var(--body-font-size)] ${className}`}>
      {elements}
    </div>
  )
}

export default MarkdownRenderer
