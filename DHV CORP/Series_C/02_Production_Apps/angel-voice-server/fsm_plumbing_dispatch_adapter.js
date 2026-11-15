// Path shim (COS 2026-10-22): voice_webhook_server.js requires './fsm_plumbing_dispatch_adapter' inside a try/catch; the real file lives in Series_C/scripts.
module.exports = require('../../scripts/fsm_plumbing_dispatch_adapter');
