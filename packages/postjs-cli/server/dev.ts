import { utils } from '@postjs/core'
import { EventEmitter } from 'events'
import fs from 'fs-extra'
import http from 'http'
import path from 'path'
import { parse } from 'url'
import { server as WebsocketServer } from 'websocket'
import { getContentType, sendText } from '.'
import { DevWatcher } from '../build/dev'
import { colorful } from '../shared/colorful'

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
                    sendText(req, res, 200, 'application/javascript', chunk.content)
                    return
                }
            }

            res.statusCode = 404
            res.end('file not found')
            return
        }

        const ext = path.extname(pathname)
        if (ext) {
            try {
                let content = await watcher.readOutputFile(pathname)
                if (content === null) {
                    const filepath = path.join(appDir, 'public', pathname)
                    if (fs.existsSync(filepath)) {
                        content = await fs.readFile(filepath)
                    }
                }
                if (content !== null) {
                    const contentType = getContentType(pathname)
                    if (/\.(m?js(\.map)?|json|css|html?|xml|svg|txt)$/i.test(pathname)) {
                        sendText(req, res, 200, contentType, content.toString())
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType })
                        res.end(content)
                    }
                    return
                }
            } catch (error) {
                res.writeHead(500)
                res.end('server internal error')
                console.error('[error] serve file:', error)
                return
            }
        }

        const [statusCode, html] = await watcher.getPageHtml(pathname)
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

    console.log(colorful(`Server ready on http://localhost:${port}`, 'green'))
}
