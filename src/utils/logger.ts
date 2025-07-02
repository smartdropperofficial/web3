const RESET = "\x1b[0m";

const BG_COLORS = {
  info: "\x1b[44m", // Blu
  warn: "\x1b[43m", // Giallo
  error: "\x1b[41m", // Rosso
  debug: "\x1b[45m", // Magenta
};

const TEXT_COLORS = {
  info: "\x1b[37m", // Bianco
  warn: "\x1b[30m", // Nero
  error: "\x1b[37m", // Bianco
  debug: "\x1b[37m", // Bianco
};

type LogLevel = "info" | "warn" | "error" | "debug";

export default class Logger {
  private static getCallerInfo(): string {
    const err = new Error();
    const stackLines = err.stack?.split("\n");
    if (!stackLines || stackLines.length < 4) return "unknown";

    const callerLine = stackLines[3].trim();
    const matchNamed = callerLine.match(/at (.+?) \((.+):(\d+):(\d+)\)/);
    const matchAnon = callerLine.match(/at (.+):(\d+):(\d+)/);

    if (matchNamed) {
      const [, fnName, file, line, col] = matchNamed;
      const shortFile = file.replace(/^.*?\/(pages|src)/, "$1");
      return `${fnName} (${shortFile}:${line}:${col})`;
    } else if (matchAnon) {
      const [, file, line, col] = matchAnon;
      const shortFile = file.replace(/^.*?\/(pages|src)/, "$1");
      return `(anonymous) (${shortFile}:${line}:${col})`;
    }

    return "unknown";
  }

  private static formatMessage(
    level: LogLevel,
    ...args: unknown[]
  ): [string, ...unknown[]] {
    const now = new Date();
    const timestamp =
      `${now.getHours().toString().padStart(2, "0")}:` +
      `${now.getMinutes().toString().padStart(2, "0")}:` +
      `${now.getSeconds().toString().padStart(2, "0")}.` +
      `${now.getMilliseconds().toString().padStart(3, "0")}`;

    const bgColor = BG_COLORS[level];
    const textColor = TEXT_COLORS[level];
    const callerInfo = this.getCallerInfo();

    const prefix = `${bgColor}${textColor}[${level.toUpperCase()}]${RESET} ${timestamp} ${callerInfo}`;

    const formattedArgs = args.map((arg) =>
      typeof arg === "object" && arg !== null
        ? JSON.stringify(arg, null, 2)
        : arg
    );

    return [prefix, ...formattedArgs];
  }

  static info(...args: unknown[]) {
    console.log(...this.formatMessage("info", ...args));
  }

  static warn(...args: unknown[]) {
    console.warn(...this.formatMessage("warn", ...args));
  }

  static error(...args: unknown[]) {
    console.error(...this.formatMessage("error", ...args));
  }

  static debug(...args: unknown[]) {
    console.debug(...this.formatMessage("debug", ...args));
  }
}
