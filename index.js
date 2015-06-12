
var gdal = require('gdal');

module.exports = {};
module.exports.reproject = reproject;

function getNoDataValues(src) {

  var bands = Array.apply(null, {length: src.bands.count()}).map(Number.call, Number);

  return bands.map(function(idx) {
    return src.bands.get(idx + 1).noDataValue;
  });

}

function getColorInterpretation(src) {

  var bands = Array.apply(null, {length: src.bands.count()}).map(Number.call, Number);

  return bands.map(function(idx) {
    return src.bands.get(idx + 1).colorInterpretation;
  });
}

function reproject(srcpath, dstpath) {

  var max_ram = 1500; //in MB, will use double the value: 1x GDAL_CACHE, 1x gdalwarp cache

  var cpus = require('os').cpus().length;
  var gdal_threads = cpus;

  process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, cpus * 1.5));
  gdal.config.set('GDAL_CACHEMAX', max_ram.toString());

  var src = gdal.open(srcpath);

  var bandCount = src.bands.count();
  var dataType = src.bands.get(1).dataType;

  var options = {
    src: src,
    s_srs: src.srs,
    t_srs: gdal.SpatialReference.fromEPSG(3857),
    memoryLimit: max_ram * 1024 * 1024,
    options: ['NUM_THREADS=' + gdal_threads.toString()]
  };

  var info = gdal.suggestedWarpOutput(options);

  var creationOptions = [
    'TILED=YES',
    'BLOCKXSIZE=512',
    'BLOCKYSIZE=512'
  ];

  options.dst = gdal.open(
    dstpath, 'w', 'GTiff',
    info.rasterSize.x, info.rasterSize.y,
    bandCount,
    dataType,
    creationOptions
  );

  options.dst.geoTransform = info.geoTransform;
  options.dst.srs = options.t_srs;

  gdal.reprojectImage(options);

  var colorInterps = getColorInterpretation(src);
  var noDataValues = getNoDataValues(src);

  options.dst.bands.forEach(function(band) {
    band.colorInterpretation = colorInterps[band.id - 1];
    band.noDataValue = noDataValues[band.id - 1];
  });

  src.close();
  options.dst.close();
}
