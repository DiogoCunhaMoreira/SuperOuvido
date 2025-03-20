// https://nuxt.com/docs/api/configuration/nuxt-config
import * as path from "path";
export default defineNuxtConfig({
  // Disable SSR since we're using browser-only APIs
  ssr: false,

  app: {
    head: {
      title: "Piano Chord Detector",
      script: [
        // Adiciona Long.js antes de qualquer outro script
        {
          src: "https://cdn.jsdelivr.net/npm/long@4.0.0/dist/long.js",
          tagPosition: "head",
        },
        // Script para garantir que Long.fromString esteja disponível
        {
          innerHTML: `
            if (window.Long && !window.Long.fromString) {
              window.Long.fromString = function(str, radix) {
                return new window.Long(parseInt(str, radix || 10));
              };
            }
          `,
          type: "text/javascript",
        },
      ],
    },
  },
  // TensorFlow.js and BasicPitch require specific handling
  build: {
    transpile: ["@spotify/basic-pitch", "@tensorflow/tfjs", "long"],
  },

  // Properly handle imports
  vite: {
    optimizeDeps: {
      include: ["@spotify/basic-pitch", "@tensorflow/tfjs"],
    },
    // Adicionar resolução para o problema do @tonejs/midi
    resolve: {
      alias: {
        long: path.resolve("./node_modules/long"),
        "@tonejs/midi": "@tonejs/midi/dist/Midi.js",
      },
    },
  },

  compatibilityDate: "2025-03-18",
});
