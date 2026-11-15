/** Local test-enablement stub (this directory is gitignored; not shipped). */
async function sendSms({ to, from, body }) {
  return { sent: true, dryRun: true, to, from, body };
}
module.exports = { sendSms };
