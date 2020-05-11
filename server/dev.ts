import { App } from '../app/app.ts'
import { server } from '../deps.ts'
import { createHtml } from '../html.ts'
import log from '../log.ts'

export async function start(appDir: string, port: number) {
    const app = new App(appDir, 'development')
    const s = server.serve({ port })
    log.info(`Server ready on http://localhost:${port}`)
    for await (const req of s) {
        req.respond({
            status: 404,
            headers: new Headers({ 'Content-Type': 'text/html' }),
            body: createHtml({
                lang: app.config.lang,
                head: ['<title>404 - page not found</title>'],
                body: '<p><strong><code>404</code></strong><small> - </small><span>page not found</span></p>'
            })
        })
    }
}
