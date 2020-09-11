/**
 * postjs hmr
 * @link https://github.com/facebook/react/issues/16604#issuecomment-528663101
 * @link https://github.com/pikapkg/esm-hmr
 */

import events from './events.ts'
import util from './util.ts'
import runtime from './vendor/react-refresh/runtime.js'

interface Callback {
    (...args: any[]): void
}

interface IWebSocket {
    readonly OPEN: number
    readyState: number
    send(message: string): void
    addEventListener(event: string, callback: Callback): void
}

class Module {
    #id: string
    #hmr: HMR
    #isLocked: boolean = false
    #isAccepted: boolean = false
    #acceptCallbacks: Callback[] = []

    get id() {
        return this.#id
    }

    constructor(id: string, hmr: HMR) {
        this.#id = id
        this.#hmr = hmr
    }

    lock(): void {
        this.#isLocked = true
    }

    accept(callback?: () => void): void {
        if (this.#isLocked) {
            return
        }
        if (!this.#isAccepted) {
            this.#hmr.sendMessage({ id: this.id, type: 'hotAccept' })
            this.#isAccepted = true
        }
        if (callback) {
            this.#acceptCallbacks.push(callback)
        }
    }

    async applyUpdate(updateUrl: string) {
        try {
            const module = await import(updateUrl)
            this.#acceptCallbacks.forEach(cb => cb(module))
        } catch (e) {
            location.reload()
        }
    }
}

class HMR {
    #modules: Map<string, Module>
    #messageQueue: any[]
    #socket: IWebSocket

    constructor() {
        this.#modules = new Map()
        this.#messageQueue = []
        this.#socket = new WebSocket((protocol === 'https:' ? 'wss' : 'ws') + '://' + host + '/_hmr', /*  'postjs-hmr' */)
        this.#socket.addEventListener('open', () => {
            this.#messageQueue.forEach(msg => this.#socket.send(JSON.stringify(msg)))
            this.#messageQueue = []
        })
        this.#socket.addEventListener('message', ({ data: rawData }: { data?: string }) => {
            if (!rawData) {
                return
            }
            const { type, id, updateUrl, hash } = JSON.parse(rawData)
            if (type === 'add') {
                events.emit('add-module', id, hash)
                console.log(`[HMR] add module ${JSON.stringify({ id, hash })}`)
            } else if (type === 'update' && this.#modules.has(id)) {
                const mod = this.#modules.get(id)!
                mod.applyUpdate(updateUrl)
                console.log(`[HMR] update module '${id}'`)
            } else if (type === 'remove' && this.#modules.has(id)) {
                this.#modules.delete(id)
                events.emit('remove-module', id)
                console.log(`[HMR] remove module '${id}'`)
            }
        })
        console.log('[HMR] listening for file changes...')
    }

    createHotContext(id: string) {
        if (this.#modules.has(id)) {
            const mod = this.#modules.get(id)!
            mod.lock()
            return mod
        }

        const mod = new Module(id, this)
        this.#modules.set(id, mod)
        return mod
    }

    sendMessage(msg: any) {
        if (this.#socket.readyState !== this.#socket.OPEN) {
            this.#messageQueue.push(msg)
        } else {
            this.#socket.send(JSON.stringify(msg))
        }
    }
}

const { location, WebSocket } = window as any
const { protocol, host } = location
const hmr = new HMR()

export const createHotContext = (id: string) => hmr.createHotContext(id)
export const performReactRefresh = util.debounce(runtime.performReactRefresh, 30)
export const RefreshRuntime = runtime

runtime.injectIntoGlobalHook(window)
Object.assign(window, {
    $RefreshReg$: () => { },
    $RefreshSig$: () => (type: any) => type
})
