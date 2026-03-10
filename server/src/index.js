const app = require('./app');
const { bootstrapDb } = require('./db/bootstrap');

const port = process.env.PORT || 3001;

async function start() {
  await bootstrapDb();
  app.listen(port, () => {
    console.log(`server listening on ${port}`);
  });
}

start().catch((error) => {
  console.error('server startup failed', error);
  process.exit(1);
});
