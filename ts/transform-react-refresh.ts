/**
 * TypeScript AST Transformer for react refresh.
 * @ref https://github.com/facebook/react/issues/16604#issuecomment-528663101
 * @ref https://github.com/facebook/react/blob/master/packages/react-refresh/src/ReactFreshBabelPlugin.js
 */

// @deno-types="../vendor/typescript/lib/typescript.d.ts"
import ts from '../vendor/typescript/lib/typescript.js';
import { traverse } from './traverse.ts';

type TSFunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

interface HookCall {
    expression: ts.Identifier | ts.PropertyAccessExpression
    name: string
    key: string
}

const refreshSig = '$RefreshSig$'
const refreshReg = '$RefreshReg$'

export class RefreshTransformer {
    private _sf: ts.SourceFile
    private _hookCalls: WeakMap<TSFunctionLike, HookCall[]>
    private _seenForRegistration: WeakSet<ts.Node>

    constructor(sf: ts.SourceFile) {
        this._sf = sf
        this._hookCalls = new WeakMap()
        this._seenForRegistration = new WeakSet()
        this._visitHookCalls()
    }

    get statements(): ts.NodeArray<ts.Statement> {
        return ts.createNodeArray([
            ...this._sf.statements
        ])
    }

    hasRegistration(node: ts.Node) {
        return this._seenForRegistration.has(node)
    }

    addRegistration(node: ts.Node) {
        this._seenForRegistration.add(node)
    }

    private _visitHookCalls() {
        traverse(this._sf, node => {
            if (ts.isCallExpression(node)) {
                let name: string
                const { expression } = node
                if (ts.isIdentifier(expression)) {
                    name = expression.text
                } else if (ts.isPropertyAccessExpression(expression)) {
                    name = expression.name.text
                } else {
                    return
                }
                if (!isHookName(name)) {
                    return
                }

                let fnNode: TSFunctionLike | null = null
                let n = node.parent
                while (n !== undefined && !ts.isSourceFile(n)) {
                    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
                        fnNode = n
                        break
                    }
                    n = n.parent
                }
                if (fnNode === null) {
                    return
                }

                if (!this._hookCalls.has(fnNode)) {
                    this._hookCalls.set(fnNode, [])
                }
                const hookCallsForFn = this._hookCalls.get(fnNode)
                let key = ''
                if (ts.isVariableDeclaration(node.parent)) {
                    // TODO: if there is no LHS, consider some other heuristic.
                    key = node.parent.name.getText()
                }

                // Some built-in Hooks reset on edits to arguments.
                const args = node.arguments
                if (name === 'useState' && args.length > 0) {
                    // useState second argument is initial state.
                    key += '(' + args[0].getFullText() + ')'
                } else if (name === 'useReducer' && args.length > 1) {
                    // useReducer second argument is initial state.
                    key += '(' + args[1].getFullText() + ')'
                }

                hookCallsForFn!.push({
                    expression,
                    name,
                    key,
                })
            }
        })
    }

    getHookCallsSignature(functionNode: TSFunctionLike) {
        const fnHookCalls = this._hookCalls.get(functionNode)
        if (fnHookCalls === undefined) {
            return null
        }
        return {
            key: fnHookCalls.map(call => call.name + '{' + call.key + '}').join('\n'),
            customHooks: fnHookCalls
                .filter(call => !isBuiltinHook(call.name))
                .map(call => JSON.parse(JSON.stringify(call))),
        }
    }
}

function isComponentishName(name: string) {
    const c = name.charAt(0)
    return c >= 'A' && c <= 'Z'
}

function isHookName(name: string) {
    let c: string
    return name.startsWith('use') && (c = name.charAt(3)) && c >= 'A' && c <= 'Z'
}

function isBuiltinHook(hookName: string) {
    switch (hookName) {
        case 'useState':
        case 'React.useState':
        case 'useReducer':
        case 'React.useReducer':
        case 'useEffect':
        case 'React.useEffect':
        case 'useLayoutEffect':
        case 'React.useLayoutEffect':
        case 'useMemo':
        case 'React.useMemo':
        case 'useCallback':
        case 'React.useCallback':
        case 'useRef':
        case 'React.useRef':
        case 'useContext':
        case 'React.useContext':
        case 'useImperativeMethods':
        case 'React.useImperativeMethods':
        case 'useDebugValue':
        case 'React.useDebugValue':
            return true;
        default:
            return false;
    }
}

export default function transformReactRefresh(ctx: ts.TransformationContext, sf: ts.SourceFile): ts.SourceFile {
    const t = new RefreshTransformer(sf)
    return ts.updateSourceFileNode(sf, ts.setTextRange(t.statements, sf.statements))
}
