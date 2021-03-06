const {client} = require('tre-client')
const Finder = require('tre-finder')
const {RenderTimeline, renderPropertyTree} = require('tre-timeline')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const setStyle = require('module-styles')('tre-keyframes-demo')
const Keyframes = require('.')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const Editor = require('tre-json-editor')
const Shell = require('tre-editor-shell')
const pointer = require('json8-pointer')
const {createValue,interpolate,addFramePaths} = require('./lib/interpolate')
require('brace/theme/solarized_dark')

function renderMiniMap(framesObs, columnCountObs) {
  const range = computed(framesObs, kvs => {
    const frames = kvs.map( kv => kv.value.content.frame )
    return {
      min: Math.min(...frames), 
      max: Math.max(...frames)
    }
  })

  const width = computed([range, columnCountObs], ({min, max}, cols) => {
    const percent = 100 * cols / (max - min)
    return `${percent}%`
  })

  return h('.tre-timeline-minimap', {}, [
    h('.visible', {
      style: { width }
    }),
    MutantMap(framesObs, kvObs => {
      console.warn('MAP')
      const left = computed([kvObs, range], (kv, {min, max}) => {
        const count = max - min
        const percent = (kv.value.content.frame - min) * 100 / count
        return `${percent}%`
      })
      return h('.minimap-keyframe', {
        style: {left}
      })
    })
  ])
}

function renderToolbar(scaleObs) {
  const scaleSlider = h('.tre-timeline-scale', [
    h('span', 'Zoom:'),
    h('input', {
      type: 'range',
      value: scaleObs,
      min: '0.3',
      max: '1.5',
      step: '0.05',
      'ev-input': e => {
        console.log('timeline scale:', e.target.value)
        scaleObs.set(Number(e.target.value))
      }
    }),
    h('span', scaleObs)
  ])
  return h('.tre-timeline-toolbar', [
    scaleSlider
  ])
}

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const renderKeyframes = Keyframes(ssb)

  const renderEditor = Editor(null, {
    ace: {
      theme: 'ace/theme/solarized_dark',
      tabSize: 2,
      useSoftTabs: true
    }
  })

  let current_kv
  const selectedFrameObs = Value()
  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, (err, kv) => {
        if (err) return cb(err)
        selectedFrameObs.set(kv)
        cb(null, kv)
      })
    }
  })

  const renderFinder = Finder(ssb, {
    details: kv => {
      const schema = kv.value.content.schema
      if (schema) {
        return renderPropertyTree(schema)
      }
      return []
    }
  })
  const finder = renderFinder(config.tre.branches.root, {
    path: [],
    shouldOpen: kv => true
  })

  const renderTimeline = RenderTimeline(ssb)

  const framesObs = MutantArray()
  const contentObs = Value()
  const tracksObs = MutantArray()
  const cellWidthObs = Value(1)
  const columnCountObs = Value(1)
  const hoverFrame = Value()

  const keyframeInfex = computed(framesObs, keyframes => {
    const result = {}
    keyframes.forEach(kv => {
      addFramePaths(result, kv.value.content)
    })
    return result
  })

  const hoverValues = computed([hoverFrame, keyframeInfex], (frame, paths) => {
    const contents = framesObs().map(kv => kv.value.content)
    return interpolate(paths, contents, frame)
  })

  function renderTrackControls({row, key, path, type}) {
    const fullpath = path ? pointer.encode([key].concat(pointer.decode(path))) : pointer.encode([key])
    const valueSpan = computed(hoverValues, values => {
      const value = pointer.find(values, fullpath)
      if (value == undefined) return []
      return h('span.track-value', value)
    })
    return h('.track-controls', {
        classList: [type]
    }, [
      h('span.track-no', row),
      type !== 'object' ? valueSpan : []
    ])
  }


  const items = renderKeyframes({
    key: config.tre.branches.animation
  }, {
    selectedFrameObs,
    framesObs,
    tracksObs
  })

  document.body.appendChild(h('.tre-keyframes-editor', {
    hooks: [el => el => {items.abort()}],
    'ev-mousemove': e => {
      const slot = e.currentTarget.querySelector('.frameSlot:hover')
      if (!slot) return //hoverFrame.set(null)
      const col = slot.style['grid-column-start']
      hoverFrame.set(col-2)
    },
    'ev-timeline-click': e => {
      console.warn(e)
      const kv = framesObs().find( kv => kv.value.content.frame == e.detail.column )
      if (kv) {
        if (kv !== selectedFrameObs()) {
          console.warn('selected', kv)
          selectedFrameObs.set(kv)
        } else {
          const content = contentObs()
          const tracks = tracksObs()
          const track = tracks[e.detail.track]
          if (track) {
            const {key, path, type} = track
            const fullpath = ['values', key].concat( path ? pointer.decode(path) : [])
            console.warn(content, fullpath, type)
            //if (typeof pointer.find(content, fullpath) !== ) return
            createValue(content, fullpath, type || 'object')
            contentObs.set(content)
          }
        }
      } else {
        ssb.publish({
          type: 'keyframe',
          'part-of': config.tre.branches.animation,
          root: config.tre.branches.root,
          frame: e.detail.column
        }, (err, kv) => {
          if (err) return console.error(err)
          console.log('Published', kv)
          selectedFrameObs.set(kv)
        })
      }
    }
  }, [
    makeSplitPane({horiz: true}, [
      makePane('75%', [
        h('.tre-keyframes-bar', [
          renderToolbar(cellWidthObs),
          renderMiniMap(framesObs, columnCountObs)
        ]),
        h('.tre-keyframes-vscroll', [
          h('.tre-finder-with-timeline', [
            finder,
            renderTimeline(null, {
              tree_element: finder,
              tracksObs,
              cellWidthObs,
              columnCountObs,
              items,
              columnClasses: items.columnClasses,
              renderTrackControls
            })
          ])
        ])
      ]),
      makeDivider(),
      makePane('15%', [
        h('div', {
          style: {
            height: '100%',
            width: '100%',
            margin: 0
          }
        }, [
          computed(selectedFrameObs, kv => {
            if (!kv) return []
            if (revisionRoot(kv) == revisionRoot(current_kv)) return computed.NO_CHANGE
            current_kv = kv
            console.warn('rendering editor shell for', kv)
            contentObs.set(Object.assign({}, kv.value.content))
            return renderShell(kv, {renderEditor, contentObs})
          })
        ])
      ])
    ])
  ]))

})

