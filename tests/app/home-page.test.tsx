// F-31: /home "use client" + async tanımlıydı; React istemcide her render'da yeni bir Promise
// gördüğü için "uncached promise" / "async/await is not yet supported" hatası basıyordu.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@clerk/nextjs", () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
    return {
        SignedIn: Pass,
        SignedOut: Pass,
        SignInButton: Pass,
        SignUpButton: Pass,
        UserButton: () => null,
    };
});
vi.mock("@/components/mode-toggle", () => ({ ModeToggle: () => null }));
vi.mock("@/components/home/help-section", () => ({ HelpSection: () => null }));

import HomePage from "@/app/(home)/home/page";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("/home sayfası", () => {
    it("async Client Component değildir ve istemcide React hatası basmadan render edilir", () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(Object.prototype.toString.call(HomePage)).not.toBe("[object AsyncFunction]");

        render(<HomePage />);

        expect(screen.getByText("Vault'a Hoşgeldiniz")).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
    });
});
