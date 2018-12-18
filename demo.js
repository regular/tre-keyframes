const {client} = require('tre-client')
const Finder = require('tre-finder')
const {RenderTimeline, renderPropertyTree} = require('tre-timeline')
const h = require('mutant/html-element')
const setStyle = require('module-styles')('tre-keyframes-demo')
const Keyframes = require('.')

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

  document.body.appendChild(h('.pane', {
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
    finder,
    renderTimeline(null, {
      tree_element: finder,
      items,
      columnClasses: items.columnClasses
    })
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
  .pane ::-webkit-scrollbar {
    height: 0px;
  }
  .pane {
    display: grid;
    grid-template-columns: 10em auto;
    grid-template-rows: 100%;
    grid-auto-flow: column;
    background: gold;
    width: 100%;
    height: min-content;
    max-height: 12em;
    min-height: 1.2em;
    overflow-y: auto;
  }
`)

