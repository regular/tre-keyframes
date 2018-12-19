const {client} = require('tre-client')
const Finder = require('tre-finder')
const {RenderTimeline, renderPropertyTree} = require('tre-timeline')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const MutantArray = require('mutant/array')
const setStyle = require('module-styles')('tre-keyframes-demo')
const Keyframes = require('.')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const Editor = require('tre-json-editor')
const Shell = require('tre-editor-shell')
require('brace/theme/solarized_dark')

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
  const items = renderKeyframes({
    key: config.tre.branches.animation
  }, {
    selectedFrameObs,
    framesObs
  })

  document.body.appendChild(h('.tre-keyframes-editor', {
    hooks: [el => el => {items.abort()}],
    'ev-timeline-click': e => {
      console.warn(e)
      const kv = framesObs().find( kv => kv.value.content.frame == e.detail.frame )
      if (kv) {
        console.warn('selected', kv)
        selectedFrameObs.set(kv)
      } else {
        ssb.publish({
          type: 'keyframe',
          'part-of': config.tre.branches.animation,
          root: config.tre.branches.root,
          frame: e.detail.frame
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
        h('div.tre-finder-with-timeline', [
          finder,
          renderTimeline(null, {
            tree_element: finder,
            items,
            columnClasses: items.columnClasses
          })
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
            const contentObs = Value(Object.assign({}, kv.value.content))
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
  .tre-keyframes-editor {
    height: 18em;
    width: 100%;
  }
  .tre-finder-with-timeline {
    display: grid;
    grid-template-columns: 10em auto;
    grid-template-rows: 100%;
    grid-auto-flow: column;
    place-content: stretch;
    place-items: stretch;
    background: gold;
    width: 100%;
    overflow-y: auto;
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
