'use strict';

const { EVENTS } = require('../schemas');

const HEARTBEAT_MS = 25000;

/**
 * Server-Sent Events: on connect, the current status and the recent log; then
 * every new line and status change as they happen.
 */
function registerEventRoutes(api, { feed, runner, scheduler }) {
  const streams = new Set();

  api.addHook('preClose', async () => {
    for (const end of streams) end();
  });

  api.get('/events', { schema: EVENTS }, (request, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

    send('status', runner.status());
    send('schedule', scheduler.status());
    for (const entry of feed.recent()) send('log', entry);

    const unsubscribe = feed.subscribe(send);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    const end = () => {
      clearInterval(heartbeat);
      unsubscribe();
      streams.delete(end);
      res.end();
    };
    streams.add(end);
    request.raw.on('close', end);
  });
}

module.exports = { registerEventRoutes };
