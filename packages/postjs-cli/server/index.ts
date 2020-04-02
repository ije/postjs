import { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import zlib from 'zlib'

// todo: implement the production server

// sendText sends text with compression
export function sendText(req: IncomingMessage, res: ServerResponse, statusCode: number, contentType: string, text: string) {
    const buf = Buffer.from(text, 'utf-8')
    const acceptEncoding = String(req.headers['accept-encoding'] || '')

    // Note: This is not a conformant accept-encoding parser.
    // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    let compressType: string | null = null
    let compress: ((buf: Buffer, callback: (err: Error | null, ret: Buffer) => void) => void) | null = null
    if (buf.length > 1024) {
        if (/\bgzip\b/.test(acceptEncoding)) {
            compressType = 'gzip'
            compress = zlib.gzip
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
            compressType = 'deflate'
            compress = zlib.deflate
        }
    }

    if (compress !== null) {
        compress(buf, (err, ret) => {
            if (err !== null) {
                res.statusCode = 500
                res.end(err.message)
                return
            }
            res.writeHead(statusCode, { 'Content-Type': contentType, 'Content-Encoding': compressType! })
            res.end(ret)
        })
        return
    }

    res.writeHead(statusCode, { 'Content-Type': contentType })
    res.end(buf)
}

// https://github.com/broofa/node-mime/blob/master/types/standard.js
/*
The MIT License (MIT)

Copyright (c) 2010 Benjamin Thomas, Robert Kieffer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
const standardTypes = { 'application/andrew-inset': ['ez'], 'application/applixware': ['aw'], 'application/atom+xml': ['atom'], 'application/atomcat+xml': ['atomcat'], 'application/atomsvc+xml': ['atomsvc'], 'application/bdoc': ['bdoc'], 'application/ccxml+xml': ['ccxml'], 'application/cdmi-capability': ['cdmia'], 'application/cdmi-container': ['cdmic'], 'application/cdmi-domain': ['cdmid'], 'application/cdmi-object': ['cdmio'], 'application/cdmi-queue': ['cdmiq'], 'application/cu-seeme': ['cu'], 'application/dash+xml': ['mpd'], 'application/davmount+xml': ['davmount'], 'application/docbook+xml': ['dbk'], 'application/dssc+der': ['dssc'], 'application/dssc+xml': ['xdssc'], 'application/ecmascript': ['ecma', 'es'], 'application/emma+xml': ['emma'], 'application/epub+zip': ['epub'], 'application/exi': ['exi'], 'application/font-tdpfr': ['pfr'], 'application/geo+json': ['geojson'], 'application/gml+xml': ['gml'], 'application/gpx+xml': ['gpx'], 'application/gxf': ['gxf'], 'application/gzip': ['gz'], 'application/hjson': ['hjson'], 'application/hyperstudio': ['stk'], 'application/inkml+xml': ['ink', 'inkml'], 'application/ipfix': ['ipfix'], 'application/java-archive': ['jar', 'war', 'ear'], 'application/java-serialized-object': ['ser'], 'application/java-vm': ['class'], 'application/javascript': ['js', 'mjs'], 'application/json': ['json', 'map'], 'application/json5': ['json5'], 'application/jsonml+json': ['jsonml'], 'application/ld+json': ['jsonld'], 'application/lost+xml': ['lostxml'], 'application/mac-binhex40': ['hqx'], 'application/mac-compactpro': ['cpt'], 'application/mads+xml': ['mads'], 'application/manifest+json': ['webmanifest'], 'application/marc': ['mrc'], 'application/marcxml+xml': ['mrcx'], 'application/mathematica': ['ma', 'nb', 'mb'], 'application/mathml+xml': ['mathml'], 'application/mbox': ['mbox'], 'application/mediaservercontrol+xml': ['mscml'], 'application/metalink+xml': ['metalink'], 'application/metalink4+xml': ['meta4'], 'application/mets+xml': ['mets'], 'application/mods+xml': ['mods'], 'application/mp21': ['m21', 'mp21'], 'application/mp4': ['mp4s', 'm4p'], 'application/msword': ['doc', 'dot'], 'application/mxf': ['mxf'], 'application/n-quads': ['nq'], 'application/n-triples': ['nt'], 'application/octet-stream': ['bin', 'dms', 'lrf', 'mar', 'so', 'dist', 'distz', 'pkg', 'bpk', 'dump', 'elc', 'deploy', 'exe', 'dll', 'deb', 'dmg', 'iso', 'img', 'msi', 'msp', 'msm', 'buffer'], 'application/oda': ['oda'], 'application/oebps-package+xml': ['opf'], 'application/ogg': ['ogx'], 'application/omdoc+xml': ['omdoc'], 'application/onenote': ['onetoc', 'onetoc2', 'onetmp', 'onepkg'], 'application/oxps': ['oxps'], 'application/patch-ops-error+xml': ['xer'], 'application/pdf': ['pdf'], 'application/pgp-encrypted': ['pgp'], 'application/pgp-signature': ['asc', 'sig'], 'application/pics-rules': ['prf'], 'application/pkcs10': ['p10'], 'application/pkcs7-mime': ['p7m', 'p7c'], 'application/pkcs7-signature': ['p7s'], 'application/pkcs8': ['p8'], 'application/pkix-attr-cert': ['ac'], 'application/pkix-cert': ['cer'], 'application/pkix-crl': ['crl'], 'application/pkix-pkipath': ['pkipath'], 'application/pkixcmp': ['pki'], 'application/pls+xml': ['pls'], 'application/postscript': ['ai', 'eps', 'ps'], 'application/pskc+xml': ['pskcxml'], 'application/raml+yaml': ['raml'], 'application/rdf+xml': ['rdf', 'owl'], 'application/reginfo+xml': ['rif'], 'application/relax-ng-compact-syntax': ['rnc'], 'application/resource-lists+xml': ['rl'], 'application/resource-lists-diff+xml': ['rld'], 'application/rls-services+xml': ['rs'], 'application/rpki-ghostbusters': ['gbr'], 'application/rpki-manifest': ['mft'], 'application/rpki-roa': ['roa'], 'application/rsd+xml': ['rsd'], 'application/rss+xml': ['rss'], 'application/rtf': ['rtf'], 'application/sbml+xml': ['sbml'], 'application/scvp-cv-request': ['scq'], 'application/scvp-cv-response': ['scs'], 'application/scvp-vp-request': ['spq'], 'application/scvp-vp-response': ['spp'], 'application/sdp': ['sdp'], 'application/set-payment-initiation': ['setpay'], 'application/set-registration-initiation': ['setreg'], 'application/shf+xml': ['shf'], 'application/sieve': ['siv', 'sieve'], 'application/smil+xml': ['smi', 'smil'], 'application/sparql-query': ['rq'], 'application/sparql-results+xml': ['srx'], 'application/srgs': ['gram'], 'application/srgs+xml': ['grxml'], 'application/sru+xml': ['sru'], 'application/ssdl+xml': ['ssdl'], 'application/ssml+xml': ['ssml'], 'application/tei+xml': ['tei', 'teicorpus'], 'application/thraud+xml': ['tfi'], 'application/timestamped-data': ['tsd'], 'application/voicexml+xml': ['vxml'], 'application/wasm': ['wasm'], 'application/widget': ['wgt'], 'application/winhlp': ['hlp'], 'application/wsdl+xml': ['wsdl'], 'application/wspolicy+xml': ['wspolicy'], 'application/xaml+xml': ['xaml'], 'application/xcap-diff+xml': ['xdf'], 'application/xenc+xml': ['xenc'], 'application/xhtml+xml': ['xhtml', 'xht'], 'application/xml': ['xml', 'xsl', 'xsd', 'rng'], 'application/xml-dtd': ['dtd'], 'application/xop+xml': ['xop'], 'application/xproc+xml': ['xpl'], 'application/xslt+xml': ['xslt'], 'application/xspf+xml': ['xspf'], 'application/xv+xml': ['mxml', 'xhvml', 'xvml', 'xvm'], 'application/yang': ['yang'], 'application/yin+xml': ['yin'], 'application/zip': ['zip'], 'audio/3gpp': ['*3gpp'], 'audio/adpcm': ['adp'], 'audio/basic': ['au', 'snd'], 'audio/midi': ['mid', 'midi', 'kar', 'rmi'], 'audio/mp3': ['*mp3'], 'audio/mp4': ['m4a', 'mp4a'], 'audio/mpeg': ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'], 'audio/ogg': ['oga', 'ogg', 'spx'], 'audio/s3m': ['s3m'], 'audio/silk': ['sil'], 'audio/wav': ['wav'], 'audio/wave': ['*wav'], 'audio/webm': ['weba'], 'audio/xm': ['xm'], 'font/collection': ['ttc'], 'font/otf': ['otf'], 'font/ttf': ['ttf'], 'font/woff': ['woff'], 'font/woff2': ['woff2'], 'image/aces': ['exr'], 'image/apng': ['apng'], 'image/bmp': ['bmp'], 'image/cgm': ['cgm'], 'image/dicom-rle': ['drle'], 'image/emf': ['emf'], 'image/fits': ['fits'], 'image/g3fax': ['g3'], 'image/gif': ['gif'], 'image/heic': ['heic'], 'image/heic-sequence': ['heics'], 'image/heif': ['heif'], 'image/heif-sequence': ['heifs'], 'image/ief': ['ief'], 'image/jls': ['jls'], 'image/jp2': ['jp2', 'jpg2'], 'image/jpeg': ['jpeg', 'jpg', 'jpe'], 'image/jpm': ['jpm'], 'image/jpx': ['jpx', 'jpf'], 'image/jxr': ['jxr'], 'image/ktx': ['ktx'], 'image/png': ['png'], 'image/sgi': ['sgi'], 'image/svg+xml': ['svg', 'svgz'], 'image/t38': ['t38'], 'image/tiff': ['tif', 'tiff'], 'image/tiff-fx': ['tfx'], 'image/webp': ['webp'], 'image/wmf': ['wmf'], 'message/disposition-notification': ['disposition-notification'], 'message/global': ['u8msg'], 'message/global-delivery-status': ['u8dsn'], 'message/global-disposition-notification': ['u8mdn'], 'message/global-headers': ['u8hdr'], 'message/rfc822': ['eml', 'mime'], 'model/3mf': ['3mf'], 'model/gltf+json': ['gltf'], 'model/gltf-binary': ['glb'], 'model/iges': ['igs', 'iges'], 'model/mesh': ['msh', 'mesh', 'silo'], 'model/stl': ['stl'], 'model/vrml': ['wrl', 'vrml'], 'model/x3d+binary': ['*x3db', 'x3dbz'], 'model/x3d+fastinfoset': ['x3db'], 'model/x3d+vrml': ['*x3dv', 'x3dvz'], 'model/x3d+xml': ['x3d', 'x3dz'], 'model/x3d-vrml': ['x3dv'], 'text/cache-manifest': ['appcache', 'manifest'], 'text/calendar': ['ics', 'ifb'], 'text/coffeescript': ['coffee', 'litcoffee'], 'text/css': ['css'], 'text/csv': ['csv'], 'text/html': ['html', 'htm', 'shtml'], 'text/jade': ['jade'], 'text/jsx': ['jsx'], 'text/less': ['less'], 'text/markdown': ['markdown', 'md'], 'text/mathml': ['mml'], 'text/mdx': ['mdx'], 'text/n3': ['n3'], 'text/plain': ['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'], 'text/richtext': ['rtx'], 'text/rtf': ['*rtf'], 'text/sgml': ['sgml', 'sgm'], 'text/shex': ['shex'], 'text/slim': ['slim', 'slm'], 'text/stylus': ['stylus', 'styl'], 'text/tab-separated-values': ['tsv'], 'text/troff': ['t', 'tr', 'roff', 'man', 'me', 'ms'], 'text/turtle': ['ttl'], 'text/uri-list': ['uri', 'uris', 'urls'], 'text/vcard': ['vcard'], 'text/vtt': ['vtt'], 'text/xml': ['*xml'], 'text/yaml': ['yaml', 'yml'], 'video/3gpp': ['3gp', '3gpp'], 'video/3gpp2': ['3g2'], 'video/h261': ['h261'], 'video/h263': ['h263'], 'video/h264': ['h264'], 'video/jpeg': ['jpgv'], 'video/jpm': ['*jpm', 'jpgm'], 'video/mj2': ['mj2', 'mjp2'], 'video/mp2t': ['ts'], 'video/mp4': ['mp4', 'mp4v', 'mpg4'], 'video/mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'], 'video/ogg': ['ogv'], 'video/quicktime': ['qt', 'mov'], 'video/webm': ['webm'] }
const typesMap = ((types: Record<string, Array<string>>) => {
    const map = new Map<string, string>()
    Object.keys(types).forEach(contentType => {
        types[contentType].forEach(ext => map.set(ext, contentType))
    })
    return map
})(standardTypes)

export function getContentType(filepath: string): string {
    const ext = path.extname(filepath).replace(/^\./, '').toLowerCase()
    return typesMap.has(ext) ? typesMap.get(ext)! : 'application/octet-stream'
}
