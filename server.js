// Root server file to ensure Railway can find and run our server
import('./node-server/index.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
}); 