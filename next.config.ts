import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota só o necessário pra rodar (sem node_modules inteiro) — é o que
  // o Dockerfile de produção usa como base da imagem final.
  output: "standalone",
};

export default nextConfig;
