const app = require('./app');
const { bootstrapDb } = require('./db/bootstrap');
const { startDailyReportScheduler } = require('./services/dailyReportScheduler');

const port = process.env.PORT || 3001;

async function start() {
  await bootstrapDb();
  let stopScheduler = () => {};
  app.listen(port, () => {
    console.log(`server listening on ${port}`);
    stopScheduler = startDailyReportScheduler();
  });

  const shutdown = () => {
    try {
      stopScheduler();
    } catch (_error) {
      // no-op
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('server startup failed', error);
  process.exit(1);
});
