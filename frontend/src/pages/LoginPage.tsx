import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTempAccount, ensureCsrfCookie } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function LoginPage() {
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<"learner" | "facilitator" | "maintainer">("learner");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const disabled = useMemo(
        () => displayName.trim().length < 2 || isSubmitting,
        [displayName, isSubmitting]
    );

    const onContinue = useCallback(async () => {
        if (disabled) return;

        setError(null);
        setIsSubmitting(true);

        try {
            const response = await createTempAccount(displayName.trim(), role);
            await ensureCsrfCookie();

            const payload = {
                id: response.id,
                username: response.username,
                displayName: response.display_name,
                role: response.role,
                createdAt: new Date().toISOString(),
            };

            localStorage.setItem("sst:user", JSON.stringify(payload));

            const nextPath =
                response.role === "facilitator"
                    ? "/facilitator"
                    : response.role === "maintainer"
                        ? "/rooms" //placeholder, will implement maintainer dashboard later
                        : "/rooms";

            navigate(nextPath);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to create account";
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [disabled, displayName, navigate, role]);

    const roleCardClass = (isSelected: boolean) =>
        [
            "rounded-lg border p-4 text-left transition",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "hover:bg-muted/60 active:scale-[0.99]",
            isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-background",
        ].join(" ");

    const dotClass = (isSelected: boolean) =>
        [
            "h-4 w-4 rounded-full border transition",
            isSelected ? "bg-primary border-primary" : "bg-background border-border",
        ].join(" ");

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary/10 via-muted/40 to-background text-foreground px-4 py-10">            <div className="mx-auto w-full max-w-2xl space-y-6">
            <div className="rounded-lg border border-border bg-background/80 backdrop-blur p-6 text-center space-y-2 shadow-sm">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Social Study Teammates
                </h1>
                <p className="text-sm text-muted-foreground">
                    Collaborative learning with structured support
                </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
                <div className="space-y-6">
                    {/* Role selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-base font-semibold">Role selection</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole("facilitator")}
                                className={roleCardClass(role === "facilitator")}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={dotClass(role === "facilitator")} />
                                    <div className="min-w-0">
                                        <div className="font-medium">Facilitator</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Create & run activities
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRole("learner")}
                                className={roleCardClass(role === "learner")}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={dotClass(role === "learner")} />
                                    <div className="min-w-0">
                                        <div className="font-medium">Learner</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Join rooms & collaborate
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRole("maintainer")}
                                className={roleCardClass(role === "maintainer")}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={dotClass(role === "maintainer")} />
                                    <div className="min-w-0">
                                        <div className="font-medium">Maintainer</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Manage system & support
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Display name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="displayName">
                            Display name
                        </label>

                        <Input
                            id="displayName"
                            type="text"
                            name="name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. student A"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onContinue();
                            }}
                        />

                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Minimum 2 characters
                            </p>

                            <details className="text-xs text-muted-foreground">
                                <summary className="cursor-pointer select-none opacity-80">
                                    Data & privacy
                                </summary>
                                <div className="mt-2 leading-snug opacity-80 max-w-[44ch]">
                                    We store your display name and role to create a temporary
                                    account and let you join rooms. Avoid entering sensitive
                                    personal information.
                                </div>
                            </details>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <Button onClick={onContinue} disabled={disabled} className="w-full">
                        {isSubmitting ? "Creating…" : "Continue"}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                        Tip: press <span className="font-medium">Enter</span> to continue
                    </p>
                </div>
            </div>
        </div>
        </div>
    );
}