import { utils } from '@postjs/core'
import { EventEmitter } from 'events'
import http from 'http'
import { parse } from 'url'
import { server as WebsocketServer } from 'websocket'
import { getContentType, sendText } from '.'
import { DevWatcher } from '../build/dev'

export function start(appDir: string, port: number) {
    const emitter = new EventEmitter().setMaxListeners(1 << 30)
    const watcher = new DevWatcher(appDir)
    const httpServer = http.createServer(async (req, res) => {
        const url = parse(req.url || '/')
        const pathname = utils.cleanPath((url.pathname || '/'))

        if (pathname.startsWith('/_post/')) {
            if (pathname === '/_post/build-manifest.js') {
                sendText(req, res, 200, 'application/javascript', 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(watcher.buildManifest))
                return
            }

            if (pathname.startsWith('/_post/pages/') && pathname.endsWith('.json')) {
                const pagePath = utils.trimPrefix(pathname, '/_post/pages').replace(/(index)?\.json?$/i, '')
                const staticProps = await watcher.getPageStaticProps(pagePath)
                if (utils.isObject(staticProps)) {
                    sendText(req, res, 200, 'application/json', JSON.stringify({ staticProps }))
                    return
                }
            }

            if (pathname.endsWith('.js')) {
                const name = utils.trimSuffix(utils.trimPrefix(pathname, '/_post/'), '.js')
                const chunk = watcher.getChunk(name)
                if (chunk !== null) {
                    let { content } = chunk
                    if (name === 'app') {
                        const appStaticProps = await watcher.getAppStaticProps()
                        if (appStaticProps) {
                            content = '(window.__POST_APP = window.__POST_APP || {}).staticProps = ' + JSON.stringify(appStaticProps) + ';\n' + content
                        }
                    }
                    sendText(req, res, 200, 'application/javascript', content)
                    return
                }
            }

            res.statusCode = 404
            res.end('file not found')
            return
        }

        if (pathname.endsWith('.hot-update.json') || pathname.endsWith('.hot-update.js')) {
            const content = watcher.getOutputContent(pathname)
            if (content !== null) {
                sendText(req, res, 200, getContentType(pathname), content.toString())
                return
            }

            res.statusCode = 404
            res.end('file not found')
        }

        // todo: serve the public static files

        const [statusCode, html] = await watcher.getPageHtml(pathname.replace(/(index)?\.html?$/i, ''))
        sendText(req, res, statusCode, 'text/html', html)
    })
    const wsServer = new WebsocketServer({ httpServer })

    watcher.watch(emitter)
    httpServer.listen(port)
    wsServer.on('request', req => {
        const conn = req.accept('hot-update', req.origin)
        const sendUpdate = async manifest => {
            conn.sendUTF(JSON.stringify(manifest))
        }
        emitter.on('webpackHotUpdate', sendUpdate)
        conn.on('close', () => {
            emitter.off('webpackHotUpdate', sendUpdate)
        })
    })

    console.log(`Server ready on http://localhost:${port}`)
}
