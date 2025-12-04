import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Color codes for terminal output
const colors = {
  DEBUG: "\x1b[36m", // Cyan
  INFO: "\x1b[32m", // Green
  WARN: "\x1b[33m", // Yellow
  ERROR: "\x1b[31m", // Red
  RESET: "\x1b[0m",
  GRAY: "\x1b[90m", // Gray for timestamps
  BOLD: "\x1b[1m",
};

class Logger {
  private currentLevel: LogLevel;
  private logToFile: boolean;
  private logFilePath: string;

  constructor() {
    // Read log level from environment (default to INFO)
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || "INFO";
    this.currentLevel =
      LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;

    // File logging configuration
    this.logToFile = process.env.LOG_TO_FILE === "true";
    this.logFilePath = process.env.LOG_FILE_PATH || "./logs/bot.log";

    // Create logs directory if file logging is enabled
    if (this.logToFile) {
      const logsDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    }
  }

  /**
   * Format timestamp
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
  }

  /**
   * Format log message
   */
  private formatMessage(
    level: string,
    context: string,
    message: string,
    data?: any,
  ): string {
    const timestamp = this.getTimestamp();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${level}] [${context}] ${message}${dataStr}`;
  }

  /**
   * Write to file if enabled
   */
  private writeToFile(message: string): void {
    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFilePath, message + "\n");
      } catch (error) {
        // Fail silently to avoid infinite loop
      }
    }
  }

  /**
   * Log with specific level
   */
  private log(
    level: LogLevel,
    levelName: string,
    color: string,
    context: string,
    message: string,
    data?: any,
    error?: Error,
  ): void {
    if (level < this.currentLevel) {
      return; // Skip if below current log level
    }

    const formattedMessage = this.formatMessage(
      levelName,
      context,
      message,
      data,
    );

    // Console output with colors
    const coloredOutput =
      `${colors.GRAY}[${this.getTimestamp()}]${colors.RESET} ` +
      `${color}${colors.BOLD}[${levelName}]${colors.RESET} ` +
      `${colors.BOLD}[${context}]${colors.RESET} ` +
      `${message}` +
      (data ? ` ${colors.GRAY}${JSON.stringify(data)}${colors.RESET}` : "");

    console.log(coloredOutput);

    // Log error stack if provided
    if (error) {
      console.error(`${color}${error.stack}${colors.RESET}`);
      this.writeToFile(formattedMessage + "\n" + error.stack);
    } else {
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * Debug level logging
   */
  debug(context: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, "DEBUG", colors.DEBUG, context, message, data);
  }

  /**
   * Info level logging
   */
  info(context: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, "INFO", colors.INFO, context, message, data);
  }

  /**
   * Warning level logging
   */
  warn(context: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, "WARN", colors.WARN, context, message, data);
  }

  /**
   * Error level logging
   */
  error(context: string, message: string, data?: any, error?: Error): void {
    this.log(
      LogLevel.ERROR,
      "ERROR",
      colors.ERROR,
      context,
      message,
      data,
      error,
    );
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }
}

// Export singleton instance
export const logger = new Logger();
