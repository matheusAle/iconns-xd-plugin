const parser = require('./lib/svg-parser.umd')
const { Path, Color } = require("scenegraph")


async function parserHandler(svgContent) {
    return createPath(parser.parse(svgContent));
}

function createPath(node, prev = []) {
    let path;
    if (node.name === 'path') {
        path = new Path();
        path = _setProperty(path, 'pathData', node.attributes.d)
        path = _setProperty(path, 'fillEnabled',  node.attributes['fill'] != 'none')
        path = _setProperty(path, 'fill', node.attributes['fill'] != 'none' ? new Color(node.attributes['fill']) : undefined)
        path = _setProperty(path, 'stroke', new Color(node.attributes['stroke'] || 'black'))
        path = _setProperty(path, 'strokeWidth', node.attributes['stroke-width'] || 0)
        path = _setProperty(path, 'strokeEndCaps', node.attributes['stroke-linecap'] || 'butt')
        path = _setProperty(path, 'strokeJoins', node.attributes['stroke-linejoin'] || 'miter')
        path = _setProperty(path, 'strokeMiterLimit', node.attributes['stroke-miterlimit'] || 4)
        path = _setProperty(path, 'strokeDashArray', node.attributes['stroke-dasharray'] || [])
        path = _setProperty(path, 'strokeDashOffset',  node.attributes['stroke-dashoffset'] || 0)
    }
    prev = path ? [...prev, path] : prev
    if (node.children) {
        for (let n of node.children) {
            let ret = createPath(n);
            if (ret) prev.push(...ret);
        }
    }
    return prev;
}

function _setProperty(path, prop, val) {
    try {
        path[prop] = val;
    } catch (e) { console.log(`svg-parser-error: ${e} :: prop: ${prop} :: val: ${val} `); }
    return path
}

module.exports = { parser: parserHandler }