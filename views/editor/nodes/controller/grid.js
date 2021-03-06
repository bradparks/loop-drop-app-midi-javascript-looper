var mercury = require('mercury')
var h = require('micro-css/h')(mercury.h)
var MPE = require('lib/mouse-position-event.js')
var nextTick = require('next-tick')
var getBaseName = require('path').basename
var GridStateHook = require('./grid-state-hook.js')

module.exports = function renderGrid(controller){
  var context = controller.context
  var setup = context.setup
  var chunks = getChunks(controller)
  var playback = controller.playback
  var shape = playback.shape()

  var rows = []
  for (var r=0;r<shape[0];r++){
    var buttons = []
    for (var c=0;c<shape[1];c++){      
      buttons.push(h('div.button', {
        'ev-dblclick': mercury.event(createChunk, {controller: controller, at: [r,c]})
      }))
    }
    rows.push(h('div.row', buttons))
  }

  return h('LoopGrid', {
    className: shape[1] > 16 ? '-min' : '',
    'ev-dragover': MPE(dragOver, controller),
    'ev-drop': MPE(drop, controller),
    'ev-dragleave': MPE(dragLeave, controller),
    'ev-dragenter': MPE(dragEnter, controller),
  }, [
    h('div.rows', {'ev-state': GridStateHook(controller.gridState)}, rows),
    h('div.chunks', chunks.map(function(chunk){
      return renderChunkBlock(chunk, controller)
    }))
  ])

}

function renderChunkBlock(chunk, controller){
  var setup = controller.context.setup
  var shape = controller.playback.shape()

  var selectedChunkId = setup.selectedChunkId()
  var box = {
    top: chunk.origin[0] / shape[0],
    bottom: (chunk.origin[0] + chunk.shape[0]) / shape[0],
    left: chunk.origin[1] / shape[1],
    right: (chunk.origin[1] + chunk.shape[1]) / shape[1]
  }

  var style = {
    'top': percent(box.top),
    'height': percent(box.bottom - box.top),
    'left': percent(box.left),
    'width': percent(box.right - box.left),
    'border-color': color(chunk.color, 1),
    'background-color': color(chunk.color, 0.1),
    'color': color(mixColor(chunk.color, [255,255,255]),1)
  }

  var node = setup.chunks.lookup.get(chunk.id)

  return h('div.chunk', { 
    className: selectedChunkId == chunk.id ? '-selected' : null, 
    style: style,
    draggable: true,
    'ev-click': mercury.event(selectChunk, { chunkId: chunk.id, controller: controller }),
    'ev-dblclick': mercury.event(editChunk, node),
    'ev-dragstart': MPE(startDrag, node),
    'ev-dragend': MPE(endDrag, node)
  },[
    h('span.label', chunk.id),
    //h('div.handle -top'),
    //h('div.handle -bottom'),
    //h('div.handle -left'),
    //h('div.handle -right'),
    h('div.handle -move')
  ])
}

function getChunks(controller){
  var context = controller.context
  var chunkPositions = controller.chunkPositions ? controller.chunkPositions() : {}
  var chunks = []
  for (var k in chunkPositions){

    var chunk = context.chunkLookup.get(k)

    if (chunk){
      var data = chunk()
      chunks.push({
        id: data.id,
        color: data.color,
        shape: data.shape,
        origin: chunkPositions[k]
      })
    }

  }
  return chunks
}

function startDrag(ev){
  window.currentDrag = ev
}

function endDrag(ev){
  window.currentDrag = null
}

var entering = null
function dragLeave(ev){
  var controller = ev.data
  if (window.currentDrag && (!entering || entering !== controller)){
    var chunkId = getId(currentDrag.data)
    if (chunkId){
      controller.chunkPositions.delete(chunkId)
    }
  }
}
function dragEnter(ev){
  entering = ev.data

  nextTick(function(){
    entering = null
  })
}

function getId(chunk){
  if (typeof chunk== 'function'){
    chunk = chunk()
  }

  if (chunk){
    return chunk.id
  }
}

