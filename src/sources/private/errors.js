'use strict';

class PrivateSourceError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
  }
}

module.exports = { PrivateSourceError };
