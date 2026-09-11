import fs from 'fs';

async function run() {
  const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/3A8C8D1FB7AD07DD4D8D82196B2D62C3');
  await new Promise(r => ws.onopen = r);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 1) {
      console.log('Tested in browser');
    }
  };

  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 500);
}

run().catch(console.error);
