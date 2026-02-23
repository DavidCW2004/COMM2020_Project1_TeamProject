import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "../../lib/cn";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
    return (
        <SelectPrimitive.Trigger
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon className="text-muted-foreground">▾</SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

export function SelectContent({
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                className={cn(
                    "relative z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-background shadow-lg",
                    // animations (tailwindcss-animate)
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
                    className
                )}
                {...props}
            >
                <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

export function SelectItem({
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-md px-2 py-2 text-sm outline-none",
                "focus:bg-muted/60 data-[state=checked]:bg-primary/10",
                className
            )}
            {...props}
        >
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="ml-auto text-primary">✓</SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    );
}