setStyle(`
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
  }
  body {
    font-family: sans-serif;
    font-size: 12pt;
  }

  .tre-keyframes-editor ::-webkit-scrollbar {
    width: 0px;
    height: 0px;
  }

  .tre-keyframes-vscroll {
    padding: 0;
    margin: 0;
    max-height: 16em;
    background: green;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .tre-keyframes-editor {
    width: 100%;
  }

  .tre-timeline-toolbar {
    grid-column: 1 / 2;
  }

  .tre-timeline-minimap {
    grid-column: 2 / 3;
    position: relative;
    background: blue;
    overflow-x: hidden;
  }

  .tre-timeline-minimap > .minimap-keyframe {
    position: absolute;
    width: 1px;
    height: 100%;
    background: white;
  }

  .tre-timeline-minimap > .visible {
    box-sizing: border-box;
    z-index: 1;
    position: absolute;
    height: 100%;
    background: rgba(255,255,255, 0.3);
    border: 1px solid black;
  }

  .track-controls {
    display: inline-grid;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: 1fr;
    grid-auto-flow: column;
    align-items: center;
    justify-content: space-areound;
    background: #888;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .track-controls > .track-value {
    background: #aaa;
    width: 4em;
    hoight: min-content;
    overflow: hidden;
    justify-self: end;
  }
  .track-controls > .track-no {
    border-radius: 3px;
    background: #bbb;
    width: min-content;
    min-width: 1.3em;
    font-size: smaller;
    text-align: center;
    padding: 2px;
  }
  .track-controls.number > .track-no {
    background: green;
    color: #ddd;
  }
  
  .tre-keyframes-bar {
    display: grid;
    grid-template-columns: 12em 1fr;
    grid-template-rows: 1.4em;
    place-content: stretch;
    place-items: stretch;
    background: #333;
    color: #666;
    width: 100%;
  }
  
  .tre-finder-with-timeline {
    display: grid;
    grid-template-columns: 12em 1fr;
    grid-template-rows: 1fr;
    grid-auto-flow: column;
    place-content: stretch;
    place-items: stretch;
    color: #111;
    background: #777;
    width: 100%;
  }

  .tre-editor-shell {
    width: 100%;
    height: 100%;
  }
  .tre-editor-shell .operations li span {
    margin-right: .5em;
  }
  .tre-editor-shell .new-revision {
    background: #B9A249;
    padding: 1em;
    margin-bottom: 1em;
  }
  .operations span.path {
    font-family: monospace;
  }
  .operations span.value.string:before {
    content: "\\"";
  }
  .operations span.value.string:after {
    content: "\\"";
  }
`)

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}


