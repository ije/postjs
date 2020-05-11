import { typescript as ts } from '../package.ts';

export interface Transform {
    (sf: ts.SourceFile, node: ts.Node, options: TransformOptions): ts.VisitResult<ts.Node> | null
}

export interface TransformOptions {
    mode?: 'development' | 'production'
    rewriteImportPath?(path: string): string
}

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
}

/**
 * TS AST transformer to rewrite import path
 * @ref https://github.com/dropbox/ts-transform-import-path-rewrite
 */
function transformImportPath(sf: ts.SourceFile, node: ts.Node, { rewriteImportPath }: TransformOptions): ts.VisitResult<ts.Node> | null {
    if (rewriteImportPath) {
        let importPath = ''
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier
        ) {
            const importPathWithQuotes = node.moduleSpecifier.getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (isDynamicImport(node)) {
            const importPathWithQuotes = node.arguments[0].getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            // `.text` instead of `getText` bc this node doesn't map to sf (it's generated d.ts)
            importPath = node.argument.literal.text
        }

        if (importPath) {
            const rewrittenPath = rewriteImportPath(importPath)
            if (rewrittenPath !== importPath) {
                const newNode = ts.getMutableClone(node)
                if (ts.isImportDeclaration(newNode) || ts.isExportDeclaration(newNode)) {
                    newNode.moduleSpecifier = ts.createLiteral(rewrittenPath)
                } else if (isDynamicImport(newNode)) {
                    newNode.arguments = ts.createNodeArray([ts.createStringLiteral(rewrittenPath)])
                } else if (ts.isImportTypeNode(newNode)) {
                    newNode.argument = ts.createLiteralTypeNode(ts.createStringLiteral(rewrittenPath))
                }
                return newNode
            }
        }
    }

    return null
}

/**
 * TypeScript AST Transformer that adds source file and line number to JSX elements.
 * @ref https://github.com/dropbox/ts-transform-react-jsx-source
 */
function transformReactJsxSource(sf: ts.SourceFile, node: ts.Node, { mode }: TransformOptions): ts.VisitResult<ts.Node> | null {
    if (mode === 'development' && ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const fileNameAttr = ts.createPropertyAssignment(
            'fileName',
            ts.createStringLiteral(sf.fileName)
        )
        const lineNumberAttr = ts.createPropertyAssignment(
            'lineNumber',
            ts.createNumericLiteral((sf.getLineAndCharacterOfPosition(node.pos).line + 1).toString())
        )
        const sourceJsxAttr = ts.createJsxAttribute(
            ts.createIdentifier('__source'),
            ts.createJsxExpression(undefined, ts.createObjectLiteral([fileNameAttr, lineNumberAttr]))
        )
        const jsxAttributes = ts.createJsxAttributes([
            ...node.attributes.properties,
            sourceJsxAttr
        ])

        if (ts.isJsxSelfClosingElement(node)) {
            return ts.createJsxSelfClosingElement(
                node.tagName,
                node.typeArguments,
                jsxAttributes
            )
        } else if (ts.isJsxOpeningElement(node)) {
            return ts.createJsxOpeningElement(
                node.tagName,
                node.typeArguments,
                jsxAttributes
            )
        }
    }
    return null
}

export function CreateTransformer(options: TransformOptions): ts.TransformerFactory<ts.SourceFile> {
    const transforms: Array<Transform> = [
        transformImportPath,
        transformReactJsxSource,
    ]
    function nodeVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
        const visitor: ts.Visitor = node => {
            for (const transform of transforms) {
                const ret = transform(sf, node, options)
                if (ret != null) {
                    return ret
                }
            }
            return ts.visitEachChild(node, visitor, ctx)
        }
        return visitor
    }

    return ctx => sf => ts.visitNode(sf, nodeVisitor(ctx, sf))
}
