const {client} = require('tre-client')
const Finder = require('tre-finder')
const {RenderTimeline, renderPropertyTree} = require('tre-timeline')
const h = require('mutant/html-element')
const setStyle = require('module-styles')('tre-keyframes-demo')
const Keyframes = require('.')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const renderKeyframes = Keyframes(ssb)

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

  const items = renderKeyframes({
    key: config.tre.branches.animation
  })

  document.body.appendChild(h('.tre-keyframes-editor', {
    hooks: [el => el => {items.abort()}],
    'ev-timeline-click': e => {
      console.warn(e)
      if (e.detail.track == 0) {
        ssb.publish({
          type: 'keyframe',
          'part-of': config.tre.branches.animation,
          root: config.tre.branches.root,
          frame: e.detail.frame
        }, (err, msg) => {
          if (err) return console.error(err)
          console.log('Published', msg)
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
        }, 'Editor')
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
    height: 12em;
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
`)

