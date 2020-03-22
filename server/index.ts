import http from 'http'

http.createServer((req, res) => {
    res.end('hello world!')
}).listen(3000)
