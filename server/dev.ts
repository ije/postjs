import { App } from '../app/app.ts'
import { existsSync, path, serve } from '../deps.ts'
import { createHtml } from '../html.ts'
import log from '../log.ts'
import util from '../util.ts'
import { getContentType } from './mime.ts'

export async function start(appDir: string, port: number) {
    const app = new App(appDir, 'development')
    const s = serve({ port })
    log.info(`Server ready on http://localhost:${port}`)

    for await (const req of s) {
        const urlSegments = req.url.split('?', 2)
        const pathname = util.cleanPath(urlSegments[0])

        try {
            //serve apis
            if (pathname.startsWith('/api/')) {
                app.callAPI(req, util.trimPrefix(pathname, '/api'))
                continue
            }

            // serve js files
            if (pathname.endsWith('.js') || pathname.endsWith('.js.map')) {
                const requsetMap = pathname.endsWith('.js.map')
                const mod = app.getModule(util.trimSuffix(pathname, '.map'))
                if (mod) {
                    const inm = req.headers.get('If-None-Match')
                    if (inm && inm === mod.sourceHash) {
                        req.respond({
                            status: 304
                        })
                        continue
                    }
                    req.respond({
                        status: 200,
                        headers: new Headers({
                            'Content-Type': `application/${requsetMap ? 'json' : 'javascript'}; charset=utf-8`,
                            'ETag': mod.sourceHash
                        }),
                        body: requsetMap ? mod.sourceMap : mod.compiledJs
                    })
                    continue
                }
            }

            // serve public files
            if (path.basename(pathname).includes('.')) {
                const filePath = path.join(app.config.rootDir, 'public', pathname)
                if (existsSync(filePath)) {
                    const body = await Deno.readFile(filePath)
                    req.respond({
                        status: 200,
                        headers: new Headers({
                            'Content-Type': getContentType(filePath)
                        }),
                        body
                    })
                    continue
                }
            }

            const [status, html] = await app.getPageHtml(pathname, urlSegments[1])
            req.respond({
                status,
                headers: new Headers({
                    'Content-Type': 'text/html'
                }),
                body: html
            })
        } catch (err) {
            req.respond({
                status: 500,
                headers: new Headers({ 'Content-Type': 'text/html' }),
                body: createHtml({
                    lang: app.config.lang,
                    head: ['<title>500 - internal server error</title>'],
                    body: `<p><strong><code>500</code></strong><small> - </small><span>${err.message}</span></p>`
                })
            })
        }
    }
}
