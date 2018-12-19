const pull = require('pull-stream')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const collectMutations = require('collect-mutations')
const setStyles = require('module-styles')('tre-keyframes')

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
`)

module.exports = function(ssb, opts) {
  opts = opts || {}
  return function(kv, ctx) {
    ctx = ctx || {}
    const keyframes = ctx.framesObs || MutantArray()
    const selectedFrameObs = ctx.selectedFrameObs || Value()

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
      const gridCol = computed(frame, frame => `${frame + 2} / span 1`)
      return computed(frame, frame => {
        if (!Number.isFinite(frame)) return []
        return h('.keyframe', {
          style: {
            'grid-row': '1 / span 1',
            'grid-column': gridCol
          }
        })
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
