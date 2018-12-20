const pull = require('pull-stream')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const collectMutations = require('collect-mutations')
const setStyles = require('module-styles')('tre-keyframes')
const pointer = require('json8-pointer')

setStyles(`
  .tre-timeline .frameSlot.has-keyframe {
    background: rgba(250,250,180,0.3);
  }
  .tre-timeline .frameSlot.has-keyframe:hover {
    background: rgba(250,250,200,0.6);
  }
  .tre-timeline .frameSlot.selected {
    background: rgba(255, 255, 50, 0.8);
    box-shadow: 0 0 18px gold;
  }
  .tre-timeline .frameSlot.selected:hover {
    background: rgba(255, 255, 100, 0.9);
    box-shadow: 0 0 24px gold;
  }
  .tre-timeline .keyframe.header {
    background: blue;
  }
  .tre-timeline .keyframe.integer,
  .tre-timeline .keyframe.number {
    background: green;
  }
  .tre-timeline .keyframe.string {
    background: red;
  }
`)

module.exports = function(ssb, opts) {
  opts = opts || {}
  return function(kv, ctx) {
    ctx = ctx || {}
    const keyframes = ctx.framesObs || MutantArray()
    const selectedFrameObs = ctx.selectedFrameObs || Value()
    const tracksObs = ctx.tracksObs || MutantArray()

    const drain = collectMutations(keyframes, {sync: true})
    pull(
      ssb['tre-parts'].byAggregationAndType(revisionRoot(kv), 'keyframe', {
        live: true,
        sync: true
      }),
      //pull.through(x => console.log('KEYFRAME', x)),
      drain
    )

    const els = MutantMap(keyframes, kvObs => {
      const frame = computed(kvObs, kv => kv && kv.value.content.frame )
      const values = computed(kvObs, kv => kv && kv.value.content.values )
      const gridCol = computed(frame, frame => `${frame + 2} / span 1`)
      return computed([frame, tracksObs, values], (frame, tracks, values) => {
        if (!Number.isFinite(frame)) return []
        const header_el = h('.keyframe.header', {
          style: {
            'grid-row': '1 / span 1',
            'grid-column': gridCol
          }
        })
        const rows = tracks.map( ({key, path, row, type}) => {
          const fullpath = [key].concat(path ? pointer.decode(path) : [])
          return pointer.find(values, fullpath) !== undefined ? {row, type} : null
        }).filter(x => x !== null)

        const row_els = rows.map( ({row, type}) =>  h('.keyframe', {
          classList: [type],
          style: {
            'grid-row': `${row + 1} / span 1`,
            'grid-column': gridCol
          }
        }))

        return [header_el].concat(row_els)
      })
    })
    els.abort = function() {
      drain.abort()
    }
    els.columnClasses = function(column) {
      return computed([keyframes, selectedFrameObs], (kfs, kv) => {
        if (kv && kv.value.content.frame == column ) return ['selected']
        const found = kfs.find( kv => kv && kv.value.content.frame == column )
        return found ? ['has-keyframe'] : []
      })
    }
    return els
  }
}

function revisionRoot(kv) {
  return kv && kv.value && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}
