import { App } from '../app/app.ts'
import { colorfulTag } from '../colorful.ts'
import { createHtml } from '../html.ts'
import { server } from '../package.ts'

export async function start(appDir: string, port: number) {
    const app = new App(appDir, 'development')
    const s = server.serve({ port })
    console.log(colorfulTag('info', 'green'), `Server ready on http://localhost:${port}`)
    for await (const req of s) {
        req.respond({
            status: 404,
            headers: new Headers({'Content-Type': 'text/html'}),
            body: createHtml({
                lang: app.config.lang,
                head: ['<title>404 - page not found</title>'],
                body: '<p style="margin:50px"><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>page not found</span></p>'
            })
        })
    }
}
