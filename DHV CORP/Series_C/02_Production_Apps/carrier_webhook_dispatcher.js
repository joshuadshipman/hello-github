// Path shim (COS 2026-10-22): voice_webhook_server.js requires './carrier_webhook_dispatcher' inside a try/catch; the real file lives in Series_C/scripts.
module.exports = require('../../scripts/carrier_webhook_dispatcher');
