import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <header className="pagehead">
      <div>
        <div className="eyebrow">Personal workspace</div>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  )
}
export function Card({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card cardpad ${className}`}>
      {title && (
        <div className="sectionhead">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  )
}
export function Progress({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div
      className="pbar"
      role="progressbar"
      aria-label="Task completion"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const label = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="modal"
    >
      <div className="modal-head">
        <h2 id={label}>{title}</h2>
        <button className="iconbtn" aria-label="Close dialog" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
