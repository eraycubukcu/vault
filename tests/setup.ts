import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";
// Next, sunucu derlemesinde "server-only"yi boş modüle çevirir; testlerde de aynısı.
vi.mock("server-only", () => ({}));
