import { app } from './app';

const port = 4000;

app.listen(port, () => {
  console.log(`Express API is running on http://localhost:${port}`);
});
