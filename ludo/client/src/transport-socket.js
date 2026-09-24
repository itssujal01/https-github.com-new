// Transport for the Node.js server: a Socket.IO connection.
import { io } from 'socket.io-client';

export function createTransport() {
  const socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
  return {
    on: (event, fn) => socket.on(event, fn),
    get connected() { return socket.connected; },
    setSession() {},
    call(event, payload) {
      return new Promise((resolve) => {
        if (!socket.connected) return resolve({ ok: false, error: 'Not connected, retrying…' });
        socket.timeout(8000).emit(event, payload, (err, res) => {
          resolve(err ? { ok: false, error: 'Server did not respond' } : res);
        });
      });
    },
  };
}
