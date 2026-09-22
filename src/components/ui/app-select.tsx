import * as Select from '@radix-ui/react-select';
import { Children, Fragment, isValidElement, useCallback, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/components/motion/dropdown.css';

type Option = { value: string; label: string; disabled: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{children?: ReactNode}>(child) ? textOf(child.props.children) : String(child)).join('');
}
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{value?: string | number; disabled?: boolean; children?: ReactNode}>(child)) return [];
    if (child.type === Fragment) return optionsOf(child.props.children);
    if (child.type !== 'option') return [];
    const label = textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) }];
  });
}

type Props = {
  value: string | number;
  onValueChange: (value: string, trigger: HTMLButtonElement) => void;
  children: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** Shared app picker. Native option data preserves existing values and disabled choices. */
export function AppSelect({value, onValueChange, children, label, className, disabled, required, id, ref}: Props) {
  const trigger = useRef<HTMLButtonElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const emptyValue = useId();
  const [query, setQuery] = useState('');
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const setTrigger = useCallback((node: HTMLButtonElement | null) => {
    trigger.current = node;
    // Keep nested menus inside the enclosing dialog's focus boundary.
    setPortalContainer(node?.closest<HTMLElement>('[data-dropdown-boundary], [id^="headlessui-dialog-panel-"]')
      ?? node?.closest<HTMLElement>('[role="dialog"], dialog') ?? null);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  const options = optionsOf(children);
  const selected = options.find(option => option.value === String(value));
  const searchable = options.length > 7;
  const matches = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const validValue = selected ? selected.value : '';
  return <Select.Root value={validValue === '' ? (required ? '' : emptyValue) : validValue}
    disabled={disabled} required={required}
    onOpenChange={open => { setQuery(''); if (open && searchable) requestAnimationFrame(() => searchInput.current?.focus()); }}
    onValueChange={next => { if (trigger.current) onValueChange(next === emptyValue ? '' : next, trigger.current); }}>
    <Select.Trigger id={id} ref={setTrigger}
      aria-label={label} aria-haspopup={searchable ? 'dialog' : 'listbox'} className={cn('ns-app-select ns-select-trigger', className)}>
      <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? 'Choose an option'}</span>
      <Select.Icon className="ns-select-chevron"><ChevronDown size={16} aria-hidden /></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={portalContainer ?? undefined}>
      <Select.Content ref={content} position="popper" align="start" sideOffset={6} collisionPadding={12}
        role={searchable ? 'dialog' : 'listbox'} aria-label={`${label} options`}
        onEscapeKeyDown={event => event.stopPropagation()}
        onFocus={event => {
          // Filtering can remove Radix's focused selected item. Keep typing in
          // the search field when its fallback would focus the popup itself.
          if (searchable && event.target === event.currentTarget) searchInput.current?.focus();
        }}
        className="ns-dropdown-surface ns-select-content ns-app-select-content">
        {searchable ? <div className="ns-app-select-search">
          <Search size={15} aria-hidden />
          <input ref={searchInput} aria-label={`Search ${label.toLocaleLowerCase()}`} placeholder="Search options…" value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape' || event.key === 'Tab') return;
              event.stopPropagation();
              // Searching inside a form must never submit its existing values.
              if (event.key === 'Enter') event.preventDefault();
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const enabled = content.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])');
                (event.key === 'ArrowUp' ? enabled?.[enabled.length - 1] : enabled?.[0])?.focus();
              }
            }} />
        </div> : null}
        <Select.ScrollUpButton className="ns-select-scroll"><ChevronUp size={14} aria-hidden /></Select.ScrollUpButton>
        <Select.Viewport className="ns-select-viewport" role={searchable ? 'listbox' : undefined} aria-label={searchable ? `${label} choices` : undefined}>
          {matches.map(option => <Select.Item key={option.value} value={option.value || emptyValue}
            disabled={option.disabled || (required && option.value === '')} textValue={option.label} className="ns-dropdown-item ns-select-item">
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator className="ns-select-indicator"><Check size={14} aria-hidden /></Select.ItemIndicator>
          </Select.Item>)}
          {!matches.length ? <p role="status" className="px-3 py-3 text-sm text-mute">No matching options.</p> : null}
        </Select.Viewport>
        <Select.ScrollDownButton className="ns-select-scroll"><ChevronDown size={14} aria-hidden /></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
