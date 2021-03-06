var mercury = require('mercury')
var h = require('micro-css/h')(mercury.h)
var Header = require('../header.js')

var Range = require('lib/params/range')
var ModRange = require('lib/params/mod-range')
var Select = require('lib/params/select')

var shapeChoices = [
  ['Sine', 'sine'],
  ['Square', 'square'],
  ['Sawtooth', 'sawtooth'],
  ['Triangle', 'triangle']
]

module.exports = function(node){
  var data = node()

  return h('SourceNode -oscillator', [

    Header(node, h('span', [
      h('strong', 'Oscillator:'), ' ',
      h('span', data.shape || 'sine')
    ])),

    h('ParamList', [

      Select(node.shape, { 
        options: shapeChoices 
      }),

      ModRange(node.amp, {
        title: 'amp',
        defaultValue: 1,
        format: 'dB',
        flex: true
      }),

      ModRange(node.detune, {
        title: 'detune',
        format: 'cents',
        flex: true
      }),

      ModRange(node.noteOffset, {
        title: 'pitch',
        format: 'semitone',
        defaultValue: 0,
        width: 200,
        flex: true
      }),

      ModRange(node.octave, {
        title: 'octave',
        format: 'octave',
        defaultValue: 0,
        width: 200,
        flex: true
      })

    ])

  ])
}