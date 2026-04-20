const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  log:   (...args: any[]) => { if (isDev) console.log(...args); },
  info:  (...args: any[]) => { if (isDev) console.log(...args); },
  warn:  (...args: any[]) => { if (isDev) console.warn(...args); },
  error: (...args: any[]) => { if (isDev) console.error(...args); },
  debug: (...args: any[]) => { if (isDev) console.debug(...args); },
};
