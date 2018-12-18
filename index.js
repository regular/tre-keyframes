const pull = require('pull-stream')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const h = require('mutant/html-element')
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
`)

module.exports = function(ssb, opts) {
  opts = opts || {}
  return function(kv, ctx) {
    console.log('keyframes for', kv)
    ctx = ctx || {}
    const keyframes = MutantArray()

    const drain = collectMutations(keyframes, {sync: true})
    pull(
      ssb['tre-parts'].byAggregationAndType(kv.key, 'keyframe', {
        live: true,
        sync: true
      }),
      //pull.through(x => console.log('KEYFRAME', x)),
      drain
    )

    const els = MutantMap(keyframes, kvObs => {
      const kv = kvObs()
      const frame = kv.value.content.frame
      if (!Number.isFinite(frame)) return []
      return h('.keyframe', {
        style: {
          'grid-row': '1 / span 1',
          'grid-column': `${frame + 2} / span 1`
        }
      })
    })
    els.abort = function() {
      drain.abort()
    }
    els.columnClasses = function(column) {
      return computed(keyframes, kfs => {
        const found = kfs.find( kv => kv && kv.value.content.frame == column )
        return found ? ['has-keyframe'] : []
      })
    }
    return els
  }
}
