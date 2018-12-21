const traverse = require('traverse')
const pointer = require('json8-pointer')

function addFramePaths(result, content) {
  const {frame, values} = content
  const paths = traverse(values).reduce(function (acc, x) {
    if (this.isLeaf && typeof x !== 'object' && x !== undefined) acc.push(pointer.encode(this.path))
    return acc
  }, [])

  for(let p of paths) {
    const frames = result[p] || []
    frames.push(frame)
    result[p] = frames.sort((a,b) => a-b)
  }
}

function filterPaths(paths, condition) {
  const result = {}
  for(let path in paths) {
    const frames = paths[path].filter(condition)
    if (frames.length) result[path] = frames
  }
  return result
}

function interpolate(paths, contents, frame) {
  const result = {}

  const before = filterPaths(paths, f => f <= frame)
  const after = filterPaths(paths, f => f > frame)

  function values(frame) {
    const c = contents.find(c => c.frame == frame)
    return c && c.values || {}
  }
  
  for(let path in before) {
    let value
    const startFrame = before[path].slice(-1)[0]
    const startValue = pointer.find(values(startFrame), path)
    if (!after[path]) {
      value = startValue
    } else {
      const endFrame = after[path][0]
      const endValue = pointer.find(values(endFrame), path)

      const frameCount = endFrame - startFrame
      const range = endValue - startValue
      value = startValue + range * (frame - startFrame) / frameCount
    }
    createValue(result, pointer.decode(path), null, value)
  }
  return result
}

function createValue(doc, path, type, value) {
  if (!path.length) return
  const [first, ...rest] = path
  if (rest.length) {
    if (doc[first] == undefined) {
      doc[first] = {}
    } else {
      if (typeof doc[first] !== 'object') return
    }
    createValue(doc[first], rest, type, value)
  } else {
    if (doc[first] !== undefined) return
    const defaultValues = {
      number: 0,
      integer: 0,
      string: '',
      object: {},
      array: []
    }
    doc[first] = value !== undefined ? value : defaultValues[type]
  }
}
module.exports = {
  addFramePaths,
  filterPaths,
  interpolate,
  createValue
}
