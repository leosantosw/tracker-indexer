'use strict';

/** An error the API can show as is: HTTP status, stable `code`, pt-BR message. */
class DebridError extends Error {
  constructor(message, statusCode, code, options) {
    super(message, options);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { DebridError };
