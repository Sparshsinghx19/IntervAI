import { app } from './app.js';

// Hosting platforms provide the port; 4000 is the local default.
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Express API is listening on port ${port}`);
});
