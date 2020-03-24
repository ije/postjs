import webpack from 'webpack'
import { Compiler, CompileResult } from '.'

export class Watcher {
    private _compiler: Compiler
    private _lastHash: string | null
    private _lastVendorChunkHash: string | null

    constructor(appDir: string, entryJS: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals'>) {
        this._compiler = new Compiler(appDir, entryJS, config)
        this._lastHash = null
        this._lastVendorChunkHash = null
    }

    watch(onChange: (errors: Error | null, result?: CompileResult) => void) {
        return new UnWatcher(this._compiler, this._compiler.watch(
            { aggregateTimeout: 150 },
            (err, stats) => {
                if (err) {
                    onChange(err)
                    return
                }

                if (!stats.hasErrors() && stats.hash && (this._lastHash === null || this._lastHash !== stats.hash)) {
                    this._lastHash = stats.hash
                    const appHash = stats.compilation.namedChunks.get('app').hash
                    const ret: CompileResult = {
                        hash: stats.hash,
                        chuncks: {
                            app: {
                                hash: appHash,
                                content: this._compiler.getChunckContent('app')
                            }
                        }
                    }
                    if (stats.compilation.namedChunks.has('vendor')) {
                        const vendorHash = stats.compilation.namedChunks.get('vendor')!.hash
                        if (this._lastVendorChunkHash === null || this._lastVendorChunkHash !== vendorHash) {
                            this._lastVendorChunkHash = vendorHash
                            ret.chuncks['vendor'] = {
                                hash: vendorHash,
                                content: this._compiler.getChunckContent('vendor')
                            }
                        }
                    }
                    onChange(null, ret)
                } else {
                    onChange(new Error(stats.toString('minimal')))
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
