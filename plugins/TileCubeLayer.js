define(
[
  "dojo/_base/declare",
  "dojo/_base/connect",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/url",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/dom-style",
  "dojox/collections/ArrayList",
  "dojox/gfx/matrix",
  "dojo/has",
  "dojo/string",
  
  "esri/kernel",
  "esri/request",
  "esri/urlUtils",
  "esri/tileUtils",
  "esri/SpatialReference",
  "esri/geometry/Extent",
  "esri/geometry/Rect",
  
  "plugins/CanvasTileLayer",
  "queue"
],
function(
  declare, connection, lang, array, Url, domConstruct, domClass, domGeom, domStyle,
  ArrayList, gfxMatrix, has, string,
  esriNS, esriRequest, urlUtils, tileUtils, SpatialReference, Extent, Rect,
  CanvasTileLayer, queue
) {

var TileCubeLayer = declare(CanvasTileLayer, {
  declaredClass: "esri.layers.TileCubeLayer",
  
  constructor: function ( urlTemplate, options) {
    this.inherited(arguments);
    this.tileQ = queue(4);
    this.temporal = (options.temporal === false) ? false : true;
    this.timeIndex = options.startTime || 10;
    this.style = options.style; 
    this.buffer = options.buffer || 20; 

    this.sprites = {};
  },

  // override this method to create canvas elements instead of img
  _addImage: function(level, row, r, col, c, id, tileW, tileH, opacity, tile, offsets){
    this.inherited(arguments);
  },

  _loadTile: function(id, level, r, c, element){
    var self = this;
    //if (!this._tileData[id]){

      this._getTile(this.getTileUrl(level, r, c), function(err, tileJson){
        if (!err && tileJson){
          try {
            self.tileQ.defer(function(id, callback){
              setTimeout(function() {
                try {
                  self._render(element, tileJson, function(){
                    callback(null, null);
                  });  
                } catch(e) {
                  callback(null, null);
                }
              }, 25);
            }, id);
           // for saving data, store the tile and layers
           self._tileData[id] = tileJson;
          } catch(e){
             
          }
        }
      });
    //} else {
    //  self._render(element, this._tileData[id], function(){});
    //}
    self._loadingList.remove(id);
    self._fireOnUpdateEvent();
  },

  _getTile: function(url, callback){
    var self = this;
    var _xhr = new XMLHttpRequest();
    _xhr.open( "GET", url, true );
    _xhr.responseType = "application/json";
    _xhr.onload = function( evt ) {
      try { 
        var json = JSON.parse(_xhr.response);
        if ( json ) {
          self._processData(json, callback);   
        }
      } catch(e){
        //console.log(e);
      }
     }
     _xhr.send(null);
  },

  _processData: function(json, callback){
    var tile = {
      histogram: {}
    };
    for (var i=0; i < json.length; i++){
      var pixel = json[i];
      for (var j=0; j < pixel.t.length; j++){

        var time = pixel.t[j];
        var val = pixel.v[j];

        if (!tile.histogram[val]){
          tile.histogram[val] = 0;
        }
        tile.histogram[val]++;
 
        if (!tile[time]){
          tile[time] = []
        }
        tile[time].push({
          x: pixel.x,
          y: pixel.y,
          v: val
        });
      }
    }
    callback(null, tile);
  },

  _update: function( styles ){
    this.styles = styles;
    this.sprites = {};
    for (var id in this._tileData){
      this._render( this._tileDom[id], this._tileData[id], function(){} );
    }
  },

  _render: function(canvas, tile, callback){
    var start = Date.now();
    var self = this;
    var context = canvas.getContext('2d');
    var width = canvas.width, height=canvas.height;
    //console.log(width, height);

    context.clearRect(0, 0, width, height);

    if (this.hidpi) {
      width *= (1/window.devicePixelRatio);
      height *= (1/window.devicePixelRatio);
    }

    if ( this.temporal === true ) {
      var time = self.timeIndex;
      for (var t = 0; t < time; t++){
        if ( tile[t] ) {
          for (var i = 0; i < tile[t].length; i++){
            this._renderPoint( tile[t][i], context);
          }
        }
      }
    } else {
      
      for (var time in tile){
        // parse the renderer into a fill
        for (var i = 0; i < tile[time].length; i++){
          this._renderPoint( tile[time][i], context); 
        }
      }
    }
    callback();
  },

  _renderPoint: function(point, context){
    if ( !this.sprites[point.v] ) {
      this._generateSprite(point);
    }

    var x = parseInt(point.x);
    var y = parseInt(point.y);
    if ( this.hidpi ) {
      x *= 2;
      y *= 2;
    }

    x += this.buffer;
    y += this.buffer;
    var xOff = this.sprites[point.v].width/2;
    var yOff = this.sprites[point.v].height/2;
    //console.log(xOff, yOff)
    context.drawImage(this.sprites[point.v], x-xOff, y-yOff);    

  },

  _generateSprite: function(point) {
    var style = this.style(parseInt(point.v));
    var r = style.radius;

    var canvas = document.createElement('canvas');
    canvas.width = style.radius * 2;
    canvas.height = style.radius * 2;
    var context = canvas.getContext('2d');

    context.beginPath();
    context.arc(r, r, r, 0, 2 * Math.PI, false);
    context.fillStyle = style.fillStyle || 'rgb(100,100,125)';
    context.fill();
    context.lineWidth = style.lineWidth || 0.8;
    context.strokeStyle = style.strokeStyle || 'rgb(240,240,240)';
    context.stroke();
    
    this.sprites[point.v] = canvas;
  }


});

if (has("extend-esri")) {
  lang.setObject("layers.TileCubeLayer", TileCubeLayer, esriNS);
}

return TileCubeLayer;  
});
