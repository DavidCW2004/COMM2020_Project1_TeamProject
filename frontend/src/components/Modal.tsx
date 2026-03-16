import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
};

export default function Modal({ isOpen, onClose, children, footer }: ModalProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCloseRef.current();
        };

        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        window.setTimeout(() => {
            const el = panelRef.current?.querySelector<HTMLElement>(
                'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
            );
            el?.focus();
        }, 0);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const modalUi = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => onCloseRef.current()}
        >
            <div className="modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <div
                ref={panelRef}
                onClick={(e) => e.stopPropagation()}
                className="modal-panel relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg outline-none"
            >
                <div className="flex items-center justify-end px-4 pt-4">
                    <button
                        type="button"
                        onClick={() => onCloseRef.current()}
                        aria-label="Close"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 pb-5 pt-3 max-h-[80vh] overflow-auto">{children}</div>

                {footer && (
                    <div className="px-6 pb-6">
                        <div className="flex justify-end gap-2">{footer}</div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalUi, document.body);
}