function dragOver(ev){
  var controller = ev.data
  var currentDrag = window.currentDrag

  if (currentDrag){

    var chunkId = getId(currentDrag.data)

    if (chunkId){
      var shape = controller.playback.shape()
      var height = ev.offsetHeight / shape[0]
      var width = ev.offsetWidth / shape[1]

      var x = ev.offsetX - currentDrag.offsetX
      var y = ev.offsetY - currentDrag.offsetY

      var r = Math.round(y/width)
      var c = Math.round(x/width)

      var currentValue = controller.chunkPositions.get(chunkId)

      if (!currentValue || currentValue[0] !== r || currentValue[1] !== c){
        controller.chunkPositions.put(chunkId, [r,c])
      }
    }

    ev.dataTransfer.dropEffect = 'move'
    ev.event.preventDefault()  
  }

  if (~ev.dataTransfer.types.indexOf('filepath')){
    ev.dataTransfer.dropEffect = 'link'
    ev.event.preventDefault()
  }
}

function drop(ev){
  var path = ev.dataTransfer.getData('filepath')
  var controller = ev.data
  var setup = controller.context.setup

  if (path && setup && setup.chunks){
    var id = setup.resolveAvailableChunk(getBaseName(path, '.json'))
    setup.chunks.push({
      'node': 'external',
      'id': id,
      'src': setup.context.fileObject.relative(path),
      'minimised': true,
      'routes': {output: '$default'}
    })
    
    var shape = controller.playback.shape()
    var height = ev.offsetHeight / shape[0]
    var width = ev.offsetWidth / shape[1]
    var r = Math.floor(ev.offsetY/height)
    var c = Math.floor(ev.offsetX/width)
    controller.chunkPositions.put(id, [r,c])
  }
}

function getElementMouseOffset(offsetX, offsetY, clientX, clientY){
  return [clientX - offsetX, clientY - offsetY]
}

function getOffset(start, end, size){
  var difference = (end - start) / size
  return Math.round(difference)
}

function percent(decimal){
  return (decimal * 100) + '%'
}

function color(rgb, a){
  if (!Array.isArray(rgb)){
    rgb = [100,100,100]
  }
  return 'rgba(' + rgb[0] +','+rgb[1]+','+rgb[2]+','+a+')'
}

function mixColor(a, b){
  if (!Array.isArray(a)){
    return b
  }
  return [
    (a[0] + a[0] + b[0]) / 3,
    (a[1] + a[0] + b[1]) / 3,
    (a[2] + a[0] + b[2]) / 3
  ]
}

function editChunk(chunk){
  var context = chunk.context
  var descriptor = chunk()
  if (descriptor && descriptor.src){
    var path = context.project.resolve([context.cwd||'', descriptor.src])
    context.actions.open(path)
  }
}

function createChunk(target){
  var controller = target.controller
  var context = controller.context
  var actions = context.actions
  var setup = context.setup
  var project = context.project
  var fileObject = context.fileObject
  var at = target.at


  var path = fileObject.resolvePath('New Chunk.json')
  context.project.resolveAvailable(project.relative(path), function(err, src){
    actions.newChunk(project.resolve(src), function(err, src){
      var id = setup.resolveAvailableChunk(getBaseName(src, '.json'))
      setup.chunks.push({
        node: 'external',
        src: fileObject.relative(project.resolve(src)),
        id: id,
        minimised: true,
        scale: '$global',
        routes: {output: '$default'}
      })
      controller.chunkPositions.put(id, at)
      setup.selectedChunkId.set(id)
    }, 50)
  })
}

function selectChunk(target){
  var controller = target.controller
  var setup = controller.context.setup
  controller.grabInput && controller.grabInput()
  setup.selectedChunkId.set(target.chunkId)
}

//
//node.selectedChunkId&&node.selectedChunkId(function(id){
//  var src = null
//  if (state.selected() === object.path){
//    process.nextTick(actions.grabInputForSelected)
//  }
//})