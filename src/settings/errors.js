'use strict';

class SettingsError extends Error {
  statusCode = 400;
}

module.exports = { SettingsError };
