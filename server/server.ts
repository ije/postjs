import { createHtml } from '../html.ts'
import log from '../log.ts'
import Project from '../project.ts'
import route from '../route.ts'
import { existsSync, path, serve, ws } from '../std.ts'
import util from '../util.ts'
import { PostAPIRequest, PostAPIResponse } from './api.ts'
import { getContentType } from './mime.ts'

export async function start(appDir: string, port: number, isDev = false) {
    const project = new Project(appDir, 'development')
    await project.ready

    try {
        const s = serve({ port })
        log.info(`Server ready on http://localhost:${port}`)
        for await (const req of s) {
            let [pathname, search] = util.splitBy(req.url, '?')
            pathname = util.cleanPath(pathname)

            try {
                if (pathname.startsWith('/_hmr')) {
                    const { conn, r: bufReader, w: bufWriter, headers } = req
                    ws.acceptWebSocket({ conn, bufReader, bufWriter, headers }).then(async socket => {
                        const watcher = project.createFSWatcher()
                        for await (const e of socket) {
                            if (util.isNEString(e)) {
                                try {
                                    const data = JSON.parse(e)
                                    if (data.type === 'hotAccept' && util.isNEString(data.id)) {
                                        const mod = project.getModule(data.id)
                                        if (mod) {
                                            watcher.on(mod.id, (type: string, hash?: string) => {
                                                if (type == 'modify') {
                                                    socket.send(JSON.stringify({
                                                        type: 'update',
                                                        id: mod.id,
                                                        updateUrl: path.resolve(path.join(project.config.baseUrl, '/_dist/'), mod.id.replace(/\.js$/, '') + `.${hash!.slice(0, 9)}.js`)
                                                    }))
                                                }
                                            })
                                        }
                                    }
                                } catch (e) { }
                            }
                        }
                        project.removeFSWatcher(watcher)
                    })
                    continue
                }

                //serve apis
                if (pathname.startsWith('/api/')) {
                    const { pagePath, params, query } = route(
                        project.config.baseUrl,
                        project.apiPaths,
                        { location: { pathname, search } }
                    )
                    const handle = await project.getAPIHandle(pagePath)
                    if (handle) {
                        handle(
                            new PostAPIRequest(req, params, query),
                            new PostAPIResponse(req)
                        )
                    } else {
                        req.respond({
                            status: 404,
                            headers: new Headers({ 'Content-Type': `application/javascript; charset=utf-8` }),
                            body: 'page not found'
                        })
                    }
                    continue
                }

                // serve js files
                if (pathname.endsWith('.js') || pathname.endsWith('.js.map')) {
                    const reqSourceMap = pathname.endsWith('.js.map')
                    const mod = project.getModuleByPath(reqSourceMap ? pathname.slice(0, -4) : pathname)
                    if (mod) {
                        const etag = req.headers.get('If-None-Match')
                        if (etag && etag === mod.hash) {
                            req.respond({
                                status: 304
                            })
                            continue
                        }
                        let { jsContent, id } = mod
                        if (id === './app.js' || id.startsWith('./pages/')) {
                            const { staticProps } = await project.importModuleAsComponent(id)
                            if (staticProps) {
                                jsContent = 'export const __staticProps = ' + JSON.stringify(staticProps) + ';\n\n' + jsContent
                            }
                        }
                        if (project.isHMRable(id)) {
                            let hmrImportPath = path.relative(
                                path.dirname(path.resolve('/', id)),
                                '/-/postjs.io/hmr.js'
                            )
                            if (!hmrImportPath.startsWith('.') && !hmrImportPath.startsWith('/')) {
                                hmrImportPath = './' + hmrImportPath
                            }
                            jsContent = injectHmrCode(id, hmrImportPath, jsContent, id.endsWith('.js'))
                        }
                        req.respond({
                            status: 200,
                            headers: new Headers({
                                'Content-Type': `application/${reqSourceMap ? 'json' : 'javascript'}; charset=utf-8`,
                                'ETag': mod.hash
                            }),
                            body: reqSourceMap ? mod.jsSourceMap : jsContent
                        })
                        continue
                    }
                }

                // serve public files
                if (path.basename(pathname).includes('.')) {
                    const filePath = path.join(project.rootDir, 'public', pathname)
                    if (existsSync(filePath)) {
                        const body = await Deno.readFile(filePath)
                        req.respond({
                            status: 200,
                            headers: new Headers({ 'Content-Type': getContentType(filePath) }),
                            body
                        })
                        continue
                    }
                }

                const [status, html] = await project.getPageHtml({ pathname, search })
                req.respond({
                    status,
                    headers: new Headers({ 'Content-Type': 'text/html' }),
                    body: html
                })
            } catch (err) {
                req.respond({
                    status: 500,
                    headers: new Headers({ 'Content-Type': 'text/html' }),
                    body: createHtml({
                        lang: 'en',
                        head: ['<title>500 - internal server error</title>'],
                        body: `<p><strong><code>500</code></strong><small> - </small><span>${err.message}</span></p>`
                    })
                })
            }
        }
    } catch (err) {
        if (err instanceof Deno.errors.AddrInUse) {
            log.error(`address :${port} already in use`)
        } else {
            console.log(err)
        }
        Deno.exit(1)
    }
}

function injectHmrCode(modId: string, hmrImportPath: string, code: string, reactRefresh: boolean) {
    const text: string[] = [
        `import { createHotContext, RefreshRuntime, performReactRefresh } from ${JSON.stringify(hmrImportPath)}`,
        `import.meta.hot = createHotContext(${JSON.stringify(modId)})`
    ]
    if (reactRefresh) {
        text.push(
            `const prevRefreshReg = window.$RefreshReg$`,
            `const prevRefreshSig = window.$RefreshSig$`,
            `window.$RefreshReg$ = (type, id) => {`,
            `    RefreshRuntime.register(type, ${JSON.stringify(modId)} + " " + id)`,
            `}`,
            `window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform`
        )
    }
    text.push('')
    text.push(code)
    text.push('')
    if (reactRefresh) {
        text.push(
            'window.$RefreshReg$ = prevRefreshReg',
            'window.$RefreshSig$ = prevRefreshSig',
            'import.meta.hot.accept(performReactRefresh)'
        )
    } else {
        text.push(
            'import.meta.hot.accept()'
        )
    }
    return text.join('\n')
}
