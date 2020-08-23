import ts from '../vendor/typescript/typescript.ts'

/**
 * TypeScript AST Transformer to support react refresh.
 * @ref https://github.com/facebook/react/issues/16604#issuecomment-528663101
 * @ref https://github.com/facebook/react/blob/master/packages/react-refresh/src/ReactFreshBabelPlugin.js
 */
export default function transformReactRefresh(sf: ts.SourceFile, node: ts.Node): ts.VisitResult<ts.Node> | null {
    return null
}
