import React from 'https://postjs.io/x/react/mod.js'
import Logo from '../components/logo.tsx'
import { useCount } from '../shared/hooks.ts'
import '../style/index.less'

export async function getStaticProps() {
    return { name: 'postjs' }
}

export default function Home({ name }: { name: string }) {
    const { count, increase, decrease } = useCount(0)

    return (
        <div className="wrapper">
            <p><Logo height={45} /></p>
            <p>Welcome to use <strong>{name}</strong>!</p>
            <p className="links">
                <span>[</span>
                    <a href="https://postjs.io/docs" target="_blank">Docs</a>
                <span>|</span>
                    <a href="https://github.com/postui/postjs" target="_blank">Github</a>
                <span>]</span>
            </p>
            <p className="counter">
                <span>Counter:</span>
                <strong>{count}</strong>
                <button onClick={decrease}>-</button>
                <button onClick={increase}>+</button>
            </p>
        </div>
    )
}
