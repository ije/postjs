import { typescript as ts } from '../package.ts';
import { CreateTransformer } from './transformer.ts';

export function compile(fileName: string, source: string) {
    return ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions: {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.React,
            allowJs: true,
            alwaysStrict: true,
            sourceMap: false
        },
        transformers: {
            before: [CreateTransformer()]
        },
    })
}
