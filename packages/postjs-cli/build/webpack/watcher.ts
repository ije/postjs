import webpack from 'webpack'
import { Compiler, CompileResult } from '.'

export class Watcher {
    private _compiler: Compiler
    private _lastHashes: Record<string, string>

    constructor(appDir: string, entryJS: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals'>) {
        this._compiler = new Compiler(appDir, entryJS, config)
        this._lastHashes = {}
    }

    watch(onChange: (errors: Error | null, result?: CompileResult) => void) {
        return new UnWatcher(this._compiler, this._compiler.watch(
            { aggregateTimeout: 150 },
            (err, stats) => {
                if (err) {
                    onChange(err)
                    return
                }

                if (!stats.hasErrors() && stats.hash) {
                    const { namedChunks } = stats.compilation
                    const ret: CompileResult = {
                        hash: stats.hash,
                        chuncks: new Map()
                    }
                    namedChunks.forEach(({ hash }, name) => {
                        if (this._lastHashes[name] !== hash) {
                            this._lastHashes[name] = hash
                            const content = this._compiler.getChunckContent(name)
                            ret.chuncks.set(name, { name, hash, content })
                        }
                    })
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
