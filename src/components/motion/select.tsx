"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./dropdown.css";

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <SelectPrimitive.Root {...props}>
      <div className={cn("ns-select", className)}>{children}</div>
    </SelectPrimitive.Root>
  );
}

export interface SelectTriggerProps {
  "aria-label"?: string;
  className?: string;
  children: ReactNode;
}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger className={cn("ns-select-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon className="ns-select-chevron" aria-hidden>
        <ChevronDown size={15} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ className, placeholder = "Select" }: SelectValueProps) {
  return <span className={cn("ns-select-value", className)}><SelectPrimitive.Value placeholder={placeholder} /></span>;
}

export interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

export function SelectContent({ className, children }: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn("ns-dropdown-surface ns-select-content", className)}
        position="popper"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <SelectPrimitive.ScrollUpButton className="ns-select-scroll" aria-hidden>
          <ChevronUp size={14} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="ns-select-viewport">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="ns-select-scroll" aria-hidden>
          <ChevronDown size={14} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export interface SelectItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item className={cn("ns-dropdown-item ns-select-item", className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ns-select-indicator">
        <Check size={14} aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
