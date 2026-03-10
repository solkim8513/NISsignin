const crypto = require('crypto');

function createResponseToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { createResponseToken };
