import { renderToTags } from '../head.tsx'
import log from '../log.ts'
import { acorn, astring, fs, path, React, ReactDomServer, Sha1 } from '../package.ts'
import { RouterContext, RouterState, URI } from '../router.ts'
import util from '../util.ts'
import { AppConfig, loadAppConfig } from './config.ts'

const code = 'let num=1+2*(3+4)-5;'
const ast = acorn.parse(code, { ecmaVersion: 9 })
const formattedCode = astring.generate(ast)
console.log(formattedCode)

export class App {
    readonly mode: 'development' | 'production'
    readonly config: AppConfig
    readonly modules: Map<string, { hash: string, raw: string, js?: string, sourceMap?: string }>

    constructor(appDir: string, mode: 'development' | 'production') {
        this.mode = mode
        this.config = loadAppConfig(appDir)
        this.modules = new Map()
        this._init()
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }

    private async _init() {
        const w = fs.walk(this.srcDir, { includeDirs: false, exts: ['.ts', '.tsx'] })
        for await (const { path } of w) {
            if (!path.endsWith('.d.ts')) {
                const info = await Deno.stat(path)
                const name = util.trimPrefix(util.trimPrefix(path, this.srcDir), '/')
                if (info.size < 1 << 20) {
                    const raw = await Deno.readTextFile(path)
                    const hasher = new Sha1()
                    this.modules.set(name, { hash: hasher.update(raw).hex(), raw })
                } else {
                    log.warn(`ignored module '${name}': too large(${(info.size / (1 << 20)).toFixed(2)}mb)`)
                }
            }
        }

        if (this.mode === 'development') {
            this._watch()
        }
    }

    private async _watch() {
        const w = Deno.watchFs(this.srcDir, { recursive: true })
        for await (const event of w) {
            console.log('>>> event', event)
        }
    }

    async build() {

    }

    async renderPage(uri: URI) {
        const modules = Array.from(this.modules.keys())
        const appModule = modules.find(key => ['app.tsx', 'app.ts'].includes(key))
        const pageModule = modules.find(key => {
            if (key.startsWith('pages/')) {
                const pagePath = util.trimPrefix(key, 'pages').replace(/(\/index)?.tsx?$/i, '') || '/'
                return pagePath === uri.pagePath
            }
            return false
        })
        let code = 404
        let head = ['<title>404 - page not found</title>']
        let body = '<p><strong><code>404</code></strong><small> - </small><span>page not found</span></p>'
        if (pageModule) {
            try {
                let App = React.Fragment
                let appStaticProps = null
                if (appModule) {
                    const mod = await import(path.join(this.srcDir, appModule))
                    if (mod.default && util.isFunction(mod.default)) {
                        const getStaticProps = mod.default.getStaticProps || mod.getStaticProps
                        if (util.isFunction(getStaticProps)) {
                            const props = await getStaticProps()
                            if (util.isObject(props)) {
                                appStaticProps = props
                            }
                        }
                        App = mod.default
                    }
                }
                const mod = await import(path.join(this.srcDir, pageModule))
                const ret = ReactDomServer.renderToString(
                    React.createElement(
                        RouterContext.Provider,
                        { value: new RouterState(uri) },
                        React.createElement(
                            App,
                            appStaticProps,
                            React.createElement(
                                mod.default,
                                await ((mod.default || {}).getStaticProps || mod.getStaticProps || (() => null))(uri)
                            )
                        )
                    )
                )
                code = 200
                head = renderToTags()
                body = `<main>${ret}</main>`
            } catch (err) {
                code = 500
                head = ['<title>500 - render error</title>']
                body = `<p><strong><code>500</code></strong><small> - </small><span>render error: ${err.message}</span></p>`
            }
        }
        return { code, head, body }
    }
}
