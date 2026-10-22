// @vitest-environment node
// Next'in upgrade işleyicisi, yolu bir route ile eşleşen WebSocket isteklerinin
// soketini kapatıyor (router-server.js: `if (matchedOutput) return socket.end()`).
// Socket.IO yolu bu yüzden hiçbir route dosyasıyla eşleşmemeli.
import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { SOCKET_INIT_URL, SOCKET_PATH } from "@/lib/socket/path";

const root = join(__dirname, "../../..");
const routeFiles = (urlPath: string) => {
    const rel = urlPath.replace(/^\//, "");
    return [
        `pages/${rel}.ts`,
        `pages/${rel}.tsx`,
        `pages/${rel}/index.ts`,
        `pages/${rel}/index.tsx`,
        `app/${rel}/route.ts`,
        `app/${rel}/page.tsx`,
    ];
};

describe("socket yolu", () => {
    it("başlatma ucu bir route, socket yolu ondan farklı", () => {
        expect(SOCKET_PATH).not.toBe(SOCKET_INIT_URL);
        expect(routeFiles(SOCKET_INIT_URL).some((f) => existsSync(join(root, f)))).toBe(true);
    });

    it("socket yolu hiçbir route dosyasıyla eşleşmiyor", () => {
        expect(routeFiles(SOCKET_PATH).filter((f) => existsSync(join(root, f)))).toEqual([]);
    });
});
