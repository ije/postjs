import { Link } from 'https://postjs.io/mod.ts'
import React from 'react'
import Logo from '../components/logo.tsx'
import { useServerTime, useCount } from '../shared/hooks.ts'

export async function getStaticProps() {
    return { name: 'postjs' }
}

export default function Home({ name }: { name: string }) {
    const { count, increase, decrease } = useCount(0)
    const time = useServerTime()

    return (
        <div style={{ margin: 60 }}>
            <p><Logo /></p>
            <p>Welcome to use <strong>{name}</strong>! &nbsp; <Link to="/about">&rarr;&nbsp; About</Link></p>
            <p>
                <strong style={{ display: 'inline-block', marginRight: 12 }}>{count}</strong>
                &nbsp;
                <button onClick={decrease}>-</button>
                &nbsp;
                <button onClick={increase}>+</button>
            </p>
            <p>
                {!time && (
                    <small>loading...</small>
                )}
                {time && (
                    <small>Server Time: {time}</small>
                )}
            </p>
        </div>
    )
}
