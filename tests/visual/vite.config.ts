import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: at("./"),
  envDir: false,
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: "@/hooks/use-current-user", replacement: at("./identity-stub.ts") },
      { find: "@/integrations/supabase/client", replacement: at("./auth-stub.ts") },
      { find: "@/lib/project-allocation.functions", replacement: at("./server-stub.ts") },
      { find: "@/lib/project-photos.functions", replacement: at("./server-stub.ts") },
      { find: "@tanstack/react-start", replacement: at("./start-stub.ts") },
      { find: "@", replacement: at("../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 8784, strictPort: true, fs: { allow: [at("../../")] } },
});
