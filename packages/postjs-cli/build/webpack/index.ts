import webpack from 'webpack'
import MemoryFS from 'memory-fs'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import path from 'path'
import createConfig from './config'

export interface CompileResult {
    hash: string,
    chuncks: { [key: string]: string }
}

export class Compiler {
    private _mfs: MemoryFS
    private _vmp: VirtualModulesPlugin
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler

    constructor(appDir: string, entryJS: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals'>) {
        this._mfs = new MemoryFS()
        this._vmp = new VirtualModulesPlugin()
        this._config = {
            ...createConfig(appDir, config),
            plugins: [this._vmp]
        }
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._mfs
        this._vmp.writeModule(this._config.entry!['app'], entryJS)
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
                    if (stats.compilation.namedChunks.has('vendor')) {
                        resolve({ hash: stats.hash, chuncks: { app: this.getChunckContent('app'), vendor: this.getChunckContent('vendor') } })
                    } else {
                        resolve({ hash: stats.hash, chuncks: { app: this.getChunckContent('app') } })
                    }
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
