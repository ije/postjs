import Link from '../link.tsx'
import log from '../log.ts'
import { fs, path, React, ReactDomServer, sha1 } from '../package.ts'
import util from '../util.ts'
import { AppConfig, loadAppConfig } from './config.ts'

export class App {
    readonly mode: 'development' | 'production'
    readonly config: AppConfig
    readonly modules: Map<string, { hash: string, raw: string, js?: string }>

    constructor(appDir: string, mode: 'development' | 'production') {
        this.mode = mode
        this.config = loadAppConfig(appDir)
        this.modules = new Map()
        this._init()
        if (mode === 'development') {
            this._watch()
        }

        console.log(ReactDomServer.renderToString(React.createElement(Link, { to: "/about" }, "about")))
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }

    private async _init() {
        const w = fs.walk(this.srcDir, { includeDirs: false, exts: ['.ts', '.tsx'] })
        for await (const { filename, info } of w) {
            const name = util.trimPrefix(filename, this.srcDir).replace(/^\/+/, '')
            if (info.size < 1 << 20) {
                const content = await Deno.readFile(filename)
                const hasher = new sha1.Sha1()
                this.modules.set(name, { hash: hasher.update(content).hex(), raw: content.toString() })
            } else {
                log.warn(`ignored module '${name}': too large`)
            }
        }
    }

    private async _watch() {
        const w = Deno.fsEvents(this.srcDir, { recursive: true })
        for await (const event of w) {
            console.log('>>> event', event)
        }
    }
}
