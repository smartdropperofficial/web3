export const log = {
  success: (message: string) =>
    console.log(`\x1b[32m%s\x1b[0m`, `✅ ${message}`),
  error: (message: string) => console.log(`\x1b[31m%s\x1b[0m`, `❌ ${message}`),
  info: (message: string) => console.log(`\x1b[34m%s\x1b[0m`, `ℹ️ ${message}`),
};
