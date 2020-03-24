import webpack from 'webpack'
import MemoryFS from 'memory-fs'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import path from 'path'
import utils from '../../shared/utils'
import createConfig from './config'

export interface CompileResult {
    hash: string,
    chuncks: Map<string, CompileChunck>
}

export interface CompileChunck {
    name: string
    hash: string
    content: string
}

export class Compiler {
    private _mfs: MemoryFS
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler

    constructor(appDir: string, entry: string | Record<string, string>, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals'>) {
        const vmp = new VirtualModulesPlugin()
        const webpackEntry: webpack.Entry = {}
        if (utils.isNEString(entry)) {
            webpackEntry['app'] = './app.jsx'
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                webpackEntry[name] = `./${name}.jsx`
            })
        }
        this._mfs = new MemoryFS()
        this._config = {
            ...createConfig(appDir, { ...config, entry: webpackEntry }),
            plugins: [vmp]
        }
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._mfs
        if (utils.isNEString(entry)) {
            vmp.writeModule('./app.jsx', entry)
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                vmp.writeModule(String(webpackEntry[name]), entry[name])
            })
        }
    }

    get hooks() {
        return this._compiler.hooks
    }

    watch(watchOptions: webpack.Compiler.WatchOptions, handler: webpack.Compiler.Handler) {
        return this._compiler.watch(watchOptions, handler)
    }

    compile(): Promise<CompileResult> {
        return new Promise((resolve: (ret: CompileResult) => void, reject: (err: Error) => void) => {
            this._compiler.run((err, stats) => {
                if (err) {
                    reject(err)
                    return
                }

                if (stats.hash && !stats.hasErrors()) {
                    const { namedChunks } = stats.compilation
                    const ret: CompileResult = {
                        hash: stats.hash,
                        chuncks: new Map()
                    }
                    namedChunks.forEach(({ hash }, name) => {
                        const content = this.getChunckContent(name)
                        ret.chuncks.set(name, { name, hash, content })
                    })
                    resolve(ret)
                } else {
                    reject(new Error(stats.toString('minimal')))
                }
            })
        })
    }

    getChunckContent(chunckName: string): string {
        const { filename, path: outPath } = this._config.output!
        const filepath = path.join(outPath!, String(filename!).replace('[name]', chunckName))
        if (this._mfs.existsSync(filepath)) {
            return this._mfs.readFileSync(filepath).toString()
        }
        return ''
    }

    clear() {
        ['app', 'vendor'].forEach(name => {
            const { filename, path: outPath } = this._config.output!
            this._mfs.unlinkSync(path.join(outPath!, String(filename!).replace('[name]', name)))
        })
    }
}
