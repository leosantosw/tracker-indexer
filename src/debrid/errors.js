'use strict';

/** An error the API can show as is: HTTP status, stable `code`, pt-BR message. */
class DebridError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { DebridError };
