import { typescript as ts } from '../deps.ts'

export interface Transform {
    (sf: ts.SourceFile, node: ts.Node, ...args: any[]): ts.VisitResult<ts.Node> | null
}

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
}

/**
 * TS AST transformer to rewrite import path
 * @ref https://github.com/dropbox/ts-transform-import-path-rewrite
 */
export function transformImportPathRewrite(sf: ts.SourceFile, node: ts.Node, rewriteImportPath?: (importPath: string) => string): ts.VisitResult<ts.Node> | null {
    if (rewriteImportPath) {
        let importPath = ''
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier
        ) {
            const importPathWithQuotes = node.moduleSpecifier.getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (isDynamicImport(node)) {
            const arg0Node = node.arguments[0]
            if (ts.isStringLiteral(arg0Node)) {
                const importPathWithQuotes = arg0Node.getText(sf)
                importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
            }
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
export function transformReactJsxSource(sf: ts.SourceFile, node: ts.Node): ts.VisitResult<ts.Node> | null {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
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

export function CreateTransformer(transform: Transform, ...args: any[]): ts.TransformerFactory<ts.SourceFile> {
    function nodeVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
        const visitor: ts.Visitor = node => {
            const ret = transform(sf, node, ...args)
            if (ret != null) {
                return ret
            }
            return ts.visitEachChild(node, visitor, ctx)
        }
        return visitor
    }

    return ctx => sf => ts.visitNode(sf, nodeVisitor(ctx, sf))
}
