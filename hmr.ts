/**
 * esm-hmr/client.ts
 * A client-side implementation of the ESM-HMR spec, for reference.
 *
 * MIT License
 *
 * Copyright (c) 2020 Fred K. Schott
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

type DisposeCallback = () => void;
type AcceptCallback = (args: { module: any; deps: any[] }) => void;
type AcceptCallbackObject = {
  deps: string[];
  callback: AcceptCallback;
};

function debug(...args: any[]) {
  console.log('[ESM-HMR]', ...args);
}

function reload() {
  window.location.reload(true);
}

let SOCKET_MESSAGE_QUEUE: any[] = [];
function _sendSocketMessage(msg: any) {
  socket.send(JSON.stringify(msg));
}
function sendSocketMessage(msg: any) {
  if (socket.readyState !== socket.OPEN) {
    SOCKET_MESSAGE_QUEUE.push(msg);
  } else {
    _sendSocketMessage(msg);
  }
}

const socketURL =
  (window as any).HMR_WEBSOCKET_URL ||
  (window.location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/';
const socket = new WebSocket(socketURL, 'esm-hmr');
socket.addEventListener('open', () => {
  SOCKET_MESSAGE_QUEUE.forEach(_sendSocketMessage);
  SOCKET_MESSAGE_QUEUE = [];
});

const REGISTERED_MODULES: { [key: string]: HotModuleState } = {};

class HotModuleState {
  id: string;
  data: any = {};
  isLocked: boolean = false;
  isDeclined: boolean = false;
  isAccepted: boolean = false;
  acceptCallbacks: AcceptCallbackObject[] = [];
  disposeCallbacks: DisposeCallback[] = [];

  constructor(id: string) {
    this.id = id;
  }

  lock(): void {
    this.isLocked = true;
  }

  dispose(callback: DisposeCallback): void {
    this.disposeCallbacks.push(callback);
  }

  invalidate(): void {
    reload();
  }

  decline(): void {
    this.isDeclined = true;
  }

  accept(_deps: string[], callback: true | AcceptCallback = true): void {
    if (this.isLocked) {
      return;
    }
    if (!this.isAccepted) {
      sendSocketMessage({ id: this.id, type: 'hotAccept' });
      this.isAccepted = true;
    }
    if (!Array.isArray(_deps)) {
      callback = _deps || callback;
      _deps = [];
    }
    if (callback === true) {
      callback = () => { };
    }
    const deps = _deps.map((dep) => {
      const ext = dep.split('.').pop();
      if (!ext) {
        dep += '.js';
      } else if (ext !== 'js') {
        dep += '.proxy.js';
      }
      return new URL(dep, `${window.location.origin}${this.id}`).pathname;
    });
    this.acceptCallbacks.push({
      deps,
      callback,
    });
  }
}

export function createHotContext(fullUrl: string) {
  const id = new URL(fullUrl).pathname;
  const existing = REGISTERED_MODULES[id];
  if (existing) {
    existing.lock();
    return existing;
  }
  const state = new HotModuleState(id);
  REGISTERED_MODULES[id] = state;
  return state;
}

async function applyUpdate(id: string) {
  const state = REGISTERED_MODULES[id];
  if (!state) {
    return false;
  }
  if (state.isDeclined) {
    return false;
  }

  const acceptCallbacks = state.acceptCallbacks;
  const disposeCallbacks = state.disposeCallbacks;
  state.disposeCallbacks = [];
  state.data = {};

  disposeCallbacks.map((callback) => callback());
  const updateID = Date.now();
  for (const { deps, callback: acceptCallback } of acceptCallbacks) {
    const [module, ...depModules] = await Promise.all([
      import(id + `?mtime=${updateID}`),
      ...deps.map((d) => import(d + `?mtime=${updateID}`)),
    ]);
    acceptCallback({ module, deps: depModules });
  }

  return true;
}

socket.addEventListener('message', ({ data: _data }: { data?: string }) => {
  if (!_data) {
    return;
  }
  const data = JSON.parse(_data);
  debug('message', data);
  if (data.type === 'reload') {
    debug('message: reload');
    reload();
    return;
  }
  if (data.type !== 'update') {
    debug('message: unknown', data);
    return;
  }
  debug('message: update', data);
  debug(data.url, Object.keys(REGISTERED_MODULES));
  applyUpdate(data.url)
    .then((ok) => {
      if (!ok) {
        reload();
      }
    })
    .catch((err) => {
      console.error(err);
      reload();
    });
});

debug('listening for file changes...');
