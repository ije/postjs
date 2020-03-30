import { EventEmitter } from 'events'
import fs from 'fs'
import { server as WebsocketServer } from 'websocket'
import http, { IncomingMessage, ServerResponse } from 'http'
import mime from 'mime/lite'
import path from 'path'
import { parse } from 'url'
import zlib from 'zlib'
import { AppWatcher } from '../build/watcher'
import utils from '../shared/utils'

export class Server {
    private _appDir: string
    private _mode: 'development' | 'production'

    constructor(dir: string, mode: 'development' | 'production') {
        const appDir = path.resolve(dir)
        if (!fs.existsSync(appDir)) {
            console.error(`no such directory: ${dir}`)
            process.exit(0)
        }

        this._appDir = dir
        this._mode = mode
    }

    start(port: number) {
        if (this._mode === 'development') {
            const emitter = new EventEmitter()
            const watcher = new AppWatcher(this._appDir)
            const httpServer = http.createServer(async (req, res) => {
                const url = parse(req.url || '/')
                const pathname = utils.cleanPath((url.pathname || '/'))

                console.log('new request:', pathname)
                if (pathname.endsWith('.hot-update.json') || pathname.endsWith('.hot-update.js')) {
                    const content = watcher.getHotUpdateContent(pathname)
                    if (content === null) {
                        res.statusCode = 404
                        res.end('file not found')
                        return
                    }

                    sendText(req, res, 200, mime.getType(path.extname(pathname)), content)
                    return
                }

                if (pathname.startsWith('/_post/')) {
                    if (pathname === '/_post/build-manifest.js') {
                        sendText(req, res, 200, mime.getType('js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(watcher.buildManifest))
                        return
                    }

                    if (pathname.startsWith('/_post/data/') && pathname.endsWith('.json')) {
                        const pagePath = utils.trimPrefix(pathname, '/_post/data').replace(/(index)?\.json?$/i, '')
                        const staticProps = await watcher.getPageStaticProps(pagePath)
                        if (!utils.isObject(staticProps)) {
                            res.statusCode = 404
                            res.end('file not found')
                            return
                        }

                        sendText(req, res, 200, mime.getType('json'), JSON.stringify({ staticProps }))
                        return
                    }

                    const chunk = watcher.getChunk(utils.trimPrefix(pathname, '/_post/'))
                    if (chunk === null) {
                        res.statusCode = 404
                        res.end('file not found')
                        return
                    }

                    sendText(req, res, 200, mime.getType('js'), chunk!.content)
                    return
                }

                const [statusCode, html] = await watcher.getPageHtml(pathname.replace(/(index)?\.html?$/i, ''))
                sendText(req, res, statusCode, 'text/html', html)
            }).listen(port)
            const wsServer = new WebsocketServer({
                httpServer
            })

            wsServer.on('request', req => {
                const conn = req.accept('hot-update', req.origin)
                emitter.on('webpackUpdate', async ({ hash }) => {
                    conn.sendUTF(JSON.stringify({ hash }))
                })
            })

            watcher.watch(emitter)
        }
    }
}

// sendText sends text with compression
function sendText(req: IncomingMessage, res: ServerResponse, statusCode: number, contentType: string, text: string) {
    const buf = Buffer.from(text, 'utf-8')
    const acceptEncoding = String(req.headers['accept-encoding'] || '')

    // Note: This is not a conformant accept-encoding parser.
    // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    let compressFn: ((buf: Buffer, callback: (err: Error | null, ret: Buffer) => void) => void) | null = null
    let compressType: string | null = null
    if (buf.length > 1024) {
        if (/\bgzip\b/.test(acceptEncoding)) {
            compressFn = zlib.gzip
            compressType = 'gzip'
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
            compressFn = zlib.deflate
            compressType = 'deflate'
        }
    }

    if (compressFn !== null) {
        compressFn(buf, (err, ret) => {
            if (err !== null) {
                res.statusCode = 500
                res.end('file not found')
                return
            }
            res.writeHead(statusCode, { 'Content-Type': contentType, 'Content-Encoding': compressType! })
            res.end(ret)
        })
    } else {
        res.writeHead(statusCode, { 'Content-Type': contentType })
        res.end(buf)
    }
}
