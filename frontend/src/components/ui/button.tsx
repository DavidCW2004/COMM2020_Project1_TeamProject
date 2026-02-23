import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: Props) {
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                variant === "primary" &&
                "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed",
                variant === "secondary" &&
                "bg-muted text-foreground border border-border hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed",
                className
            )}
            {...props}
        />
    );
}