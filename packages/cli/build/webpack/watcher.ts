import webpack from 'webpack'
import { Compiler, CompileResult } from '.'

export class Watcher {
    private _lastHash: string | null
    private _lastVendorChunkHash: string | null
    private _compiler: Compiler

    constructor(appDir: string, entryJS: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals'>) {
        this._lastHash = null
        this._lastVendorChunkHash = null
        this._compiler = new Compiler(appDir, entryJS, config)
    }

    watch(onChange: (errors: Error | null, result?: CompileResult) => void) {
        return new UnWatcher(this._compiler, this._compiler.watch(
            { aggregateTimeout: 150 },
            (err, stats) => {
                if (err) {
                    onChange(err)
                    return
                }

                if (stats.hasErrors()) {
                    onChange(new Error(stats.toString('minimal')))
                } else if (stats.hash && (this._lastHash === null || this._lastHash !== stats.hash)) {
                    this._lastHash = stats.hash
                    if (stats.compilation.namedChunks.has('vendor')) {
                        const vendorHash = stats.compilation.namedChunks.get('vendor')!.hash
                        if (this._lastVendorChunkHash === null || this._lastVendorChunkHash !== vendorHash) {
                            this._lastVendorChunkHash = vendorHash
                            onChange(null, { hash: stats.hash, chuncks: { app: this._compiler.getChunckContent('app'), vendor: this._compiler.getChunckContent('vendor') } })
                            return
                        }
                    }
                    onChange(null, { hash: stats.hash, chuncks: { app: this._compiler.getChunckContent('app') } })
                }
            }
        ))
    }
}

class UnWatcher {
    private _compiler: Compiler
    private _watching: webpack.Compiler.Watching

    constructor(compiler: Compiler, watching: webpack.Compiler.Watching) {
        this._compiler = compiler
        this._watching = watching
    }

    unwatch(callback?: () => void) {
        this._watching.close(() => {
            this._compiler.clear()
            if (callback) {
                callback()
            }
        })
    }
}
