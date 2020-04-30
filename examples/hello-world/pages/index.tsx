import { Sha1 } from 'https://deno.land/std@v0.42.0/util/sha1.ts'
import React from 'https://dev.jspm.io/react'
import Head from '../../../head.tsx'
import Link from '../../../link.tsx'

export default function Home() {
    const sha1 = new Sha1()
    return (
        <div style={{ margin: 50 }}>
            <Head>
                <title>Welcome to use postjs!</title>
                <meta name="hash" content={sha1.update('hello world!').hex()} />
            </Head>
            <p>Welcome to use <strong>postjs</strong>! <Link style={{ paddingLeft: 18 }} to="/about">&rarr;&nbsp; About</Link></p>
        </div>
    )
}
