'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dict } from '@/lib/i18n/dictionaries';

export function CommandPalette({ dict }: { dict: Dict }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost px-3 py-1.5 text-xs"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">⌕</span>
        <span className="hidden sm:inline">{dict.search}</span>
        <kbd className="ms-1 rounded border border-line px-1 text-[10px]">⌘K</kbd>
      </button>
      <CommandPaletteDialog
        open={open}
        value={value}
        dict={dict}
        inputRef={inputRef}
        onChange={setValue}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function CommandPaletteDialog({
  open,
  value,
  dict,
  inputRef,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  dict: Dict;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.commandPalette}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const q = value.trim();
          if (!q) return;
          onClose();
          router.push(`/app/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <input
          ref={inputRef}
          className="input py-3 text-base shadow-lg"
          placeholder={dict.searchPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={dict.searchPlaceholder}
        />
      </form>
    </div>
  );
}
