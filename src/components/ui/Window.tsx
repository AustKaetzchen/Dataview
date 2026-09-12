import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icon'

// Global z-index counter for window focus management (ensures active window is always on top)
let globalTopZIndex = 1000
export function getNextTopZIndex(): number {
  globalTopZIndex += 1
  return globalTopZIndex
}

// Clean, unambiguous Pushpin SVG (VS Code / desktop window style)
export const PushpinIcon: React.FC<{ isPinned: boolean; className?: string }> = ({
  isPinned,
  className = 'w-3.5 h-3.5',
}) => {
  if (isPinned) {
    // Pinned (vertical upright pin)
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <line x1="12" y1="17" x2="12" y2="22" strokeWidth="2" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
    )
  }

  // Unpinned (angled / floating pin outline)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} -rotate-45 opacity-80 hover:opacity-100 transition-transform`}
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  )
}

export interface WindowProps {
  id?: string
  title: string
  icon?: string
  isOpen: boolean
  onClose: () => void
  isPinned?: boolean
  defaultPinned?: boolean
  onTogglePin?: (pinned: boolean) => void
  defaultWidth?: number
  defaultHeight?: number | string
  minWidth?: number
  minHeight?: number
  className?: string
  children: React.ReactNode
}

export const Window: React.FC<WindowProps> = ({
  title,
  icon = 'info',
  isOpen,
  onClose,
  isPinned: controlledPinned,
  defaultPinned = true,
  onTogglePin,
  defaultWidth = 336,
  defaultHeight = 'auto',
  minWidth = 280,
  minHeight = 200,
  className = '',
  children,
}) => {
  const [internalPinned, setInternalPinned] = useState(defaultPinned)
  const isPinned = controlledPinned !== undefined ? controlledPinned : internalPinned

  const setPinned = useCallback(
    (nextPinned: boolean) => {
      setInternalPinned(nextPinned)
      onTogglePin?.(nextPinned)
    },
    [onTogglePin]
  )

  const panelRef = useRef<HTMLDivElement>(null)

  // Dynamic window z-index for active window focus
  const [zIndex, setZIndex] = useState<number>(() => getNextTopZIndex())

  const bringToFront = useCallback(() => {
    const nextZ = getNextTopZIndex()
    setZIndex(nextZ)
    if (panelRef.current) {
      panelRef.current.style.zIndex = `${nextZ}`
    }
  }, [])

  // Floating Window Coordinates and Size
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 360, y: 12 })
  const [size, setSize] = useState<{ width: number; height?: number }>({
    width: defaultWidth,
  })

  // Drag state refs
  const dragRef = useRef<{
    active: boolean
    type: 'move' | 'resize-e' | 'resize-s' | 'resize-se' | null
    startX: number
    startY: number
    initX: number
    initY: number
    initW: number
    initH: number
    currX: number
    currY: number
    currW: number
    currH: number
  }>({
    active: false,
    type: null,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    initW: 0,
    initH: 0,
    currX: 0,
    currY: 0,
    currW: 0,
    currH: 0,
  })

  const [isInteracting, setIsInteracting] = useState(false)

  // Clean transition to unpinned mode without any 100% full-screen width expansion
  const unpinAtCurrentRect = useCallback(
    (clientX?: number, clientY?: number) => {
      const el = panelRef.current
      if (!el) {
        setPinned(false)
        return
      }

      const rect = el.getBoundingClientRect()
      const currentW = Math.max(minWidth, Math.round(rect.width))
      const currentH = Math.max(minHeight, Math.round(rect.height))

      // Crucial: Set explicit pixel dimensions on DOM before changing position to fixed
      el.style.width = `${currentW}px`
      el.style.left = `${rect.left}px`
      el.style.top = `${rect.top}px`

      const nextZ = getNextTopZIndex()
      setZIndex(nextZ)
      el.style.zIndex = `${nextZ}`

      setPos({ x: rect.left, y: rect.top })
      setSize({ width: currentW, height: currentH })
      setPinned(false)

      if (clientX !== undefined && clientY !== undefined) {
        dragRef.current = {
          active: true,
          type: 'move',
          startX: clientX,
          startY: clientY,
          initX: rect.left,
          initY: rect.top,
          initW: currentW,
          initH: currentH,
          currX: rect.left,
          currY: rect.top,
          currW: currentW,
          currH: currentH,
        }
        setIsInteracting(true)
      }
    },
    [minWidth, minHeight, setPinned]
  )

  // Header MouseDown (Drag Handler) - Brings to front immediately
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('a')) return

    e.preventDefault()
    e.stopPropagation()

    bringToFront()

    if (isPinned) {
      // Unpin smoothly and immediately initiate dragging from current position
      unpinAtCurrentRect(e.clientX, e.clientY)
      return
    }

    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    dragRef.current = {
      active: true,
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
      initW: rect.width,
      initH: rect.height,
      currX: rect.left,
      currY: rect.top,
      currW: rect.width,
      currH: rect.height,
    }
    setIsInteracting(true)
  }

  // Resize Handlers - Brings to front immediately
  const handleResizeStart = (
    e: React.MouseEvent,
    type: 'resize-e' | 'resize-s' | 'resize-se'
  ) => {
    if (isPinned || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    bringToFront()

    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    dragRef.current = {
      active: true,
      type,
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
      initW: rect.width,
      initH: rect.height,
      currX: rect.left,
      currY: rect.top,
      currW: rect.width,
      currH: rect.height,
    }
    setIsInteracting(true)
  }

  // Global mousemove and mouseup listeners during drag/resize
  useEffect(() => {
    if (!isInteracting) return

    let rafId: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag.active) return

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY

      if (drag.type === 'move') {
        const maxX = Math.max(0, window.innerWidth - 80)
        const maxY = Math.max(0, window.innerHeight - 60)
        drag.currX = Math.max(0, Math.min(maxX, drag.initX + dx))
        drag.currY = Math.max(0, Math.min(maxY, drag.initY + dy))
      } else if (drag.type === 'resize-e') {
        const maxW = Math.max(minWidth, window.innerWidth - drag.initX - 12)
        drag.currW = Math.max(minWidth, Math.min(maxW, drag.initW + dx))
      } else if (drag.type === 'resize-s') {
        const maxH = Math.max(minHeight, window.innerHeight - drag.initY - 12)
        drag.currH = Math.max(minHeight, Math.min(maxH, drag.initH + dy))
      } else if (drag.type === 'resize-se') {
        const maxW = Math.max(minWidth, window.innerWidth - drag.initX - 12)
        const maxH = Math.max(minHeight, window.innerHeight - drag.initY - 12)
        drag.currW = Math.max(minWidth, Math.min(maxW, drag.initW + dx))
        drag.currH = Math.max(minHeight, Math.min(maxH, drag.initH + dy))
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          const el = panelRef.current
          if (el) {
            if (drag.type === 'move') {
              el.style.left = `${drag.currX}px`
              el.style.top = `${drag.currY}px`
            } else if (drag.type === 'resize-e') {
              el.style.width = `${drag.currW}px`
            } else if (drag.type === 'resize-s') {
              el.style.height = `${drag.currH}px`
            } else if (drag.type === 'resize-se') {
              el.style.width = `${drag.currW}px`
              el.style.height = `${drag.currH}px`
            }
          }
          rafId = null
        })
      }
    }

    const handleMouseUp = () => {
      const drag = dragRef.current
      drag.active = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }

      if (drag.type === 'move') {
        setPos({ x: drag.currX, y: drag.currY })
      } else if (drag.type === 'resize-e') {
        setSize((prev) => ({ ...prev, width: drag.currW }))
      } else if (drag.type === 'resize-s') {
        setSize((prev) => ({ ...prev, height: drag.currH }))
      } else if (drag.type === 'resize-se') {
        setSize({ width: drag.currW, height: drag.currH })
      }

      setIsInteracting(false)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isInteracting, minWidth, minHeight])

  if (!isOpen) return null

  const windowElement = (
    <>
      {/* Invisible Full-Screen Capture Backdrop during drag/resize to prevent mouse leaking to map */}
      {isInteracting && (
        <div
          className="fixed inset-0 z-[99999] select-none"
          style={{
            cursor:
              dragRef.current.type === 'move'
                ? 'move'
                : dragRef.current.type === 'resize-e'
                ? 'ew-resize'
                : dragRef.current.type === 'resize-s'
                ? 'ns-resize'
                : 'nwse-resize',
          }}
        />
      )}

      <div
        ref={panelRef}
        onMouseDownCapture={bringToFront}
        style={
          isPinned
            ? { width: '100%' }
            : {
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: size.height ? `${size.height}px` : undefined,
                zIndex,
              }
        }
        className={
          isPinned
            ? `relative z-30 flex flex-col bg-card/98 backdrop-blur-md border border-border shadow-2xl p-[var(--padding)] text-[var(--body-font-size)] font-sans select-none pointer-events-auto max-h-[calc(100vh-160px)] ${className}`
            : `flex flex-col bg-card/98 backdrop-blur-md border border-border shadow-2xl p-[var(--padding)] text-[var(--body-font-size)] font-sans select-none pointer-events-auto max-h-[calc(100vh-32px)] ${className}`
        }
      >
        {/* Window Header (Draggable) */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="flex items-center justify-between pb-2 border-b border-border shrink-0 cursor-move select-none"
          title={isPinned ? 'Click and drag to float window' : 'Drag to move window'}
        >
          {/* Left: Drag Handle, Icon, Title (Strictly aligned, white non-interactive elements) */}
          <div className="flex items-center gap-1.5 leading-none min-w-0">
            <Icon name="drag_indicator" className="text-white/40 text-sm shrink-0" />
            <Icon name={icon} className="text-white text-base shrink-0" />
            <span className="font-bold text-white text-[var(--header-font-size)] tracking-tight truncate">
              {title}
            </span>
          </div>

          {/* Right: Actions (Pin/Unpin toggle and Close button) */}
          <div className="flex items-center gap-1 leading-none shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isPinned) {
                  unpinAtCurrentRect()
                } else {
                  setPinned(true)
                }
              }}
              className="text-white/80 hover:text-white cursor-pointer p-1 rounded-none hover:bg-muted/50 transition-colors flex items-center justify-center"
              title={isPinned ? 'Unpin into floating window' : 'Dock under Value colourbar'}
              aria-label={isPinned ? 'Unpin window' : 'Dock window'}
            >
              <PushpinIcon isPinned={isPinned} className="text-white w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white cursor-pointer p-1 rounded-none hover:bg-muted/50 transition-colors flex items-center justify-center"
              aria-label="Close window"
              title="Close window"
            >
              <Icon name="close" className="text-white text-sm" />
            </button>
          </div>
        </div>

        {/* Window Body Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-[var(--cell-padding)]">
          {children}
        </div>

        {/* Resize Handles (Enabled when unpinned) */}
        {!isPinned && (
          <>
            {/* Right border resize handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'resize-e')}
              className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/40 active:bg-primary transition-colors z-20"
              title="Resize width"
            />
            {/* Bottom border resize handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'resize-s')}
              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize hover:bg-primary/40 active:bg-primary transition-colors z-20"
              title="Resize height"
            />
            {/* Bottom-right corner resize handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, 'resize-se')}
              className="absolute right-0 bottom-0 w-3.5 h-3.5 cursor-nwse-resize hover:bg-primary/60 active:bg-primary transition-colors z-30 flex items-end justify-end p-0.5"
              title="Resize window"
            >
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-white/60" />
            </div>
          </>
        )}
      </div>
    </>
  )

  // When unpinned, portal directly to document.body to break out of any parent stacking context
  if (!isPinned && typeof document !== 'undefined') {
    return createPortal(windowElement, document.body)
  }

  return windowElement
}

export default Window
