import React from 'react'
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
            <p>
                <span>Welcome to use <strong>{name}</strong>!</span>
                <br/>
                [
                    <a href="https://postjs.io/docs" target="_blank">Docs</a>
                    |
                    <a href="https://github.com/postui/postjs" target="_blank">Github</a>
                ]
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
