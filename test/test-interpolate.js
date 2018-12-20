const test = require('tape')
const {addFramePaths, filterPaths, interpolate} = require('../lib/interpolate')

test('addFramePaths', t => {
  const result = {}
  addFramePaths(result, {
    frame: 10,
    values: {
      x: 0
    }
  })
  t.deepEqual(result, {
    '/x': [10]
  })

  addFramePaths(result, {
    frame: 0,
    values: {
      x: 0
    }
  })
  t.deepEqual(result, {
    '/x': [0, 10]
  })
  addFramePaths(result, {
    frame: 20,
    values: {
      x: null,  // ignored
      y: undefined, // ignored
      z: {}, // ignored
      foo: {
        bar: true
      }
    }
  })
  t.deepEqual(result, {
    '/x': [0, 10],
    '/foo/bar': [20]
  })
  t.end()
})

test('filterPaths', t => {
  t.deepEqual(
    filterPaths({
      '/x': [1,2,3],
      '/y': [3]
    }, frame => frame < 3), {
      '/x': [1,2]
    }
  )
  t.end()
})

test('interpolate', t => {
  const contents = [
    {
      frame: -10,
      values: {
        pos: {x: -100}
      }
    },
    {
      frame: 10,
      values: {
        pos: {x: 100}
      }
    }
  ]

  const paths = {}
  contents.forEach( content => addFramePaths(paths, content) )

  t.deepEqual(interpolate(paths, contents, -11), {
  })
  t.deepEqual(interpolate(paths, contents, -10), {
    pos: {x: -100}
  })
  t.deepEqual(interpolate(paths, contents, 0), {
    pos: {x: 0}
  })
  t.deepEqual(interpolate(paths, contents, 5), {
    pos: {x: 50}
  })
  t.deepEqual(interpolate(paths, contents, 10), {
    pos: {x: 100}
  })
  t.deepEqual(interpolate(paths, contents, 11), {
    pos: {x: 100}
  })

  t.end()
})

test('interpolate (3 keyframes)', t => {
  const contents = [
    {
      frame: 0,
      values: {x: 0}
    },
    {
      frame: 1,
      values: {x: 10}
    },
    {
      frame: 2,
      values: {x: 20}
    },
  ]

  const paths = {}
  contents.forEach( content => addFramePaths(paths, content) )

  t.deepEqual(interpolate(paths, contents, 0), {
    x: 0
  })
  t.deepEqual(interpolate(paths, contents, 1), {
    x: 10
  })
  t.deepEqual(interpolate(paths, contents, 2), {
    x: 20
  })
  t.end()
})
