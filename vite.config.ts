import { defineConfig as defineViteConfig } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { env } from "node:process";

const isVercelBuild: boolean =
  Boolean(env.VERCEL && env.VERCEL !== "0") ||
  Boolean(env.VERCEL_URL);
  
export default defineViteConfig(async (env) => {
  const config = await defineLovableConfig({
    tanstackStart: {
      server: { entry: "server" },
    },
    ...(isVercelBuild
      ? {
          
          nitro: false,
        }
      : {}),
  })(env);

  if (env.command === "build" && isVercelBuild) {
    config.plugins = [
      ...(config.plugins ?? []),
      nitro({
        preset: "vercel",
        output: {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        },
      }),
    ];
  }

  return config;
});
